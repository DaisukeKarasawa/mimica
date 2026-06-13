import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  AgentMode,
  AgentQuestionAnswerPayload,
  AvatarState,
  ChatAttachment,
  ChatMessage,
  EditorContext,
} from "@mimica/shared";
import { DEFAULT_SETTINGS, resolveCharacterShortNameEn } from "@mimica/shared";
import { CharacterDirector } from "@mimica/character-runtime";
import { TopBar } from "./components/TopBar";
import { CharacterStage } from "./components/CharacterStage";
import { ChatPanel } from "./components/ChatPanel";
import { MainSplitLayout } from "./components/MainSplitLayout";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useCharacterAssets } from "./hooks/useCharacterAssets";
import { useSessionTabs } from "./hooks/useSessionTabs";
import { matchChatTabShortcut, type ChatTabShortcutAction } from "./lib/chatTabShortcuts";

export default function App() {
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const characterAssets = useCharacterAssets();
  const [splitLayoutReady, setSplitLayoutReady] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>(DEFAULT_SETTINGS.defaultAgentMode);
  const [tabsBarVisible, setTabsBarVisible] = useState(true);

  const resetStreamRef = useRef<() => void>(() => {});
  const workspaceSyncInFlight = useRef(new Set<string>());

  const director = useMemo(() => new CharacterDirector({ onStateChange: setAvatarState }), []);

  const characterShortName = useMemo(
    () => resolveCharacterShortNameEn(characterAssets?.metadata),
    [characterAssets?.metadata],
  );

  const handleStopStreaming = useCallback(async () => {
    await window.mimica.cancelAgent();
    setIsStreaming(false);
    resetStreamRef.current();
  }, []);

  const tabs = useSessionTabs({
    isStreaming,
    onStopStreaming: handleStopStreaming,
  });

  const { handleAgentEvent, resetStream, beginStream } = useAgentEvents({
    director,
    setAllSessions: tabs.setAllSessions,
    setIsStreaming,
  });

  resetStreamRef.current = resetStream;

  const linkedWorkspacePath = editorContext?.workspacePath ?? null;

  useEffect(() => {
    const unsubCtx = window.mimica.onEditorContext(setEditorContext);
    const unsubAgent = window.mimica.onAgentEvent(handleAgentEvent);
    return () => {
      unsubCtx();
      unsubAgent();
    };
  }, [handleAgentEvent]);

  // First launch: auto-open a draft tab once Cursor links a workspace (⌘T is easy to miss).
  useEffect(() => {
    if (!linkedWorkspacePath || tabs.openTabIds.length > 0) return;
    void tabs.handleNewSession(linkedWorkspacePath);
  }, [linkedWorkspacePath, tabs.openTabIds.length, tabs.handleNewSession]);

  useEffect(() => {
    if (!linkedWorkspacePath) return;
    const sessionId = tabs.activeSession?.id;
    if (!sessionId || tabs.activeSession?.workspacePath === linkedWorkspacePath) return;
    if (workspaceSyncInFlight.current.has(sessionId)) return;

    workspaceSyncInFlight.current.add(sessionId);
    void (async () => {
      try {
        const list = await window.mimica.listSessions();
        const current = list.find((s) => s.id === sessionId);
        if (!current || current.workspacePath === linkedWorkspacePath) return;

        const saved = await window.mimica.saveSession({
          ...current,
          workspacePath: linkedWorkspacePath,
        });
        tabs.setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } finally {
        workspaceSyncInFlight.current.delete(sessionId);
      }
    })();
  }, [
    linkedWorkspacePath,
    tabs.activeSession?.id,
    tabs.activeSession?.workspacePath,
    tabs.setAllSessions,
  ]);

  const resolveWorkspacePath = useCallback(
    () => linkedWorkspacePath ?? tabs.activeSession?.workspacePath ?? null,
    [linkedWorkspacePath, tabs.activeSession?.workspacePath],
  );

  const applyChatTabShortcut = useCallback(
    (action: ChatTabShortcutAction) => {
      if (typeof action === "object" && action.type === "selectTab") {
        tabs.selectTabByIndex(action.index);
        return;
      }

      switch (action) {
        case "new": {
          const workspacePath = resolveWorkspacePath();
          if (workspacePath) {
            void tabs.handleNewSession(workspacePath);
          }
          break;
        }
        case "close": {
          const target =
            tabs.activeSessionId && tabs.openTabIds.includes(tabs.activeSessionId)
              ? tabs.activeSessionId
              : tabs.openTabIds[tabs.openTabIds.length - 1];
          if (target) void tabs.handleCloseTab(target);
          break;
        }
        case "next":
          tabs.cycleTab(1);
          break;
        case "prev":
          tabs.cycleTab(-1);
          break;
        case "history":
          tabs.setPanelMode(tabs.panelMode === "history" ? "chat" : "history");
          break;
        case "tabsBar":
          setTabsBarVisible((visible) => !visible);
          break;
      }
    },
    [
      resolveWorkspacePath,
      tabs.activeSessionId,
      tabs.openTabIds,
      tabs.handleNewSession,
      tabs.handleCloseTab,
      tabs.cycleTab,
      tabs.selectTabByIndex,
      tabs.panelMode,
      tabs.setPanelMode,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchChatTabShortcut(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      applyChatTabShortcut(action);
    };

    window.addEventListener("keydown", onKeyDown, true);
    const unsubShortcut = window.mimica.onChatTabShortcut(applyChatTabShortcut);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      unsubShortcut();
    };
  }, [applyChatTabShortcut]);

  const handleSend = async (content: string, attachments?: ChatAttachment[]) => {
    const workspacePath = resolveWorkspacePath();
    if (!workspacePath) return;

    let session = tabs.activeSession;
    if (!session) {
      session = await tabs.handleNewSession(workspacePath);
    }

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      context: editorContext ?? undefined,
      attachments: attachments?.length ? attachments : undefined,
    };
    let title = session.title;
    if (session.messages.length === 0) {
      const titleSource = content.trim() || (attachments?.length ? "Image" : "");
      title = titleSource.slice(0, 24) + (titleSource.length > 24 ? "…" : "");
    }
    const updated = {
      ...session,
      title,
      workspacePath,
      messages: [...session.messages, userMsg],
    };
    const saved = await window.mimica.saveSession(updated);
    tabs.setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));

    beginStream();
    setIsStreaming(true);
    try {
      await window.mimica.submitAgent({
        sessionId: saved.id,
        content,
        workspacePath,
        mode: agentMode,
        editorContext,
        attachments,
      });
    } catch {
      setIsStreaming(false);
      resetStreamRef.current();
      director.setState("idle");
    }
  };

  const handleCancel = async () => {
    await handleStopStreaming();
    director.setState("idle");
  };

  const handleQuestionAnswer = async (runId: string, payload: AgentQuestionAnswerPayload) => {
    const session = tabs.activeSession;
    if (!session || !runId) return;
    beginStream();
    setIsStreaming(true);
    try {
      const saved = await window.mimica.answerAgentQuestion({
        sessionId: session.id,
        runId,
        mode: agentMode,
        payload,
      });
      tabs.setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } catch {
      setIsStreaming(false);
      resetStreamRef.current();
      director.setState("idle");
    }
  };

  const handleQuestionDismiss = async (runId: string, questionPromptId: string) => {
    const session = tabs.activeSession;
    if (!session || !runId) return;
    try {
      const saved = await window.mimica.dismissAgentQuestion({
        sessionId: session.id,
        runId,
        questionPromptId,
      });
      tabs.setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app">
      <TopBar />
      <MainSplitLayout
        onSplitReady={() => setSplitLayoutReady(true)}
        stage={
          <CharacterStage
            avatarState={avatarState}
            assets={characterAssets}
            layoutReady={splitLayoutReady}
          />
        }
        chat={
          <ChatPanel
            openSessions={tabs.openSessions}
            historySessions={tabs.historySessions}
            activeSessionId={tabs.activeSessionId}
            activeSession={tabs.activeSession}
            panelMode={tabs.panelMode}
            tabsBarVisible={tabsBarVisible}
            isStreaming={isStreaming}
            avatarState={avatarState}
            agentMode={agentMode}
            characterShortName={characterShortName}
            workspacePath={resolveWorkspacePath()}
            onAgentModeChange={setAgentMode}
            chatIconUrl={characterAssets?.chatIconUrl}
            onSelectSession={(id) => {
              tabs.setActiveSessionId(id);
              tabs.setPanelMode("chat");
            }}
            onCloseTab={(id) => void tabs.handleCloseTab(id)}
            onReorderTab={tabs.reorderOpenTab}
            onSelectHistorySession={tabs.openSessionTab}
            onDeleteSession={(id) => void tabs.handleDeleteSession(id)}
            onSend={(text, attachments) => void handleSend(text, attachments)}
            onCancel={() => void handleCancel()}
            onQuestionAnswer={handleQuestionAnswer}
            onQuestionDismiss={handleQuestionDismiss}
          />
        }
      />
    </div>
  );
}

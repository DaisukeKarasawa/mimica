import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  AgentMode,
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
import { useMessageQueue } from "./hooks/useMessageQueue";
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
  const drainInFlightRef = useRef(false);
  const onRunSettledRef = useRef<(sessionId: string) => void>(() => {});
  const messageQueue = useMessageQueue();

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
    onRunSettled: (sessionId) => onRunSettledRef.current(sessionId),
  });

  resetStreamRef.current = resetStream;

  const submitToAgent = useCallback(
    async (params: {
      sessionId: string;
      content: string;
      workspacePath: string;
      mode: AgentMode;
      editorContext?: EditorContext | null;
      attachments?: ChatAttachment[];
    }) => {
      beginStream();
      setIsStreaming(true);
      try {
        await window.mimica.submitAgent({
          sessionId: params.sessionId,
          content: params.content,
          workspacePath: params.workspacePath,
          mode: params.mode,
          editorContext: params.editorContext ?? undefined,
          attachments: params.attachments,
        });
      } catch {
        setIsStreaming(false);
        resetStreamRef.current();
        director.setState("idle");
      }
    },
    [beginStream, director],
  );

  const drainQueue = useCallback(
    async (sessionId: string) => {
      if (drainInFlightRef.current) return;
      const next = messageQueue.dequeue(sessionId);
      if (!next) return;

      drainInFlightRef.current = true;
      try {
        await submitToAgent({
          sessionId,
          content: next.content,
          workspacePath: next.workspacePath,
          mode: next.agentMode,
          editorContext: next.editorContext,
          attachments: next.attachments,
        });
      } finally {
        drainInFlightRef.current = false;
      }
    },
    [messageQueue, submitToAgent],
  );

  useEffect(() => {
    onRunSettledRef.current = (sessionId) => {
      void drainQueue(sessionId);
    };
  }, [drainQueue]);

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

    const shouldQueue = isStreaming && tabs.activeSessionId === saved.id;
    if (shouldQueue) {
      messageQueue.enqueue(saved.id, {
        content,
        attachments,
        editorContext,
        agentMode,
        workspacePath,
      });
      return;
    }

    await submitToAgent({
      sessionId: saved.id,
      content,
      workspacePath,
      mode: agentMode,
      editorContext,
      attachments,
    });
  };

  const handleCancel = async () => {
    await handleStopStreaming();
    director.setState("idle");
  };

  const handleCloseTab = (id: string) => {
    messageQueue.clear(id);
    void tabs.handleCloseTab(id);
  };

  const handleDeleteSession = (id: string) => {
    messageQueue.clear(id);
    void tabs.handleDeleteSession(id);
  };

  const queuedCount = messageQueue.getQueueSize(tabs.activeSessionId);

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
            queuedCount={queuedCount}
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
            onCloseTab={handleCloseTab}
            onReorderTab={tabs.reorderOpenTab}
            onSelectHistorySession={tabs.openSessionTab}
            onDeleteSession={handleDeleteSession}
            onSend={(text, attachments) => void handleSend(text, attachments)}
            onCancel={() => void handleCancel()}
          />
        }
      />
    </div>
  );
}

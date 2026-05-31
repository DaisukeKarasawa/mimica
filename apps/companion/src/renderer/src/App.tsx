import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  AgentMode,
  AvatarState,
  ChatMessage,
  CharacterAssetStatus,
  EditorContext,
} from "@mimica/shared";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WORKSPACE_FALLBACK,
  resolveCharacterShortNameEn,
} from "@mimica/shared";
import { CharacterDirector } from "@mimica/character-runtime";
import { TopBar } from "./components/TopBar";
import { CharacterStage } from "./components/CharacterStage";
import { ChatPanel } from "./components/ChatPanel";
import { MainSplitLayout } from "./components/MainSplitLayout";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useSessionTabs } from "./hooks/useSessionTabs";
import { matchChatTabShortcut, type ChatTabShortcutAction } from "./lib/chatTabShortcuts";

export default function App() {
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>(DEFAULT_SETTINGS.defaultAgentMode);
  const [tabsBarVisible, setTabsBarVisible] = useState(true);

  const resetStreamRef = useRef<() => void>(() => {});

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

  const resolveWorkspacePath = useCallback(
    () => editorContext?.workspacePath ?? DEFAULT_WORKSPACE_FALLBACK,
    [editorContext?.workspacePath],
  );

  useEffect(() => {
    void window.mimica.getCharacterAssets().then(setCharacterAssets);
    const unsubCtx = window.mimica.onEditorContext(setEditorContext);
    const unsubAgent = window.mimica.onAgentEvent(handleAgentEvent);
    return () => {
      unsubCtx();
      unsubAgent();
    };
  }, [handleAgentEvent]);

  const applyChatTabShortcut = useCallback(
    (action: ChatTabShortcutAction) => {
      if (typeof action === "object" && action.type === "selectTab") {
        tabs.selectTabByIndex(action.index);
        return;
      }

      switch (action) {
        case "new":
          void tabs.handleNewSession(resolveWorkspacePath());
          break;
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

  const handleSend = async (content: string) => {
    let session = tabs.activeSession;
    if (!session) {
      session = await tabs.handleNewSession(resolveWorkspacePath());
    }

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      context: editorContext ?? undefined,
    };
    let title = session.title;
    if (session.messages.length === 0) {
      title = content.slice(0, 24) + (content.length > 24 ? "…" : "");
    }
    const updated = {
      ...session,
      title,
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
        workspacePath: saved.workspacePath,
        mode: agentMode,
        editorContext,
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

  return (
    <div className="app">
      <TopBar />
      <MainSplitLayout
        stage={<CharacterStage avatarState={avatarState} assets={characterAssets} />}
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
            onSend={(text) => void handleSend(text)}
            onCancel={() => void handleCancel()}
          />
        }
      />
    </div>
  );
}

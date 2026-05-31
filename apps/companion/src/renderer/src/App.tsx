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
  AGENT_DISPLAY_NAME,
  avatarStatusLabel,
  DEFAULT_SETTINGS,
  DEFAULT_WORKSPACE_FALLBACK,
} from "@mimica/shared";
import { CharacterDirector } from "@mimica/character-runtime";
import { TopBar } from "./components/TopBar";
import { CharacterStage } from "./components/CharacterStage";
import { ChatPanel } from "./components/ChatPanel";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useBridgeStatus } from "./hooks/useBridgeStatus";
import { useSessionTabs } from "./hooks/useSessionTabs";
import { matchChatTabShortcut } from "./lib/chatTabShortcuts";

export default function App() {
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState(avatarStatusLabel("idle"));
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus | null>(null);
  const [devPreview, setDevPreview] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>(DEFAULT_SETTINGS.defaultAgentMode);

  const resetStreamRef = useRef<() => void>(() => {});

  const bridgeConnected = useBridgeStatus();
  const director = useMemo(() => new CharacterDirector({ onStateChange: setAvatarState }), []);

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
    devPreview,
    director,
    setAllSessions: tabs.setAllSessions,
    setIsStreaming,
    setStatusText,
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchChatTabShortcut(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();

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
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    resolveWorkspacePath,
    tabs.activeSessionId,
    tabs.openTabIds,
    tabs.handleNewSession,
    tabs.handleCloseTab,
    tabs.cycleTab,
  ]);

  const handleSend = async (content: string) => {
    if (devPreview) setDevPreview(false);

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
    await window.mimica.submitAgent({
      sessionId: saved.id,
      content,
      workspacePath: saved.workspacePath,
      mode: agentMode,
      editorContext,
    });
  };

  const handleCancel = async () => {
    await handleStopStreaming();
    director.setState("idle", true);
    setStatusText("キャンセルしました");
  };

  const handlePreviewState = (state: AvatarState) => {
    setDevPreview(true);
    director.setState(state, true);
    setStatusText(`手動: ${avatarStatusLabel(state)}`);
  };

  return (
    <div className="app">
      <TopBar connected={bridgeConnected} agentMode={agentMode} />
      <main className="main">
        <CharacterStage
          avatarState={avatarState}
          statusText={statusText}
          agentName={AGENT_DISPLAY_NAME}
          assets={characterAssets}
          onPreviewState={handlePreviewState}
        />
        <ChatPanel
          openSessions={tabs.openSessions}
          historySessions={tabs.allSessions}
          activeSessionId={tabs.activeSessionId}
          activeSession={tabs.activeSession}
          panelMode={tabs.panelMode}
          editorContext={editorContext}
          isStreaming={isStreaming}
          avatarState={avatarState}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          chatIconUrl={characterAssets?.chatIconUrl}
          onSelectSession={(id) => {
            tabs.setActiveSessionId(id);
            tabs.setPanelMode("chat");
          }}
          onCloseTab={(id) => void tabs.handleCloseTab(id)}
          onShowHistory={() => tabs.setPanelMode("history")}
          onSelectHistorySession={tabs.openSessionTab}
          onDeleteSession={(id) => void tabs.handleDeleteSession(id)}
          onNewSession={() => void tabs.handleNewSession(resolveWorkspacePath())}
          onSend={(text) => void handleSend(text)}
          onCancel={() => void handleCancel()}
        />
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AvatarState, ChatMessage, ChatSession, EditorContext } from "@mimica/shared";
import { AGENT_DISPLAY_NAME, avatarStatusLabel } from "@mimica/shared";
import { CharacterDirector } from "@mimica/character-runtime";
import type { CharacterAssetStatus } from "../../preload/index";
import { TopBar } from "./components/TopBar";
import { CharacterStage } from "./components/CharacterStage";
import { ChatPanel, type ChatPanelMode } from "./components/ChatPanel";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { matchChatTabShortcut } from "./lib/chatTabShortcuts";
import { loadOpenTabIds, persistOpenTabIds } from "./lib/openTabs";

export default function App() {
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => loadOpenTabIds());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<ChatPanelMode>("chat");
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState(avatarStatusLabel("idle"));
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus | null>(null);
  const [devPreview, setDevPreview] = useState(false);

  const director = useMemo(
    () => new CharacterDirector({ onStateChange: setAvatarState }),
    [],
  );

  const { handleAgentEvent, resetStream, beginStream } = useAgentEvents({
    devPreview,
    director,
    setAllSessions,
    setIsStreaming,
    setStatusText,
  });

  const openSessions = useMemo(
    () =>
      openTabIds
        .map((id) => allSessions.find((s) => s.id === id))
        .filter((s): s is ChatSession => s !== undefined),
    [openTabIds, allSessions],
  );

  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? null;

  const setOpenTabs = useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    setOpenTabIds((prev) => {
      const next = typeof ids === "function" ? ids(prev) : ids;
      persistOpenTabIds(next);
      return next;
    });
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await window.mimica.listSessions();
    setAllSessions(list);

    setOpenTabIds((prev) => {
      const pruned = prev.filter((id) => list.some((s) => s.id === id));
      if (pruned.length !== prev.length) persistOpenTabIds(pruned);
      return pruned;
    });
  }, []);

  useEffect(() => {
    void refreshSessions();
    void window.mimica.getBridgeStatus().then((s) => setBridgeConnected(s.connected));
    void window.mimica.getCharacterAssets().then(setCharacterAssets);
    const interval = setInterval(() => {
      void window.mimica.getBridgeStatus().then((s) => setBridgeConnected(s.connected));
    }, 3000);
    const unsubCtx = window.mimica.onEditorContext(setEditorContext);
    const unsubAgent = window.mimica.onAgentEvent(handleAgentEvent);
    return () => {
      clearInterval(interval);
      unsubCtx();
      unsubAgent();
    };
  }, [refreshSessions, handleAgentEvent]);

  useEffect(() => {
    if (allSessions.length === 0 || openTabIds.length > 0) return;
    const id = allSessions[0].id;
    setOpenTabs([id]);
    if (!activeSessionId) setActiveSessionId(id);
  }, [allSessions, openTabIds.length, activeSessionId, setOpenTabs]);

  useEffect(() => {
    if (panelMode !== "chat") return;
    if (activeSessionId && openTabIds.includes(activeSessionId)) return;
    const next = openTabIds[openTabIds.length - 1] ?? null;
    setActiveSessionId(next);
  }, [panelMode, activeSessionId, openTabIds]);

  const openSessionTab = useCallback(
    (id: string) => {
      setOpenTabs(openTabIds.includes(id) ? openTabIds : [...openTabIds, id]);
      setActiveSessionId(id);
      setPanelMode("chat");
    },
    [openTabIds, setOpenTabs],
  );

  const handleNewSession = useCallback(async () => {
    const ws = editorContext?.workspacePath ?? "~/dev/mimica";
    const session = await window.mimica.createSession(ws);
    await refreshSessions();
    setOpenTabs((prev) => [...prev, session.id]);
    setActiveSessionId(session.id);
    setPanelMode("chat");
  }, [editorContext?.workspacePath, refreshSessions, setOpenTabs]);

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      if (openTabIds.length === 0) return;
      setPanelMode("chat");
      setActiveSessionId((prev) => {
        const idx = prev ? openTabIds.indexOf(prev) : -1;
        let next = idx + direction;
        if (next < 0) next = openTabIds.length - 1;
        if (next >= openTabIds.length) next = 0;
        return openTabIds[next] ?? null;
      });
    },
    [openTabIds],
  );

  const handleCloseTab = useCallback(async (id: string) => {
    if (isStreaming && activeSessionId === id) {
      await window.mimica.cancelAgent();
      setIsStreaming(false);
      resetStream();
    }
    const nextIds = openTabIds.filter((tabId) => tabId !== id);
    setOpenTabs(nextIds);
    if (activeSessionId === id) {
      setActiveSessionId(nextIds[nextIds.length - 1] ?? null);
    }
  }, [activeSessionId, isStreaming, openTabIds, resetStream, setOpenTabs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchChatTabShortcut(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();

      switch (action) {
        case "new":
          void handleNewSession();
          break;
        case "close": {
          const target =
            activeSessionId && openTabIds.includes(activeSessionId)
              ? activeSessionId
              : openTabIds[openTabIds.length - 1];
          if (target) void handleCloseTab(target);
          break;
        }
        case "next":
          cycleTab(1);
          break;
        case "prev":
          cycleTab(-1);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeSessionId, openTabIds, handleNewSession, handleCloseTab, cycleTab]);

  const handleDeleteSession = async (id: string) => {
    if (isStreaming && activeSessionId === id) {
      await window.mimica.cancelAgent();
      setIsStreaming(false);
      resetStream();
    }
    await window.mimica.deleteSession(id);
    const nextIds = openTabIds.filter((tabId) => tabId !== id);
    setOpenTabs(nextIds);
    if (activeSessionId === id) {
      setActiveSessionId(nextIds[nextIds.length - 1] ?? null);
    }
    await refreshSessions();
  };

  const handleSend = async (content: string) => {
    if (devPreview) setDevPreview(false);

    let session = activeSession;
    if (!session) {
      const ws = editorContext?.workspacePath ?? "~/dev/mimica";
      session = await window.mimica.createSession(ws);
      setOpenTabs([...openTabIds, session.id]);
      setActiveSessionId(session.id);
      await refreshSessions();
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
    const updated: ChatSession = {
      ...session,
      title,
      messages: [...session.messages, userMsg],
    };
    const saved = await window.mimica.saveSession(updated);
    setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));

    beginStream();
    director.setState("thinking", true);
    setIsStreaming(true);
    setStatusText(avatarStatusLabel("thinking"));

    await window.mimica.submitAgent({
      sessionId: saved.id,
      content,
      workspacePath: saved.workspacePath,
      editorContext,
    });
  };

  const handleCancel = async () => {
    await window.mimica.cancelAgent();
    setIsStreaming(false);
    resetStream();
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
      <TopBar connected={bridgeConnected} agentMode="agent" />
      <main className="main">
        <CharacterStage
          avatarState={avatarState}
          statusText={statusText}
          agentName={AGENT_DISPLAY_NAME}
          assets={characterAssets}
          onPreviewState={handlePreviewState}
        />
        <ChatPanel
          openSessions={openSessions}
          historySessions={allSessions}
          activeSessionId={activeSessionId}
          activeSession={activeSession}
          panelMode={panelMode}
          editorContext={editorContext}
          isStreaming={isStreaming}
          avatarState={avatarState}
          chatIconUrl={characterAssets?.chatIconUrl}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            setPanelMode("chat");
          }}
          onCloseTab={(id) => void handleCloseTab(id)}
          onShowHistory={() => setPanelMode("history")}
          onSelectHistorySession={openSessionTab}
          onDeleteSession={(id) => void handleDeleteSession(id)}
          onNewSession={() => void handleNewSession()}
          onSend={(text) => void handleSend(text)}
          onCancel={() => void handleCancel()}
        />
      </main>
    </div>
  );
}

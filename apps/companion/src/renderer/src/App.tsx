import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentMode, AvatarState, EditorContext } from "@mimica/shared";
import { DEFAULT_SETTINGS, mapAgentRunToAvatar, resolveCharacterShortNameEn } from "@mimica/shared";
import { CharacterDirector } from "@mimica/character-runtime";
import { TopBar } from "./components/TopBar";
import { CharacterStage } from "./components/CharacterStage";
import { ChatPanel } from "./components/ChatPanel";
import { MainSplitLayout } from "./components/MainSplitLayout";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useAgentSubmitQueue } from "./hooks/useAgentSubmitQueue";
import { useCharacterAssets } from "./hooks/useCharacterAssets";
import { useSessionRunStates } from "./hooks/useSessionRunStates";
import { useSessionTabs } from "./hooks/useSessionTabs";
import { isSessionRunActive } from "./lib/sessionRunState";
import { matchChatTabShortcut, type ChatTabShortcutAction } from "./lib/chatTabShortcuts";

export default function App() {
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const characterAssets = useCharacterAssets();
  const [splitLayoutReady, setSplitLayoutReady] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>(DEFAULT_SETTINGS.defaultAgentMode);
  const [tabsBarVisible, setTabsBarVisible] = useState(true);

  const resetStreamRef = useRef<(sessionId?: string) => void>(() => {});
  const onRunSettledRef = useRef<(sessionId: string) => void>(() => {});
  const workspaceSyncInFlight = useRef(new Set<string>());

  const sessionRuns = useSessionRunStates();
  const director = useMemo(() => new CharacterDirector({ onStateChange: setAvatarState }), []);

  const characterShortName = useMemo(
    () => resolveCharacterShortNameEn(characterAssets?.metadata),
    [characterAssets?.metadata],
  );

  const handleStopStreaming = useCallback(
    async (sessionId: string) => {
      const run = sessionRuns.getSessionRun(sessionId);
      await window.mimica.cancelAgent({ sessionId, runId: run.runId });
      sessionRuns.clearSessionRun(sessionId);
      resetStreamRef.current(sessionId);
    },
    [sessionRuns],
  );

  const tabs = useSessionTabs({
    isSessionRunning: (sessionId) => sessionRuns.isSessionRunActiveById(sessionId),
    onStopStreaming: handleStopStreaming,
  });

  const registerOnRunSettled = useCallback((handler: (sessionId: string) => void) => {
    onRunSettledRef.current = handler;
  }, []);

  const { handleAgentEvent, resetStream, beginStream } = useAgentEvents({
    director,
    setAllSessions: tabs.setAllSessions,
    setSessionRun: sessionRuns.setSessionRun,
    clearSessionRun: sessionRuns.clearSessionRun,
    activeSessionId: tabs.activeSessionId,
    onRunSettled: (sessionId) => onRunSettledRef.current(sessionId),
  });

  resetStreamRef.current = resetStream;

  const resolveWorkspacePath = useCallback(
    () => editorContext?.workspacePath ?? tabs.activeSession?.workspacePath ?? null,
    [editorContext?.workspacePath, tabs.activeSession?.workspacePath],
  );

  const { handleSend, clearQueueForSession, queuedCount, submitError, clearSubmitError } =
    useAgentSubmitQueue({
      director,
      beginStream,
      resetStream,
      setSessionRun: sessionRuns.setSessionRun,
      clearSessionRun: sessionRuns.clearSessionRun,
      isSessionRunning: (sessionId) => sessionRuns.isSessionRunActiveById(sessionId),
      onRunSettled: registerOnRunSettled,
      activeSessionId: tabs.activeSessionId,
      activeSession: tabs.activeSession,
      agentMode,
      editorContext,
      resolveWorkspacePath,
      setAllSessions: tabs.setAllSessions,
      handleNewSession: tabs.handleNewSession,
    });

  const activeSessionRun = sessionRuns.getSessionRun(tabs.activeSessionId);
  const isActiveSessionStreaming = isSessionRunActive(activeSessionRun);

  useEffect(() => {
    if (!tabs.activeSessionId) {
      director.setState("idle");
      return;
    }
    const run = sessionRuns.getSessionRun(tabs.activeSessionId);
    if (!isSessionRunActive(run)) {
      director.setState("idle");
      return;
    }
    director.setState(
      run.status === "streaming"
        ? mapAgentRunToAvatar("streaming")
        : mapAgentRunToAvatar("thinking"),
    );
  }, [director, sessionRuns.runs, tabs.activeSessionId, sessionRuns.getSessionRun]);

  const handleCloseTab = useCallback(
    (id: string) => {
      clearQueueForSession(id);
      void tabs.handleCloseTab(id);
    },
    [clearQueueForSession, tabs.handleCloseTab],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      clearQueueForSession(id);
      void tabs.handleDeleteSession(id);
    },
    [clearQueueForSession, tabs.handleDeleteSession],
  );

  const linkedWorkspacePath = editorContext?.workspacePath ?? null;

  useEffect(() => {
    const unsubCtx = window.mimica.onEditorContext(setEditorContext);
    const unsubAgent = window.mimica.onAgentEvent(handleAgentEvent);
    return () => {
      unsubCtx();
      unsubAgent();
    };
  }, [handleAgentEvent]);

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
          if (target) handleCloseTab(target);
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
      handleCloseTab,
      resolveWorkspacePath,
      tabs.activeSessionId,
      tabs.openTabIds,
      tabs.handleNewSession,
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

  const handleCancel = async () => {
    if (!tabs.activeSessionId) return;
    await handleStopStreaming(tabs.activeSessionId);
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
            isStreaming={isActiveSessionStreaming}
            activeSessionRunStatus={activeSessionRun.status}
            queuedCount={queuedCount}
            submitError={submitError}
            onClearSubmitError={clearSubmitError}
            avatarState={avatarState}
            agentMode={agentMode}
            characterShortName={characterShortName}
            workspacePath={resolveWorkspacePath()}
            onAgentModeChange={setAgentMode}
            chatIconUrl={characterAssets?.chatIconUrl}
            onSelectSession={(id) => {
              tabs.setActiveSessionId(id);
              tabs.setPanelMode("chat");
              clearSubmitError();
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

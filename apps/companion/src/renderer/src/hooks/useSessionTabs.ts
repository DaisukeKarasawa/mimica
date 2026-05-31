import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatPanelMode } from "../components/ChatPanel";
import type { ChatSession } from "@mimica/shared";
import { loadOpenTabIds, persistOpenTabIds } from "../lib/openTabs";

export interface UseSessionTabsOptions {
  isStreaming: boolean;
  onStopStreaming: () => Promise<void>;
}

export function useSessionTabs(options: UseSessionTabsOptions) {
  const { isStreaming, onStopStreaming } = options;

  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => loadOpenTabIds());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<ChatPanelMode>("chat");

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
  }, [refreshSessions]);

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

  const stopStreamingIfActive = useCallback(
    async (sessionId: string) => {
      if (isStreaming && activeSessionId === sessionId) {
        await onStopStreaming();
      }
    },
    [activeSessionId, isStreaming, onStopStreaming],
  );

  const openSessionTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveSessionId(id);
      setPanelMode("chat");
    },
    [setOpenTabs],
  );

  const handleNewSession = useCallback(
    async (workspacePath: string) => {
      const session = await window.mimica.createSession(workspacePath);
      await refreshSessions();
      setOpenTabs((prev) => [...prev, session.id]);
      setActiveSessionId(session.id);
      setPanelMode("chat");
      return session;
    },
    [refreshSessions, setOpenTabs],
  );

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

  const handleCloseTab = useCallback(
    async (id: string) => {
      await stopStreamingIfActive(id);
      const nextIds = openTabIds.filter((tabId) => tabId !== id);
      setOpenTabs(nextIds);
      if (activeSessionId === id) {
        setActiveSessionId(nextIds[nextIds.length - 1] ?? null);
      }
    },
    [activeSessionId, openTabIds, setOpenTabs, stopStreamingIfActive],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await stopStreamingIfActive(id);
      await window.mimica.deleteSession(id);
      const nextIds = openTabIds.filter((tabId) => tabId !== id);
      setOpenTabs(nextIds);
      if (activeSessionId === id) {
        setActiveSessionId(nextIds[nextIds.length - 1] ?? null);
      }
      await refreshSessions();
    },
    [activeSessionId, openTabIds, refreshSessions, setOpenTabs, stopStreamingIfActive],
  );

  const openSessions = useMemo(
    () =>
      openTabIds
        .map((id) => allSessions.find((s) => s.id === id))
        .filter((s): s is ChatSession => s !== undefined),
    [openTabIds, allSessions],
  );

  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? null;

  return {
    allSessions,
    setAllSessions,
    openSessions,
    openTabIds,
    activeSessionId,
    activeSession,
    panelMode,
    setPanelMode,
    setActiveSessionId,
    setOpenTabs,
    refreshSessions,
    openSessionTab,
    handleNewSession,
    handleCloseTab,
    handleDeleteSession,
    cycleTab,
  };
}

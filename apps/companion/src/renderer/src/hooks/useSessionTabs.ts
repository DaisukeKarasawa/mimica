import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatPanelMode } from "../components/ChatPanel";
import type { ChatSession } from "@mimica/shared";
import { hasSessionHistory } from "@mimica/shared";
import { loadOpenTabIds, persistOpenTabIds } from "../lib/openTabs";
import { reorderTabIds } from "../lib/reorderTabIds";

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

  const historySessions = useMemo(
    () => allSessions.filter(hasSessionHistory),
    [allSessions],
  );

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (historySessions.length === 0 || openTabIds.length > 0) return;
    const id = historySessions[0]!.id;
    setOpenTabs([id]);
    if (!activeSessionId) setActiveSessionId(id);
  }, [historySessions, openTabIds.length, activeSessionId, setOpenTabs]);

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

  const reorderOpenTab = useCallback(
    (draggedId: string, toIndex: number) => {
      setOpenTabs((prev) => {
        const fromIndex = prev.indexOf(draggedId);
        if (fromIndex === -1) return prev;
        return reorderTabIds(prev, fromIndex, toIndex);
      });
    },
    [setOpenTabs],
  );

  const removeTabFromUi = useCallback(
    (id: string) => {
      const nextIds = openTabIds.filter((tabId) => tabId !== id);
      setOpenTabs(nextIds);
      if (activeSessionId === id) {
        setActiveSessionId(nextIds[nextIds.length - 1] ?? null);
      }
    },
    [activeSessionId, openTabIds, setOpenTabs],
  );

  const detachTab = useCallback(
    async (id: string, deleteFromBackend: boolean | "ifEmpty") => {
      await stopStreamingIfActive(id);

      let shouldRefresh = false;
      if (deleteFromBackend === true) {
        await window.mimica.deleteSession(id);
        shouldRefresh = true;
      } else if (deleteFromBackend === "ifEmpty") {
        const session = allSessions.find((s) => s.id === id);
        if (session && !hasSessionHistory(session)) {
          await window.mimica.deleteSession(id);
          shouldRefresh = true;
        }
      }

      removeTabFromUi(id);
      if (shouldRefresh) await refreshSessions();
    },
    [allSessions, refreshSessions, removeTabFromUi, stopStreamingIfActive],
  );

  const handleCloseTab = useCallback(
    (id: string) => detachTab(id, "ifEmpty"),
    [detachTab],
  );

  const handleDeleteSession = useCallback(
    (id: string) => detachTab(id, true),
    [detachTab],
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
    historySessions,
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
    reorderOpenTab,
  };
}

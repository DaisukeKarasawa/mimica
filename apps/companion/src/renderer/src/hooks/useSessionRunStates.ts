import { useCallback, useState } from "react";
import { IDLE_SESSION_RUN, isSessionRunActive, type SessionRunState } from "../lib/sessionRunState";

export function useSessionRunStates() {
  const [runs, setRuns] = useState<Map<string, SessionRunState>>(() => new Map());

  const setSessionRun = useCallback((sessionId: string, patch: Partial<SessionRunState>) => {
    setRuns((prev) => {
      const next = new Map(prev);
      const current = next.get(sessionId) ?? IDLE_SESSION_RUN;
      const merged: SessionRunState = { ...current, ...patch };
      if (merged.status === "idle") {
        next.delete(sessionId);
      } else {
        next.set(sessionId, merged);
      }
      return next;
    });
  }, []);

  const clearSessionRun = useCallback((sessionId: string) => {
    setRuns((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const getSessionRun = useCallback(
    (sessionId: string | null): SessionRunState => {
      if (!sessionId) return IDLE_SESSION_RUN;
      return runs.get(sessionId) ?? IDLE_SESSION_RUN;
    },
    [runs],
  );

  const isSessionRunActiveById = useCallback(
    (sessionId: string | null): boolean => isSessionRunActive(getSessionRun(sessionId)),
    [getSessionRun],
  );

  return { runs, setSessionRun, clearSessionRun, getSessionRun, isSessionRunActiveById };
}

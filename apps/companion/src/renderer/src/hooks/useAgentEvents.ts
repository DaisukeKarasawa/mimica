import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, AgentRunState, ChatSession } from "@mimica/shared";
import { mapAgentRunToAvatar } from "@mimica/shared";
import type { CharacterDirector } from "@mimica/character-runtime";
import {
  applyAgentComplete,
  applyAgentDelta,
  applyAgentTool,
  streamMessageId,
} from "../lib/agentSessionUpdate";
import { logAgentPerfUi, type AgentPerfUiRecord } from "../lib/agentPerfUi";
import type { SessionRunState } from "../lib/sessionRunState";
import type { PendingStreamComplete, StreamRevealContext } from "../lib/streamRevealController";
import { StreamRevealController } from "../lib/streamRevealController";

export interface UseAgentEventsOptions {
  director: CharacterDirector;
  setAllSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setSessionRun: (sessionId: string, patch: Partial<SessionRunState>) => void;
  clearSessionRun: (sessionId: string) => void;
  activeSessionId: string | null;
  onRunSettled?: (sessionId: string) => void;
}

export interface UseAgentEventsResult {
  handleAgentEvent: (event: AgentEventMessage) => void;
  resetStream: (sessionId?: string) => void;
  beginStream: (sessionId: string) => string;
}

function runStatusFromAgentState(state: AgentRunState): SessionRunState["status"] | null {
  switch (state) {
    case "thinking":
      return "thinking";
    case "streaming":
      return "streaming";
    case "failed":
      return "error";
    case "cancelled":
    case "completed":
    case "idle":
    case "waiting":
      return "idle";
    default:
      return null;
  }
}

export function useAgentEvents(options: UseAgentEventsOptions): UseAgentEventsResult {
  const {
    director,
    setAllSessions,
    setSessionRun,
    clearSessionRun,
    activeSessionId,
    onRunSettled,
  } = options;

  const activeStreamIdRef = useRef<string | null>(null);
  const settledRunKeyRef = useRef<string | null>(null);
  const perfByRunIdRef = useRef(new Map<string, AgentPerfUiRecord>());
  const backgroundStreamTextRef = useRef(new Map<string, string>());
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directorRef = useRef(director);
  const setAllSessionsRef = useRef(setAllSessions);
  const setSessionRunRef = useRef(setSessionRun);
  const clearSessionRunRef = useRef(clearSessionRun);
  const activeSessionIdRef = useRef(activeSessionId);
  const onRunSettledRef = useRef(onRunSettled);
  directorRef.current = director;
  setAllSessionsRef.current = setAllSessions;
  setSessionRunRef.current = setSessionRun;
  clearSessionRunRef.current = clearSessionRun;
  activeSessionIdRef.current = activeSessionId;
  onRunSettledRef.current = onRunSettled;

  const isActiveSession = useCallback(
    (sessionId: string) => sessionId === activeSessionIdRef.current,
    [],
  );

  const notifyRunSettled = useCallback((sessionId: string, runId: string) => {
    const key = `${sessionId}:${runId}`;
    if (settledRunKeyRef.current === key) return;
    settledRunKeyRef.current = key;
    onRunSettledRef.current?.(sessionId);
  }, []);

  const clearCompletionTimeout = () => {
    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  };

  const scheduleReturnToIdleRef = useRef((delayMs: number) => {
    clearCompletionTimeout();
    completionTimeoutRef.current = setTimeout(() => {
      completionTimeoutRef.current = null;
      directorRef.current.setState("idle");
    }, delayMs);
  });

  const revealRef = useRef<StreamRevealController | null>(null);
  if (!revealRef.current) {
    revealRef.current = new StreamRevealController({
      onFrame: (ctx: StreamRevealContext, content: string) => {
        const perf = perfByRunIdRef.current.get(ctx.runId);
        if (perf && content.length > 0) {
          logAgentPerfUi(perf, "first_visible");
        }
        setAllSessionsRef.current((prev) =>
          applyAgentDelta(prev, ctx.sessionId, ctx.runId, ctx.streamId, content),
        );
      },
      onFinalize: (pending: PendingStreamComplete) => {
        const perf = perfByRunIdRef.current.get(pending.runId);
        if (perf) {
          logAgentPerfUi(perf, "reveal_done", {
            contentChars: [...pending.content].length,
          });
          perfByRunIdRef.current.delete(pending.runId);
        }
        activeStreamIdRef.current = null;
        setAllSessionsRef.current((prev) =>
          applyAgentComplete(
            prev,
            pending.sessionId,
            pending.runId,
            pending.streamId,
            pending.content,
          ),
        );
        if (isActiveSession(pending.sessionId)) {
          directorRef.current.setState("success");
          scheduleReturnToIdleRef.current(1200);
        }
        clearSessionRunRef.current(pending.sessionId);
        notifyRunSettled(pending.sessionId, pending.runId);
      },
    });
  }
  const reveal = revealRef.current;

  const syncRevealContext = useCallback(
    (event: AgentEventMessage & { runId: string }) => {
      const streamId = activeStreamIdRef.current ?? streamMessageId(event.runId, null);
      reveal.setContext({
        sessionId: event.sessionId,
        runId: event.runId,
        streamId,
      });
    },
    [reveal],
  );

  const applyPendingCompleteWithoutSuccess = useCallback(() => {
    const snapshot = reveal.drainForAbort();
    if (!snapshot) return false;
    activeStreamIdRef.current = null;
    setAllSessionsRef.current((prev) =>
      applyAgentComplete(
        prev,
        snapshot.sessionId,
        snapshot.runId,
        snapshot.streamId,
        snapshot.content,
      ),
    );
    return true;
  }, [reveal]);

  const resetStream = useCallback(
    (sessionId?: string) => {
      if (sessionId && !isActiveSession(sessionId)) return;
      applyPendingCompleteWithoutSuccess();
      reveal.reset();
      activeStreamIdRef.current = null;
    },
    [applyPendingCompleteWithoutSuccess, isActiveSession, reveal],
  );

  const beginStream = useCallback(
    (sessionId: string) => {
      clearCompletionTimeout();
      setSessionRunRef.current(sessionId, { status: "thinking" });
      if (isActiveSession(sessionId)) {
        resetStream(sessionId);
        directorRef.current.setState("thinking");
        const id = uuidv4();
        activeStreamIdRef.current = id;
        return id;
      }
      return streamMessageId(`pending-${sessionId}`, null);
    },
    [isActiveSession, resetStream],
  );

  const appendBackgroundDelta = useCallback(
    (event: AgentEventMessage & { runId: string; content: string }) => {
      const bufferKey = `${event.sessionId}:${event.runId}`;
      const streamId = streamMessageId(event.runId, null);
      const nextText = (backgroundStreamTextRef.current.get(bufferKey) ?? "") + event.content;
      backgroundStreamTextRef.current.set(bufferKey, nextText);
      setAllSessionsRef.current((prev) =>
        applyAgentDelta(prev, event.sessionId, event.runId, streamId, nextText),
      );
    },
    [],
  );

  const finalizeBackgroundComplete = useCallback(
    (event: AgentEventMessage & { runId: string; content: string }) => {
      const bufferKey = `${event.sessionId}:${event.runId}`;
      const streamId = streamMessageId(event.runId, null);
      const content = backgroundStreamTextRef.current.get(bufferKey) ?? event.content;
      backgroundStreamTextRef.current.delete(bufferKey);
      setAllSessionsRef.current((prev) =>
        applyAgentComplete(prev, event.sessionId, event.runId, streamId, content),
      );
      clearSessionRunRef.current(event.sessionId);
      notifyRunSettled(event.sessionId, event.runId);
    },
    [notifyRunSettled],
  );

  const updateSessionRunFromAgentState = useCallback(
    (sessionId: string, state: AgentRunState, runId?: string) => {
      const status = runStatusFromAgentState(state);
      if (!status || status === "idle") {
        clearSessionRunRef.current(sessionId);
        return;
      }
      setSessionRunRef.current(sessionId, { status, runId });
    },
    [],
  );

  useEffect(
    () => () => {
      clearCompletionTimeout();
      reveal.stop();
    },
    [reveal],
  );

  const handleAgentEvent = useCallback(
    (event: AgentEventMessage) => {
      switch (event.type) {
        case "agent_state": {
          updateSessionRunFromAgentState(event.sessionId, event.state, event.runId);
          if (isActiveSession(event.sessionId) && event.state !== "completed") {
            directorRef.current.setState(mapAgentRunToAvatar(event.state));
          }
          if (event.state === "failed" || event.state === "cancelled") {
            if (isActiveSession(event.sessionId)) {
              reveal.stop();
              resetStream(event.sessionId);
              scheduleReturnToIdleRef.current(event.state === "failed" ? 2000 : 1200);
            } else {
              backgroundStreamTextRef.current.delete(`${event.sessionId}:${event.runId ?? ""}`);
            }
            clearSessionRunRef.current(event.sessionId);
            if (event.runId) {
              notifyRunSettled(event.sessionId, event.runId);
            }
          }
          break;
        }
        case "agent_warning":
          break;
        case "agent_perf": {
          perfByRunIdRef.current.set(event.runId, {
            runId: event.runId,
            t0EpochMs: event.t0EpochMs,
          });
          break;
        }
        case "agent_delta": {
          setSessionRunRef.current(event.sessionId, {
            status: "streaming",
            runId: event.runId,
          });
          if (!isActiveSession(event.sessionId)) {
            appendBackgroundDelta(event);
            break;
          }
          syncRevealContext(event);
          reveal.appendReceived(event.content);
          reveal.start();
          break;
        }
        case "agent_tool": {
          if (!isActiveSession(event.sessionId)) {
            const streamId = streamMessageId(event.runId, null);
            setAllSessionsRef.current((prev) =>
              applyAgentTool(
                prev,
                event.sessionId,
                event.runId,
                streamId,
                backgroundStreamTextRef.current.get(`${event.sessionId}:${event.runId}`) ?? "",
                event.name,
                event.detail,
              ),
            );
            break;
          }
          syncRevealContext(event);
          reveal.clearReceived();
          const ctx = reveal.getContext();
          if (!ctx) break;
          setAllSessionsRef.current((prev) =>
            applyAgentDelta(prev, ctx.sessionId, ctx.runId, ctx.streamId, ""),
          );
          setAllSessionsRef.current((prev) =>
            applyAgentTool(
              prev,
              ctx.sessionId,
              ctx.runId,
              ctx.streamId,
              "",
              event.name,
              event.detail,
            ),
          );
          break;
        }
        case "agent_complete": {
          if (!isActiveSession(event.sessionId)) {
            finalizeBackgroundComplete(event);
            break;
          }
          syncRevealContext(event);
          const streamId = activeStreamIdRef.current ?? streamMessageId(event.runId, null);
          reveal.setReceivedIfLonger(event.content);
          reveal.queueComplete({
            sessionId: event.sessionId,
            runId: event.runId,
            streamId,
            content: reveal.getReceivedContent(),
          });
          reveal.start();
          break;
        }
        case "agent_error": {
          if (isActiveSession(event.sessionId)) {
            reveal.stop();
            resetStream(event.sessionId);
            directorRef.current.setState("error");
            clearCompletionTimeout();
            completionTimeoutRef.current = setTimeout(() => {
              completionTimeoutRef.current = null;
              directorRef.current.setState("idle");
            }, 2000);
          } else {
            backgroundStreamTextRef.current.delete(`${event.sessionId}:${event.runId}`);
          }
          clearSessionRunRef.current(event.sessionId);
          notifyRunSettled(event.sessionId, event.runId);
          break;
        }
        default:
          break;
      }
    },
    [
      appendBackgroundDelta,
      finalizeBackgroundComplete,
      isActiveSession,
      notifyRunSettled,
      resetStream,
      reveal,
      syncRevealContext,
      updateSessionRunFromAgentState,
    ],
  );

  return { handleAgentEvent, resetStream, beginStream };
}

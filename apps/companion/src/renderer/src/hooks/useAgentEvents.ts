import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, AgentRunState, ChatSession } from "@mimica/shared";
import { sessionHasPendingQuestion } from "@mimica/shared";
import {
  applyAgentComplete,
  applyAgentDelta,
  applyAgentQuestion,
  applyAgentQuestionResolved,
  applyAgentTool,
  streamMessageId,
} from "../lib/agentSessionUpdate";
import { shouldApplyAgentStateToSessionRun } from "../lib/agentSessionRunState";
import { logAgentPerfUi, type AgentPerfUiRecord } from "../lib/agentPerfUi";
import { runStatusFromAgentState, type SessionRunState } from "../lib/sessionRunState";
import type { PendingStreamComplete, StreamRevealContext } from "../lib/streamRevealController";
import { StreamRevealController } from "../lib/streamRevealController";
import { codePointCount } from "../lib/streamReveal";

export type AvatarMomentKind = "success" | "error";

export interface UseAgentEventsOptions {
  setAllSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setSessionRun: (sessionId: string, patch: Partial<SessionRunState>) => void;
  clearSessionRun: (sessionId: string) => void;
  activeSessionId: string | null;
  onRunSettled?: (sessionId: string) => void;
  onAvatarMoment?: (kind: AvatarMomentKind, holdMs: number) => void;
}

export interface UseAgentEventsResult {
  handleAgentEvent: (event: AgentEventMessage) => void;
  resetStream: (sessionId?: string) => void;
  beginStream: (sessionId: string) => string;
}

function backgroundBufferKey(sessionId: string, runId: string): string {
  return `${sessionId}:${runId}`;
}

function findBackgroundStream(
  buffers: Map<string, string>,
  sessionId: string,
): { runId: string; text: string } | null {
  const prefix = `${sessionId}:`;
  for (const [key, text] of buffers) {
    if (!key.startsWith(prefix) || !text) continue;
    return { runId: key.slice(prefix.length), text };
  }
  return null;
}

function clearBackgroundBuffersForSession(buffers: Map<string, string>, sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of [...buffers.keys()]) {
    if (key.startsWith(prefix)) {
      buffers.delete(key);
    }
  }
}

export function useAgentEvents(options: UseAgentEventsOptions): UseAgentEventsResult {
  const {
    setAllSessions,
    setSessionRun,
    clearSessionRun,
    activeSessionId,
    onRunSettled,
    onAvatarMoment,
  } = options;

  const activeStreamIdRef = useRef<string | null>(null);
  const previousActiveSessionIdRef = useRef<string | null>(activeSessionId);
  const settledRunKeyRef = useRef<string | null>(null);
  const perfByRunIdRef = useRef(new Map<string, AgentPerfUiRecord>());
  const backgroundStreamTextRef = useRef(new Map<string, string>());
  const setAllSessionsRef = useRef(setAllSessions);
  const setSessionRunRef = useRef(setSessionRun);
  const clearSessionRunRef = useRef(clearSessionRun);
  const activeSessionIdRef = useRef(activeSessionId);
  const onRunSettledRef = useRef(onRunSettled);
  const onAvatarMomentRef = useRef(onAvatarMoment);
  setAllSessionsRef.current = setAllSessions;
  setSessionRunRef.current = setSessionRun;
  clearSessionRunRef.current = clearSessionRun;
  activeSessionIdRef.current = activeSessionId;
  onRunSettledRef.current = onRunSettled;
  onAvatarMomentRef.current = onAvatarMoment;

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
        setAllSessionsRef.current((prev) => {
          const updated = applyAgentComplete(
            prev,
            pending.sessionId,
            pending.runId,
            pending.streamId,
            pending.content,
          );
          const session = updated.find((s) => s.id === pending.sessionId);
          if (
            isActiveSession(pending.sessionId) &&
            !(session != null && sessionHasPendingQuestion(session))
          ) {
            onAvatarMomentRef.current?.("success", 1200);
          }
          return updated;
        });
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
    clearSessionRunRef.current(snapshot.sessionId);
    notifyRunSettled(snapshot.sessionId, snapshot.runId);
    return true;
  }, [notifyRunSettled, reveal]);

  /** Tab switch: settle only if agent_complete was already queued, not in-progress deltas. */
  const applyQueuedCompleteOnTabLeave = useCallback(() => {
    const pending = reveal.drainPendingComplete();
    if (!pending) return false;
    activeStreamIdRef.current = null;
    setAllSessionsRef.current((prev) =>
      applyAgentComplete(prev, pending.sessionId, pending.runId, pending.streamId, pending.content),
    );
    clearSessionRunRef.current(pending.sessionId);
    notifyRunSettled(pending.sessionId, pending.runId);
    return true;
  }, [notifyRunSettled, reveal]);

  const hydrateRevealFromBackground = useCallback(
    (sessionId: string) => {
      const background = findBackgroundStream(backgroundStreamTextRef.current, sessionId);
      if (!background) return;
      const streamId = streamMessageId(background.runId, null);
      activeStreamIdRef.current = streamId;
      reveal.setContext({
        sessionId,
        runId: background.runId,
        streamId,
      });
      reveal.setReceivedIfLonger(background.text);
      reveal.start();
    },
    [reveal],
  );

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
      setSessionRunRef.current(sessionId, { status: "thinking" });
      if (isActiveSession(sessionId)) {
        resetStream(sessionId);
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
      const bufferKey = backgroundBufferKey(event.sessionId, event.runId);
      const streamId = streamMessageId(event.runId, null);
      const nextText = (backgroundStreamTextRef.current.get(bufferKey) ?? "") + event.content;
      backgroundStreamTextRef.current.set(bufferKey, nextText);
      setAllSessionsRef.current((prev) =>
        applyAgentDelta(prev, event.sessionId, event.runId, streamId, nextText),
      );
    },
    [],
  );

  const seedBackgroundFromReveal = useCallback(
    (sessionId: string) => {
      const ctx = reveal.getContext();
      if (!ctx || ctx.sessionId !== sessionId) return;
      const received = reveal.getReceivedContent();
      if (!received) return;
      backgroundStreamTextRef.current.set(backgroundBufferKey(ctx.sessionId, ctx.runId), received);
    },
    [reveal],
  );

  const finalizeBackgroundComplete = useCallback(
    (event: AgentEventMessage & { runId: string; content: string }) => {
      const bufferKey = backgroundBufferKey(event.sessionId, event.runId);
      const streamId = streamMessageId(event.runId, null);
      const buffered = backgroundStreamTextRef.current.get(bufferKey) ?? "";
      const content =
        codePointCount(buffered) >= codePointCount(event.content) ? buffered : event.content;
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
      if (status === "idle") {
        clearSessionRunRef.current(sessionId);
        return;
      }
      setSessionRunRef.current(sessionId, { status, runId });
    },
    [],
  );

  useEffect(
    () => () => {
      reveal.stop();
    },
    [reveal],
  );

  useEffect(() => {
    const previousActiveSessionId = previousActiveSessionIdRef.current;
    if (previousActiveSessionId && previousActiveSessionId !== activeSessionId) {
      seedBackgroundFromReveal(previousActiveSessionId);
    }
    previousActiveSessionIdRef.current = activeSessionId;

    applyQueuedCompleteOnTabLeave();
    reveal.reset();
    activeStreamIdRef.current = null;
    if (activeSessionId) {
      hydrateRevealFromBackground(activeSessionId);
    }
  }, [
    activeSessionId,
    applyQueuedCompleteOnTabLeave,
    hydrateRevealFromBackground,
    reveal,
    seedBackgroundFromReveal,
  ]);

  const handleAgentEvent = useCallback(
    (event: AgentEventMessage) => {
      switch (event.type) {
        case "agent_state": {
          if (shouldApplyAgentStateToSessionRun(event.state, isActiveSession(event.sessionId))) {
            updateSessionRunFromAgentState(event.sessionId, event.state, event.runId);
          }
          if (event.state === "failed" || event.state === "cancelled") {
            if (isActiveSession(event.sessionId)) {
              reveal.stop();
              resetStream(event.sessionId);
              if (event.state === "failed") {
                onAvatarMomentRef.current?.("error", 2000);
              }
            } else if (event.runId) {
              backgroundStreamTextRef.current.delete(
                backgroundBufferKey(event.sessionId, event.runId),
              );
            } else {
              clearBackgroundBuffersForSession(backgroundStreamTextRef.current, event.sessionId);
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
                backgroundStreamTextRef.current.get(
                  backgroundBufferKey(event.sessionId, event.runId),
                ) ?? "",
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
          setSessionRunRef.current(event.sessionId, {
            status: "streaming",
            runId: event.runId,
          });
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
          const streamId = activeStreamIdRef.current ?? streamMessageId(event.runId, null);
          if (isActiveSession(event.sessionId)) {
            reveal.stop();
            reveal.reset();
            activeStreamIdRef.current = null;
            setAllSessionsRef.current((prev) =>
              applyAgentComplete(prev, event.sessionId, event.runId, streamId, event.message),
            );
            onAvatarMomentRef.current?.("error", 2000);
          } else {
            backgroundStreamTextRef.current.delete(
              backgroundBufferKey(event.sessionId, event.runId),
            );
            setAllSessionsRef.current((prev) =>
              applyAgentComplete(prev, event.sessionId, event.runId, streamId, event.message),
            );
          }
          clearSessionRunRef.current(event.sessionId);
          notifyRunSettled(event.sessionId, event.runId);
          break;
        }
        case "agent_question": {
          const streamId = activeStreamIdRef.current ?? streamMessageId(event.runId, null);
          setAllSessionsRef.current((prev) =>
            applyAgentQuestion(prev, event.sessionId, event.runId, event.question, streamId),
          );
          break;
        }
        case "agent_question_resolved": {
          setAllSessionsRef.current((prev) =>
            applyAgentQuestionResolved(prev, event.sessionId, event.questionPromptId, event.status),
          );
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

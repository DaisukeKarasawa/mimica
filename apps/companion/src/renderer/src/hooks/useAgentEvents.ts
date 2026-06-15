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
import { codePointCount } from "../lib/streamReveal";
import { StreamRevealController, type PendingStreamComplete } from "../lib/streamRevealController";
import { runStatusFromAgentState, type SessionRunState } from "../lib/sessionRunState";

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

function clearBackgroundBuffersForSession(buffers: Map<string, string>, sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of [...buffers.keys()]) {
    if (key.startsWith(prefix)) {
      buffers.delete(key);
    }
  }
}

function clearBufferedStreamForRun(
  buffers: Map<string, string>,
  sessionId: string,
  runId: string | undefined,
): void {
  if (!runId) return;
  buffers.delete(backgroundBufferKey(sessionId, runId));
}

function resolveBufferedContent(
  buffers: Map<string, string>,
  sessionId: string,
  runId: string,
  content: string,
): string {
  const buffered = buffers.get(backgroundBufferKey(sessionId, runId)) ?? "";
  buffers.delete(backgroundBufferKey(sessionId, runId));
  return codePointCount(buffered) > codePointCount(content) ? buffered : content;
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
  const settledRunKeyRef = useRef<string | null>(null);
  const backgroundStreamTextRef = useRef(new Map<string, string>());
  const setAllSessionsRef = useRef(setAllSessions);
  const setSessionRunRef = useRef(setSessionRun);
  const clearSessionRunRef = useRef(clearSessionRun);
  const activeSessionIdRef = useRef(activeSessionId);
  const onRunSettledRef = useRef(onRunSettled);
  const onAvatarMomentRef = useRef(onAvatarMoment);
  const finalizeCompleteRef = useRef<
    (sessionId: string, runId: string, streamId: string, content: string) => void
  >(() => {});
  setAllSessionsRef.current = setAllSessions;
  setSessionRunRef.current = setSessionRun;
  clearSessionRunRef.current = clearSessionRun;
  activeSessionIdRef.current = activeSessionId;
  onRunSettledRef.current = onRunSettled;
  onAvatarMomentRef.current = onAvatarMoment;

  const revealRef = useRef<StreamRevealController | null>(null);
  if (!revealRef.current) {
    revealRef.current = new StreamRevealController({
      onFrame: (ctx, content) => {
        setAllSessionsRef.current((prev) =>
          applyAgentDelta(prev, ctx.sessionId, ctx.runId, ctx.streamId, content),
        );
      },
      onFinalize: (pending: PendingStreamComplete) => {
        if (activeStreamIdRef.current === pending.streamId) {
          activeStreamIdRef.current = null;
        }
        finalizeCompleteRef.current(
          pending.sessionId,
          pending.runId,
          pending.streamId,
          pending.content,
        );
      },
    });
  }
  const reveal = revealRef.current;

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

  const finalizeComplete = useCallback(
    (sessionId: string, runId: string, streamId: string, content: string) => {
      if (isActiveSession(sessionId)) {
        activeStreamIdRef.current = null;
      }
      setAllSessionsRef.current((prev) => {
        const updated = applyAgentComplete(prev, sessionId, runId, streamId, content);
        const session = updated.find((s) => s.id === sessionId);
        if (
          isActiveSession(sessionId) &&
          !(session != null && sessionHasPendingQuestion(session))
        ) {
          onAvatarMomentRef.current?.("success", 1200);
        }
        return updated;
      });
      clearSessionRunRef.current(sessionId);
      notifyRunSettled(sessionId, runId);
    },
    [isActiveSession, notifyRunSettled],
  );
  finalizeCompleteRef.current = finalizeComplete;

  const appendBackgroundDelta = useCallback(
    (event: AgentEventMessage & { runId: string; content: string }) => {
      const bufferKey = backgroundBufferKey(event.sessionId, event.runId);
      const nextText = (backgroundStreamTextRef.current.get(bufferKey) ?? "") + event.content;
      backgroundStreamTextRef.current.set(bufferKey, nextText);
    },
    [],
  );

  const resetStream = useCallback(
    (sessionId?: string) => {
      if (sessionId && !isActiveSession(sessionId)) return;
      reveal.stop();
      reveal.reset();
      activeStreamIdRef.current = null;
    },
    [isActiveSession, reveal],
  );

  const beginStream = useCallback(
    (sessionId: string) => {
      setSessionRunRef.current(sessionId, { status: "thinking" });
      if (isActiveSession(sessionId)) {
        const pending = reveal.drainPendingComplete();
        if (pending) {
          finalizeComplete(pending.sessionId, pending.runId, pending.streamId, pending.content);
        }
        reveal.stop();
        reveal.reset();
        activeStreamIdRef.current = uuidv4();
        return activeStreamIdRef.current;
      }
      return streamMessageId(`pending-${sessionId}`, null);
    },
    [finalizeComplete, isActiveSession, reveal],
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

  useEffect(() => {
    activeStreamIdRef.current = null;
  }, [activeSessionId]);

  const handleAgentEvent = useCallback(
    (event: AgentEventMessage) => {
      switch (event.type) {
        case "agent_state": {
          if (shouldApplyAgentStateToSessionRun(event.state, isActiveSession(event.sessionId))) {
            updateSessionRunFromAgentState(event.sessionId, event.state, event.runId);
          }
          if (event.state === "failed" || event.state === "cancelled") {
            reveal.stop();
            reveal.reset();
            clearBufferedStreamForRun(
              backgroundStreamTextRef.current,
              event.sessionId,
              event.runId,
            );
            if (!event.runId) {
              clearBackgroundBuffersForSession(backgroundStreamTextRef.current, event.sessionId);
            }
            if (isActiveSession(event.sessionId)) {
              activeStreamIdRef.current = null;
              if (event.state === "failed") {
                onAvatarMomentRef.current?.("error", 2000);
              }
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
        case "agent_perf":
          break;
        case "agent_delta": {
          setSessionRunRef.current(event.sessionId, {
            status: "streaming",
            runId: event.runId,
          });
          appendBackgroundDelta(event);
          break;
        }
        case "agent_tool": {
          clearBufferedStreamForRun(backgroundStreamTextRef.current, event.sessionId, event.runId);
          const streamId =
            (isActiveSession(event.sessionId) ? activeStreamIdRef.current : null) ??
            streamMessageId(event.runId, null);
          setAllSessionsRef.current((prev) =>
            applyAgentTool(
              prev,
              event.sessionId,
              event.runId,
              streamId,
              "",
              event.name,
              event.detail,
            ),
          );
          break;
        }
        case "agent_readout": {
          if (!isActiveSession(event.sessionId)) break;
          if (event.phase === "preparing") {
            setSessionRunRef.current(event.sessionId, {
              status: "preparing",
              runId: event.runId,
            });
          } else if (event.phase === "start") {
            setSessionRunRef.current(event.sessionId, {
              status: "readout",
              runId: event.runId,
            });
          }
          break;
        }
        case "agent_complete": {
          const streamId =
            (isActiveSession(event.sessionId) ? activeStreamIdRef.current : null) ??
            streamMessageId(event.runId, null);
          const content = resolveBufferedContent(
            backgroundStreamTextRef.current,
            event.sessionId,
            event.runId,
            event.content,
          );
          clearBufferedStreamForRun(backgroundStreamTextRef.current, event.sessionId, event.runId);
          if (isActiveSession(event.sessionId)) {
            reveal.setContext({
              sessionId: event.sessionId,
              runId: event.runId,
              streamId,
            });
            reveal.setReceivedIfLonger(content);
            reveal.queueComplete({
              sessionId: event.sessionId,
              runId: event.runId,
              streamId,
              content,
            });
            setSessionRunRef.current(event.sessionId, {
              status: "revealing",
              runId: event.runId,
            });
            reveal.start();
            break;
          }
          finalizeComplete(event.sessionId, event.runId, streamId, content);
          break;
        }
        case "agent_error": {
          reveal.stop();
          reveal.reset();
          const streamId =
            (isActiveSession(event.sessionId) ? activeStreamIdRef.current : null) ??
            streamMessageId(event.runId, null);
          if (event.runId) {
            clearBufferedStreamForRun(
              backgroundStreamTextRef.current,
              event.sessionId,
              event.runId,
            );
          }
          if (isActiveSession(event.sessionId)) {
            activeStreamIdRef.current = null;
            setAllSessionsRef.current((prev) =>
              applyAgentComplete(prev, event.sessionId, event.runId, streamId, event.message),
            );
            onAvatarMomentRef.current?.("error", 2000);
          } else {
            setAllSessionsRef.current((prev) =>
              applyAgentComplete(prev, event.sessionId, event.runId, streamId, event.message),
            );
          }
          clearSessionRunRef.current(event.sessionId);
          notifyRunSettled(event.sessionId, event.runId);
          break;
        }
        case "agent_question": {
          clearBufferedStreamForRun(backgroundStreamTextRef.current, event.sessionId, event.runId);
          const streamId =
            (isActiveSession(event.sessionId) ? activeStreamIdRef.current : null) ??
            streamMessageId(event.runId, null);
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
      finalizeComplete,
      isActiveSession,
      notifyRunSettled,
      reveal,
      updateSessionRunFromAgentState,
    ],
  );

  return { handleAgentEvent, resetStream, beginStream };
}

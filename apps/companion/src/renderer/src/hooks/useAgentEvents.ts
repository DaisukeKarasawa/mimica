import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, ChatSession } from "@mimica/shared";
import { mapAgentRunToAvatar, sessionHasPendingQuestion } from "@mimica/shared";
import type { CharacterDirector } from "@mimica/character-runtime";
import {
  applyAgentComplete,
  applyAgentDelta,
  applyAgentQuestion,
  applyAgentQuestionResolved,
  applyAgentTool,
  streamMessageId,
} from "../lib/agentSessionUpdate";
import { logAgentPerfUi, type AgentPerfUiRecord } from "../lib/agentPerfUi";
import type { PendingStreamComplete, StreamRevealContext } from "../lib/streamRevealController";
import { StreamRevealController } from "../lib/streamRevealController";

export interface UseAgentEventsOptions {
  director: CharacterDirector;
  setAllSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseAgentEventsResult {
  handleAgentEvent: (event: AgentEventMessage) => void;
  resetStream: () => void;
  beginStream: () => string;
}

export function useAgentEvents(options: UseAgentEventsOptions): UseAgentEventsResult {
  const { director, setAllSessions, setIsStreaming } = options;

  const activeStreamIdRef = useRef<string | null>(null);
  const perfByRunIdRef = useRef(new Map<string, AgentPerfUiRecord>());
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directorRef = useRef(director);
  const setAllSessionsRef = useRef(setAllSessions);
  const setIsStreamingRef = useRef(setIsStreaming);
  directorRef.current = director;
  setAllSessionsRef.current = setAllSessions;
  setIsStreamingRef.current = setIsStreaming;

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
        setAllSessionsRef.current((prev) => {
          const updated = applyAgentComplete(
            prev,
            pending.sessionId,
            pending.runId,
            pending.streamId,
            pending.content,
          );
          const session = updated.find((s) => s.id === pending.sessionId);
          const hasPendingQuestion = session != null && sessionHasPendingQuestion(session);
          if (hasPendingQuestion) {
            directorRef.current.setState("waiting");
          } else {
            directorRef.current.setState("success");
            scheduleReturnToIdleRef.current(1200);
          }
          return updated;
        });
        setIsStreamingRef.current(false);
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
    setIsStreamingRef.current(false);
    return true;
  }, [reveal]);

  const resetStream = useCallback(() => {
    applyPendingCompleteWithoutSuccess();
    reveal.reset();
    activeStreamIdRef.current = null;
  }, [applyPendingCompleteWithoutSuccess, reveal]);

  const beginStream = useCallback(() => {
    clearCompletionTimeout();
    resetStream();
    directorRef.current.setState("thinking");
    const id = uuidv4();
    activeStreamIdRef.current = id;
    return id;
  }, [resetStream]);

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
          if (event.state !== "completed") {
            directorRef.current.setState(mapAgentRunToAvatar(event.state));
          }
          if (event.state === "streaming") setIsStreamingRef.current(true);
          if (event.state === "failed" || event.state === "cancelled") {
            reveal.stop();
            resetStream();
            setIsStreamingRef.current(false);
            scheduleReturnToIdleRef.current(event.state === "failed" ? 2000 : 1200);
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
          syncRevealContext(event);
          reveal.appendReceived(event.content);
          reveal.start();
          break;
        }
        case "agent_tool": {
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
          reveal.stop();
          resetStream();
          setIsStreamingRef.current(false);
          directorRef.current.setState("error");
          clearCompletionTimeout();
          completionTimeoutRef.current = setTimeout(() => {
            completionTimeoutRef.current = null;
            directorRef.current.setState("idle");
          }, 2000);
          break;
        }
        case "agent_question": {
          const streamId = activeStreamIdRef.current ?? streamMessageId(event.runId, null);
          setAllSessionsRef.current((prev) =>
            applyAgentQuestion(prev, event.sessionId, event.runId, event.question, streamId),
          );
          directorRef.current.setState("waiting");
          break;
        }
        case "agent_question_resolved": {
          setAllSessionsRef.current((prev) =>
            applyAgentQuestionResolved(prev, event.sessionId, event.questionPromptId, event.status),
          );
          if (event.status === "answered") {
            directorRef.current.setState("thinking");
          } else {
            directorRef.current.setState("idle");
          }
          break;
        }
        default:
          break;
      }
    },
    [resetStream, reveal, syncRevealContext],
  );

  return { handleAgentEvent, resetStream, beginStream };
}

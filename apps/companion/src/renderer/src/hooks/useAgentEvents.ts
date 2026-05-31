import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, ChatSession } from "@mimica/shared";
import { mapAgentRunToAvatar } from "@mimica/shared";
import type { CharacterDirector } from "@mimica/character-runtime";
import { applyAgentDelta, applyAgentComplete, reduceAgentEvent } from "../lib/agentSessionUpdate";
import {
  advanceRevealCount,
  codePointCount,
  sliceByCodePoints,
  STREAM_REVEAL_CHARS_PER_SECOND,
} from "../lib/streamReveal";

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

interface PendingComplete {
  sessionId: string;
  runId: string;
  streamId: string;
  content: string;
}

export function useAgentEvents(options: UseAgentEventsOptions): UseAgentEventsResult {
  const { director, setAllSessions, setIsStreaming } = options;

  const receivedContentRef = useRef("");
  const revealedCountRef = useRef(0);
  const revealCarryRef = useRef(0);
  const lastRevealTickAtRef = useRef(0);
  const activeStreamIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const revealRafRef = useRef(0);
  const pendingCompleteRef = useRef<PendingComplete | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCompletionTimeout = () => {
    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  };

  const scheduleReturnToIdle = (delayMs: number) => {
    clearCompletionTimeout();
    completionTimeoutRef.current = setTimeout(() => {
      completionTimeoutRef.current = null;
      director.setState("idle", true);
    }, delayMs);
  };

  const stopRevealLoop = useCallback(() => {
    if (revealRafRef.current !== 0) {
      cancelAnimationFrame(revealRafRef.current);
      revealRafRef.current = 0;
    }
  }, []);

  const displayedContent = useCallback(
    () => sliceByCodePoints(receivedContentRef.current, revealedCountRef.current),
    [],
  );

  const pushDisplayedToSession = useCallback(() => {
    const sessionId = activeSessionIdRef.current;
    const streamId = activeStreamIdRef.current;
    const runId = activeRunIdRef.current;
    if (!sessionId || !streamId || !runId) return;

    const content = displayedContent();
    setAllSessions((prev) =>
      applyAgentDelta(prev, sessionId, runId, streamId, content),
    );
  }, [displayedContent, setAllSessions]);

  const finalizeComplete = useCallback(() => {
    const pending = pendingCompleteRef.current;
    if (!pending) return;

    stopRevealLoop();
    pendingCompleteRef.current = null;

    setAllSessions((prev) => {
      const next = applyAgentComplete(
        prev,
        pending.sessionId,
        pending.runId,
        pending.streamId,
        pending.content,
      );
      const session = next.find((s) => s.id === pending.sessionId);
      if (session) {
        void window.mimica.saveSession(session);
      }
      return next;
    });

    receivedContentRef.current = "";
    revealedCountRef.current = 0;
    revealCarryRef.current = 0;
    lastRevealTickAtRef.current = 0;
    activeStreamIdRef.current = null;
    activeSessionIdRef.current = null;
    activeRunIdRef.current = null;

    director.setState("success", true);
    setIsStreaming(false);
    scheduleReturnToIdle(1200);
  }, [director, setAllSessions, setIsStreaming, stopRevealLoop]);

  const revealTick = useCallback(() => {
    revealRafRef.current = 0;

    const now = Date.now();
    if (lastRevealTickAtRef.current === 0) {
      lastRevealTickAtRef.current = now;
    }
    const deltaMs = now - lastRevealTickAtRef.current;
    lastRevealTickAtRef.current = now;

    const receivedCount = codePointCount(receivedContentRef.current);
    const advanced = advanceRevealCount(
      revealedCountRef.current,
      receivedCount,
      deltaMs,
      STREAM_REVEAL_CHARS_PER_SECOND,
      revealCarryRef.current,
    );
    revealCarryRef.current = advanced.carry;

    if (advanced.revealed > revealedCountRef.current) {
      revealedCountRef.current = advanced.revealed;
      pushDisplayedToSession();
    }

    const caughtUp = revealedCountRef.current >= receivedCount;
    if (pendingCompleteRef.current && caughtUp) {
      finalizeComplete();
      return;
    }

    if (!caughtUp || pendingCompleteRef.current) {
      revealRafRef.current = requestAnimationFrame(revealTick);
    }
  }, [finalizeComplete, pushDisplayedToSession]);

  const startRevealLoop = useCallback(() => {
    if (revealRafRef.current !== 0) return;
    if (lastRevealTickAtRef.current === 0) {
      lastRevealTickAtRef.current = Date.now();
    }
    revealRafRef.current = requestAnimationFrame(revealTick);
  }, [revealTick]);

  const resetStream = useCallback(() => {
    stopRevealLoop();
    pendingCompleteRef.current = null;
    receivedContentRef.current = "";
    revealedCountRef.current = 0;
    revealCarryRef.current = 0;
    lastRevealTickAtRef.current = 0;
    activeStreamIdRef.current = null;
    activeSessionIdRef.current = null;
    activeRunIdRef.current = null;
  }, [stopRevealLoop]);

  const beginStream = useCallback(() => {
    clearCompletionTimeout();
    resetStream();
    const id = uuidv4();
    activeStreamIdRef.current = id;
    return id;
  }, [resetStream]);

  useEffect(
    () => () => {
      clearCompletionTimeout();
      stopRevealLoop();
    },
    [stopRevealLoop],
  );

  const bindStreamContext = useCallback((event: AgentEventMessage & { runId: string }) => {
    activeSessionIdRef.current = event.sessionId;
    activeRunIdRef.current = event.runId;
  }, []);

  const handleAgentEvent = useCallback(
    (event: AgentEventMessage) => {
      switch (event.type) {
        case "agent_state": {
          if (event.state !== "completed") {
            const avatar = mapAgentRunToAvatar(event.state);
            director.setState(avatar, true);
          }
          if (event.state === "streaming") setIsStreaming(true);
          if (event.state === "failed" || event.state === "cancelled") {
            stopRevealLoop();
            resetStream();
            setIsStreaming(false);
          }
          break;
        }
        case "agent_warning":
          break;
        case "agent_delta": {
          bindStreamContext(event);
          receivedContentRef.current += event.content;
          startRevealLoop();
          break;
        }
        case "agent_tool": {
          bindStreamContext(event);
          setAllSessions((prev) =>
            reduceAgentEvent(prev, event, {
              streamId: activeStreamIdRef.current,
              content: displayedContent(),
            }),
          );
          break;
        }
        case "agent_complete": {
          bindStreamContext(event);
          const streamId = activeStreamIdRef.current ?? `stream-${event.runId}`;
          if (codePointCount(event.content) >= codePointCount(receivedContentRef.current)) {
            receivedContentRef.current = event.content;
          }
          pendingCompleteRef.current = {
            sessionId: event.sessionId,
            runId: event.runId,
            streamId,
            content: event.content,
          };
          startRevealLoop();
          break;
        }
        case "agent_error": {
          stopRevealLoop();
          resetStream();
          setIsStreaming(false);
          director.setState("error", true);
          clearCompletionTimeout();
          completionTimeoutRef.current = setTimeout(() => {
            completionTimeoutRef.current = null;
            director.setState("idle", true);
          }, 2000);
          break;
        }
        default:
          break;
      }
    },
    [
      bindStreamContext,
      director,
      displayedContent,
      resetStream,
      setAllSessions,
      setIsStreaming,
      startRevealLoop,
      stopRevealLoop,
    ],
  );

  return { handleAgentEvent, resetStream, beginStream };
}

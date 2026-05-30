import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, AvatarState, ChatSession } from "@mimica/shared";
import { avatarStatusLabel, mapAgentRunToAvatar } from "@mimica/shared";
import type { CharacterDirector } from "@mimica/character-runtime";
import { reduceAgentEvent } from "../lib/agentSessionUpdate";

export interface UseAgentEventsOptions {
  devPreview: boolean;
  director: CharacterDirector;
  setAllSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusText: React.Dispatch<React.SetStateAction<string>>;
}

export interface UseAgentEventsResult {
  handleAgentEvent: (event: AgentEventMessage) => void;
  resetStream: () => void;
  beginStream: () => string;
}

export function useAgentEvents(options: UseAgentEventsOptions): UseAgentEventsResult {
  const { devPreview, director, setAllSessions, setIsStreaming, setStatusText } = options;

  const streamingContentRef = useRef("");
  const activeStreamIdRef = useRef<string | null>(null);
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
      setStatusText(avatarStatusLabel("idle"));
    }, delayMs);
  };

  const resetStream = useCallback(() => {
    streamingContentRef.current = "";
    activeStreamIdRef.current = null;
  }, []);

  const beginStream = useCallback(() => {
    clearCompletionTimeout();
    streamingContentRef.current = "";
    const id = uuidv4();
    activeStreamIdRef.current = id;
    return id;
  }, []);

  useEffect(() => () => clearCompletionTimeout(), []);

  const handleAgentEvent = useCallback(
    (event: AgentEventMessage) => {
      if (devPreview) return;

      switch (event.type) {
        case "agent_state": {
          const avatar = mapAgentRunToAvatar(event.state);
          director.setState(avatar, true);
          setStatusText(avatarStatusLabel(avatar));
          if (event.state === "streaming") setIsStreaming(true);
          if (
            event.state === "completed" ||
            event.state === "failed" ||
            event.state === "cancelled"
          ) {
            setIsStreaming(false);
          }
          break;
        }
        case "agent_warning":
          setStatusText(event.message);
          break;
        case "agent_delta": {
          streamingContentRef.current += event.content;
          setAllSessions(
            (prev) =>
              reduceAgentEvent(prev, event, {
                streamId: activeStreamIdRef.current,
                content: streamingContentRef.current,
              }).sessions,
          );
          break;
        }
        case "agent_tool": {
          setAllSessions(
            (prev) =>
              reduceAgentEvent(prev, event, {
                streamId: activeStreamIdRef.current,
                content: streamingContentRef.current,
              }).sessions,
          );
          break;
        }
        case "agent_complete": {
          setAllSessions((prev) => {
            const result = reduceAgentEvent(prev, event, {
              streamId: activeStreamIdRef.current,
              content: streamingContentRef.current,
            });
            if (result.sideEffect.type === "save_session") {
              void window.mimica.saveSession(result.sideEffect.session);
            }
            return result.sessions;
          });
          streamingContentRef.current = "";
          activeStreamIdRef.current = null;
          director.setState("success", true);
          setStatusText(avatarStatusLabel("success"));
          setIsStreaming(false);
          scheduleReturnToIdle(1200);
          break;
        }
        case "agent_error": {
          resetStream();
          setIsStreaming(false);
          director.setState("error", true);
          setStatusText(event.message);
          clearCompletionTimeout();
          completionTimeoutRef.current = setTimeout(() => {
            completionTimeoutRef.current = null;
            director.setState("idle", true);
            setStatusText(avatarStatusLabel("idle"));
          }, 2000);
          break;
        }
        default:
          break;
      }
    },
    [devPreview, director, resetStream, setAllSessions, setIsStreaming, setStatusText],
  );

  return { handleAgentEvent, resetStream, beginStream };
}

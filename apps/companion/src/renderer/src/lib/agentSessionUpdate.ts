import { v4 as uuidv4 } from "uuid";
import type { AgentEventMessage, ChatMessage, ChatSession } from "@mimica/shared";

export function streamMessageId(runId: string, activeStreamId: string | null): string {
  return activeStreamId ?? `stream-${runId}`;
}

export function applyAgentDelta(
  sessions: ChatSession[],
  sessionId: string,
  runId: string,
  streamId: string,
  content: string,
): ChatSession[] {
  const partial: ChatMessage = {
    id: streamId,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    agentRunId: runId,
  };
  return sessions.map((s) => {
    if (s.id !== sessionId) return s;
    const rest = s.messages.filter((m) => m.id !== streamId);
    return { ...s, messages: [...rest, partial] };
  });
}

export function applyAgentComplete(
  sessions: ChatSession[],
  sessionId: string,
  runId: string,
  streamId: string,
  content: string,
): { sessions: ChatSession[]; updatedSession: ChatSession | undefined } {
  const assistantMsg: ChatMessage = {
    id: uuidv4(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    agentRunId: runId,
  };
  let updatedSession: ChatSession | undefined;
  const next = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    const rest = s.messages.filter((m) => m.id !== streamId);
    updatedSession = { ...s, messages: [...rest, assistantMsg] };
    return updatedSession;
  });
  return { sessions: next, updatedSession };
}

export function applyAgentTool(
  sessions: ChatSession[],
  sessionId: string,
  runId: string,
  streamId: string,
  streamContent: string,
  name: string,
  detail?: string,
): ChatSession[] {
  const tool = { id: uuidv4(), name, detail };
  return sessions.map((s) => {
    if (s.id !== sessionId) return s;
    const idx = s.messages.findIndex((m) => m.id === streamId);
    if (idx === -1) {
      return {
        ...s,
        messages: [
          ...s.messages,
          {
            id: streamId,
            role: "assistant" as const,
            content: streamContent,
            createdAt: new Date().toISOString(),
            agentRunId: runId,
            toolCalls: [tool],
          },
        ],
      };
    }
    const messages = [...s.messages];
    const msg = messages[idx]!;
    messages[idx] = {
      ...msg,
      toolCalls: [...(msg.toolCalls ?? []), tool],
    };
    return { ...s, messages };
  });
}

export type AgentSessionSideEffect =
  | { type: "save_session"; session: ChatSession }
  | { type: "none" };

export function reduceAgentEvent(
  sessions: ChatSession[],
  event: AgentEventMessage,
  stream: { streamId: string | null; content: string },
): { sessions: ChatSession[]; sideEffect: AgentSessionSideEffect } {
  switch (event.type) {
    case "agent_delta": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      return {
        sessions: applyAgentDelta(sessions, event.sessionId, event.runId, streamId, stream.content),
        sideEffect: { type: "none" },
      };
    }
    case "agent_complete": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      const { sessions: next, updatedSession } = applyAgentComplete(
        sessions,
        event.sessionId,
        event.runId,
        streamId,
        event.content,
      );
      return {
        sessions: next,
        sideEffect: updatedSession
          ? { type: "save_session", session: updatedSession }
          : { type: "none" },
      };
    }
    case "agent_tool": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      return {
        sessions: applyAgentTool(
          sessions,
          event.sessionId,
          event.runId,
          streamId,
          stream.content,
          event.name,
          event.detail,
        ),
        sideEffect: { type: "none" },
      };
    }
    default:
      return { sessions, sideEffect: { type: "none" } };
  }
}

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
): ChatSession[] {
  return sessions.map((s) => {
    if (s.id !== sessionId) return s;

    const streamIndex = s.messages.findIndex((m) => m.id === streamId);
    const runIndex = s.messages.findIndex(
      (m) => m.role === "assistant" && m.agentRunId === runId,
    );
    const targetIndex = streamIndex >= 0 ? streamIndex : runIndex;

    if (targetIndex >= 0) {
      const messages = s.messages.map((m, i) =>
        i === targetIndex ? { ...m, content, agentRunId: runId } : m,
      );
      const keepId = messages[targetIndex]!.id;
      return {
        ...s,
        messages: messages.filter(
          (m) =>
            m.id === keepId ||
            !(m.role === "assistant" && m.agentRunId === runId),
        ),
      };
    }

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      agentRunId: runId,
    };
    return { ...s, messages: [...s.messages, assistantMsg] };
  });
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

export function reduceAgentEvent(
  sessions: ChatSession[],
  event: AgentEventMessage,
  stream: { streamId: string | null; content: string },
): ChatSession[] {
  switch (event.type) {
    case "agent_delta": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      return applyAgentDelta(sessions, event.sessionId, event.runId, streamId, stream.content);
    }
    case "agent_complete": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      return applyAgentComplete(sessions, event.sessionId, event.runId, streamId, event.content);
    }
    case "agent_tool": {
      const streamId = streamMessageId(event.runId, stream.streamId);
      return applyAgentTool(
        sessions,
        event.sessionId,
        event.runId,
        streamId,
        stream.content,
        event.name,
        event.detail,
      );
    }
    default:
      return sessions;
  }
}

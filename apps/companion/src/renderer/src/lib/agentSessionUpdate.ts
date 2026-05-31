import type { ChatMessage, ChatSession } from "@mimica/shared";
import { upsertAssistantTurn } from "@mimica/shared";

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
  return sessions.map((s) =>
    s.id === sessionId ? upsertAssistantTurn(s, { runId, content, streamId }) : s,
  );
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
  const tool = { id: crypto.randomUUID(), name, detail };
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

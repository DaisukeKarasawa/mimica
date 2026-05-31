import type { ChatMessage, ChatSession } from "./chat.js";

export interface UpsertAssistantTurnParams {
  runId: string;
  content: string;
  /** In-flight stream bubble id; preferred over runId-only match when set. */
  streamId?: string;
}

/**
 * One agent run → one assistant message. Updates stream bubble or existing run,
 * dedupes duplicate assistant rows for the same runId, or appends.
 */
export function upsertAssistantTurn(
  session: ChatSession,
  params: UpsertAssistantTurnParams,
): ChatSession {
  const { runId, content, streamId } = params;

  const streamIndex = streamId ? session.messages.findIndex((m) => m.id === streamId) : -1;
  const runIndex = session.messages.findIndex(
    (m) => m.role === "assistant" && m.agentRunId === runId,
  );
  const targetIndex = streamIndex >= 0 ? streamIndex : runIndex;

  if (targetIndex >= 0) {
    const messages = session.messages.map((m, i) =>
      i === targetIndex ? { ...m, content, agentRunId: runId } : m,
    );
    const keepId = messages[targetIndex]!.id;
    return {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: messages.filter(
        (m) => m.id === keepId || !(m.role === "assistant" && m.agentRunId === runId),
      ),
    };
  }

  const assistantMsg: ChatMessage = {
    id: streamId ?? crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    agentRunId: runId,
  };
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    messages: [...session.messages, assistantMsg],
  };
}

import type { ChatMessage, ChatSession } from "@mimica/shared";
import { upsertAssistantTurn } from "@mimica/shared";

/** Persist the final assistant turn after an agent run completes (idempotent per runId). */
export function appendAssistantMessage(
  session: ChatSession,
  content: string,
  runId: string,
): ChatSession {
  return upsertAssistantTurn(session, { runId, content });
}

export function appendUserMessage(session: ChatSession, content: string, id?: string): ChatSession {
  const userMsg: ChatMessage = {
    id: id ?? crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    messages: [...session.messages, userMsg],
  };
}

/**
 * History for the agent prompt: the current user turn is sent separately in
 * `## User message`, so omit it when it matches the submitted prompt.
 */
export function historyForAgentPrompt(messages: ChatMessage[], prompt: string): ChatMessage[] {
  const last = messages.at(-1);
  if (last?.role === "user" && last.content === prompt) {
    return messages.slice(0, -1);
  }
  return messages;
}

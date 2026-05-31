import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, ChatSession } from "@mimica/shared";

/** Persist the final assistant turn after an agent run completes (idempotent per runId). */
export function appendAssistantMessage(
  session: ChatSession,
  content: string,
  runId: string,
): ChatSession {
  const existingIndex = session.messages.findIndex(
    (m) => m.role === "assistant" && m.agentRunId === runId,
  );
  if (existingIndex >= 0) {
    const messages = session.messages.map((m, i) =>
      i === existingIndex ? { ...m, content, agentRunId: runId } : m,
    );
    return {
      ...session,
      updatedAt: new Date().toISOString(),
      messages,
    };
  }

  const assistantMsg: ChatMessage = {
    id: uuidv4(),
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

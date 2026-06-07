import type { ChatMessage } from "@mimica/shared";

/** Max user+assistant pairs replayed when cold-starting an agent (no SDK follow-up context). */
export const MAX_AGENT_HISTORY_TURNS = 8;

export function trimChatHistoryForPrompt(messages: ChatMessage[]): ChatMessage[] {
  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const maxMessages = MAX_AGENT_HISTORY_TURNS * 2;
  if (turns.length <= maxMessages) return turns;
  return turns.slice(-maxMessages);
}

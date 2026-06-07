/**
 * Agent prompt strategy for Mimica session pool follow-ups.
 *
 * States:
 * - **coldStart** (`isFollowUp === false`): new SDK agent; send preamble, persona, trimmed
 *   history (see `trimChatHistoryForPrompt`), context, and user message.
 * - **followUp** (`isFollowUp === true`): reused SDK agent with prior turns in memory; send
 *   mode preamble (Ask/Plan/Agent constraints), a compact persona reminder, the persona pack
 *   rules, editor context (if any), and the user message. Conversation history is not replayed.
 * - **recycledAgent**: pool entry invalidated (workspace/mode/apiKey change); treated as
 *   coldStart on the replacement agent (`turnsSent` reset to 0).
 *
 * `turnsSent` increments only after a successful run (`markTurnSent`). Failed/cancelled runs
 * keep the prior count so the next attempt can cold-start with history replay when needed.
 */

export type AgentPromptStrategy = "coldStart" | "followUp";

export function promptStrategyForFollowUp(isFollowUp: boolean): AgentPromptStrategy {
  return isFollowUp ? "followUp" : "coldStart";
}

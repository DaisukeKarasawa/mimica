import type { AgentQuestionAnswerPayload, AgentQuestionPrompt } from "@mimica/shared";

/**
 * Canonical follow-up text when SDK rejects AskQuestion (Phase 1 fallback).
 *
 * Format (fixed in Phase 0 #32):
 * ```
 * [AskQuestion answers]
 * ## <title or first prompt>
 * - Q: <prompt>
 *   A: <comma-separated option labels> / <freeform if any>
 * ```
 */
export function buildAskQuestionFollowUpText(
  prompt: AgentQuestionPrompt,
  payload: AgentQuestionAnswerPayload,
): string {
  const heading = prompt.title?.trim() || prompt.questions[0]?.prompt || "Questions";
  const lines: string[] = ["[AskQuestion answers]", `## ${heading}`];

  for (const item of prompt.questions) {
    const answer = payload.answers.find((entry) => entry.questionId === item.id);
    const labels = (answer?.selectedOptionIds ?? [])
      .map((optionId) => item.options.find((option) => option.id === optionId)?.label)
      .filter((label): label is string => !!label && label.length > 0);

    let answerText = labels.join(", ");
    const freeform = answer?.freeformText?.trim();
    if (freeform) {
      answerText = answerText ? `${answerText} / ${freeform}` : freeform;
    }
    if (!answerText) {
      answerText = "(no answer)";
    }

    lines.push(`- Q: ${item.prompt}`, `  A: ${answerText}`);
  }

  return lines.join("\n");
}

/** Defensive match for AskQuestion tool names across SDK / stream variants. */
export function isAskQuestionToolName(name: string | undefined): boolean {
  if (!name) return false;
  const normalized = name.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return normalized === "askquestion";
}

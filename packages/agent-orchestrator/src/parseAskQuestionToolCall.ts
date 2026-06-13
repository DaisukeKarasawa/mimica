import { randomUUID } from "node:crypto";
import type { AgentQuestionItem, AgentQuestionPrompt } from "@mimica/shared";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseOptions(raw: unknown): AgentQuestionItem["options"] {
  if (!Array.isArray(raw)) return [];
  const options: AgentQuestionItem["options"] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = readString(record.id);
    const label = readString(record.label);
    if (!id || !label) continue;
    options.push({ id, label });
  }
  return options;
}

/**
 * Defensive parse of AskQuestion tool_call args (SDK proto shape; all fields optional).
 * Returns null on unknown shape without throwing.
 */
export function parseAskQuestionToolCall(
  args: unknown,
  runId: string,
  toolCallId?: string,
): AgentQuestionPrompt | null {
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;
  const title = readString(record.title);
  const rawQuestions = record.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return null;

  const questions: AgentQuestionItem[] = [];
  for (const raw of rawQuestions) {
    if (!raw || typeof raw !== "object") continue;
    const question = raw as Record<string, unknown>;
    const id = readString(question.id);
    const prompt = readString(question.prompt);
    if (!id || !prompt) continue;
    const options = parseOptions(question.options);
    if (options.length === 0) continue;
    const allowMultiple = question.allow_multiple === true || question.allowMultiple === true;
    questions.push({ id, prompt, options, allowMultiple });
  }

  if (questions.length === 0) return null;

  return {
    id: randomUUID(),
    runId,
    toolCallId,
    title,
    questions,
    source: "tool_call_stream",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

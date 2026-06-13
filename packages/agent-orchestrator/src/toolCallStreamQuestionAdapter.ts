import type { AgentQuestionPrompt } from "@mimica/shared";
import { isAskQuestionToolName } from "./agentQuestionFollowUp.js";
import { parseAskQuestionToolCall } from "./parseAskQuestionToolCall.js";

interface ToolCallStreamEvent {
  type: "tool_call";
  name: string;
  status: string;
  args?: unknown;
  runId?: string;
  toolCallId?: string;
}

function isToolCallStreamEvent(event: unknown): event is ToolCallStreamEvent {
  if (!event || typeof event !== "object") return false;
  const record = event as Record<string, unknown>;
  return (
    record.type === "tool_call" &&
    typeof record.name === "string" &&
    typeof record.status === "string"
  );
}

const pendingRunIds = new Set<string>();

/** Phase 1 fallback: parse AskQuestion from tool_call stream events. */
export function tryParseAskQuestionStreamEvent(event: unknown): AgentQuestionPrompt | null {
  if (!isToolCallStreamEvent(event)) return null;
  if (event.status !== "running" || !isAskQuestionToolName(event.name)) return null;
  if (!event.runId) return null;
  if (pendingRunIds.has(event.runId)) return null;
  if (event.args == null) return null;

  const prompt = parseAskQuestionToolCall(event.args, event.runId, event.toolCallId);
  if (!prompt) return null;

  pendingRunIds.add(event.runId);
  return prompt;
}

/** Clear per-run dedup state when the SDK run finishes or the question is resolved. */
export function releaseAskQuestionStreamRun(runId: string): void {
  pendingRunIds.delete(runId);
}

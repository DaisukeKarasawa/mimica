import type { AgentQuestionPrompt } from "@mimica/shared";
import type { AgentQuestionAdapter } from "./agentQuestionAdapter.js";
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

/** Phase 1 fallback: parse AskQuestion from tool_call stream events. */
export class ToolCallStreamQuestionAdapter implements AgentQuestionAdapter {
  private readonly pendingRunIds = new Set<string>();

  tryParseQuestion(event: unknown): AgentQuestionPrompt | null {
    if (!isToolCallStreamEvent(event)) return null;
    if (event.status !== "running" || !isAskQuestionToolName(event.name)) return null;
    if (!event.runId) return null;
    if (this.pendingRunIds.has(event.runId)) return null;
    if (event.args == null) return null;

    const prompt = parseAskQuestionToolCall(event.args, event.runId, event.toolCallId);
    if (!prompt) return null;

    this.pendingRunIds.add(event.runId);
    return prompt;
  }

  releaseRun(runId: string): void {
    this.pendingRunIds.delete(runId);
  }

  async submitAnswer(_ctx: Parameters<AgentQuestionAdapter["submitAnswer"]>[0]): Promise<void> {}

  async dismissQuestion(
    _ctx: Parameters<AgentQuestionAdapter["dismissQuestion"]>[0],
  ): Promise<void> {}
}

const defaultQuestionAdapter = new ToolCallStreamQuestionAdapter();

export { defaultQuestionAdapter };

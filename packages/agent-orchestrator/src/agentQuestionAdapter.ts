import type { AgentQuestionAnswerPayload, AgentQuestionPrompt } from "@mimica/shared";
import { isAskQuestionToolName } from "./agentQuestionFollowUp.js";

export interface AgentQuestionAnswerContext {
  sessionId: string;
  runId: string;
  prompt: AgentQuestionPrompt;
  payload: AgentQuestionAnswerPayload;
}

export interface AgentQuestionDismissContext {
  sessionId: string;
  runId: string;
  questionPromptId: string;
  prompt: AgentQuestionPrompt;
}

export interface AgentQuestionAdapter {
  /** Detect a structured question from a stream / interaction event. */
  tryParseQuestion(event: unknown): AgentQuestionPrompt | null;

  /** Reflect user answers back to the agent run (Phase 1: follow-up, Phase 2: SDK). */
  submitAnswer(ctx: AgentQuestionAnswerContext): Promise<void>;

  /** Skip / dismiss without sending a follow-up (v1 default). */
  dismissQuestion(ctx: AgentQuestionDismissContext): Promise<void>;
}

interface ToolCallStreamEvent {
  type: "tool_call";
  name: string;
  status: string;
  args?: unknown;
  runId?: string;
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

/** Phase 0 stub — logs AskQuestion stream shape; full parse lands in Phase 1 (#33). */
export class StubAgentQuestionAdapter implements AgentQuestionAdapter {
  tryParseQuestion(event: unknown): AgentQuestionPrompt | null {
    if (!isToolCallStreamEvent(event)) return null;
    if (event.status !== "running" || !isAskQuestionToolName(event.name)) return null;

    console.info("[ask-question-spike]", {
      runId: event.runId,
      toolName: event.name,
      status: event.status,
      hasArgs: event.args != null,
      argKeys:
        event.args && typeof event.args === "object"
          ? Object.keys(event.args as Record<string, unknown>)
          : [],
      argsPreview: event.args,
    });
    return null;
  }

  async submitAnswer(_ctx: AgentQuestionAnswerContext): Promise<void> {}

  async dismissQuestion(_ctx: AgentQuestionDismissContext): Promise<void> {}
}

const defaultQuestionAdapter = new StubAgentQuestionAdapter();

export { defaultQuestionAdapter };

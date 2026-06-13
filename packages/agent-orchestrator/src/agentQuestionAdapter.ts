import type { AgentQuestionAnswerPayload, AgentQuestionPrompt } from "@mimica/shared";

export interface AgentQuestionAnswerContext {
  sessionId: string;
  runId: string;
  prompt: AgentQuestionPrompt;
  payload: AgentQuestionAnswerPayload;
}

export interface AgentQuestionDismissContext {
  sessionId: string;
  runId: string;
  questionId: string;
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

/** Phase 0 stub — stream parsing and IPC wiring land in Phase 1 (#33). */
export class StubAgentQuestionAdapter implements AgentQuestionAdapter {
  tryParseQuestion(_event: unknown): AgentQuestionPrompt | null {
    return null;
  }

  async submitAnswer(_ctx: AgentQuestionAnswerContext): Promise<void> {}

  async dismissQuestion(_ctx: AgentQuestionDismissContext): Promise<void> {}
}

export const stubAgentQuestionAdapter = new StubAgentQuestionAdapter();

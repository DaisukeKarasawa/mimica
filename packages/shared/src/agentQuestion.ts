import type { AgentMode } from "./chat.js";

/**
 * Ask Questions domain model (Epic #31 / Phase 0 #32).
 *
 * State machine (v1):
 * ```
 * (run active) → tool_call AskQuestion detected → agent_question emitted → waiting
 * waiting + user answers → agent_question_resolved(answered) → follow-up submitAgent
 * waiting + dismiss → agent_question_resolved(dismissed)
 * run completes while pending → question stays pending until user acts (v1 default)
 * ```
 */

export type AgentQuestionSource = "sdk_native" | "tool_call_stream";

export type AgentQuestionStatus = "pending" | "answered" | "dismissed" | "expired";

export interface AgentQuestionOption {
  id: string;
  label: string;
}

export interface AgentQuestionItem {
  id: string;
  prompt: string;
  options: AgentQuestionOption[];
  allowMultiple: boolean;
}

export interface AgentQuestionPrompt {
  /** Mimica correlation id (UUID). */
  id: string;
  runId: string;
  /** SDK / stream linkage when available. */
  toolCallId?: string;
  title?: string;
  questions: AgentQuestionItem[];
  source: AgentQuestionSource;
  status: AgentQuestionStatus;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface AgentQuestionAnswerEntry {
  questionId: string;
  selectedOptionIds: string[];
  freeformText?: string;
}

export interface AgentQuestionAnswerPayload {
  questionPromptId: string;
  answers: AgentQuestionAnswerEntry[];
}

/** Renderer → main IPC: submit structured answers. */
export interface AgentQuestionAnswerInput {
  sessionId: string;
  runId: string;
  mode: AgentMode;
  payload: AgentQuestionAnswerPayload;
}

/** Renderer → main IPC: dismiss without follow-up. */
export interface AgentQuestionDismissInput {
  sessionId: string;
  runId: string;
  questionPromptId: string;
}

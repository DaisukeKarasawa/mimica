import type { AgentQuestionPrompt, AgentQuestionStatus } from "./agentQuestion.js";
import type { AgentRunState, AvatarState, MessageContext, MimicaSettings } from "./chat.js";

export type { MimicaSettings };

export interface CodeSymbolResult {
  name: string;
  kind: string;
  /** Workspace-relative path with POSIX separators. */
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface EditorContext {
  workspacePath: string;
  currentFilePath?: string;
  currentFileLanguage?: string;
  selectedText?: string;
  selectionStartLine?: number;
  selectionEndLine?: number;
}

export type ClientMessage =
  | { type: "ping"; token: string }
  | { type: "context_update"; context: EditorContext; token: string }
  | { type: "companion_ready"; token: string }
  | { type: "symbol_search_result"; requestId: string; token: string; symbols: CodeSymbolResult[] };

export type ServerMessage =
  | { type: "pong" }
  | { type: "connection_ack"; port: number }
  | { type: "context_ack"; context: EditorContext }
  | { type: "symbol_search_request"; requestId: string; query: string; limit: number };

export type CompanionMessage =
  | { type: "chat_submit"; sessionId: string; content: string; context?: MessageContext }
  | { type: "chat_cancel"; sessionId: string; runId: string }
  | { type: "settings_get" }
  | { type: "settings_update"; settings: Partial<MimicaSettings> };

export interface AgentCancelPayload {
  sessionId: string;
  runId?: string;
}

export type AgentEventMessage =
  | { type: "agent_state"; sessionId: string; state: AgentRunState; runId?: string }
  | { type: "agent_delta"; sessionId: string; runId: string; content: string }
  | { type: "agent_tool"; sessionId: string; runId: string; name: string; detail?: string }
  | { type: "agent_complete"; sessionId: string; runId: string; content: string }
  | { type: "agent_error"; sessionId: string; runId: string; message: string }
  | { type: "agent_warning"; sessionId: string; message: string }
  | { type: "agent_perf"; sessionId: string; runId: string; t0EpochMs: number }
  | {
      type: "agent_readout";
      sessionId: string;
      runId: string;
      phase: "start" | "end";
    }
  | {
      type: "agent_question";
      sessionId: string;
      runId: string;
      question: AgentQuestionPrompt;
    }
  | {
      type: "agent_question_resolved";
      sessionId: string;
      runId: string;
      questionPromptId: string;
      status: AgentQuestionStatus;
    };

export function mapAgentRunToAvatar(state: AgentRunState): AvatarState {
  switch (state) {
    case "thinking":
      return "thinking";
    case "streaming":
      return "talking";
    case "waiting":
      return "waiting";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "cancelled":
      return "cancelled";
    case "idle":
    default:
      return "idle";
  }
}

import type { AgentRunState, AvatarState, ChatSession } from "@mimica/shared";

/** Renderer UI subset derived from {@link AgentRunState} plus voice-readout phases. */
export type SessionRunStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "readout"
  | "revealing"
  | "error";

export interface SessionRunState {
  status: SessionRunStatus;
  runId?: string;
}

export const IDLE_SESSION_RUN: SessionRunState = { status: "idle" };

export function isSessionRunActive(state: SessionRunState | undefined): boolean {
  return (
    state?.status === "thinking" ||
    state?.status === "streaming" ||
    state?.status === "readout" ||
    state?.status === "revealing"
  );
}

export function runStatusFromAgentState(state: AgentRunState): SessionRunStatus {
  switch (state) {
    case "thinking":
      return "thinking";
    case "streaming":
      return "streaming";
    case "failed":
      return "error";
    case "cancelled":
    case "completed":
    case "idle":
    case "waiting":
      return "idle";
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled AgentRunState: ${_exhaustive}`);
    }
  }
}

/** Avatar motion: only voice readout uses talking; LLM streaming stays thinking. */
export function mapSessionRunToAvatar(status: SessionRunStatus): AvatarState {
  switch (status) {
    case "readout":
      return "talking";
    case "streaming":
    case "thinking":
      return "thinking";
    case "revealing":
    case "idle":
      return "idle";
    case "error":
      return "error";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled SessionRunStatus: ${_exhaustive}`);
    }
  }
}

/** Icon + bubble + dots until this run's answer text is visible in the chat list. */
export function shouldShowAssistantPendingIndicator(
  status: SessionRunStatus,
  session: ChatSession | null,
  runId: string | null | undefined,
): boolean {
  if (!session || !runId) return false;
  if (status !== "thinking" && status !== "streaming" && status !== "readout") {
    return false;
  }
  const hasVisibleAnswer = session.messages.some(
    (message) =>
      message.role === "assistant" &&
      message.agentRunId === runId &&
      Boolean(message.content.trim()),
  );
  return !hasVisibleAnswer;
}

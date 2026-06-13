import type { AgentRunState } from "@mimica/shared";

/** Renderer UI subset derived from {@link AgentRunState}. */
export type SessionRunStatus = "idle" | "thinking" | "streaming" | "error";

export interface SessionRunState {
  status: SessionRunStatus;
  runId?: string;
}

export const IDLE_SESSION_RUN: SessionRunState = { status: "idle" };

export function isSessionRunActive(state: SessionRunState | undefined): boolean {
  return state?.status === "thinking" || state?.status === "streaming";
}

export function runStatusFromAgentState(state: AgentRunState): SessionRunStatus | null {
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
      return _exhaustive;
    }
  }
}

export type SessionRunStatus = "idle" | "thinking" | "streaming" | "error";

export interface SessionRunState {
  status: SessionRunStatus;
  runId?: string;
}

export const IDLE_SESSION_RUN: SessionRunState = { status: "idle" };

export function isSessionRunActive(state: SessionRunState | undefined): boolean {
  return state?.status === "thinking" || state?.status === "streaming";
}

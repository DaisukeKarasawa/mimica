import type { AgentRunState } from "@mimica/shared";

/** Active-session `completed` is deferred until stream reveal finalizes. */
export function shouldApplyAgentStateToSessionRun(
  state: AgentRunState,
  isActiveSession: boolean,
): boolean {
  if (state === "completed" && isActiveSession) {
    return false;
  }
  return true;
}

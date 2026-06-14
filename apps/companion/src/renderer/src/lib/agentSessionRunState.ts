import type { AgentRunState } from "@mimica/shared";

/** Active-session `completed` may arrive after `agent_complete` finalizes the turn. */
export function shouldApplyAgentStateToSessionRun(
  state: AgentRunState,
  isActiveSession: boolean,
): boolean {
  if (state === "completed" && isActiveSession) {
    return false;
  }
  return true;
}

import { isAskQuestionToolName } from "./agentQuestionFollowUp.js";

/**
 * Phase 0 stream spike (#32): log AskQuestion tool_call shape once per run.
 * Manual verification: Plan mode + ambiguous prompt → inspect companion main logs.
 */
export function logAskQuestionStreamSpike(params: {
  runId: string;
  toolName: string;
  status: string;
  args: unknown;
}): void {
  if (!isAskQuestionToolName(params.toolName)) return;
  if (params.status !== "running") return;

  console.info("[ask-question-spike]", {
    runId: params.runId,
    toolName: params.toolName,
    status: params.status,
    hasArgs: params.args != null,
    argKeys:
      params.args && typeof params.args === "object"
        ? Object.keys(params.args as Record<string, unknown>)
        : [],
    argsPreview: params.args,
  });
}

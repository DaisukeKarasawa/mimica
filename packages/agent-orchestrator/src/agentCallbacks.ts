import type { AgentQuestionPrompt, AgentRunError, AgentRunState } from "@mimica/shared";

/**
 * Terminal failure contract: orchestrator emits `failed` state, then `onError` with
 * the same runId so companion can replace partial stream content via `agent_error`.
 */
export interface AgentRunCallbacks {
  onState: (state: AgentRunState) => void;
  onDelta: (chunk: string) => void;
  onComplete: (content: string) => void;
  onError: (error: AgentRunError) => void;
  onTool?: (name: string, detail?: string) => void;
  onWarning?: (message: string) => void;
  onQuestion?: (question: AgentQuestionPrompt) => void;
}

import type { AgentRunError, AgentRunState } from "@mimica/shared";

export interface AgentRunCallbacks {
  onState: (state: AgentRunState) => void;
  onDelta: (chunk: string) => void;
  onComplete: (content: string) => void;
  onError: (error: AgentRunError) => void;
  onTool?: (name: string, detail?: string) => void;
  onWarning?: (message: string) => void;
}

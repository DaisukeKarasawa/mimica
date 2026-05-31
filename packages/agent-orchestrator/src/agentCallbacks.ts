import type { AgentRunState } from "@mimica/shared";

export interface AgentRunCallbacks {
  onState: (state: AgentRunState) => void;
  onDelta: (chunk: string) => void;
  onComplete: (content: string) => void;
  onError: (message: string) => void;
  onTool?: (name: string, detail?: string) => void;
  onWarning?: (message: string) => void;
}

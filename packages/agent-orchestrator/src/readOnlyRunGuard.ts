import type { Run } from "@cursor/sdk";
import { cancelRun } from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { isAskDeniedTool, READ_ONLY_TOOL_ERROR } from "./readOnlyPolicy.js";
import { agentRunError } from "@mimica/shared";
import { isBlockedToolCallStatus, toolCallName } from "./toolCallName.js";

/** Single enforcement point for Ask-mode write-tool blocking (onDelta + stream). */
export class ReadOnlyRunGuard {
  private blocked = false;

  constructor(
    private readonly getRun: () => Run | null,
    private readonly callbacks: AgentRunCallbacks,
  ) {}

  get isBlocked(): boolean {
    return this.blocked;
  }

  async blockDeniedTool(name: string): Promise<void> {
    if (this.blocked) return;
    this.blocked = true;
    try {
      await cancelRun(this.getRun());
    } finally {
      this.callbacks.onState("failed");
      this.callbacks.onError(agentRunError("read_only_blocked", READ_ONLY_TOOL_ERROR(name)));
    }
  }

  async handleSendDelta(
    update: { type: string; toolCall?: unknown },
    isCancelled: () => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.blocked || isCancelled() || signal?.aborted) return;
    if (update.type !== "tool-call-started" && update.type !== "partial-tool-call") return;
    const name = toolCallName(update.toolCall);
    if (name && isAskDeniedTool(name)) {
      await this.blockDeniedTool(name);
    }
  }

  async handleStreamToolCall(name: string, status: string | undefined): Promise<boolean> {
    if (this.blocked) return false;
    if (isAskDeniedTool(name) && isBlockedToolCallStatus(status)) {
      await this.blockDeniedTool(name);
      return true;
    }
    return false;
  }
}

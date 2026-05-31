import type { Run } from "@cursor/sdk";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { isWriteTool, READ_ONLY_TOOL_ERROR } from "./readOnlyPolicy.js";
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

  async blockWriteTool(name: string): Promise<void> {
    if (this.blocked) return;
    this.blocked = true;
    await this.getRun()?.cancel();
    this.callbacks.onState("failed");
    this.callbacks.onError(READ_ONLY_TOOL_ERROR(name));
  }

  async handleSendDelta(
    update: { type: string; toolCall?: unknown },
    isCancelled: () => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.blocked || isCancelled() || signal?.aborted) return;
    if (update.type !== "tool-call-started" && update.type !== "partial-tool-call") return;
    const name = toolCallName(update.toolCall);
    if (name && isWriteTool(name)) {
      await this.blockWriteTool(name);
    }
  }

  async handleStreamToolCall(name: string, status: string | undefined): Promise<boolean> {
    if (this.blocked) return false;
    if (isWriteTool(name) && isBlockedToolCallStatus(status)) {
      await this.blockWriteTool(name);
      return true;
    }
    return false;
  }
}

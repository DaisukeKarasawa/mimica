import type { WebContents } from "electron";
import type { AgentEventMessage, AgentRunState } from "@mimica/shared";

export function emitAgentEvent(wc: WebContents | undefined, event: AgentEventMessage): void {
  wc?.send("agent-event", event);
}

export class AgentRunEmitter {
  constructor(
    private readonly wc: WebContents | undefined,
    private readonly sessionId: string,
    private readonly runId: string,
    private readonly isActive: () => boolean,
  ) {}

  state(agentState: AgentRunState): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_state",
      sessionId: this.sessionId,
      state: agentState,
      runId: this.runId,
    });
  }

  delta(content: string): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_delta",
      sessionId: this.sessionId,
      runId: this.runId,
      content,
    });
  }

  tool(name: string, detail?: string): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_tool",
      sessionId: this.sessionId,
      runId: this.runId,
      name,
      detail,
    });
  }

  complete(content: string): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_complete",
      sessionId: this.sessionId,
      runId: this.runId,
      content,
    });
  }

  error(message: string): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_error",
      sessionId: this.sessionId,
      runId: this.runId,
      message,
    });
  }

  warning(message: string): void {
    emitAgentEvent(this.wc, {
      type: "agent_warning",
      sessionId: this.sessionId,
      message,
    });
  }

  perf(t0EpochMs: number): void {
    if (!this.isActive()) return;
    emitAgentEvent(this.wc, {
      type: "agent_perf",
      sessionId: this.sessionId,
      runId: this.runId,
      t0EpochMs,
    });
  }
}

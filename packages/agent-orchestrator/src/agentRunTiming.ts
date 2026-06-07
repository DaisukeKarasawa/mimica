import { performance } from "node:perf_hooks";

const LOG_PREFIX = "[mimica:agent-perf]";

/** Set `MIMICA_AGENT_PERF=1` when launching Companion to emit timing logs. */
export function isAgentPerfEnabled(): boolean {
  return process.env.MIMICA_AGENT_PERF === "1";
}

export type AgentRunTimingMarkId =
  | "T0_submit"
  | "T1_agent_ready"
  | "T1_send_done"
  | "T2_first_activity"
  | "T2_first_tool"
  | "T2_first_delta"
  | "T3_last_tool_done"
  | "T4_run_wait"
  | "T4_complete";

export interface AgentRunTimingMeta {
  mode?: string;
  isFollowUp?: boolean;
  workspacePath?: string;
  promptChars?: number;
}

export class AgentRunTimingTrace {
  private readonly startedAt = performance.now();
  private readonly marks = new Map<AgentRunTimingMarkId, number>();

  constructor(
    readonly runId: string,
    readonly meta: AgentRunTimingMeta = {},
  ) {
    this.markOnce("T0_submit");
  }

  markOnce(id: AgentRunTimingMarkId): void {
    if (!this.marks.has(id)) {
      this.marks.set(id, performance.now());
    }
  }

  /** For events that should reflect the latest occurrence (e.g. last tool done). */
  markLatest(id: AgentRunTimingMarkId): void {
    this.marks.set(id, performance.now());
  }

  elapsedMs(id: AgentRunTimingMarkId): number | null {
    const at = this.marks.get(id);
    if (at == null) return null;
    return Math.round(at - this.startedAt);
  }

  segmentMs(from: AgentRunTimingMarkId, to: AgentRunTimingMarkId): number | null {
    const a = this.marks.get(from);
    const b = this.marks.get(to);
    if (a == null || b == null) return null;
    return Math.round(b - a);
  }

  report(outcome: "completed" | "cancelled" | "failed" | "blocked"): void {
    if (!isAgentPerfEnabled()) return;

    const segments: Record<string, number | null> = {
      "T0→T1_agent起動": this.segmentMs("T0_submit", "T1_agent_ready"),
      "T1→T1send_send完了": this.segmentMs("T1_agent_ready", "T1_send_done"),
      "T1send→T2_初回イベント": this.segmentMs("T1_send_done", "T2_first_activity"),
      "T2→T2delta_初回表示delta": this.segmentMs("T2_first_activity", "T2_first_delta"),
      "T1send→T2delta_表示開始まで": this.segmentMs("T1_send_done", "T2_first_delta"),
      "T2tool→T3_ツール調査": this.segmentMs("T2_first_tool", "T3_last_tool_done"),
      "T3→T4_回答生成wait": this.segmentMs("T3_last_tool_done", "T4_run_wait"),
      "T1send→T4_実行完了": this.segmentMs("T1_send_done", "T4_run_wait"),
      "T0→T4_合計(main)": this.segmentMs("T0_submit", "T4_complete"),
    };

    const marks: Record<string, number | null> = {};
    for (const id of [
      "T0_submit",
      "T1_agent_ready",
      "T1_send_done",
      "T2_first_activity",
      "T2_first_tool",
      "T2_first_delta",
      "T3_last_tool_done",
      "T4_run_wait",
      "T4_complete",
    ] as const) {
      marks[id] = this.elapsedMs(id);
    }

    console.info(
      `${LOG_PREFIX} ${JSON.stringify({
        runId: this.runId,
        outcome,
        meta: this.meta,
        marks,
        segments,
        note: "T5(UI reveal完了)は renderer DevTools に [mimica:agent-perf-ui] で出力",
      })}`,
    );
  }
}

const LOG_PREFIX = "[mimica:agent-perf-ui]";

export interface AgentPerfUiRecord {
  runId: string;
  t0EpochMs: number;
  firstVisibleMs?: number;
}

export function logAgentPerfUi(
  record: AgentPerfUiRecord,
  event: "first_visible" | "reveal_done",
  extra?: { contentChars?: number },
): void {
  const now = Date.now();
  const elapsed = now - record.t0EpochMs;
  if (event === "first_visible" && record.firstVisibleMs == null) {
    record.firstVisibleMs = elapsed;
    console.info(
      `${LOG_PREFIX} ${JSON.stringify({
        runId: record.runId,
        T5_ui_first_visible_ms: elapsed,
        note: "吹き出しに最初の文字が描画された時刻（T0=submit 基準）",
      })}`,
    );
    return;
  }
  if (event === "reveal_done") {
    console.info(
      `${LOG_PREFIX} ${JSON.stringify({
        runId: record.runId,
        T5_ui_reveal_done_ms: elapsed,
        T5_ui_first_visible_ms: record.firstVisibleMs ?? null,
        T5_reveal_after_first_visible_ms:
          record.firstVisibleMs == null ? null : elapsed - record.firstVisibleMs,
        contentChars: extra?.contentChars,
        note: "タイプライター表示が追いついた時刻",
      })}`,
    );
  }
}

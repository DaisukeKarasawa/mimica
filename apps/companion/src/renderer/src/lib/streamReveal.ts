/**
 * チャット吹き出しの表示速度（受信ストリームとは独立）。
 * 表示開始（TTFB）は agent 側のまま。ここは話している感のためのタイプライター速度のみ。
 */
export const STREAM_REVEAL_CHARS_PER_SECOND = 60;

/** 1フレームあたりの進めすぎ防止（タブ切替などで delta が飛ぶ場合） */
export const STREAM_REVEAL_MAX_DELTA_MS = 100;

export function codePointCount(text: string): number {
  return [...text].length;
}

export function sliceByCodePoints(text: string, count: number): string {
  if (count <= 0) return "";
  return [...text].slice(0, count).join("");
}

/**
 * 経過時間に応じて「今フレームまでに進めてよい表示文字数」を返す。
 * 受信済み文字数が途中で増えても、表示は charsPerSecond を超えて進まない。
 */
export function advanceRevealCount(
  currentRevealed: number,
  receivedCount: number,
  deltaMs: number,
  charsPerSecond: number,
  carry: number,
): { revealed: number; carry: number } {
  if (receivedCount <= currentRevealed) {
    return { revealed: receivedCount, carry: 0 };
  }

  const clampedDelta = Math.max(0, Math.min(deltaMs, STREAM_REVEAL_MAX_DELTA_MS));
  const nextCarry = carry + (clampedDelta / 1000) * charsPerSecond;
  const increment = Math.floor(nextCarry);
  const revealed = Math.min(receivedCount, currentRevealed + increment);
  return {
    revealed,
    carry: increment > 0 ? nextCarry - increment : nextCarry,
  };
}

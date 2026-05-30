import { stripMetaNarration } from "./userFacingText.js";

export function streamVisibleText(
  accumulated: string,
  visibleLen: number,
  onDelta: (chunk: string) => void,
): { text: string; visibleLen: number } {
  const visible = stripMetaNarration(accumulated);
  const delta = visible.slice(visibleLen);
  if (delta) onDelta(delta);
  return { text: accumulated, visibleLen: visible.length };
}

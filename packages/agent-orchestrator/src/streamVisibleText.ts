import { stripMetaNarration } from "./userFacingText.js";

function longestCommonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

export function streamVisibleText(
  accumulated: string,
  previousVisible: string,
  onDelta: (chunk: string) => void,
): { text: string; visible: string } {
  const visible = stripMetaNarration(accumulated);
  const delta = visible.slice(longestCommonPrefixLength(previousVisible, visible));
  if (delta) onDelta(delta);
  return { text: accumulated, visible };
}

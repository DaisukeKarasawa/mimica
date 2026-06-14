/** Strip markdown and build a short spoken summary for tutti TTS. */

/** Spoken line length — long answers garble Irodori output and slow synthesis. */
export const MAX_SPEECH_CHARS = 220;

const MAX_STRIP_INPUT = 8_000;

export function prepareReadoutText(markdown: string, maxLength = MAX_STRIP_INPUT): string {
  let text = markdown;
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/[*_~>|]/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
}

/**
 * Short Japanese-friendly excerpt for readout (first sentences, capped).
 * Full answer stays in chat; only this text is sent to tutti.
 */
export function summarizeForReadout(markdown: string, maxChars = MAX_SPEECH_CHARS): string {
  const plain = prepareReadoutText(markdown);
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;

  const parts = plain.match(/[^。！？!?.\n]+[。！？!?]?/g);
  if (!parts?.length) {
    return plain.slice(0, maxChars).trim();
  }

  let out = "";
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const next = out + trimmed;
    if (next.length > maxChars) break;
    out = next;
  }
  if (out.trim()) return out.trim();
  return plain.slice(0, maxChars).trim();
}

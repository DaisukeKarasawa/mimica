/** 1行に潰れた GFM テーブル（`| a | b | | --- |`）を行区切りへ直す */
export function normalizeCollapsedTables(text: string): string {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("```")) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const t = line.trimStart();
      if (!t.startsWith("|")) return line;
      if (!/\|\s+\|/.test(line)) return line;
      return line.replace(/\s+\|\s+\|/g, "|\n|");
    })
    .join("\n");
}

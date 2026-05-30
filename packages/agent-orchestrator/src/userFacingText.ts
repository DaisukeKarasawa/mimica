/** ユーザーに見せないメタ発話（計画・手順の独り言）の検出 */

const META_LINE =
  /(調べます|確認します|読み取ります|検索します|調査します|取得します|続けます|合わせます|反映させます|洗い出します)/;

const META_TOPIC =
  /(ペルソナ(設定)?|ワークスペース内|返答のトーン|メッセージが途中で切れ|最新の予報|ツールを実行|ファイルを読)/;

export function isMetaNarrationParagraph(paragraph: string): boolean {
  const t = paragraph.trim();
  if (!t) return true;
  if (META_LINE.test(t) && t.length < 220) return true;
  if (META_TOPIC.test(t) && META_LINE.test(t)) return true;
  if (/^まず、?/.test(t) && META_TOPIC.test(t)) return true;
  return false;
}

function isStructuralMarkdownLine(line: string): boolean {
  const t = line.trim();
  if (/^```/.test(t)) return true;
  if (/^\|/.test(t)) return true;
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^[-*+]\s/.test(t)) return true;
  if (/^\d+\.\s/.test(t)) return true;
  return false;
}

function isMetaContentLine(line: string): boolean {
  const t = line.trim();
  return isMetaNarrationParagraph(t) || META_LINE.test(t);
}

function stripMetaLines(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) return "";

  const nonEmptyLines = trimmed.split("\n").filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) return "";

  const entireBlockIsMeta = nonEmptyLines.every((line) => {
    if (isStructuralMarkdownLine(line)) return false;
    return isMetaContentLine(line);
  });

  return entireBlockIsMeta ? "" : trimmed;
}

/** ツール呼び出し前の assistant 本文からはユーザー向け段落だけ残す（全体がメタだけなら空） */
export function stripMetaNarration(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  const kept = paragraphs.map(stripMetaLines).filter((p) => p.length > 0);
  if (kept.length > 0) return kept.join("\n\n").trim();
  return stripMetaLines(text);
}

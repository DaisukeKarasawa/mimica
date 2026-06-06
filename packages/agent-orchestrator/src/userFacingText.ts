/** ユーザーに見せないメタ発話（計画・手順の独り言）の検出 */

const META_VERB =
  /(?:調べ|確認|読み取り|読み|検索|調査|取得|続け|合わせ|反映させ|洗い出し|見てみ|追い|特定|探索|確認して)(?:します|ます|る|ていきます)/;

/** 段落末尾の作業宣言（「関連コードを読みます。」など） */
const META_CLOSING = new RegExp(
  `(?:関連コードを|コードを|実装を|原因を|箇所を)?${META_VERB.source}[。?？!！]?\\s*$`,
);

const META_TOPIC =
  /(ペルソナ(設定)?|ワークスペース内|返答のトーン|メッセージが途中で切れ|最新の予報|ツールを実行|ファイルを読)/;

function splitJapaneseSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stripTrailingMetaSentences(block: string): string {
  const sentences = splitJapaneseSentences(block.trim());
  if (sentences.length === 0) return "";

  const kept = [...sentences];
  while (kept.length > 0) {
    const last = kept[kept.length - 1]!;
    const body = last.replace(/[。?？!！]\s*$/, "").trim();
    if (body.length > 0 && body.length < 120 && isMetaNarrationParagraph(last)) {
      kept.pop();
      continue;
    }
    break;
  }
  return kept.join("").trim();
}

export function isMetaNarrationParagraph(paragraph: string): boolean {
  const t = paragraph.trim();
  if (!t) return true;
  if (t.length < 120 && META_CLOSING.test(t)) {
    if (META_TOPIC.test(t)) return true;
    if (
      /(?:関連コード|コード|実装|原因|箇所|ファイル|ツール|ワークスペース|まず|続けて|次に)/.test(t)
    ) {
      return true;
    }
    // 単独の作業宣言（「調べます。」など）。「問題を確認します。」のような短い回答は残す
    if (splitJapaneseSentences(t).length === 1 && t.length < 40) {
      if (
        /^(?:関連コード|コード|実装|原因|ファイル|ツール|まず|続けて|次に|調べ|読み|検索|調査|取得|洗い出|探索)/.test(
          t,
        )
      ) {
        return true;
      }
    }
  }
  if (META_TOPIC.test(t) && META_CLOSING.test(t)) return true;
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
  const sentences = splitJapaneseSentences(t);
  if (sentences.length > 1) return false;
  return isMetaNarrationParagraph(t);
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

  if (entireBlockIsMeta) return "";
  return stripTrailingMetaSentences(trimmed);
}

/** ツール呼び出し前の assistant 本文からはユーザー向け段落だけ残す（全体がメタだけなら空） */
export function stripMetaNarration(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  const kept = paragraphs.map(stripMetaLines).filter((p) => p.length > 0);
  if (kept.length > 0) return kept.join("\n\n").trim();
  return stripMetaLines(text);
}

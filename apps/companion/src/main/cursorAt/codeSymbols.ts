import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { AtMenuItem, CodeSymbolResult } from "@mimica/shared";
import { AT_MENU_MAX_RESULTS, AT_MENU_SECTION_LABELS, matchesAtPathQuery } from "@mimica/shared";
import { assertContained } from "../paths.js";

export const MAX_CODE_SNIPPET_LINES = 80;
export const CODE_CONTEXT_BEFORE = 5;
export const CODE_CONTEXT_AFTER = 40;

function languageHintFromPath(relativePath: string): string {
  const ext = extname(relativePath).slice(1);
  return ext || "text";
}

function findSymbolLine(content: string, symbolName: string, hintLine?: number): number {
  if (hintLine && hintLine > 0) return hintLine;

  const patterns = [
    new RegExp(`\\b(function|class|interface|type|enum|const|let|var)\\s+${symbolName}\\b`),
    new RegExp(`\\b${symbolName}\\s*\\(`),
    new RegExp(`\\b${symbolName}\\b`),
  ];
  const lines = content.split("\n");
  for (const pattern of patterns) {
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) return index + 1;
  }
  return 1;
}

export function extractCodeSnippet(
  content: string,
  symbolName: string,
  hintLine?: number,
): { snippet: string; startLine: number; endLine: number } {
  const lines = content.split("\n");
  const anchorLine = findSymbolLine(content, symbolName, hintLine);
  const start = Math.max(1, anchorLine - CODE_CONTEXT_BEFORE);
  const end = Math.min(
    lines.length,
    anchorLine + CODE_CONTEXT_AFTER,
    start + MAX_CODE_SNIPPET_LINES - 1,
  );
  const snippet = lines.slice(start - 1, end).join("\n");
  return { snippet, startLine: start, endLine: end };
}

export function expandCodeMention(
  workspacePath: string,
  filePath: string,
  symbolName: string,
  hintLine?: number,
): { text: string; warning?: string } {
  let absPath: string;
  try {
    absPath = assertContained(join(workspacePath, filePath), workspacePath);
  } catch {
    return {
      text: `@Code:${filePath}:${symbolName}`,
      warning: `@Code:${filePath}:${symbolName} は workspace 内に見つかりません`,
    };
  }

  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: `@Code:${filePath}:${symbolName}`,
      warning: `@Code:${filePath}:${symbolName} を読み取れませんでした: ${message}`,
    };
  }

  const { snippet, startLine, endLine } = extractCodeSnippet(content, symbolName, hintLine);
  const lang = languageHintFromPath(filePath);
  const block = [
    "## Referenced code symbol",
    "",
    `\`${filePath}:${symbolName}\` (lines ${startLine}-${endLine}):`,
    "",
    "```" + lang,
    snippet,
    "```",
  ].join("\n");
  return { text: block };
}

export function codeSymbolsToMenuItems(symbols: CodeSymbolResult[], query: string): AtMenuItem[] {
  const items: AtMenuItem[] = [];
  for (const symbol of symbols) {
    const label = `${symbol.filePath}:${symbol.name}`;
    if (query && !matchesAtPathQuery(label, symbol.name, query)) continue;
    items.push({
      kind: "code",
      path: symbol.filePath,
      name: symbol.name,
      description: `${symbol.kind} · ${symbol.filePath}:${symbol.startLine}`,
      line: symbol.startLine,
      endLine: symbol.endLine,
    });
    if (items.length >= AT_MENU_MAX_RESULTS) break;
  }
  return items;
}

export function codeSectionLabel(): string {
  return AT_MENU_SECTION_LABELS.code;
}

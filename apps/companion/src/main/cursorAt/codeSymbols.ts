import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AtMenuItem, CodeSymbolResult } from "@mimica/shared";
import { AT_MENU_MAX_RESULTS, matchesAtPathQuery } from "@mimica/shared";
import { assertContained } from "../paths.js";
import { WorkspaceIgnoreFilter } from "./ignoreFilter.js";
import { languageHintFromPath } from "./util.js";

export const MAX_CODE_SNIPPET_LINES = 80;
export const CODE_CONTEXT_BEFORE = 5;
export const CODE_CONTEXT_AFTER = 40;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSymbolLine(content: string, symbolName: string, hintLine?: number): number {
  if (hintLine && hintLine > 0) return hintLine;

  const escaped = escapeRegExp(symbolName);
  const patterns = [
    new RegExp(`\\b(function|class|interface|type|enum|const|let|var)\\s+${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s*\\(`),
    new RegExp(`\\b${escaped}\\b`),
  ];
  const lines = content.split("\n");
  for (const pattern of patterns) {
    try {
      const index = lines.findIndex((line) => pattern.test(line));
      if (index >= 0) return index + 1;
    } catch {
      // Malformed symbol names must not break expansion.
    }
  }
  return 1;
}

export function extractCodeSnippet(
  content: string,
  symbolName: string,
  hintLine?: number,
): { snippet: string; startLine: number; endLine: number } {
  const lines = content.split("\n");
  const maxLine = Math.max(1, lines.length);
  const rawAnchor = findSymbolLine(content, symbolName, hintLine);
  const anchorLine = Math.min(Math.max(rawAnchor, 1), maxLine);
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

  const ignore = new WorkspaceIgnoreFilter(workspacePath);
  if (ignore.isIgnored(filePath)) {
    return {
      text: `@Code:${filePath}:${symbolName}`,
      warning: `@Code:${filePath}:${symbolName} は ignore 対象のため参照できません`,
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

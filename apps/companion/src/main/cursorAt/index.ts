import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { ChatSession, ResolveAtInputResult } from "@mimica/shared";
import {
  AT_GIT_COMMIT_LABEL,
  atGitBranchLabel,
  extractAtPathTokens,
  extractCodeTokens,
  extractGitBranchTokens,
  extractGitCommitTokens,
  extractPastChatTokens,
} from "@mimica/shared";
import { expandCodeMention } from "./codeSymbols.js";
import { resolveRelativePath } from "./enumerate.js";
import { formatGitDiffBlock, getBranchDiff, getWorkingTreeDiff } from "./gitContext.js";
import { WorkspaceIgnoreFilter } from "./ignoreFilter.js";
import { formatPastChatForPrompt } from "./pastChats.js";

export const MAX_AT_FILE_LINES = 800;
export const MAX_AT_FILE_BYTES = 256 * 1024;
export const MAX_AT_FOLDER_ENTRIES = 500;

export interface ResolveAtInputOptions {
  skipPaths?: string[];
  getSession?: (id: string) => ChatSession | undefined;
}

function languageHintFromPath(relativePath: string): string {
  const ext = extname(relativePath).slice(1);
  return ext || "text";
}

function truncateFileContent(content: string): { body: string; truncated: boolean } {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes <= MAX_AT_FILE_BYTES) {
    const lines = content.split("\n");
    if (lines.length <= MAX_AT_FILE_LINES) {
      return { body: content, truncated: false };
    }
    return {
      body: lines.slice(0, MAX_AT_FILE_LINES).join("\n"),
      truncated: true,
    };
  }

  let truncated = content.slice(0, MAX_AT_FILE_BYTES);
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > 0) {
    truncated = truncated.slice(0, lastNewline);
  }
  const lines = truncated.split("\n");
  if (lines.length > MAX_AT_FILE_LINES) {
    truncated = lines.slice(0, MAX_AT_FILE_LINES).join("\n");
  }
  return { body: truncated, truncated: true };
}

function listFolderEntries(workspacePath: string, absDir: string, relativeDir: string): string[] {
  const ignore = new WorkspaceIgnoreFilter(workspacePath);
  const entries: string[] = [];

  const walk = (currentAbs: string, currentRel: string, depth: number): void => {
    if (entries.length >= MAX_AT_FOLDER_ENTRIES || depth > 24) return;
    let children: string[];
    try {
      children = readdirSync(currentAbs);
    } catch {
      return;
    }
    for (const name of children.sort()) {
      const relPath = currentRel ? `${currentRel}/${name}` : name;
      if (ignore.isIgnored(relPath)) continue;

      const childAbs = join(currentAbs, name);
      let stat;
      try {
        stat = lstatSync(childAbs);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;

      if (stat.isFile()) {
        entries.push(relPath);
      } else if (stat.isDirectory()) {
        walk(childAbs, relPath, depth + 1);
      }
      if (entries.length >= MAX_AT_FOLDER_ENTRIES) return;
    }
  };

  walk(absDir, relativeDir, 0);
  return entries;
}

function expandFileMention(
  relativePath: string,
  absPath: string,
): { text: string; warning?: string } {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: `@${relativePath}`,
      warning: `@${relativePath} を読み取れませんでした: ${message}`,
    };
  }

  const { body, truncated } = truncateFileContent(content);
  const lang = languageHintFromPath(relativePath);
  const block = [
    "## Referenced file",
    "",
    `\`${relativePath}\`:`,
    "",
    "```" + lang,
    body,
    "```",
  ].join("\n");
  const warning = truncated
    ? `@${relativePath} は大きすぎるため先頭部分のみ注入しました（${MAX_AT_FILE_LINES} 行 / ${MAX_AT_FILE_BYTES} bytes 上限）`
    : undefined;
  return { text: block, warning };
}

function expandFolderMention(
  workspacePath: string,
  relativePath: string,
  absPath: string,
): { text: string; warning?: string } {
  const entries = listFolderEntries(workspacePath, absPath, relativePath);
  const listing =
    entries.length > 0 ? entries.map((entry) => `- ${entry}`).join("\n") : "- (empty)";
  const warning =
    entries.length >= MAX_AT_FOLDER_ENTRIES
      ? `@${relativePath} の一覧が上限 (${MAX_AT_FOLDER_ENTRIES}) に達したため一部のみ注入しました`
      : undefined;
  const block = ["## Referenced folder", "", `\`${relativePath}/\` contents:`, "", listing].join(
    "\n",
  );
  return { text: block, warning };
}

function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function resolveAtInput(
  workspacePath: string,
  input: string,
  options?: ResolveAtInputOptions,
): ResolveAtInputResult {
  const warnings: string[] = [];
  const resolvedPaths: string[] = [];
  let expanded = input;

  for (const token of extractPastChatTokens(expanded)) {
    const session = options?.getSession?.(token.sessionId);
    if (!session) {
      warnings.push(`@Past Chat: ${token.sessionId} のセッションが見つかりません`);
      continue;
    }
    const result = formatPastChatForPrompt(session);
    expanded = expanded.replace(token.raw, result.text);
    if (result.warning) warnings.push(result.warning);
  }

  for (const token of extractGitCommitTokens(expanded)) {
    const diffResult = getWorkingTreeDiff(workspacePath);
    if (diffResult.warning && !diffResult.empty) warnings.push(diffResult.warning);
    if (
      diffResult.warning &&
      diffResult.empty &&
      diffResult.warning !== "Git リポジトリではありません"
    ) {
      warnings.push(diffResult.warning);
    }
    const block = formatGitDiffBlock(AT_GIT_COMMIT_LABEL, diffResult.diff, diffResult.empty);
    expanded = expanded.replace(token, block.trim());
  }

  for (const token of extractGitBranchTokens(expanded)) {
    const diffResult = getBranchDiff(workspacePath, token.baseBranch);
    if (diffResult.warning && !diffResult.empty) warnings.push(diffResult.warning);
    if (
      diffResult.warning &&
      diffResult.empty &&
      diffResult.warning !== "Git リポジトリではありません"
    ) {
      warnings.push(diffResult.warning);
    }
    const title = atGitBranchLabel(diffResult.baseBranch ?? token.baseBranch);
    const block = formatGitDiffBlock(title, diffResult.diff, diffResult.empty);
    expanded = expanded.replace(token.raw, block.trim());
  }

  for (const token of extractCodeTokens(expanded)) {
    const result = expandCodeMention(workspacePath, token.filePath, token.symbolName);
    expanded = expanded.replace(token.raw, result.text);
    if (result.warning) warnings.push(result.warning);
    resolvedPaths.push(`${token.filePath}:${token.symbolName}`);
  }

  const skip = new Set(
    (options?.skipPaths ?? []).map((path) => normalizePathForCompare(path)).filter(Boolean),
  );
  const pathTokens = extractAtPathTokens(expanded);

  for (const token of pathTokens) {
    const normalized = normalizePathForCompare(token.path);
    if (skip.has(normalized)) continue;

    const resolved = resolveRelativePath(workspacePath, normalized);
    if (!resolved) {
      warnings.push(`@${token.path} は workspace 内に見つからないか参照できません`);
      continue;
    }

    const relativePath = normalized;
    if (resolved.kind === "file") {
      const result = expandFileMention(relativePath, resolved.absPath);
      expanded = expanded.replace(token.raw, result.text);
      if (result.warning) warnings.push(result.warning);
      resolvedPaths.push(relativePath);
      continue;
    }

    const result = expandFolderMention(workspacePath, relativePath, resolved.absPath);
    expanded = expanded.replace(token.raw, result.text);
    if (result.warning) warnings.push(result.warning);
    resolvedPaths.push(`${relativePath}/`);
  }

  return {
    expanded,
    paths: resolvedPaths.length > 0 ? resolvedPaths : undefined,
    warning: warnings.length > 0 ? warnings.join("\n") : undefined,
  };
}

export function debugLogAtResolution(paths: string[], expandedChars: number): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[at-mention] resolved ${paths.join(", ")} (${expandedChars} chars)`);
  }
}

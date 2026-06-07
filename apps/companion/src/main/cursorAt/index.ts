import { lstatSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
import { formatPastChatForPrompt, normalizeWorkspacePath } from "./pastChats.js";
import { languageHintFromPath } from "./util.js";

export const MAX_AT_FILE_LINES = 800;
export const MAX_AT_FILE_BYTES = 256 * 1024;
export const MAX_AT_FOLDER_ENTRIES = 500;

export interface ResolveAtInputOptions {
  skipPaths?: string[];
  getSession?: (id: string) => ChatSession | undefined;
  /** Extract @ tokens from this string; defaults to `input`. */
  tokenSource?: string;
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

async function expandFileMention(
  relativePath: string,
  absPath: string,
): Promise<{ text: string; warning?: string }> {
  let content: string;
  try {
    content = await readFile(absPath, "utf8");
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

export async function resolveAtInput(
  workspacePath: string,
  input: string,
  options?: ResolveAtInputOptions,
): Promise<ResolveAtInputResult> {
  const warnings: string[] = [];
  const resolvedPaths: string[] = [];
  let expanded = input;
  const normalizedWorkspace = normalizeWorkspacePath(workspacePath);

  const skip = new Set(
    (options?.skipPaths ?? []).map((path) => normalizePathForCompare(path)).filter(Boolean),
  );
  const tokenSource = options?.tokenSource ?? input;
  const pathTokens = extractAtPathTokens(tokenSource);
  const pastChatTokens = extractPastChatTokens(tokenSource);
  const gitCommitTokens = extractGitCommitTokens(tokenSource);
  const branchTokens = extractGitBranchTokens(tokenSource);
  const codeTokens = extractCodeTokens(tokenSource);

  for (const token of pastChatTokens) {
    const session = options?.getSession?.(token.sessionId);
    if (!session) {
      warnings.push(`@Past Chat: ${token.sessionId} のセッションが見つかりません`);
      continue;
    }
    if (normalizeWorkspacePath(session.workspacePath) !== normalizedWorkspace) {
      warnings.push(`@Past Chat: ${token.sessionId} はこの workspace では参照できません`);
      continue;
    }
    const result = formatPastChatForPrompt(session);
    expanded = expanded.replace(token.raw, result.text);
    if (result.warning) warnings.push(result.warning);
  }

  if (gitCommitTokens.length > 0) {
    const diffResult = await getWorkingTreeDiff(workspacePath);
    if (diffResult.warning && !diffResult.empty) warnings.push(diffResult.warning);
    if (
      diffResult.warning &&
      diffResult.empty &&
      diffResult.warning !== "Git リポジトリではありません"
    ) {
      warnings.push(diffResult.warning);
    }
    const block = formatGitDiffBlock(AT_GIT_COMMIT_LABEL, diffResult.diff, diffResult.empty);
    for (const token of gitCommitTokens) {
      expanded = expanded.replace(token, block.trim());
    }
  }

  if (branchTokens.length > 0) {
    const branchDiffs = await Promise.all(
      branchTokens.map(async (token) => ({
        token,
        diffResult: await getBranchDiff(workspacePath, token.baseBranch),
      })),
    );
    for (const { token, diffResult } of branchDiffs) {
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
  }

  for (const token of codeTokens) {
    const result = await expandCodeMention(workspacePath, token.filePath, token.symbolName);
    expanded = expanded.replace(token.raw, result.text);
    if (result.warning) warnings.push(result.warning);
    resolvedPaths.push(`${token.filePath}:${token.symbolName}`);
  }

  const pathExpansions = await Promise.all(
    pathTokens.map(async (token) => {
      const normalized = normalizePathForCompare(token.path);
      if (skip.has(normalized)) return null;

      const resolved = resolveRelativePath(workspacePath, normalized);
      if (!resolved) {
        return {
          raw: token.raw,
          warning: `@${token.path} は workspace 内に見つからないか参照できません`,
          text: null,
          resolvedPath: null,
        };
      }

      const relativePath = normalized;
      if (resolved.kind === "file") {
        const result = await expandFileMention(relativePath, resolved.absPath);
        return {
          raw: token.raw,
          text: result.text,
          warning: result.warning,
          resolvedPath: relativePath,
        };
      }

      const result = expandFolderMention(workspacePath, relativePath, resolved.absPath);
      return {
        raw: token.raw,
        text: result.text,
        warning: result.warning,
        resolvedPath: `${relativePath}/`,
      };
    }),
  );

  for (const expansion of pathExpansions) {
    if (!expansion) continue;
    if (expansion.warning) warnings.push(expansion.warning);
    if (!expansion.text) continue;
    expanded = expanded.replace(expansion.raw, expansion.text);
    if (expansion.resolvedPath) resolvedPaths.push(expansion.resolvedPath);
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

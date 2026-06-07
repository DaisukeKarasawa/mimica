import type { AtMenuItem } from "./atMenu.js";
import { AT_GIT_COMMIT_LABEL, atGitBranchLabel } from "./atMenu.js";

/** Trailing @-mention being composed (start of input or after whitespace). */
export const AT_MENU_OPEN_PATTERN = /(?:^|\s)@([^\s@]*)$/;

/** `@path` tokens embedded in a message (resolution at submit time). */
export const AT_PATH_TOKEN_PATTERN = /(?<=^|\s)@([^\s@]+)/g;

export const AT_PAST_CHAT_TOKEN_PATTERN = /@Past Chat: ([0-9a-f-]{36})/gi;
export const AT_GIT_COMMIT_TOKEN = `@${AT_GIT_COMMIT_LABEL}`;
export const AT_CODE_TOKEN_PATTERN = /@Code:([^:\s]+):([^\s]+)/g;

function stripSpecialAtTokens(input: string): string {
  let stripped = input.replace(AT_PAST_CHAT_TOKEN_PATTERN, " ");
  stripped = stripped.replace(/@Past Chat:\s*\S*/gi, " ");
  stripped = stripped.replace(AT_CODE_TOKEN_PATTERN, " ");
  stripped = stripped.replaceAll(AT_GIT_COMMIT_TOKEN, " ");
  stripped = stripped.replace(/@Branch \(Diff with [^)]*\)?/g, " ");
  return stripped;
}

export interface AtMenuScope {
  /** Directory prefix for folder navigation; empty string means workspace root. */
  parentDir: string;
  /** Partial path segment filter within parentDir (may include `/`). */
  filter: string;
  /** True when the query ends with `/` and lists direct children only. */
  browseChildren: boolean;
}

export interface AtPathToken {
  raw: string;
  path: string;
}

export interface AtPastChatToken {
  raw: string;
  sessionId: string;
}

export interface AtCodeToken {
  raw: string;
  filePath: string;
  symbolName: string;
}

export interface AtGitBranchToken {
  raw: string;
  baseBranch: string;
}

export function isAtMenuOpen(value: string): boolean {
  return AT_MENU_OPEN_PATTERN.test(value);
}

export function atMenuFilterQuery(value: string): string {
  const match = value.match(AT_MENU_OPEN_PATTERN);
  return match?.[1] ?? "";
}

export function atPathQueryFilterText(scope: AtMenuScope): string {
  if (scope.browseChildren) return "";
  return scope.parentDir
    ? scope.filter
      ? `${scope.parentDir}/${scope.filter}`
      : scope.parentDir
    : scope.filter;
}

export function matchesAtPathQuery(path: string, name: string, filter: string): boolean {
  const normalizedFilter = filter
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!normalizedFilter) return true;

  const lowerPath = path.replace(/\\/g, "/").toLowerCase();
  const lowerName = name.toLowerCase();
  const filterSegments = normalizedFilter.split("/").filter(Boolean);
  const pathSegments = lowerPath.split("/");

  if (filterSegments.length > 0) {
    for (let i = 0; i <= pathSegments.length - filterSegments.length; i += 1) {
      let aligned = true;
      for (let j = 0; j < filterSegments.length; j += 1) {
        const segment = pathSegments[i + j] ?? "";
        if (!segment.startsWith(filterSegments[j])) {
          aligned = false;
          break;
        }
      }
      if (aligned) return true;
    }
  }

  if (lowerPath.includes(normalizedFilter)) return true;
  if (lowerName.includes(normalizedFilter)) return true;

  const lastFilterSegment = filterSegments[filterSegments.length - 1] ?? normalizedFilter;
  if (pathSegments.some((segment) => segment.startsWith(lastFilterSegment))) {
    return true;
  }

  return false;
}

export function scoreAtPathQueryMatch(path: string, name: string, filter: string): number {
  const normalizedFilter = filter
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!normalizedFilter) return 0;

  const lowerPath = path.replace(/\\/g, "/").toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerName === normalizedFilter) return 1000;
  if (lowerPath === normalizedFilter) return 950;
  if (lowerName.startsWith(normalizedFilter)) return 900;
  if (lowerPath.startsWith(normalizedFilter)) return 850;

  const filterSegments = normalizedFilter.split("/").filter(Boolean);
  const pathSegments = lowerPath.split("/");
  for (let i = 0; i <= pathSegments.length - filterSegments.length; i += 1) {
    let aligned = true;
    for (let j = 0; j < filterSegments.length; j += 1) {
      const segment = pathSegments[i + j] ?? "";
      if (!segment.startsWith(filterSegments[j])) {
        aligned = false;
        break;
      }
    }
    if (aligned) return 800 - i;
  }

  if (lowerName.includes(normalizedFilter)) return 500;
  if (lowerPath.includes(normalizedFilter)) return 400;
  return 100;
}

export function parseAtMenuScope(query: string): AtMenuScope {
  const normalized = query.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.endsWith("/")) {
    const parentDir = normalized.slice(0, -1);
    return { parentDir, filter: "", browseChildren: true };
  }
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex === -1) {
    return { parentDir: "", filter: normalized, browseChildren: false };
  }
  return {
    parentDir: normalized.slice(0, slashIndex),
    filter: normalized.slice(slashIndex + 1),
    browseChildren: false,
  };
}

export function extractAtPathTokens(input: string): AtPathToken[] {
  const tokens: AtPathToken[] = [];
  const seen = new Set<string>();
  const stripped = stripSpecialAtTokens(input);
  for (const match of stripped.matchAll(AT_PATH_TOKEN_PATTERN)) {
    const raw = match[0];
    const path = match[1]?.replace(/\\/g, "/").replace(/\/+$/, "") ?? "";
    if (!path || seen.has(path)) continue;
    seen.add(path);
    tokens.push({ raw, path });
  }
  return tokens;
}

export function extractPastChatTokens(input: string): AtPastChatToken[] {
  const tokens: AtPastChatToken[] = [];
  const seen = new Set<string>();
  for (const match of input.matchAll(AT_PAST_CHAT_TOKEN_PATTERN)) {
    const sessionId = match[1]?.toLowerCase() ?? "";
    if (!sessionId || seen.has(sessionId)) continue;
    seen.add(sessionId);
    tokens.push({ raw: match[0], sessionId });
  }
  return tokens;
}

export function extractGitCommitTokens(input: string): string[] {
  return input.includes(AT_GIT_COMMIT_TOKEN) ? [AT_GIT_COMMIT_TOKEN] : [];
}

export function extractGitBranchTokens(input: string): AtGitBranchToken[] {
  const tokens: AtGitBranchToken[] = [];
  const pattern = /@Branch \(Diff with ([^)]+)\)/g;
  for (const match of input.matchAll(pattern)) {
    const baseBranch = match[1]?.trim() ?? "";
    if (!baseBranch) continue;
    tokens.push({ raw: match[0], baseBranch });
  }
  return tokens;
}

/** True when input contains any @ token that resolveAtInput would expand. */
export function hasResolvableAtTokens(input: string): boolean {
  return (
    extractAtPathTokens(input).length > 0 ||
    extractPastChatTokens(input).length > 0 ||
    extractGitCommitTokens(input).length > 0 ||
    extractGitBranchTokens(input).length > 0 ||
    extractCodeTokens(input).length > 0
  );
}

export function extractCodeTokens(input: string): AtCodeToken[] {
  const tokens: AtCodeToken[] = [];
  const seen = new Set<string>();
  for (const match of input.matchAll(AT_CODE_TOKEN_PATTERN)) {
    const filePath = match[1]?.replace(/\\/g, "/") ?? "";
    const symbolName = match[2] ?? "";
    const key = `${filePath}:${symbolName}`;
    if (!filePath || !symbolName || seen.has(key)) continue;
    seen.add(key);
    tokens.push({ raw: match[0], filePath, symbolName });
  }
  return tokens;
}

export function atMenuItemToken(item: AtMenuItem, baseBranch?: string): string {
  switch (item.kind) {
    case "folder":
      return `@${item.path}/`;
    case "file":
      return `@${item.path} `;
    case "past-chat":
      return `@Past Chat: ${item.path} `;
    case "git-commit":
      return `@${AT_GIT_COMMIT_LABEL} `;
    case "git-branch":
      return `@${atGitBranchLabel(baseBranch ?? item.path ?? item.name)} `;
    case "code":
      return `@Code:${item.path}:${item.name} `;
    default:
      return `@${item.path} `;
  }
}

/** Menu row label derived from the canonical submit token. */
export function atMenuItemDisplayLabel(item: AtMenuItem, baseBranch?: string): string {
  return atMenuItemToken(item, baseBranch).trimEnd();
}

export function replaceAtMenuSelection(
  value: string,
  item: AtMenuItem,
  baseBranch?: string,
): string {
  const match = value.match(/^(.*?)@([^\s@]*)$/);
  if (!match) return value;
  return `${match[1]}${atMenuItemToken(item, baseBranch)}`;
}

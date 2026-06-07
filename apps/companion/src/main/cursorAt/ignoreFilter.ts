import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALWAYS_IGNORED_SEGMENTS = new Set([".git", "node_modules"]);

function globToRegExp(pattern: string): RegExp {
  const rawPattern = pattern.replace(/\\/g, "/");
  let normalized = rawPattern;
  const anchoredToRoot = normalized.startsWith("/");
  if (anchoredToRoot) normalized = normalized.slice(1);
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);

  const hasWildcards = normalized.includes("*") || normalized.includes("?");
  const isDirectoryPattern = rawPattern.endsWith("/") || !hasWildcards;
  const hasSlash = normalized.includes("/");
  let regex = anchoredToRoot || hasSlash ? "^" : "(^|.*/)";

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        regex += ".*";
        i += 1;
      } else {
        regex += "[^/]*";
      }
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      continue;
    }
    regex += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  if (isDirectoryPattern) {
    regex += "(?:/.*)?";
  }
  regex += "$";
  return new RegExp(regex);
}

interface IgnoreRule {
  negated: boolean;
  regex: RegExp;
}

export class WorkspaceIgnoreFilter {
  private readonly rules: IgnoreRule[] = [];

  constructor(workspacePath: string) {
    this.loadIgnoreFile(join(workspacePath, ".gitignore"));
    this.loadIgnoreFile(join(workspacePath, ".cursorignore"));
  }

  private loadIgnoreFile(filePath: string): void {
    if (!existsSync(filePath)) return;
    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const negated = line.startsWith("!");
      const body = negated ? line.slice(1) : line;
      try {
        this.rules.push({ negated, regex: globToRegExp(body) });
      } catch {
        // Skip malformed patterns.
      }
    }
  }

  isIgnored(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) return false;

    const segments = normalized.split("/");
    if (segments.some((segment) => ALWAYS_IGNORED_SEGMENTS.has(segment))) {
      return true;
    }

    let ignored = false;
    for (const rule of this.rules) {
      if (rule.regex.test(normalized)) {
        ignored = !rule.negated;
      }
    }
    return ignored;
  }
}

export function isIgnoredPathSegment(name: string): boolean {
  return ALWAYS_IGNORED_SEGMENTS.has(name);
}

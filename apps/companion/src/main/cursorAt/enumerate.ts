import { lstatSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { AtMenuItem } from "@mimica/shared";
import {
  AT_MENU_MAX_RESULTS,
  atPathQueryFilterText,
  matchesAtPathQuery,
  parseAtMenuScope,
  scoreAtPathQueryMatch,
} from "@mimica/shared";
import { assertContained } from "../paths.js";
import { WorkspaceIgnoreFilter } from "./ignoreFilter.js";

const MAX_WALK_DEPTH = 24;
export const PATH_INDEX_TTL_MS = 5_000;
const MAX_CACHED_WORKSPACES = 5;

interface PathIndexEntry {
  path: string;
  kind: "file" | "folder";
  name: string;
}

interface PathIndexCache {
  builtAt: number;
  entries: PathIndexEntry[];
}

const indexCaches = new Map<string, PathIndexCache>();
const ignoreFilters = new Map<string, WorkspaceIgnoreFilter>();

function getIgnoreFilter(workspacePath: string): WorkspaceIgnoreFilter {
  const existing = ignoreFilters.get(workspacePath);
  if (existing) return existing;
  const filter = new WorkspaceIgnoreFilter(workspacePath);
  ignoreFilters.set(workspacePath, filter);
  return filter;
}

function buildPathIndex(workspacePath: string): PathIndexEntry[] {
  const ignore = getIgnoreFilter(workspacePath);
  const entries: PathIndexEntry[] = [];

  const walk = (relativeDir: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH) return;
    let absDir: string;
    try {
      absDir = relativeDir
        ? assertContained(join(workspacePath, relativeDir), workspacePath)
        : workspacePath;
    } catch {
      return;
    }

    let children: string[];
    try {
      children = readdirSync(absDir);
    } catch {
      return;
    }

    for (const name of children) {
      const relativePath = relativeDir ? `${relativeDir}/${name}` : name;
      if (ignore.isIgnored(relativePath)) continue;

      const absPath = join(absDir, name);
      let stat;
      try {
        stat = lstatSync(absPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;

      if (stat.isDirectory()) {
        entries.push({ path: relativePath, kind: "folder", name });
        walk(relativePath, depth + 1);
        continue;
      }
      if (stat.isFile()) {
        entries.push({ path: relativePath, kind: "file", name });
      }
    }
  };

  walk("", 0);
  return entries;
}

function evictPathIndexCaches(now = Date.now()): void {
  for (const [key, cache] of indexCaches) {
    if (now - cache.builtAt >= PATH_INDEX_TTL_MS) {
      indexCaches.delete(key);
      ignoreFilters.delete(key);
    }
  }

  while (indexCaches.size > MAX_CACHED_WORKSPACES) {
    const oldestKey = indexCaches.keys().next().value;
    if (!oldestKey) break;
    indexCaches.delete(oldestKey);
    ignoreFilters.delete(oldestKey);
  }
}

function getPathIndex(workspacePath: string): PathIndexEntry[] {
  const now = Date.now();
  evictPathIndexCaches(now);

  const cached = indexCaches.get(workspacePath);
  if (cached && now - cached.builtAt < PATH_INDEX_TTL_MS) {
    return cached.entries;
  }

  const entries = buildPathIndex(workspacePath);
  indexCaches.set(workspacePath, { builtAt: now, entries });
  evictPathIndexCaches(now);
  return entries;
}

function compareAtMenuItems(a: AtMenuItem, b: AtMenuItem): number {
  if (a.kind !== b.kind) {
    return a.kind === "folder" ? -1 : 1;
  }
  return a.path.localeCompare(b.path);
}

function listDirectChildren(
  workspacePath: string,
  parentDir: string,
  filter: string,
  limit: number,
): AtMenuItem[] {
  const ignore = getIgnoreFilter(workspacePath);
  let absParent: string;
  try {
    absParent = parentDir
      ? assertContained(join(workspacePath, parentDir), workspacePath)
      : workspacePath;
  } catch {
    return [];
  }

  let children: string[];
  try {
    children = readdirSync(absParent);
  } catch {
    return [];
  }

  const items: AtMenuItem[] = [];
  for (const name of children) {
    const relativePath = parentDir ? `${parentDir}/${name}` : name;
    if (ignore.isIgnored(relativePath)) continue;

    const absPath = join(absParent, name);
    let stat;
    try {
      stat = lstatSync(absPath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;

    if (filter && !matchesAtPathQuery(relativePath, name, filter)) continue;

    items.push({
      path: relativePath,
      kind: stat.isDirectory() ? "folder" : "file",
      name,
    });
  }

  return items
    .sort((a, b) => {
      const scoreDiff =
        scoreAtPathQueryMatch(b.path, b.name, filter) -
        scoreAtPathQueryMatch(a.path, a.name, filter);
      if (scoreDiff !== 0) return scoreDiff;
      return compareAtMenuItems(a, b);
    })
    .slice(0, limit);
}

export function searchAtPaths(
  workspacePath: string,
  query: string,
  limit = AT_MENU_MAX_RESULTS,
): AtMenuItem[] {
  const scope = parseAtMenuScope(query);

  const filterText = atPathQueryFilterText(scope);

  if (scope.browseChildren) {
    return listDirectChildren(workspacePath, scope.parentDir, filterText, limit);
  }

  const index = getPathIndex(workspacePath);
  const matches: AtMenuItem[] = [];
  for (const entry of index) {
    if (!matchesAtPathQuery(entry.path, entry.name, filterText)) continue;
    matches.push({ path: entry.path, kind: entry.kind, name: entry.name });
  }

  return matches
    .sort((a, b) => {
      const scoreDiff =
        scoreAtPathQueryMatch(b.path, b.name, filterText) -
        scoreAtPathQueryMatch(a.path, a.name, filterText);
      if (scoreDiff !== 0) return scoreDiff;
      return compareAtMenuItems(a, b);
    })
    .slice(0, limit);
}

export function clearAtPathIndexCache(workspacePath?: string): void {
  if (workspacePath) {
    indexCaches.delete(workspacePath);
    ignoreFilters.delete(workspacePath);
    return;
  }
  indexCaches.clear();
  ignoreFilters.clear();
}

export function resolveRelativePath(
  workspacePath: string,
  relativePath: string,
): { absPath: string; kind: "file" | "folder" } | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized) return null;

  const ignore = getIgnoreFilter(workspacePath);
  if (ignore.isIgnored(normalized)) return null;

  let absPath: string;
  try {
    absPath = assertContained(join(workspacePath, normalized), workspacePath);
  } catch {
    return null;
  }

  let stat;
  try {
    stat = lstatSync(absPath);
  } catch {
    return null;
  }
  if (stat.isSymbolicLink()) return null;

  if (stat.isDirectory()) {
    return { absPath, kind: "folder" };
  }
  if (stat.isFile()) {
    return { absPath, kind: "file" };
  }
  return null;
}

export function displayNameForPath(relativePath: string): string {
  return basename(relativePath.replace(/\\/g, "/")) || relativePath;
}

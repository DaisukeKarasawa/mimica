import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import { SLASH_COMMAND_NAME_PATTERN } from "@mimica/shared";
import { assertRealContained } from "../paths.js";

export const SKILL_FILE = "SKILL.md";
export const NO_WORKSPACE_CACHE_KEY = "";

const WALK_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  "coverage",
  "out",
  ".next",
  ".cache",
]);

export function normalizeWorkspacePath(workspacePath: string | null | undefined): string | null {
  const trimmed = (workspacePath ?? "").trim();
  return trimmed || null;
}

export function catalogCacheKey(workspacePath: string | null | undefined): string {
  return normalizeWorkspacePath(workspacePath) ?? NO_WORKSPACE_CACHE_KEY;
}

/** Resolve workspace for slash catalogs; null when missing or invalid (user-only fallback). */
export function resolveSlashWorkspaceOrNull(
  raw: string | null | undefined,
  resolveWorkspacePath: (workspacePath: string) => string,
): string | null {
  const normalized = normalizeWorkspacePath(raw);
  if (!normalized) return null;
  try {
    return resolveWorkspacePath(normalized);
  } catch {
    return null;
  }
}

const MTIME_TTL_MS = 1000;
const mtimeTtlCache = new Map<string, { value: number; at: number }>();

/** Test-only: clear mtime memo/TTL between isolated fixtures. */
export function clearSlashCatalogRootsMtimeCaches(): void {
  mtimeTtlCache.clear();
}

function cachedMtime(cacheKey: string, compute: () => number): number {
  const now = Date.now();
  const ttlEntry = mtimeTtlCache.get(cacheKey);
  if (ttlEntry && now - ttlEntry.at < MTIME_TTL_MS) {
    return ttlEntry.value;
  }
  const value = compute();
  mtimeTtlCache.set(cacheKey, { value, at: now });
  return value;
}

function cursorHome(...segments: string[]): string {
  return join(homedir(), ".cursor", ...segments);
}

function agentsHome(...segments: string[]): string {
  return join(homedir(), ".agents", ...segments);
}

export function userSkillsRoot(): string {
  return cursorHome("skills");
}

export function bundledSkillsRoot(): string {
  return cursorHome("skills-cursor");
}

export function pluginSkillsCacheRoot(): string {
  return cursorHome("plugins", "cache");
}

export function userAgentsSkillsRoot(): string {
  return agentsHome("skills");
}

export function userCommandsDir(): string {
  return cursorHome("commands");
}

export function userAgentsDir(): string {
  return cursorHome("agents");
}

export function projectAgentsDir(workspacePath: string): string {
  return join(workspacePath, ".cursor", "agents");
}

export function projectSkillsRoot(workspacePath: string): string {
  return join(workspacePath, ".cursor", "skills");
}

export function projectAgentsSkillsRoot(workspacePath: string): string {
  return join(workspacePath, ".agents", "skills");
}

export function projectCommandsDir(workspacePath: string): string {
  return join(workspacePath, ".cursor", "commands");
}

/** Project subpath only when it is a real path contained in the workspace (rejects symlink escapes). */
export function projectDirIfContained(workspacePath: string, ...segments: string[]): string | null {
  try {
    return assertRealContained(join(workspacePath, ...segments), workspacePath);
  } catch {
    return null;
  }
}

export function cursorWorktreesRoot(): string {
  return cursorHome("worktrees");
}

function shouldSkipWalkDir(dirName: string, absolutePath: string): boolean {
  if (WALK_SKIP_DIRS.has(dirName)) return true;
  const worktreesRoot = cursorWorktreesRoot();
  const normalized = absolutePath.replace(/\\/g, "/");
  const worktreesNormalized = worktreesRoot.replace(/\\/g, "/");
  if (normalized === worktreesNormalized || normalized.startsWith(`${worktreesNormalized}/`)) {
    return true;
  }
  return false;
}

function entryStat(fullPath: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(fullPath);
  } catch {
    return null;
  }
}

export function isRealDirectory(fullPath: string): boolean {
  const stat = entryStat(fullPath);
  if (!stat) return false;
  return stat.isDirectory() && !stat.isSymbolicLink();
}

export function isRealFile(fullPath: string): boolean {
  const stat = entryStat(fullPath);
  if (!stat) return false;
  return stat.isFile() && !stat.isSymbolicLink();
}

export function commandNameFromFile(commandsRoot: string, filePath: string): string {
  const rel = relative(commandsRoot, filePath).replace(/\\/g, "/");
  return rel.endsWith(".md") ? rel.slice(0, -3) : rel;
}

export function walkCommandFiles(
  commandsRoot: string,
): Array<{ name: string; absolutePath: string }> {
  if (!existsSync(commandsRoot) || !isRealDirectory(commandsRoot)) return [];

  const found: Array<{ name: string; absolutePath: string }> = [];
  const stack = [commandsRoot];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (isRealDirectory(fullPath)) {
        if (shouldSkipWalkDir(entry.name, fullPath)) continue;
        stack.push(fullPath);
      } else if (isRealFile(fullPath) && extname(entry.name) === ".md") {
        const name = commandNameFromFile(commandsRoot, fullPath);
        if (SLASH_COMMAND_NAME_PATTERN.test(name)) {
          found.push({ name, absolutePath: fullPath });
        }
      }
    }
  }

  return found;
}

function commandsContentMtime(commandsRoot: string): number {
  let max = dirMtime(commandsRoot);
  for (const command of walkCommandFiles(commandsRoot)) {
    max = Math.max(max, fileMtime(command.absolutePath));
  }
  return max;
}

export function walkSkillFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (isRealDirectory(fullPath)) {
        if (shouldSkipWalkDir(entry.name, fullPath)) continue;
        stack.push(fullPath);
      } else if (isRealFile(fullPath) && entry.name === SKILL_FILE) {
        found.push(fullPath);
      }
    }
  }
  return found;
}

export function isPluginSkillPath(skillFilePath: string): boolean {
  const normalized = skillFilePath.replace(/\\/g, "/");
  const cacheMarker = "/plugins/cache/";
  const skillsMarker = "/skills/";
  const cacheIdx = normalized.indexOf(cacheMarker);
  if (cacheIdx < 0) return false;
  const afterCache = normalized.slice(cacheIdx + cacheMarker.length);
  return afterCache.includes(skillsMarker);
}

export function walkPluginSkillFiles(cacheRoot: string): string[] {
  return walkSkillFiles(cacheRoot).filter(isPluginSkillPath);
}

export function findWorkspaceSkillRoots(workspacePath: string): string[] {
  if (!existsSync(workspacePath)) return [];

  const roots = new Set<string>();
  const stack = [workspacePath];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (!isRealDirectory(fullPath)) continue;
      if (shouldSkipWalkDir(entry.name, fullPath)) continue;

      if (entry.name === ".cursor") {
        const skillsDir = join(fullPath, "skills");
        if (existsSync(skillsDir) && isRealDirectory(skillsDir)) roots.add(skillsDir);
      } else if (entry.name === ".agents") {
        const skillsDir = join(fullPath, "skills");
        if (existsSync(skillsDir) && isRealDirectory(skillsDir)) roots.add(skillsDir);
      }

      stack.push(fullPath);
    }
  }

  return [...roots];
}

function fileMtime(path: string): number {
  try {
    return existsSync(path) ? statSync(path).mtimeMs : 0;
  } catch {
    return 0;
  }
}

function dirMtime(path: string): number {
  return fileMtime(path);
}

function skillsContentMtime(root: string, pluginOnly = false): number {
  let max = dirMtime(root);
  const files = pluginOnly ? walkPluginSkillFiles(root) : walkSkillFiles(root);
  for (const skillFile of files) {
    max = Math.max(max, fileMtime(skillFile));
  }
  return max;
}

function agentsContentMtime(agentsRoot: string): number {
  let max = dirMtime(agentsRoot);
  if (!existsSync(agentsRoot)) return max;

  let entries;
  try {
    entries = readdirSync(agentsRoot, { withFileTypes: true });
  } catch {
    return max;
  }

  for (const entry of entries) {
    if (extname(entry.name) !== ".md") continue;
    const fullPath = join(agentsRoot, entry.name);
    if (isRealFile(fullPath)) {
      max = Math.max(max, fileMtime(fullPath));
    }
  }
  return max;
}

function computeCommandsCatalogMtime(workspacePath: string | null): number {
  const mtimes = [commandsContentMtime(userCommandsDir())];
  if (workspacePath) {
    mtimes.push(commandsContentMtime(projectCommandsDir(workspacePath)));
  }
  return Math.max(...mtimes, 0);
}

function computeSkillsCatalogMtime(workspacePath: string | null): number {
  const mtimes = [
    skillsContentMtime(userSkillsRoot()),
    skillsContentMtime(bundledSkillsRoot()),
    skillsContentMtime(pluginSkillsCacheRoot(), true),
    skillsContentMtime(userAgentsSkillsRoot()),
  ];

  if (workspacePath) {
    mtimes.push(
      dirMtime(projectSkillsRoot(workspacePath)),
      dirMtime(projectAgentsSkillsRoot(workspacePath)),
      workspaceSkillsContentMtime(workspacePath),
    );
  }

  return Math.max(...mtimes, 0);
}

function computeSubagentsCatalogMtime(workspacePath: string | null): number {
  const mtimes = [agentsContentMtime(userAgentsDir())];
  if (workspacePath) {
    mtimes.push(agentsContentMtime(projectAgentsDir(workspacePath)));
  }
  return Math.max(...mtimes, 0);
}

/** @deprecated Use slashCommandsCatalogMtime, slashSkillsCatalogMtime, or slashSubagentsCatalogMtime. */
export function slashCatalogRootsMtime(workspacePath: string | null): number {
  const key = `all:${catalogCacheKey(workspacePath)}`;
  return cachedMtime(key, () => {
    const mtimes = [
      computeCommandsCatalogMtime(workspacePath),
      computeSkillsCatalogMtime(workspacePath),
      computeSubagentsCatalogMtime(workspacePath),
    ];
    return Math.max(...mtimes, 0);
  });
}

export function slashCommandsCatalogMtime(workspacePath: string | null): number {
  const key = `commands:${catalogCacheKey(workspacePath)}`;
  return cachedMtime(key, () => computeCommandsCatalogMtime(workspacePath));
}

export function slashSkillsCatalogMtime(workspacePath: string | null): number {
  const key = `skills:${catalogCacheKey(workspacePath)}`;
  return cachedMtime(key, () => computeSkillsCatalogMtime(workspacePath));
}

export function slashSubagentsCatalogMtime(workspacePath: string | null): number {
  const key = `subagents:${catalogCacheKey(workspacePath)}`;
  return cachedMtime(key, () => computeSubagentsCatalogMtime(workspacePath));
}

function workspaceSkillsContentMtime(workspacePath: string): number {
  let max = dirMtime(workspacePath);
  for (const root of findWorkspaceSkillRoots(workspacePath)) {
    max = Math.max(max, dirMtime(root));
    for (const skillFile of walkSkillFiles(root)) {
      max = Math.max(max, fileMtime(skillFile));
    }
  }
  return max;
}

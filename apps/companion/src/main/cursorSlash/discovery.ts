import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import { SLASH_COMMAND_NAME_PATTERN } from "@mimica/shared";

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

export function commandNameFromFile(commandsRoot: string, filePath: string): string {
  const rel = relative(commandsRoot, filePath).replace(/\\/g, "/");
  return rel.endsWith(".md") ? rel.slice(0, -3) : rel;
}

export function walkCommandFiles(
  commandsRoot: string,
): Array<{ name: string; absolutePath: string }> {
  if (!existsSync(commandsRoot)) return [];

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
      if (entry.isDirectory()) {
        if (shouldSkipWalkDir(entry.name, fullPath)) continue;
        stack.push(fullPath);
      } else if (entry.isFile() && extname(entry.name) === ".md") {
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
      if (entry.isDirectory()) {
        if (shouldSkipWalkDir(entry.name, fullPath)) continue;
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === SKILL_FILE) {
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
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      if (shouldSkipWalkDir(entry.name, fullPath)) continue;

      if (entry.name === ".cursor") {
        const skillsDir = join(fullPath, "skills");
        if (existsSync(skillsDir)) roots.add(skillsDir);
      } else if (entry.name === ".agents") {
        const skillsDir = join(fullPath, "skills");
        if (existsSync(skillsDir)) roots.add(skillsDir);
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

export function slashCatalogRootsMtime(workspacePath: string | null): number {
  const mtimes = [
    commandsContentMtime(userCommandsDir()),
    dirMtime(userSkillsRoot()),
    dirMtime(bundledSkillsRoot()),
    dirMtime(pluginSkillsCacheRoot()),
    dirMtime(userAgentsSkillsRoot()),
    dirMtime(userAgentsDir()),
  ];

  if (workspacePath) {
    mtimes.push(
      commandsContentMtime(projectCommandsDir(workspacePath)),
      dirMtime(projectSkillsRoot(workspacePath)),
      dirMtime(projectAgentsSkillsRoot(workspacePath)),
      dirMtime(projectAgentsDir(workspacePath)),
      workspaceSkillsContentMtime(workspacePath),
    );
  }

  return Math.max(...mtimes, 0);
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

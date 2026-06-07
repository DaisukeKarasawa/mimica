import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative } from "node:path";
import type { SlashCommandSource, SlashMenuItem } from "@mimica/shared";
import { SLASH_NAME_PATTERN } from "@mimica/shared";
import { getCachedCatalog, skillCatalogStore } from "./catalog.js";
import {
  bundledSkillsRoot,
  catalogCacheKey,
  findWorkspaceSkillRoots,
  normalizeWorkspacePath,
  pluginSkillsCacheRoot,
  userAgentsSkillsRoot,
  userSkillsRoot,
  walkPluginSkillFiles,
  walkSkillFiles,
} from "./discovery.js";

interface SkillEntry {
  name: string;
  description: string;
  absolutePath: string;
  source: SlashCommandSource;
  workspaceRelativePath?: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const field = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

function skillNameFromPath(skillFilePath: string, content: string): string {
  const frontmatter = parseFrontmatter(content);
  const fromFrontmatter = frontmatter.name?.replace(/^['"]|['"]$/g, "").trim();
  if (fromFrontmatter && SLASH_NAME_PATTERN.test(fromFrontmatter)) {
    return fromFrontmatter;
  }
  return basename(join(skillFilePath, ".."));
}

function skillDescription(content: string, name: string): string {
  const frontmatter = parseFrontmatter(content);
  const fromFrontmatter = frontmatter.description?.replace(/^['"]|['"]$/g, "").trim();
  if (fromFrontmatter) return fromFrontmatter;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s+/, "").trim();
    }
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  }
  return name;
}

function loadSkillEntry(
  absolutePath: string,
  source: SlashCommandSource,
  workspacePath: string | null,
): SkillEntry | null {
  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
  const name = skillNameFromPath(absolutePath, content);
  if (!SLASH_NAME_PATTERN.test(name)) return null;
  const workspaceRelativePath =
    source === "project" && workspacePath ? relative(workspacePath, absolutePath) : undefined;
  return {
    name,
    description: skillDescription(content, name),
    absolutePath,
    source,
    workspaceRelativePath,
  };
}

function addSkillsFromRoot(
  byName: Map<string, SkillEntry>,
  root: string,
  source: SlashCommandSource,
  workspacePath: string | null,
  overwrite: boolean,
): void {
  const walk = source === "plugin" ? walkPluginSkillFiles : walkSkillFiles;
  for (const filePath of walk(root)) {
    const entry = loadSkillEntry(filePath, source, workspacePath);
    if (!entry) continue;
    if (overwrite || !byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }
}

function buildSkillCatalog(workspacePath: string | null): Map<string, SkillEntry> {
  const byName = new Map<string, SkillEntry>();

  // Lowest priority first: plugin → bundled → user → project (project wins).
  addSkillsFromRoot(byName, pluginSkillsCacheRoot(), "plugin", workspacePath, false);
  addSkillsFromRoot(byName, bundledSkillsRoot(), "bundled", workspacePath, false);
  addSkillsFromRoot(byName, userSkillsRoot(), "user", workspacePath, false);
  addSkillsFromRoot(byName, userAgentsSkillsRoot(), "user", workspacePath, false);

  if (workspacePath) {
    for (const root of findWorkspaceSkillRoots(workspacePath)) {
      addSkillsFromRoot(byName, root, "project", workspacePath, true);
    }
  }

  return byName;
}

function getSkillCatalog(workspacePath: string | null): Map<string, SkillEntry> {
  const cacheKey = catalogCacheKey(workspacePath);
  return getCachedCatalog(cacheKey, workspacePath, skillCatalogStore(), () =>
    buildSkillCatalog(workspacePath),
  );
}

export function listSlashSkills(workspacePath: string | null): SlashMenuItem[] {
  const normalized = normalizeWorkspacePath(workspacePath);
  return [...getSkillCatalog(normalized).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      kind: "skill" as const,
      name: entry.name,
      description: entry.description,
      source: entry.source,
    }));
}

export function resolveSlashSkill(
  workspacePath: string | null,
  skillName: string,
  remainder?: string,
): { expanded: string; skillName: string } | { warning: string; skillName: string } | null {
  const normalized = normalizeWorkspacePath(workspacePath);
  const entry = getSkillCatalog(normalized).get(skillName);
  if (!entry) return null;

  if (!existsSync(entry.absolutePath)) {
    return { warning: `Could not load skill /${skillName}: file not found`, skillName };
  }

  const skillPath = entry.workspaceRelativePath ?? entry.absolutePath.replace(homedir(), "~");
  const lines = [
    `## Skill: ${entry.name}`,
    "",
    `Follow the skill at \`${skillPath}\`.`,
    "",
    `Description: ${entry.description}`,
    "",
    "Use the Read tool to load the skill file before acting on this request.",
  ];
  const extra = remainder?.trim();
  if (extra) {
    lines.push("", "---", "", "## Additional context", "", extra);
  }
  return { expanded: lines.join("\n"), skillName: entry.name };
}

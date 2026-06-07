import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative } from "node:path";
import type { SlashCommandSource, SlashMenuItem } from "@mimica/shared";
import { SLASH_NAME_PATTERN } from "@mimica/shared";
import { getCachedCatalog, skillCatalogStore } from "./catalog.js";

const SKILL_FILE = "SKILL.md";

interface SkillEntry {
  name: string;
  description: string;
  absolutePath: string;
  source: SlashCommandSource;
  workspaceRelativePath?: string;
}

function userSkillsRoot(): string {
  return join(homedir(), ".cursor", "skills");
}

function projectSkillsRoot(workspacePath: string): string {
  return join(workspacePath, ".cursor", "skills");
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

function walkSkillFiles(root: string): string[] {
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
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === SKILL_FILE) {
        found.push(fullPath);
      }
    }
  }
  return found;
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
  workspacePath: string,
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
    source === "project" ? relative(workspacePath, absolutePath) : undefined;
  return {
    name,
    description: skillDescription(content, name),
    absolutePath,
    source,
    workspaceRelativePath,
  };
}

function buildSkillCatalog(workspacePath: string): Map<string, SkillEntry> {
  const byName = new Map<string, SkillEntry>();

  for (const filePath of walkSkillFiles(projectSkillsRoot(workspacePath))) {
    const entry = loadSkillEntry(filePath, "project", workspacePath);
    if (entry) byName.set(entry.name, entry);
  }

  for (const filePath of walkSkillFiles(userSkillsRoot())) {
    const entry = loadSkillEntry(filePath, "user", workspacePath);
    if (entry && !byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }

  return byName;
}

function getSkillCatalog(workspacePath: string): Map<string, SkillEntry> {
  return getCachedCatalog(workspacePath, skillCatalogStore(), () =>
    buildSkillCatalog(workspacePath),
  );
}

export function listSlashSkills(workspacePath: string): SlashMenuItem[] {
  return [...getSkillCatalog(workspacePath).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      kind: "skill" as const,
      name: entry.name,
      description: entry.description,
      source: entry.source,
    }));
}

export function resolveSlashSkill(
  workspacePath: string,
  skillName: string,
  remainder?: string,
): { expanded: string; skillName: string } | { warning: string; skillName: string } | null {
  const entry = getSkillCatalog(workspacePath).get(skillName);
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

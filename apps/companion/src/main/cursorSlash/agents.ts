import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { SlashCommandSource, SlashMenuItem } from "@mimica/shared";
import {
  SLASH_NAME_PATTERN,
  SLASH_SUBAGENT_CATALOG,
  type SlashSubagentDefinition,
} from "@mimica/shared";
import { getCachedCatalog, slashSubagentsCatalogMtime, subagentCatalogStore } from "./catalog.js";
import {
  catalogCacheKey,
  isRealDirectory,
  isRealFile,
  normalizeWorkspacePath,
  projectAgentsDir,
  userAgentsDir,
} from "./discovery.js";

interface CustomAgentEntry {
  name: string;
  description: string;
  body: string;
  absolutePath: string;
  source: Extract<SlashCommandSource, "project" | "user">;
}

interface SubagentCatalogEntry {
  name: string;
  description: string;
  source: SlashCommandSource;
  builtin?: SlashSubagentDefinition;
  custom?: CustomAgentEntry;
}

function parseFrontmatter(content: string): { fields: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fields: {}, body: content };
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const field = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (field) fields[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return { fields, body: match[2] };
}

function loadCustomAgentFile(
  absolutePath: string,
  source: CustomAgentEntry["source"],
): CustomAgentEntry | null {
  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }

  const { fields, body } = parseFrontmatter(content);
  const name = fields.name?.trim() || basename(absolutePath, extname(absolutePath));
  const description = fields.description?.trim();
  if (!description || !SLASH_NAME_PATTERN.test(name)) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[slash-agents] skipped invalid agent file: ${absolutePath}`);
    }
    return null;
  }

  return {
    name,
    description,
    body: body.trim(),
    absolutePath,
    source,
  };
}

function readCustomAgentsFromDir(
  dir: string,
  source: CustomAgentEntry["source"],
): CustomAgentEntry[] {
  if (!existsSync(dir) || !isRealDirectory(dir)) return [];

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const agents: CustomAgentEntry[] = [];
  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (!isRealFile(absolutePath) || extname(entry.name) !== ".md") continue;
    const loaded = loadCustomAgentFile(absolutePath, source);
    if (loaded) agents.push(loaded);
  }
  return agents;
}

function buildSubagentCatalog(workspacePath: string | null): Map<string, SubagentCatalogEntry> {
  const byName = new Map<string, SubagentCatalogEntry>();

  for (const builtin of SLASH_SUBAGENT_CATALOG) {
    byName.set(builtin.id, {
      name: builtin.id,
      description: builtin.description,
      source: "builtin",
      builtin,
    });
  }

  for (const custom of readCustomAgentsFromDir(userAgentsDir(), "user")) {
    byName.set(custom.name, {
      name: custom.name,
      description: custom.description,
      source: custom.source,
      custom,
    });
  }

  if (workspacePath) {
    for (const custom of readCustomAgentsFromDir(projectAgentsDir(workspacePath), "project")) {
      byName.set(custom.name, {
        name: custom.name,
        description: custom.description,
        source: custom.source,
        custom,
      });
    }
  }

  return byName;
}

function getSubagentCatalog(workspacePath: string | null): Map<string, SubagentCatalogEntry> {
  const normalized = normalizeWorkspacePath(workspacePath);
  const cacheKey = catalogCacheKey(normalized);
  return getCachedCatalog(
    cacheKey,
    normalized,
    subagentCatalogStore(),
    () => buildSubagentCatalog(normalized),
    slashSubagentsCatalogMtime,
  );
}

export function listSlashSubagents(workspacePath: string | null): SlashMenuItem[] {
  return [...getSubagentCatalog(workspacePath).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      kind: "subagent" as const,
      name: entry.name,
      description: entry.description,
      source: entry.source,
    }));
}

export function resolveSlashSubagent(
  workspacePath: string | null,
  subagentId: string,
  remainder?: string,
): { expanded: string; subagentId: string; warning?: string } | null {
  const entry = getSubagentCatalog(workspacePath).get(subagentId);
  if (!entry) return null;

  const prompt = remainder?.trim() || "Handle the user request.";

  if (entry.custom) {
    if (!existsSync(entry.custom.absolutePath)) {
      return {
        expanded: `/${subagentId}${remainder ? ` ${remainder}` : ""}`,
        subagentId,
        warning: `Could not load subagent /${subagentId}: file not found`,
      };
    }

    const expanded = [
      "## Custom subagent",
      "",
      `Act according to the following system prompt for subagent \`${entry.custom.name}\`:`,
      "",
      entry.custom.body,
      "",
      "---",
      "",
      "## User request",
      "",
      prompt,
    ].join("\n");
    return { expanded, subagentId: entry.custom.name };
  }

  if (!entry.builtin) return null;

  const expanded = [
    "## Subagent dispatch",
    "",
    `Use the Task tool with \`subagent_type: "${entry.builtin.id}"\` to handle the following request.`,
    "",
    "Pass this as the subagent prompt:",
    prompt,
  ].join("\n");

  return { expanded, subagentId: entry.builtin.id };
}

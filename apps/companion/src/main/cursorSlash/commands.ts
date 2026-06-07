import { readFileSync } from "node:fs";
import type { SlashCommandSource, SlashCommandSummary } from "@mimica/shared";
import { commandCatalogStore, getCachedCatalog } from "./catalog.js";
import {
  catalogCacheKey,
  normalizeWorkspacePath,
  projectCommandsDir,
  userCommandsDir,
  walkCommandFiles,
} from "./discovery.js";

interface CommandEntry {
  name: string;
  description: string;
  absolutePath: string;
  source: SlashCommandSource;
}

function extractSlashCommandDescription(content: string, name: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const titled = trimmed.match(/^#\s+`?\/([^`]+)`?\s*[—–-]\s*(.+)$/);
    if (titled) return titled[2].trim();

    const heading = trimmed.match(/^#\s+(.+)$/);
    if (heading) return heading[1].replace(/`/g, "").trim();

    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  }
  return name;
}

function loadCommandEntry(
  name: string,
  absolutePath: string,
  source: SlashCommandSource,
): CommandEntry {
  let description = name;
  try {
    const body = readFileSync(absolutePath, "utf8");
    description = extractSlashCommandDescription(body, name);
  } catch {
    // keep fallback description
  }
  return { name, description, absolutePath, source };
}

function addCommandsFromDir(
  byName: Map<string, CommandEntry>,
  commandsRoot: string,
  source: SlashCommandSource,
  overwrite: boolean,
): void {
  for (const command of walkCommandFiles(commandsRoot)) {
    const entry = loadCommandEntry(command.name, command.absolutePath, source);
    if (overwrite || !byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }
}

function buildCommandCatalog(workspacePath: string | null): CommandEntry[] {
  const byName = new Map<string, CommandEntry>();

  addCommandsFromDir(byName, userCommandsDir(), "user", true);

  if (workspacePath) {
    addCommandsFromDir(byName, projectCommandsDir(workspacePath), "project", true);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getCommandCatalog(workspacePath: string | null): Map<string, CommandEntry> {
  const normalized = normalizeWorkspacePath(workspacePath);
  const cacheKey = catalogCacheKey(normalized);
  const entries = getCachedCatalog(cacheKey, normalized, commandCatalogStore(), () =>
    buildCommandCatalog(normalized),
  );
  return new Map(entries.map((entry) => [entry.name, entry]));
}

export function listSlashCommands(workspacePath: string | null): SlashCommandSummary[] {
  return [...getCommandCatalog(workspacePath).values()].map(({ name, description, source }) => ({
    name,
    description,
    source,
  }));
}

export function formatSlashCommandPrompt(
  commandName: string,
  body: string,
  remainder?: string,
): string {
  const trimmedBody = body.trimEnd();
  const extra = remainder?.trim();
  if (!extra) return trimmedBody;
  return `${trimmedBody}\n\n---\n\n## Additional context\n\n${extra}`;
}

export function resolveSlashCommand(
  workspacePath: string | null,
  token: string,
  remainder?: string,
): { expanded: string; commandName: string; warning?: string } | null {
  const entry = getCommandCatalog(workspacePath).get(token);
  if (!entry) return null;

  try {
    const body = readFileSync(entry.absolutePath, "utf8");
    return { expanded: formatSlashCommandPrompt(token, body, remainder), commandName: token };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      expanded: `/${token}${remainder ? ` ${remainder}` : ""}`,
      commandName: token,
      warning: `Could not load command /${token}: ${message}`,
    };
  }
}

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import type { SlashCommandSource, SlashCommandSummary } from "@mimica/shared";
import { SLASH_NAME_PATTERN } from "@mimica/shared";
import { commandCatalogStore, getCachedCatalog } from "./catalog.js";

function userCommandsDir(): string {
  return join(homedir(), ".cursor", "commands");
}

function projectCommandsDir(workspacePath: string): string {
  return join(workspacePath, ".cursor", "commands");
}

function readCommandNames(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
      .map((entry) => basename(entry.name, ".md"))
      .filter((name) => SLASH_NAME_PATTERN.test(name));
  } catch {
    return [];
  }
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

function commandFilePath(
  workspacePath: string,
  name: string,
): { path: string; source: SlashCommandSource } | null {
  const projectPath = join(projectCommandsDir(workspacePath), `${name}.md`);
  if (existsSync(projectPath)) {
    return { path: projectPath, source: "project" };
  }

  const userPath = join(userCommandsDir(), `${name}.md`);
  if (existsSync(userPath)) {
    return { path: userPath, source: "user" };
  }

  return null;
}

function buildCommandCatalog(workspacePath: string): SlashCommandSummary[] {
  const projectNames = new Set(readCommandNames(projectCommandsDir(workspacePath)));
  const userNames = readCommandNames(userCommandsDir()).filter((name) => !projectNames.has(name));
  const names = [...projectNames, ...userNames].sort((a, b) => a.localeCompare(b));

  return names.map((name) => {
    const source: SlashCommandSource = projectNames.has(name) ? "project" : "user";
    const dir = source === "project" ? projectCommandsDir(workspacePath) : userCommandsDir();
    let description = name;
    try {
      const body = readFileSync(join(dir, `${name}.md`), "utf8");
      description = extractSlashCommandDescription(body, name);
    } catch {
      // keep fallback description
    }
    return { name, description, source };
  });
}

export function listSlashCommands(workspacePath: string): SlashCommandSummary[] {
  return getCachedCatalog(workspacePath, commandCatalogStore(), () =>
    buildCommandCatalog(workspacePath),
  );
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
  workspacePath: string,
  token: string,
  remainder?: string,
): { expanded: string; commandName: string; warning?: string } | null {
  const located = commandFilePath(workspacePath, token);
  if (!located) return null;

  try {
    const body = readFileSync(located.path, "utf8");
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

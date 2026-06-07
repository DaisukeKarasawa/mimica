import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import type {
  ResolveSlashCommandResult,
  SlashCommandSource,
  SlashCommandSummary,
} from "@mimica/shared";

const COMMAND_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SLASH_INPUT_PATTERN = /^\/([A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/;

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
      .filter((name) => COMMAND_NAME_PATTERN.test(name));
  } catch {
    return [];
  }
}

function readCommandBody(dir: string, name: string): string {
  const filePath = join(dir, `${name}.md`);
  return readFileSync(filePath, "utf8");
}

export function extractSlashCommandDescription(content: string, name: string): string {
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

export function listSlashCommands(workspacePath: string): SlashCommandSummary[] {
  const projectNames = new Set(readCommandNames(projectCommandsDir(workspacePath)));
  const userNames = readCommandNames(userCommandsDir()).filter((name) => !projectNames.has(name));
  const names = [...projectNames, ...userNames].sort((a, b) => a.localeCompare(b));

  return names.map((name) => {
    const source: SlashCommandSource = projectNames.has(name) ? "project" : "user";
    const dir = source === "project" ? projectCommandsDir(workspacePath) : userCommandsDir();
    let description = name;
    try {
      description = extractSlashCommandDescription(readCommandBody(dir, name), name);
    } catch {
      // keep fallback description
    }
    return { name, description, source };
  });
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
  input: string,
): ResolveSlashCommandResult {
  const trimmed = input.trim();
  const match = trimmed.match(SLASH_INPUT_PATTERN);
  if (!match) {
    return { expanded: input };
  }

  const [, commandName, remainder] = match;
  const located = commandFilePath(workspacePath, commandName);
  if (!located) {
    return { expanded: input };
  }

  try {
    const body = readFileSync(located.path, "utf8");
    const expanded = formatSlashCommandPrompt(commandName, body, remainder);
    return { expanded, commandName };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      expanded: input,
      commandName,
      warning: `Could not load command /${commandName}: ${message}`,
    };
  }
}

export function debugLogSlashCommandResolution(commandName: string, expandedChars: number): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[slash-command] resolved /${commandName} (${expandedChars} chars)`);
  }
}

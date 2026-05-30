import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRETS_PATH = join(homedir(), "Library", "Application Support", "Mimica", "secrets.json");

export function resolveCursorApiKey(): string | undefined {
  if (process.env.CURSOR_API_KEY) {
    return process.env.CURSOR_API_KEY;
  }
  if (!existsSync(SECRETS_PATH)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(SECRETS_PATH, "utf8")) as { cursorApiKey?: string };
    return parsed.cursorApiKey;
  } catch {
    return undefined;
  }
}

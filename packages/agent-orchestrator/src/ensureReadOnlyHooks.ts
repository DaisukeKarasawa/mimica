import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MIMICA_READ_ONLY_HOOK_SCRIPT } from "./readOnlyTools.js";

const HOOK_GUARD_MARKER = "mimica-read-only-guard";

interface HooksConfig {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

function bundledHookScriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", MIMICA_READ_ONLY_HOOK_SCRIPT);
}

function mimicaHookEntries(scriptPath: string): HooksConfig["hooks"] {
  const command = `node ${scriptPath}`;
  const base = { command, failClosed: true };
  return {
    preToolUse: [{ ...base, matcher: "Write|Delete|Shell|Task|Edit|ApplyPatch|Create" }],
    beforeShellExecution: [base],
    beforeMCPExecution: [base],
  };
}

function hasMimicaGuard(config: HooksConfig): boolean {
  for (const entries of Object.values(config.hooks)) {
    for (const entry of entries) {
      const command = entry.command;
      if (typeof command === "string" && command.includes(HOOK_GUARD_MARKER)) {
        return true;
      }
    }
  }
  return false;
}

function mergeHooks(existing: HooksConfig, mimica: HooksConfig["hooks"]): HooksConfig {
  const merged: HooksConfig = {
    version: existing.version ?? 1,
    hooks: { ...existing.hooks },
  };
  for (const [event, entries] of Object.entries(mimica)) {
    merged.hooks[event] = [...(merged.hooks[event] ?? []), ...entries];
  }
  return merged;
}

/** Install Mimica read-only hook scripts into the agent workspace (pre-dispatch enforcement). */
export async function ensureReadOnlyHooks(workspacePath: string): Promise<void> {
  const scriptPath = bundledHookScriptPath();
  const cursorDir = join(workspacePath, ".cursor");
  const hooksDir = join(cursorDir, "hooks");
  const hooksJsonPath = join(cursorDir, "hooks.json");
  const workspaceScriptPath = join(hooksDir, MIMICA_READ_ONLY_HOOK_SCRIPT);

  await mkdir(hooksDir, { recursive: true });
  await writeFile(workspaceScriptPath, await readFile(scriptPath));

  let config: HooksConfig = { version: 1, hooks: {} };
  try {
    config = JSON.parse(await readFile(hooksJsonPath, "utf8")) as HooksConfig;
    if (!config.hooks || typeof config.hooks !== "object") {
      config.hooks = {};
    }
  } catch {
    // No hooks.json yet — create one below.
  }

  if (hasMimicaGuard(config)) {
    return;
  }

  const next = mergeHooks(config, mimicaHookEntries(workspaceScriptPath));
  await writeFile(hooksJsonPath, `${JSON.stringify(next, null, 2)}\n`);
}

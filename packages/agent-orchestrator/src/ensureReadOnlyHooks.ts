import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowsReadOnlyHooksInDev,
  isMimicaMonorepoDevRoot,
  stripMimicaReadOnlyHooksFromWorkspace,
} from "./mimicaDevWorkspace.js";
import {
  DENIED_HOOK_TOOLS_FILE,
  HOOK_GUARD_MARKER,
  type HooksConfig,
  MIMICA_READ_ONLY_HOOK_SCRIPT,
} from "./readOnlyPolicy.js";

export type EnsureReadOnlyHooksResult = { ok: true } | { ok: false; message: string };

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function bundledHookScriptPath(): string {
  return join(packageRoot(), "hooks", MIMICA_READ_ONLY_HOOK_SCRIPT);
}

function bundledDeniedToolsPath(): string {
  return join(packageRoot(), "policy", DENIED_HOOK_TOOLS_FILE);
}

function mimicaHookEntries(scriptPath: string): HooksConfig["hooks"] {
  const command = `${process.execPath} ${JSON.stringify(scriptPath)}`;
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
export async function ensureReadOnlyHooks(
  workspacePath: string,
): Promise<EnsureReadOnlyHooksResult> {
  try {
    if ((await isMimicaMonorepoDevRoot(workspacePath)) && !allowsReadOnlyHooksInDev()) {
      await stripMimicaReadOnlyHooksFromWorkspace(workspacePath);
      return { ok: true };
    }

    const scriptPath = bundledHookScriptPath();
    const cursorDir = join(workspacePath, ".cursor");
    const hooksDir = join(cursorDir, "hooks");
    const hooksJsonPath = join(cursorDir, "hooks.json");
    const workspaceScriptPath = join(hooksDir, MIMICA_READ_ONLY_HOOK_SCRIPT);
    const workspaceDeniedToolsPath = join(hooksDir, DENIED_HOOK_TOOLS_FILE);

    await mkdir(hooksDir, { recursive: true });
    await copyFile(bundledDeniedToolsPath(), workspaceDeniedToolsPath);
    await copyFile(scriptPath, workspaceScriptPath);

    let config: HooksConfig = { version: 1, hooks: {} };
    try {
      config = JSON.parse(await readFile(hooksJsonPath, "utf8")) as HooksConfig;
      if (!config.hooks || typeof config.hooks !== "object") {
        config.hooks = {};
      }
    } catch {
      // No hooks.json yet — create one below.
    }

    if (!hasMimicaGuard(config)) {
      const next = mergeHooks(config, mimicaHookEntries(workspaceScriptPath));
      await writeFile(hooksJsonPath, `${JSON.stringify(next, null, 2)}\n`);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

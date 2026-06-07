import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DENIED_HOOK_TOOLS_FILE,
  DENIED_TOOLS_CONFIG_FILE,
  HOOK_GUARD_MARKER,
  type HooksConfig,
  MIMICA_READ_ONLY_HOOK_SCRIPT,
} from "./readOnlyPolicy.js";

/** True when workspace is the mimica monorepo dev root (Companion must not persist read-only hooks here). */
export async function isMimicaMonorepoDevRoot(workspacePath: string): Promise<boolean> {
  try {
    const pkgPath = join(workspacePath, "package.json");
    await access(pkgPath);
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { name?: string };
    if (pkg.name !== "mimica") return false;
    await access(join(workspacePath, "packages", "agent-orchestrator", "package.json"));
    await access(join(workspacePath, "apps", "companion", "package.json"));
    return true;
  } catch {
    return false;
  }
}

function isMimicaHookEntry(entry: Record<string, unknown>): boolean {
  const command = entry.command;
  return typeof command === "string" && command.includes(HOOK_GUARD_MARKER);
}

/** Remove persisted read-only hook files and hooks.json entries from a workspace (best-effort). */
export async function stripMimicaReadOnlyHooksFromWorkspace(workspacePath: string): Promise<void> {
  const cursorDir = join(workspacePath, ".cursor");
  const hooksDir = join(cursorDir, "hooks");
  const hooksJsonPath = join(cursorDir, "hooks.json");

  for (const file of [
    MIMICA_READ_ONLY_HOOK_SCRIPT,
    DENIED_HOOK_TOOLS_FILE,
    DENIED_TOOLS_CONFIG_FILE,
  ]) {
    try {
      await unlink(join(hooksDir, file));
    } catch {
      // missing file is fine
    }
  }

  let config: HooksConfig;
  try {
    config = JSON.parse(await readFile(hooksJsonPath, "utf8")) as HooksConfig;
    if (!config.hooks || typeof config.hooks !== "object") return;
  } catch {
    return;
  }

  let changed = false;
  const nextHooks: HooksConfig["hooks"] = {};
  for (const [event, entries] of Object.entries(config.hooks)) {
    const kept = entries.filter((entry) => !isMimicaHookEntry(entry));
    if (kept.length !== entries.length) changed = true;
    if (kept.length > 0) nextHooks[event] = kept;
  }

  if (!changed) return;

  await writeFile(
    hooksJsonPath,
    `${JSON.stringify({ version: config.version ?? 1, hooks: nextHooks }, null, 2)}\n`,
  );
}

/** Opt-in: set MIMICA_ALLOW_READONLY_HOOKS_IN_DEV=1 to install read-only hooks on the dev monorepo (testing only). */
export function allowsReadOnlyHooksInDev(): boolean {
  return process.env.MIMICA_ALLOW_READONLY_HOOKS_IN_DEV === "1";
}

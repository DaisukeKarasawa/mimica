/** Matches stream-level tool_call `name` values (lowercase / snake_case). */
const WRITE_TOOL_RE =
  /^(write|edit|delete|shell|run_terminal|terminal|apply_patch|create|str_replace|patch|execute)/i;

/** Cursor hook `preToolUse` tool_name values (PascalCase). Sync with policy/denied-hook-tools.mjs */
const DENIED_HOOK_TOOL_RE = /^(Write|Delete|Shell|Task|Edit|ApplyPatch|Create)$/;

export const MIMICA_READ_ONLY_HOOK_SCRIPT = "mimica-read-only-guard.mjs";

/** Substring matched in hooks.json command strings to identify Mimica read-only entries. */
export const HOOK_GUARD_MARKER = "mimica-read-only-guard";

export const DENIED_HOOK_TOOLS_FILE = "denied-hook-tools.mjs";

export interface HooksConfig {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_RE.test(name);
}

export function isDeniedHookTool(name: string): boolean {
  return DENIED_HOOK_TOOL_RE.test(name);
}

export const READ_ONLY_TOOL_ERROR = (name: string) =>
  `Read-only mode: ツール "${name}" は MVP では利用できません`;

export const READ_ONLY_HOOK_INSTALL_WARNING =
  "read-only フックをワークスペースに配置できませんでした。ストリーム側のブロックのみ有効です。";

import {
  ASK_DENIED_STREAM_TOOL_RE,
  DENIED_HOOK_TOOL_RE,
  WRITE_TOOL_RE,
} from "./deniedToolPatterns.js";

export const MIMICA_READ_ONLY_HOOK_SCRIPT = "mimica-read-only-guard.mjs";

/** Substring matched in hooks.json command strings to identify Mimica read-only entries. */
export const HOOK_GUARD_MARKER = "mimica-read-only-guard";

export const DENIED_HOOK_TOOLS_FILE = "denied-hook-tools.mjs";
export const DENIED_TOOLS_CONFIG_FILE = "denied-tools.json";

export interface HooksConfig {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_RE.test(name);
}

/** Ask mode denied tools (stream + hook naming). Includes Task/subagent dispatch. */
export function isAskDeniedTool(name: string): boolean {
  return ASK_DENIED_STREAM_TOOL_RE.test(name) || DENIED_HOOK_TOOL_RE.test(name);
}

export function isDeniedHookTool(name: string): boolean {
  return DENIED_HOOK_TOOL_RE.test(name);
}

export const READ_ONLY_TOOL_ERROR = (name: string) =>
  `Read-only mode: ツール "${name}" は MVP では利用できません`;

export const READ_ONLY_HOOK_INSTALL_WARNING =
  "read-only フックをワークスペースに配置できませんでした。ストリーム側のブロックのみ有効です。";

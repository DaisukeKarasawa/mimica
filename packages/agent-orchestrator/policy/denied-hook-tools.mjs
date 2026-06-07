/**
 * Shared tool-name patterns for Mimica read-only enforcement (Cursor hooks).
 * Keep DENIED_HOOK_TOOL_RE in sync with src/readOnlyPolicy.ts.
 */

/** Stream-level tool_call `name` values (lowercase / snake_case). */
export const WRITE_TOOL_RE =
  /^(write|edit|delete|shell|run_terminal|terminal|apply_patch|create|str_replace|patch|execute)/i;

/** Ask mode denied stream tools. Keep in sync with ASK_DENIED_STREAM_TOOL_RE in readOnlyPolicy.ts */
export const ASK_DENIED_STREAM_TOOL_RE =
  /^(write|edit|delete|shell|task|run_terminal|terminal|apply_patch|create|str_replace|patch|execute)/i;

/** Cursor hook `preToolUse` tool_name values (PascalCase). */
export const DENIED_HOOK_TOOL_RE = /^(Write|Delete|Shell|Task|Edit|ApplyPatch|Create)$/;

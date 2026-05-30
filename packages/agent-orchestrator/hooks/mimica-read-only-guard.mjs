#!/usr/bin/env node
/**
 * Cursor hook: deny write / shell / MCP tools for Mimica MVP read-only agent.
 * Used by preToolUse, beforeShellExecution, and beforeMCPExecution.
 */
import { readFileSync } from "node:fs";

const DENIED_HOOK_TOOL_RE = /^(Write|Delete|Shell|Task|Edit|ApplyPatch|Create)$/;

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(2);
  }
}

const input = readInput();
const event = input.hook_event_name ?? "";

if (event === "preToolUse") {
  const toolName = input.tool_name ?? "";
  if (DENIED_HOOK_TOOL_RE.test(toolName)) {
    process.stdout.write(
      JSON.stringify({
        permission: "deny",
        user_message: `Read-only mode: ${toolName} is not available in Mimica MVP.`,
        agent_message:
          "Mimica MVP is read-only. Do not use write, delete, shell, or task tools. Use read/search tools only.",
      }),
    );
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({ permission: "allow" }));
  process.exit(0);
}

if (event === "beforeShellExecution" || event === "beforeMCPExecution") {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: "Read-only mode: shell and MCP execution are not available in Mimica MVP.",
      agent_message:
        "Mimica MVP is read-only. Shell and MCP tools are blocked. Use read/search tools only.",
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ permission: "allow" }));
process.exit(0);

#!/usr/bin/env node
/**
 * Run Prettier on files the Agent edits so local changes match CI `pnpm format:check`.
 * Fire-and-forget: afterFileEdit cannot block the agent; failures are ignored.
 */
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

const input = readInput();
if (!input?.file_path) {
  process.exit(0);
}

const workspaceRoot = input.workspace_roots?.[0] ?? process.cwd();
const absPath = isAbsolute(input.file_path)
  ? input.file_path
  : resolve(workspaceRoot, input.file_path);

spawnSync("pnpm", ["exec", "prettier", "--write", absPath], {
  cwd: workspaceRoot,
  stdio: "ignore",
});

process.exit(0);

#!/usr/bin/env node
/**
 * Run Prettier on files the Agent edits so local changes match CI `pnpm format:check`.
 * Fire-and-forget: afterFileEdit cannot block the agent; failures are ignored.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

function isInsideWorkspace(workspaceRoot, filePath) {
  const rootReal = realpathSync(workspaceRoot);
  const absPath = isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath);
  const canonical = existsSync(absPath) ? realpathSync(absPath) : resolve(absPath);
  const rel = relative(rootReal, canonical);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

const input = readInput();
if (!input?.file_path) {
  process.exit(0);
}

const workspaceRoot = input.workspace_roots?.[0] ?? process.cwd();
if (!isInsideWorkspace(workspaceRoot, input.file_path)) {
  process.exit(0);
}

const absPath = isAbsolute(input.file_path)
  ? input.file_path
  : resolve(workspaceRoot, input.file_path);

spawnSync("pnpm", ["exec", "prettier", "--write", absPath], {
  cwd: workspaceRoot,
  stdio: "ignore",
});

process.exit(0);

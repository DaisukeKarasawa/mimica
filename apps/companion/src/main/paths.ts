import { lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { resolveAllowedWorkspacePath } from "./workspaceAllowlist.js";

export function expandHomePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

export function resolveExpandedPath(path: string): string {
  return normalize(resolve(expandHomePath(path)));
}

export function assertContained(resolvedPath: string, baseDir: string): string {
  const base = normalize(resolve(baseDir));
  const abs = normalize(resolve(resolvedPath));
  const rel = relative(base, abs);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    return abs;
  }
  throw new Error(`Path escapes base directory: ${resolvedPath}`);
}

/** Reject symlinks and verify the canonical target stays inside the workspace. */
export function assertRealContained(absPath: string, workspacePath: string): string {
  let stat;
  try {
    stat = lstatSync(absPath);
  } catch {
    throw new Error(`Path not accessible: ${absPath}`);
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed: ${absPath}`);
  }

  const realWorkspace = realpathSync(workspacePath);
  const realPath = realpathSync(absPath);
  assertContained(realPath, realWorkspace);
  return absPath;
}

export function resolveContainedPath(path: string, baseDir: string): string {
  return assertContained(resolveExpandedPath(path), baseDir);
}

export function resolveWorkspacePath(raw: string): string {
  return resolveAllowedWorkspacePath(raw);
}

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import { resolveExpandedPath } from "./paths.js";

const allowedRoots = new Set<string>();

/** Home-relative paths that must never be used as agent workspaces. */
const SENSITIVE_HOME_RELATIVE = [
  ".ssh",
  ".aws",
  ".gnupg",
  ".config/gcloud",
  ".kube",
  "Library/Keychains",
  "Library/Application Support",
];

function isSensitiveHomePath(resolved: string): boolean {
  const home = resolve(homedir());
  const abs = resolve(resolved);
  const rel = relative(home, abs);
  if (rel.startsWith("..") || rel === "") return rel === "";
  return SENSITIVE_HOME_RELATIVE.some((seg) => rel === seg || rel.startsWith(`${seg}/`));
}

export function seedWorkspaceAllowlist(paths: Iterable<string>): void {
  for (const raw of paths) {
    try {
      registerWorkspaceRoot(raw);
    } catch {
      /* skip invalid or disallowed persisted paths */
    }
  }
}

/** Register and return a workspace root for agent runs (bridge context or session create). */
export function registerWorkspaceRoot(raw: string): string {
  const resolved = resolveExpandedPath(raw);
  if (isSensitiveHomePath(resolved)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`Workspace path does not exist: ${raw}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${raw}`);
  }
  allowedRoots.add(resolved);
  return resolved;
}

export function resolveAllowedWorkspacePath(raw: string): string {
  const resolved = resolveExpandedPath(raw);
  if (!allowedRoots.has(resolved)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`Workspace path does not exist: ${raw}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${raw}`);
  }
  return resolved;
}

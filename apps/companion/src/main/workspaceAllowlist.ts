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

/** Absolute system prefixes that must never be used as agent workspaces. */
const BLOCKED_SYSTEM_PREFIXES = [
  "/etc",
  "/System",
  "/private/etc",
  "/private/var",
  "/bin",
  "/sbin",
  "/dev",
  "/proc",
  "/Library",
  "/Applications",
  "/var/log",
  "/var/root",
  "/var/db",
  "/var/audit",
];

function isBlockedSystemPath(resolved: string): boolean {
  const abs = resolve(resolved);
  if (abs === "/") return true;
  return BLOCKED_SYSTEM_PREFIXES.some((prefix) => abs === prefix || abs.startsWith(`${prefix}/`));
}

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
    } catch (err) {
      console.warn(
        "[mimica] Skipping disallowed or invalid persisted workspace path:",
        raw,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/** Register and return a workspace root for agent runs (bridge context or session create). */
export function registerWorkspaceRoot(raw: string): string {
  const resolved = resolveExpandedPath(raw);
  if (isBlockedSystemPath(resolved)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
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

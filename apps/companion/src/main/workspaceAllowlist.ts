import { existsSync, realpathSync, statSync } from "node:fs";
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

function assertWorkspacePathAllowed(resolved: string, raw: string): void {
  if (isBlockedSystemPath(resolved)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
  if (isSensitiveHomePath(resolved)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
}

function canonicalizeWorkspacePath(resolved: string, raw: string): string {
  try {
    return realpathSync(resolved);
  } catch {
    throw new Error(`Workspace path could not be resolved: ${raw}`);
  }
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
  assertWorkspacePathAllowed(resolved, raw);
  if (!existsSync(resolved)) {
    throw new Error(`Workspace path does not exist: ${raw}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${raw}`);
  }
  const canonical = canonicalizeWorkspacePath(resolved, raw);
  assertWorkspacePathAllowed(canonical, raw);
  allowedRoots.add(canonical);
  return canonical;
}

export function resolveAllowedWorkspacePath(raw: string): string {
  const resolved = resolveExpandedPath(raw);
  if (!existsSync(resolved)) {
    throw new Error(`Workspace path does not exist: ${raw}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${raw}`);
  }
  const canonical = canonicalizeWorkspacePath(resolved, raw);
  if (!allowedRoots.has(canonical)) {
    throw new Error(`Workspace path is not allowed: ${raw}`);
  }
  return canonical;
}

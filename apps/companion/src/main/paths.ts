import { homedir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

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

export function resolveContainedPath(path: string, baseDir: string): string {
  return assertContained(resolveExpandedPath(path), baseDir);
}

export function resolveWorkspacePath(raw: string): string {
  const resolved = resolveExpandedPath(raw);
  if (raw.startsWith("~/")) {
    assertContained(resolved, homedir());
  }
  return resolved;
}

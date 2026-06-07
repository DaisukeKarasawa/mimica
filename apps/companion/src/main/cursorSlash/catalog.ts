import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function dirMtime(path: string): number {
  try {
    return existsSync(path) ? statSync(path).mtimeMs : 0;
  } catch {
    return 0;
  }
}

export function slashCatalogRootsMtime(workspacePath: string): number {
  return Math.max(
    dirMtime(join(workspacePath, ".cursor", "commands")),
    dirMtime(join(homedir(), ".cursor", "commands")),
    dirMtime(join(workspacePath, ".cursor", "skills")),
    dirMtime(join(homedir(), ".cursor", "skills")),
  );
}

interface CatalogCache<T> {
  rootsMtime: number;
  data: T;
}

const commandCaches = new Map<string, CatalogCache<unknown>>();
const skillCaches = new Map<string, CatalogCache<unknown>>();

export function getCachedCatalog<T>(
  workspacePath: string,
  store: Map<string, CatalogCache<unknown>>,
  build: () => T,
): T {
  const rootsMtime = slashCatalogRootsMtime(workspacePath);
  const existing = store.get(workspacePath);
  if (existing && existing.rootsMtime === rootsMtime) {
    return existing.data as T;
  }
  const data = build();
  store.set(workspacePath, { rootsMtime, data });
  return data;
}

export function commandCatalogStore(): Map<string, CatalogCache<unknown>> {
  return commandCaches;
}

export function skillCatalogStore(): Map<string, CatalogCache<unknown>> {
  return skillCaches;
}

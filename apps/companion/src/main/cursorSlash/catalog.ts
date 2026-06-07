import {
  clearSlashCatalogRootsMtimeCaches,
  slashCommandsCatalogMtime,
  slashSkillsCatalogMtime,
  slashSubagentsCatalogMtime,
} from "./discovery.js";

interface CatalogCache<T> {
  rootsMtime: number;
  data: T;
}

const commandCaches = new Map<string, CatalogCache<unknown>>();
const skillCaches = new Map<string, CatalogCache<unknown>>();
const subagentCaches = new Map<string, CatalogCache<unknown>>();

export function getCachedCatalog<T>(
  cacheKey: string,
  workspacePath: string | null,
  store: Map<string, CatalogCache<unknown>>,
  build: () => T,
  rootsMtimeGetter: (workspacePath: string | null) => number,
): T {
  const rootsMtime = rootsMtimeGetter(workspacePath);
  const existing = store.get(cacheKey);
  if (existing && existing.rootsMtime === rootsMtime) {
    return existing.data as T;
  }
  const data = build();
  store.set(cacheKey, { rootsMtime, data });
  return data;
}

export function commandCatalogStore(): Map<string, CatalogCache<unknown>> {
  return commandCaches;
}

export function skillCatalogStore(): Map<string, CatalogCache<unknown>> {
  return skillCaches;
}

export function subagentCatalogStore(): Map<string, CatalogCache<unknown>> {
  return subagentCaches;
}

export { slashCommandsCatalogMtime, slashSkillsCatalogMtime, slashSubagentsCatalogMtime };

/** Test-only: clear cached slash catalogs between isolated fixtures. */
export function resetSlashCatalogCachesForTests(): void {
  commandCaches.clear();
  skillCaches.clear();
  subagentCaches.clear();
  clearSlashCatalogRootsMtimeCaches();
}

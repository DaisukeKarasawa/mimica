import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MimicaSettings } from "@mimica/shared";
import {
  buildSettingsForPackRoot,
  DEFAULT_ACTIVE_CHARACTER_ID,
  resolveCharacterPackRoot,
  type CharacterPackResolveOptions,
} from "@mimica/shared/character-pack";
import { electron } from "./electron.js";
import { resolveExpandedPath } from "./paths.js";

const companionPackageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function devMonorepoPacksDir(): string {
  return join(companionPackageRoot, "../../packs");
}

let cachedPackResolveOptions: CharacterPackResolveOptions | undefined;

export function getCharacterPackResolveOptions(): CharacterPackResolveOptions {
  if (cachedPackResolveOptions) {
    return cachedPackResolveOptions;
  }

  try {
    const { app } = electron();
    cachedPackResolveOptions = {
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      homeDir: homedir(),
    };
    return cachedPackResolveOptions;
  } catch {
    return { packaged: false, homeDir: homedir() };
  }
}

/**
 * Resolves the active character pack directory.
 *
 * Priority: MIMICA_CHARACTER_PACK_ROOT → candidate paths (MIMICA_ASSETS_ROOT layouts,
 * monorepo packs/rio) → packaged resources → ~/MimicaAssets/characters/{id}.
 */
export function resolveActiveCharacterPackRoot(
  characterId: string = DEFAULT_ACTIVE_CHARACTER_ID,
): string {
  const explicit = process.env.MIMICA_CHARACTER_PACK_ROOT?.trim();
  if (explicit) {
    return resolveExpandedPath(explicit);
  }

  const baseOptions = getCharacterPackResolveOptions();
  const candidateRoots: string[] = [];

  const assetsRootEnv = process.env.MIMICA_ASSETS_ROOT?.trim();
  if (assetsRootEnv) {
    const assetsRoot = resolveExpandedPath(assetsRootEnv);
    candidateRoots.push(join(assetsRoot, "packs", characterId));
    candidateRoots.push(join(assetsRoot, "characters", characterId));
  }

  if (!baseOptions.packaged) {
    candidateRoots.push(join(devMonorepoPacksDir(), characterId));
  }

  return resolveCharacterPackRoot(characterId, {
    ...baseOptions,
    candidateRoots,
  });
}

export function getActiveMimicaSettings(
  characterId: string = DEFAULT_ACTIVE_CHARACTER_ID,
): MimicaSettings {
  return buildSettingsForPackRoot(resolveActiveCharacterPackRoot(characterId), characterId);
}

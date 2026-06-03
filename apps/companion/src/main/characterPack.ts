import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MimicaSettings } from "@mimica/shared";
import {
  buildDefaultSettings,
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

export function getCharacterPackResolveOptions(): CharacterPackResolveOptions {
  try {
    const { app } = electron();
    return {
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      homeDir: homedir(),
    };
  } catch {
    return { packaged: false, homeDir: homedir() };
  }
}

/**
 * Resolves the active character pack directory (dev: env → monorepo packs → MimicaAssets).
 */
export function resolveActiveCharacterPackRoot(
  characterId: string = DEFAULT_ACTIVE_CHARACTER_ID,
): string {
  const explicit = process.env.MIMICA_CHARACTER_PACK_ROOT?.trim();
  if (explicit) {
    return resolveExpandedPath(explicit);
  }

  const assetsRootEnv = process.env.MIMICA_ASSETS_ROOT?.trim();
  if (assetsRootEnv) {
    const assetsRoot = resolveExpandedPath(assetsRootEnv);
    const packsLayout = join(assetsRoot, "packs", characterId);
    const legacyLayout = join(assetsRoot, "characters", characterId);
    if (existsSync(packsLayout)) return packsLayout;
    if (existsSync(legacyLayout)) return legacyLayout;
    return legacyLayout;
  }

  const baseOptions = getCharacterPackResolveOptions();
  if (!baseOptions.packaged) {
    const monorepoPack = join(devMonorepoPacksDir(), characterId);
    if (existsSync(monorepoPack)) {
      return monorepoPack;
    }
  }

  return resolveCharacterPackRoot(characterId, baseOptions);
}

export function getActiveMimicaSettings(
  characterId: string = DEFAULT_ACTIVE_CHARACTER_ID,
): MimicaSettings {
  const characterAssetRoot = resolveActiveCharacterPackRoot(characterId);
  const base = buildDefaultSettings(getCharacterPackResolveOptions());
  return {
    ...base,
    activeCharacterId: characterId,
    characterAssetRoot,
    motionMapPath: join(characterAssetRoot, "motion-map.json"),
    personaPackPath: join(characterAssetRoot, "persona", "SKILL.md"),
    chatIconPath: join(characterAssetRoot, "icon.png"),
  };
}

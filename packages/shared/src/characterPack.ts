import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MimicaSettings } from "./chat.js";
import type { CharacterMetadata } from "./avatar.js";

export const DEFAULT_ACTIVE_CHARACTER_ID = "rio";

const CHARACTER_ID_RE = /^[A-Za-z0-9_-]+$/;

export function assertCharacterId(characterId: string): void {
  if (!CHARACTER_ID_RE.test(characterId)) {
    throw new Error(`Invalid characterId: ${characterId}`);
  }
}

export interface CharacterPackResolveOptions {
  /** When true, resolve under `{resourcesPath}/packs/{id}/`. */
  packaged?: boolean;
  /** Electron `process.resourcesPath` (required when `packaged` is true). */
  resourcesPath?: string;
  /** Home directory for `~/MimicaAssets/...` fallback (defaults to `os.homedir()`). */
  homeDir?: string;
  /**
   * Dev override: MimicaAssets root (`~/MimicaAssets`) or legacy layout root.
   * Resolves to `{assetsRoot}/characters/{id}/`.
   */
  assetsRoot?: string;
  /** Checked in order before packaged / default fallbacks (first existing path wins). */
  candidateRoots?: string[];
}

/** True when the directory has metadata, skeleton, atlas, and motion-map for runtime. */
export function isValidCharacterPackRoot(packRoot: string): boolean {
  const metaPath = join(packRoot, "metadata.json");
  const motionPath = join(packRoot, "motion-map.json");
  if (!existsSync(metaPath) || !existsSync(motionPath)) return false;

  try {
    const metadata = JSON.parse(readFileSync(metaPath, "utf8")) as CharacterMetadata;
    if (typeof metadata.skelFile !== "string" || metadata.skelFile.trim() === "") return false;
    if (typeof metadata.atlasFile !== "string" || metadata.atlasFile.trim() === "") return false;
    return (
      existsSync(join(packRoot, metadata.skelFile)) &&
      existsSync(join(packRoot, metadata.atlasFile))
    );
  } catch {
    return false;
  }
}

export function resolveCharacterPackRoot(
  characterId: string,
  options: CharacterPackResolveOptions = {},
): string {
  assertCharacterId(characterId);

  for (const candidate of options.candidateRoots ?? []) {
    if (isValidCharacterPackRoot(candidate)) {
      return candidate;
    }
  }

  const home = options.homeDir ?? homedir();

  if (options.packaged) {
    if (!options.resourcesPath) {
      throw new Error("resourcesPath is required when packaged is true");
    }
    return join(options.resourcesPath, "packs", characterId);
  }

  if (options.assetsRoot) {
    const fromAssetsRoot = join(options.assetsRoot, "characters", characterId);
    if (isValidCharacterPackRoot(fromAssetsRoot)) return fromAssetsRoot;
  }

  const defaultRoot = join(home, "MimicaAssets", "characters", characterId);
  if (isValidCharacterPackRoot(defaultRoot)) return defaultRoot;

  return defaultRoot;
}

export function buildSettingsForPackRoot(
  characterAssetRoot: string,
  characterId: string = DEFAULT_ACTIVE_CHARACTER_ID,
): MimicaSettings {
  return {
    theme: "kanagawa-dragon",
    activeCharacterId: characterId,
    characterAssetRoot,
    motionMapPath: join(characterAssetRoot, "motion-map.json"),
    personaPackPath: join(characterAssetRoot, "persona", "SKILL.md"),
    chatIconPath: join(characterAssetRoot, "icon.png"),
    maxChatSessions: 5,
    saveChatHistory: true,
    defaultAgentMode: "agent",
  };
}

export function resolveCharacterPackPaths(
  characterId: string,
  options: CharacterPackResolveOptions = {},
): Pick<
  MimicaSettings,
  "characterAssetRoot" | "motionMapPath" | "personaPackPath" | "chatIconPath"
> {
  const characterAssetRoot = resolveCharacterPackRoot(characterId, options);
  return {
    characterAssetRoot,
    motionMapPath: join(characterAssetRoot, "motion-map.json"),
    personaPackPath: join(characterAssetRoot, "persona", "SKILL.md"),
    chatIconPath: join(characterAssetRoot, "icon.png"),
  };
}

export function buildDefaultSettings(options: CharacterPackResolveOptions = {}): MimicaSettings {
  const characterId = DEFAULT_ACTIVE_CHARACTER_ID;
  const characterAssetRoot = resolveCharacterPackRoot(characterId, options);
  return buildSettingsForPackRoot(characterAssetRoot, characterId);
}

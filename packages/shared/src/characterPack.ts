import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MimicaSettings } from "./chat.js";

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

export function resolveCharacterPackRoot(
  characterId: string,
  options: CharacterPackResolveOptions = {},
): string {
  assertCharacterId(characterId);

  for (const candidate of options.candidateRoots ?? []) {
    if (existsSync(candidate)) {
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
    return join(options.assetsRoot, "characters", characterId);
  }

  return join(home, "MimicaAssets", "characters", characterId);
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

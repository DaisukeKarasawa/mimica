import { homedir } from "node:os";
import { join } from "node:path";
import type { MimicaSettings } from "./chat.js";

export const DEFAULT_ACTIVE_CHARACTER_ID = "rio";

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
}

export function resolveCharacterPackRoot(
  characterId: string,
  options: CharacterPackResolveOptions = {},
): string {
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

export function resolveCharacterPackPaths(
  characterId: string,
  options: CharacterPackResolveOptions = {},
): Pick<MimicaSettings, "characterAssetRoot" | "motionMapPath" | "personaPackPath" | "chatIconPath"> {
  const characterAssetRoot = resolveCharacterPackRoot(characterId, options);
  return {
    characterAssetRoot,
    motionMapPath: join(characterAssetRoot, "motion-map.json"),
    personaPackPath: join(characterAssetRoot, "persona", "SKILL.md"),
    chatIconPath: join(characterAssetRoot, "icon.png"),
  };
}

export function buildDefaultSettings(
  options: CharacterPackResolveOptions = {},
): MimicaSettings {
  const characterId = DEFAULT_ACTIVE_CHARACTER_ID;
  return {
    theme: "kanagawa-dragon",
    activeCharacterId: characterId,
    ...resolveCharacterPackPaths(characterId, options),
    maxChatSessions: 5,
    saveChatHistory: true,
    defaultAgentMode: "agent",
  };
}

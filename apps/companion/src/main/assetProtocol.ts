import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { CharacterMetadata, MotionMap } from "@mimica/shared";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import type { ElectronMain } from "./electron.js";
import { expandHomePath } from "./paths.js";

export const CHARACTER_ASSET_SCHEME = "mimica-asset";
export const CHARACTER_ASSET_BASE = `${CHARACTER_ASSET_SCHEME}://local/`;

let assetRoot = expandHomePath(DEFAULT_SETTINGS.characterAssetRoot);
let electronApis: Pick<ElectronMain, "protocol" | "net"> | null = null;

const CHAT_ICON_NAMES = ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp"] as const;

export function bindElectronApis(apis: Pick<ElectronMain, "protocol" | "net">): void {
  electronApis = apis;
}

function apis(): Pick<ElectronMain, "protocol" | "net"> {
  if (!electronApis) throw new Error("Electron APIs not bound");
  return electronApis;
}

/** 設定パス → 同ベース名の別拡張子 → アセットルートの既定ファイル名 */
export function resolveChatIconFile(
  assetRootDir: string,
  configuredPath: string,
): string | null {
  const configured = expandHomePath(configuredPath);
  if (existsSync(configured)) return configured;

  const base = basename(configured, extname(configured));
  const dir = dirname(configured);
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const candidate = join(dir, `${base}${ext}`);
    if (existsSync(candidate)) return candidate;
  }

  for (const name of CHAT_ICON_NAMES) {
    const candidate = join(assetRootDir, name);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function registerAssetProtocol(): void {
  const { protocol } = apis();
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHARACTER_ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function setupAssetProtocolHandler(): void {
  const { protocol, net } = apis();
  assetRoot = expandHomePath(DEFAULT_SETTINGS.characterAssetRoot);
  protocol.handle(CHARACTER_ASSET_SCHEME, (request: Request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = normalize(join(assetRoot, rel));
    const rootNorm = normalize(`${assetRoot}/`);
    if (!filePath.startsWith(rootNorm)) {
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });
}

export interface CharacterAssetStatus {
  baseUrl: string;
  assetRoot: string;
  ready: boolean;
  missing: string[];
  metadata: CharacterMetadata | null;
  motionMap: MotionMap | null;
  chatIconUrl: string | null;
}

export function getCharacterAssetStatus(): CharacterAssetStatus {
  const root = expandHomePath(DEFAULT_SETTINGS.characterAssetRoot);
  assetRoot = root;

  let metadata: CharacterMetadata | null = null;
  let motionMap: MotionMap | null = null;
  const metaPath = join(root, "metadata.json");
  const motionPath = expandHomePath(DEFAULT_SETTINGS.motionMapPath);

  if (existsSync(metaPath)) {
    metadata = JSON.parse(readFileSync(metaPath, "utf8")) as CharacterMetadata;
  }
  if (existsSync(motionPath)) {
    motionMap = JSON.parse(readFileSync(motionPath, "utf8")) as MotionMap;
  }

  const required: string[] = [];
  if (metadata) {
    required.push(metadata.skelFile, metadata.atlasFile);
  } else {
    required.push("metadata.json");
  }

  const missing = required.filter((f) => !existsSync(join(root, f)));

  const iconFile = resolveChatIconFile(root, DEFAULT_SETTINGS.chatIconPath);
  let chatIconUrl: string | null = null;
  if (iconFile) {
    const rel = relative(root, iconFile).replace(/\\/g, "/");
    chatIconUrl = `${CHARACTER_ASSET_BASE}${rel}`;
  }

  return {
    baseUrl: CHARACTER_ASSET_BASE,
    assetRoot: root,
    ready: missing.length === 0 && metadata !== null && motionMap !== null,
    missing,
    metadata,
    motionMap,
    chatIconUrl,
  };
}

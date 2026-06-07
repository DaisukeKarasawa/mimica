import { readFileSync, existsSync, realpathSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative } from "node:path";
import type { CharacterAssetStatus, CharacterMetadata, MotionMap } from "@mimica/shared";
import type { ElectronMain } from "./electron.js";
import { getActiveMimicaSettings } from "./characterPack.js";
import { assertContained, resolveExpandedPath } from "./paths.js";

export const CHARACTER_ASSET_SCHEME = "mimica-asset";
export const CHARACTER_ASSET_BASE = `${CHARACTER_ASSET_SCHEME}://local/`;

let assetRoot: string | null = null;
let assetRootRealNorm: string | null = null;
let protocolHandlerRegistered = false;
let electronApis: Pick<ElectronMain, "protocol"> | null = null;

const MIME_BY_EXT: Record<string, string> = {
  ".skel": "application/octet-stream",
  ".atlas": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

const CHAT_ICON_NAMES = ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp"] as const;

function syncAssetRootFromSettings(): string {
  const root = resolveExpandedPath(getActiveMimicaSettings().characterAssetRoot);
  assetRoot = root;
  return root;
}

export function bindElectronApis(apis: Pick<ElectronMain, "protocol">): void {
  electronApis = apis;
}

function apis(): Pick<ElectronMain, "protocol"> {
  if (!electronApis) throw new Error("Electron APIs not bound");
  return electronApis;
}

/** 設定パス → 同ベース名の別拡張子 → アセットルートの既定ファイル名 */
export function resolveChatIconFile(assetRootDir: string, configuredPath: string): string | null {
  const configured = assertContained(resolveExpandedPath(configuredPath), assetRootDir);
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

function syncAssetRootRealNorm(): boolean {
  try {
    const root = syncAssetRootFromSettings();
    assetRootRealNorm = `${realpathSync(root)}/`;
    return true;
  } catch {
    assetRootRealNorm = null;
    return false;
  }
}

/** Register or refresh the mimica-asset protocol handler (safe to call repeatedly). */
export function setupAssetProtocolHandler(): boolean {
  if (!syncAssetRootRealNorm()) {
    console.error(
      "[mimica] Character asset root is unavailable; mimica-asset:// requests will 404",
    );
    return false;
  }

  if (protocolHandlerRegistered) return true;

  const { protocol } = apis();
  protocol.handle(CHARACTER_ASSET_SCHEME, (request: Request) => {
    syncAssetRootFromSettings();
    if (!syncAssetRootRealNorm()) {
      return new Response("Not Found", { status: 404 });
    }
    const realRootNorm = assetRootRealNorm;
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const root = assetRoot;
    if (!root || !realRootNorm) {
      return new Response("Not Found", { status: 404 });
    }
    const filePath = normalize(join(root, rel));
    let realPath: string;
    try {
      realPath = realpathSync(filePath);
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[mimica-asset] missing file: ${filePath}`);
      }
      return new Response("Not Found", { status: 404 });
    }
    if (!realPath.startsWith(realRootNorm)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = readFileSync(realPath);
      const mimeType = MIME_BY_EXT[extname(rel).toLowerCase()] ?? "application/octet-stream";
      return new Response(data, { headers: { "Content-Type": mimeType } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mimica-asset] read failed for ${realPath}: ${message}`);
      return new Response("Not Found", { status: 404 });
    }
  });
  protocolHandlerRegistered = true;
  return true;
}

export function ensureAssetProtocolHandler(): boolean {
  return setupAssetProtocolHandler();
}

export function getCharacterAssetStatus(): CharacterAssetStatus {
  ensureAssetProtocolHandler();
  const settings = getActiveMimicaSettings();
  const root = syncAssetRootFromSettings();

  let metadata: CharacterMetadata | null = null;
  let motionMap: MotionMap | null = null;
  const metaPath = join(root, "metadata.json");
  const motionPath = resolveExpandedPath(settings.motionMapPath);

  if (existsSync(metaPath)) {
    try {
      metadata = JSON.parse(readFileSync(metaPath, "utf8")) as CharacterMetadata;
    } catch {
      metadata = null;
    }
  }
  if (existsSync(motionPath)) {
    try {
      motionMap = JSON.parse(readFileSync(motionPath, "utf8")) as MotionMap;
    } catch {
      motionMap = null;
    }
  }

  const required: string[] = [];
  if (metadata) {
    if (typeof metadata.skelFile === "string" && metadata.skelFile.trim() !== "") {
      required.push(metadata.skelFile);
    }
    if (typeof metadata.atlasFile === "string" && metadata.atlasFile.trim() !== "") {
      required.push(metadata.atlasFile);
    }
  } else {
    required.push("metadata.json");
  }

  const missing = required.filter((f) => !existsSync(join(root, f)));
  const metadataValid =
    metadata !== null &&
    typeof metadata.skelFile === "string" &&
    metadata.skelFile.trim() !== "" &&
    typeof metadata.atlasFile === "string" &&
    metadata.atlasFile.trim() !== "";

  const iconFile = resolveChatIconFile(root, settings.chatIconPath);
  let chatIconUrl: string | null = null;
  if (iconFile) {
    const rel = relative(root, iconFile).replace(/\\/g, "/");
    chatIconUrl = `${CHARACTER_ASSET_BASE}${rel}`;
  }

  return {
    baseUrl: CHARACTER_ASSET_BASE,
    assetRoot: root,
    ready: missing.length === 0 && metadataValid && motionMap !== null,
    missing,
    metadata,
    motionMap,
    chatIconUrl,
  };
}

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { electron } from "./electron.js";
import { getActiveMimicaSettings } from "./characterPack.js";
import { resolveExpandedPath } from "./paths.js";

const LOG_PREFIX = "[personaSetup]";
/** Bump when bundled persona templates change incompatibly (e.g. three-layer model). */
export const PERSONA_PACK_VERSION = 2;
const PERSONA_PACK_VERSION_FILE = ".pack-version";

export const PERSONA_PACK_SEEDS = [
  { template: "SKILL.md", dest: "SKILL.md" },
  { template: "style.md", dest: "style.md" },
  { template: "examples.md", dest: "examples.md" },
  { template: "lines.json.example", dest: "lines.json" },
] as const;

/** SHA-256 digests of pack v1 bundled templates (master @ 0.2.0). */
const PERSONA_PACK_V1_DIGESTS: Record<(typeof PERSONA_PACK_SEEDS)[number]["dest"], string> = {
  "SKILL.md": "8269430d0dde9e7aa331617c840fa140a6be9fd132ecfbe729052128ae661998",
  "style.md": "becd61fb9dd47b8a27316061a8eb07edf62eeb84af955292a981dd9d4d445544",
  "examples.md": "dbcef2ceb07487e5a96bda02f8b40b93ce914c35b953a422195d7ec46936043c",
  "lines.json": "e9a37a0149531a2d200c8141ad65898a8ada3e0bbec3383e08d01dede56d6f12",
};

let cachedTemplatePersonaDir: string | undefined;
let cachedPersonaPrompt: string | undefined;
let cachedPersonaSourcePath: string | undefined;
let cachedPersonaSourceMtimeMs: number | undefined;
let cachedPersonaStyleMtimeMs: number | undefined;

function devTemplatePersonaDir(): string {
  const companionRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  return join(companionRoot, "../../templates/persona");
}

/** Packaged apps read from extraResources; dev uses monorepo templates/persona. */
function getTemplatePersonaDir(): string {
  if (cachedTemplatePersonaDir) return cachedTemplatePersonaDir;

  try {
    const { app } = electron();
    cachedTemplatePersonaDir = app.isPackaged
      ? join(process.resourcesPath, "templates/persona")
      : devTemplatePersonaDir();
  } catch {
    cachedTemplatePersonaDir = devTemplatePersonaDir();
  }

  if (!existsSync(cachedTemplatePersonaDir)) {
    console.warn(`${LOG_PREFIX} template persona directory not found: ${cachedTemplatePersonaDir}`);
  }

  return cachedTemplatePersonaDir;
}

function readPersonaPack(skillPath: string): string | null {
  const templatePersonaDir = getTemplatePersonaDir();
  const candidates = [skillPath, join(templatePersonaDir, "SKILL.md")].filter((p) => existsSync(p));

  const resolved = candidates[0];
  if (!resolved) {
    console.warn(
      `${LOG_PREFIX} persona pack not found (checked user path and ${templatePersonaDir})`,
    );
    return null;
  }

  const dir = dirname(resolved);
  const parts = [readFileSync(resolved, "utf8").trim()];
  const stylePath = join(dir, "style.md");
  if (existsSync(stylePath)) {
    parts.push(`---\n${readFileSync(stylePath, "utf8").trim()}`);
  }
  return parts.join("\n\n");
}

function readInstalledPersonaPackVersion(targetDir: string): number {
  const versionPath = join(targetDir, PERSONA_PACK_VERSION_FILE);
  if (!existsSync(versionPath)) return 0;
  const parsed = Number.parseInt(readFileSync(versionPath, "utf8").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeInstalledPersonaPackVersion(targetDir: string, version: number): void {
  writeFileSync(join(targetDir, PERSONA_PACK_VERSION_FILE), `${version}\n`, "utf8");
}

function fileSha256(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

/** Whether an upgrade may replace an existing destination file. */
function shouldReplaceOnUpgrade(
  installedVersion: number,
  dest: (typeof PERSONA_PACK_SEEDS)[number]["dest"],
  outPath: string,
): boolean {
  if (!existsSync(outPath)) return true;
  if (installedVersion === 0) return false;
  if (installedVersion === 1) {
    const v1Digest = PERSONA_PACK_V1_DIGESTS[dest];
    return v1Digest !== undefined && fileSha256(outPath) === v1Digest;
  }
  return false;
}

export function resetPersonaSetupCachesForTests(): void {
  cachedTemplatePersonaDir = undefined;
  cachedPersonaPrompt = undefined;
  cachedPersonaSourcePath = undefined;
  cachedPersonaSourceMtimeMs = undefined;
  cachedPersonaStyleMtimeMs = undefined;
}

/** Seeds or upgrades persona pack files from bundled templates. */
export function syncPersonaPackFromTemplate(
  templatePersonaDir: string,
  targetDir: string,
): boolean {
  mkdirSync(targetDir, { recursive: true });
  const installedVersion = readInstalledPersonaPackVersion(targetDir);
  const shouldUpgrade = installedVersion < PERSONA_PACK_VERSION;
  let changed = false;
  let upgradeComplete = true;

  for (const { template, dest } of PERSONA_PACK_SEEDS) {
    const src = join(templatePersonaDir, template);
    const out = join(targetDir, dest);
    if (!existsSync(src)) {
      console.warn(`${LOG_PREFIX} seed template missing: ${src}`);
      if (shouldUpgrade) upgradeComplete = false;
      continue;
    }
    if (!shouldUpgrade && existsSync(out)) continue;
    if (shouldUpgrade && !shouldReplaceOnUpgrade(installedVersion, dest, out)) continue;
    try {
      copyFileSync(src, out);
      changed = true;
    } catch (err) {
      console.error(`${LOG_PREFIX} failed to seed ${dest} from ${src}:`, err);
      if (shouldUpgrade) upgradeComplete = false;
    }
  }

  if (shouldUpgrade && upgradeComplete) {
    writeInstalledPersonaPackVersion(targetDir, PERSONA_PACK_VERSION);
    changed = true;
  }

  return changed;
}

export function ensurePersonaPackOnDisk(): void {
  const assetRoot = resolveExpandedPath(getActiveMimicaSettings().characterAssetRoot);
  const targetDir = join(assetRoot, "persona");
  const changed = syncPersonaPackFromTemplate(getTemplatePersonaDir(), targetDir);
  if (changed) {
    cachedPersonaPrompt = undefined;
    cachedPersonaSourcePath = undefined;
    cachedPersonaSourceMtimeMs = undefined;
    cachedPersonaStyleMtimeMs = undefined;
  }
}

function personaSourceMtimeMs(sourcePath: string): number | undefined {
  try {
    return statSync(sourcePath).mtimeMs;
  } catch {
    return undefined;
  }
}

export function resolvePersonaSystemPrompt(): string | undefined {
  ensurePersonaPackOnDisk();
  const settings = getActiveMimicaSettings();
  const sourcePath = resolveExpandedPath(settings.personaPackPath);
  const sourceMtimeMs = personaSourceMtimeMs(sourcePath);
  const stylePath = join(dirname(sourcePath), "style.md");
  const styleMtimeMs = personaSourceMtimeMs(stylePath);
  if (
    cachedPersonaPrompt &&
    cachedPersonaSourcePath === sourcePath &&
    cachedPersonaSourceMtimeMs === sourceMtimeMs &&
    cachedPersonaStyleMtimeMs === styleMtimeMs
  ) {
    return cachedPersonaPrompt;
  }
  const prompt = readPersonaPack(sourcePath);
  if (!prompt) return undefined;
  cachedPersonaSourcePath = sourcePath;
  cachedPersonaSourceMtimeMs = sourceMtimeMs;
  cachedPersonaStyleMtimeMs = styleMtimeMs;
  cachedPersonaPrompt = prompt;
  return prompt;
}

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { electron } from "./electron.js";
import { homedir } from "node:os";
import { resolveContainedPath } from "./paths.js";

const LOG_PREFIX = "[personaSetup]";

let cachedTemplatePersonaDir: string | undefined;

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
    console.warn(
      `${LOG_PREFIX} template persona directory not found: ${cachedTemplatePersonaDir}`,
    );
  }

  return cachedTemplatePersonaDir;
}

function readPersonaPack(skillPath: string): string | null {
  const templatePersonaDir = getTemplatePersonaDir();
  const candidates = [
    skillPath,
    join(templatePersonaDir, "SKILL.md"),
  ].filter((p) => existsSync(p));

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
  const linesPath = join(dir, "lines.json");
  if (existsSync(stylePath)) {
    parts.push(`---\n${readFileSync(stylePath, "utf8").trim()}`);
  }
  if (existsSync(linesPath)) {
    parts.push(`---\n## 参考セリフ (lines.json)\n${readFileSync(linesPath, "utf8").trim()}`);
  }
  return parts.join("\n\n");
}

function resolveCharacterAssetRoot(): string {
  return resolveContainedPath(DEFAULT_SETTINGS.characterAssetRoot, homedir());
}

export function ensurePersonaPackOnDisk(): void {
  const assetRoot = resolveCharacterAssetRoot();
  const targetDir = resolveContainedPath(
    join(DEFAULT_SETTINGS.characterAssetRoot, "persona"),
    assetRoot,
  );
  mkdirSync(targetDir, { recursive: true });

  const seeds: Array<{ template: string; dest: string }> = [
    { template: "SKILL.md", dest: "SKILL.md" },
    { template: "style.md", dest: "style.md" },
    { template: "examples.md", dest: "examples.md" },
    { template: "lines.json.example", dest: "lines.json" },
  ];
  const templatePersonaDir = getTemplatePersonaDir();
  for (const { template, dest } of seeds) {
    const src = join(templatePersonaDir, template);
    const out = join(targetDir, dest);
    if (!existsSync(src)) {
      console.warn(`${LOG_PREFIX} seed template missing: ${src}`);
      continue;
    }
    if (existsSync(out)) continue;
    try {
      copyFileSync(src, out);
    } catch (err) {
      console.error(`${LOG_PREFIX} failed to seed ${dest} from ${src}:`, err);
    }
  }
}

export function resolvePersonaSystemPrompt(): string | undefined {
  ensurePersonaPackOnDisk();
  const prompt = readPersonaPack(
    resolveContainedPath(DEFAULT_SETTINGS.personaPackPath, resolveCharacterAssetRoot()),
  );
  return prompt ?? undefined;
}

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { expandHomePath } from "./paths.js";

const companionRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const templatePersonaDir = join(companionRoot, "../../templates/persona");

function readPersonaPack(skillPath: string): string | null {
  const candidates = [
    skillPath,
    join(templatePersonaDir, "SKILL.md"),
  ].filter((p) => existsSync(p));

  const resolved = candidates[0];
  if (!resolved) return null;

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

export function ensurePersonaPackOnDisk(): void {
  const targetDir = expandHomePath(join(DEFAULT_SETTINGS.characterAssetRoot, "persona"));
  mkdirSync(targetDir, { recursive: true });

  const seeds: Array<{ template: string; dest: string }> = [
    { template: "SKILL.md", dest: "SKILL.md" },
    { template: "style.md", dest: "style.md" },
    { template: "examples.md", dest: "examples.md" },
    { template: "lines.json.example", dest: "lines.json" },
  ];
  for (const { template, dest } of seeds) {
    const src = join(templatePersonaDir, template);
    const out = join(targetDir, dest);
    if (existsSync(src) && !existsSync(out)) {
      copyFileSync(src, out);
    }
  }
}

export function resolvePersonaSystemPrompt(): string | undefined {
  ensurePersonaPackOnDisk();
  const prompt = readPersonaPack(expandHomePath(DEFAULT_SETTINGS.personaPackPath));
  return prompt ?? undefined;
}

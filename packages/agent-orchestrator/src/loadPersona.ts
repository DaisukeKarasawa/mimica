import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function expandHomePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

export interface PersonaPack {
  skillMarkdown: string;
  styleMarkdown?: string;
  linesJson?: string;
  sourcePath: string;
}

export function loadPersonaPack(
  personaSkillPath: string,
  templatePersonaDir?: string,
): PersonaPack | null {
  const primary = expandHomePath(personaSkillPath);
  const candidates = [
    primary,
    templatePersonaDir ? join(templatePersonaDir, "SKILL.md") : null,
  ].filter((p): p is string => !!p && existsSync(p));

  const skillPath = candidates[0];
  if (!skillPath) return null;

  const dir = dirname(skillPath);
  const stylePath = join(dir, "style.md");
  const linesPath = join(dir, "lines.json");

  return {
    skillMarkdown: readFileSync(skillPath, "utf8"),
    styleMarkdown: existsSync(stylePath) ? readFileSync(stylePath, "utf8") : undefined,
    linesJson: existsSync(linesPath) ? readFileSync(linesPath, "utf8") : undefined,
    sourcePath: skillPath,
  };
}

export function buildPersonaSystemPrompt(
  pack: PersonaPack,
  options?: { includeReferenceLines?: boolean },
): string {
  const parts = [pack.skillMarkdown.trim()];
  if (pack.styleMarkdown) {
    parts.push(`---\n${pack.styleMarkdown.trim()}`);
  }
  if (options?.includeReferenceLines && pack.linesJson) {
    parts.push(`---\n## 参考セリフ (lines.json)\n${pack.linesJson.trim()}`);
  }
  return parts.join("\n\n");
}

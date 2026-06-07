import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SlashMenuItem } from "@mimica/shared";
import { normalizeWorkspacePath } from "./discovery.js";

export const IMAGE_GENERATE_MENU_ITEM: SlashMenuItem = {
  kind: "image",
  name: "image",
  description: "テキスト指示で画像を生成（GenerateImage）",
};

export const IMAGE_ATTACH_MENU_ITEM: SlashMenuItem = {
  kind: "image",
  name: "attach",
  description: "既存画像を添付（PNG / JPEG / WebP / GIF）",
};

export function defaultGeneratedImageDir(workspacePath: string): string {
  return join(workspacePath, "assets");
}

export function resolveSlashImageGeneration(
  workspacePath: string | null,
  remainder?: string,
): { expanded: string; warning?: string } | null {
  const normalized = normalizeWorkspacePath(workspacePath);
  if (!normalized) {
    return {
      expanded: "/image",
      warning:
        "画像生成にはワークスペースのリンクが必要です。Extension でフォルダを開いてください。",
    };
  }

  const prompt = remainder?.trim();
  if (!prompt) {
    return {
      expanded: "/image",
      warning: "画像生成の指示を `/image` の後に入力してください。",
    };
  }

  const assetsDir = defaultGeneratedImageDir(normalized);
  let assetsReady = existsSync(assetsDir);
  if (!assetsReady) {
    try {
      mkdirSync(assetsDir, { recursive: true });
      assetsReady = true;
    } catch {
      assetsReady = false;
    }
  }

  const saveHint = assetsReady
    ? `Save generated images under \`${assetsDir}\` (create subfolders if helpful).`
    : `Could not create \`${assetsDir}\`; show the image inline in chat if saving fails.`;

  const expanded = [
    "## Image generation request",
    "",
    "Use the GenerateImage tool (or equivalent image generation tool) to create a new image from the user's description.",
    "",
    saveHint,
    "",
    "After generation, briefly confirm what was created and where it was saved (or that only inline preview is available).",
    "",
    "---",
    "",
    "## User description",
    "",
    prompt,
  ].join("\n");

  return {
    expanded,
    warning: assetsReady
      ? undefined
      : `Could not create assets directory at ${assetsDir}; image may only appear inline in chat.`,
  };
}

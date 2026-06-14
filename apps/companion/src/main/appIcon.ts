import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NativeImage } from "electron";
import { electron } from "./electron.js";

const COMPANION_PACKAGE_NAME = "@mimica/companion";

export const ICON_CANDIDATES = [
  "icon-dock.png",
  "icon.icns",
  "icon.png",
  "icon.jpg",
  "icon.jpeg",
] as const;

export function resolveCompanionPackageRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../.."), // src/main → apps/companion
    join(moduleDir, "../../.."), // out/main → apps/companion
    process.cwd(),
  ];

  for (const root of candidates) {
    const packageJsonPath = join(root, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
      if (pkg.name === COMPANION_PACKAGE_NAME) return root;
    } catch {
      /* try next candidate */
    }
  }

  return join(moduleDir, "../..");
}

function* eachBuildIconPath(root: string): Generator<string> {
  for (const name of ICON_CANDIDATES) {
    const path = join(root, "build", name);
    if (existsSync(path)) yield path;
  }
}

export function resolveAppIconPath(): string | undefined {
  const root = resolveCompanionPackageRoot();
  return eachBuildIconPath(root).next().value;
}

export function loadAppIcon(): NativeImage | undefined {
  const { nativeImage } = electron();
  const root = resolveCompanionPackageRoot();

  for (const iconPath of eachBuildIconPath(root)) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  }

  return undefined;
}

/** Dock / window icon for unpackaged runs (dev, preview). Packaged .app uses electron-builder resources. */
export function applyAppIcon(): void {
  const icon = loadAppIcon();
  if (!icon) {
    console.warn(
      "[appIcon] No usable icon in build/. Run `pnpm --filter @mimica/companion run icon:mac` on macOS.",
    );
    return;
  }

  const { app } = electron();
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }
}

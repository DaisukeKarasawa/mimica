#!/usr/bin/env node
/**
 * Builds macOS app icons from build/icon.{png,jpg,jpeg}:
 * - icon-dock.png: squircle mask baked in (for Electron dev Dock via setIcon)
 * - icon.icns: for electron-builder / packaged .app (macOS applies its own mask)
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const companionRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(companionRoot, "build");
const DOCK_SIZE = 1024;
/** Visible squircle size in the Dock slot (macOS neighbors are roughly 80–84%). */
const DOCK_VISUAL_SCALE = 0.82;
/** Inset of artwork inside the squircle. */
const INNER_ART_PADDING_RATIO = 0.1;

if (process.platform !== "darwin") {
  console.log("icon:mac skipped (macOS only).");
  process.exit(0);
}

const SOURCE_CANDIDATES = ["icon.png", "icon.jpg", "icon.jpeg"];
const source = SOURCE_CANDIDATES.map((name) => join(buildDir, name)).find((path) =>
  existsSync(path),
);
if (!source) {
  console.error(`error: place one of ${SOURCE_CANDIDATES.join(", ")} in build/`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function buildDockIcon(sourcePath, outPath) {
  const squircleSize = Math.round(DOCK_SIZE * DOCK_VISUAL_SCALE);
  const squircleOffset = Math.round((DOCK_SIZE - squircleSize) / 2);
  const maskRadius = Math.round(squircleSize * 0.2237);
  const artPadding = Math.round(squircleSize * INNER_ART_PADDING_RATIO);
  const artSize = squircleSize - artPadding * 2;

  const meta = await sharp(sourcePath).metadata();
  const background = meta.hasAlpha
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 255, g: 255, b: 255, alpha: 1 };

  const resized = await sharp(sourcePath)
    .resize(artSize, artSize, { fit: "contain", background })
    .png()
    .toBuffer();

  const squircleCanvas = await sharp({
    create: {
      width: squircleSize,
      height: squircleSize,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, top: artPadding, left: artPadding }])
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${squircleSize}" height="${squircleSize}">
      <rect width="${squircleSize}" height="${squircleSize}" rx="${maskRadius}" ry="${maskRadius}" fill="white"/>
    </svg>`,
  );

  const maskedSquircle = await sharp(squircleCanvas)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: DOCK_SIZE,
      height: DOCK_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: maskedSquircle, top: squircleOffset, left: squircleOffset }])
    .png()
    .toFile(outPath);
}

const workPng = join(buildDir, ".icon-source.png");
run("sips", ["-s", "format", "png", source, "--out", workPng]);

const dockOut = join(buildDir, "icon-dock.png");
await buildDockIcon(workPng, dockOut);
console.log(`Wrote ${dockOut} from ${source}`);

const iconset = join(buildDir, "icon.iconset");
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset);

const entries = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

for (const [size, name] of entries) {
  run("sips", ["-z", String(size), String(size), workPng, "--out", join(iconset, name)]);
}

const icnsOut = join(buildDir, "icon.icns");
run("iconutil", ["-c", "icns", iconset, "-o", icnsOut]);

rmSync(iconset, { recursive: true, force: true });
rmSync(workPng, { force: true });
console.log(`Wrote ${icnsOut} from ${source}`);

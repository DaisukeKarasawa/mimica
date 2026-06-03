#!/usr/bin/env node
/**
 * Copies packs/rio from mimica-assets into build/packs/rio for electron-builder.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const companionRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(companionRoot, "../..");
const assetsRepo = process.env.MIMICA_ASSETS_REPO ?? join(repoRoot, "../mimica-assets");
const src = join(assetsRepo, "packs/rio");
const destRoot = join(companionRoot, "build/packs");
const dest = join(destRoot, "rio");

if (!existsSync(src)) {
  console.error(`error: pack not found: ${src}`);
  console.error("Clone mimica-assets or set MIMICA_ASSETS_REPO.");
  process.exit(1);
}

rmSync(destRoot, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);

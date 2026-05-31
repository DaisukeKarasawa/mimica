#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AtlasAttachmentLoader, SkeletonBinary, TextureAtlas } from "@esotericsoftware/spine-core";
import { ATLAS_SCALE } from "./atlasScale.js";

function usage(): never {
  console.error("Usage: extract-animations <path-to.skel> [path-to.atlas]");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a: string) => a !== "--");
const skelArg = args[0];
if (!skelArg) usage();
const skelPath = resolve(skelArg);
const atlasPath = resolve(args[1] ?? skelPath.replace(/\.skel$/i, ".atlas"));

try {
  const atlasText = readFileSync(atlasPath, "utf8");
  const atlas = new TextureAtlas(atlasText);
  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  const binary = new SkeletonBinary(attachmentLoader);
  binary.scale = ATLAS_SCALE;
  const skeletonData = binary.readSkeletonData(readFileSync(skelPath));
  const names = skeletonData.animations.map((a) => a.name).sort();
  console.log(`Animations (${names.length}):`);
  for (const name of names) {
    console.log(`  - ${name}`);
  }
} catch (err) {
  console.error(
    "Failed to parse .skel (format/version mismatch?). Verify in Companion with pnpm dev:companion.",
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

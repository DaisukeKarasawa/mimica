#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AtlasAttachmentLoader, SkeletonBinary, TextureAtlas } from "@esotericsoftware/spine-core";

function usage(): never {
  console.error("Usage: extract-animations <path-to.skel> [path-to.atlas]");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== "--");
const skelPath = resolve(args[0] ?? usage());
const atlasPath = resolve(args[1] ?? skelPath.replace(/\.skel$/i, ".atlas"));

const atlasText = readFileSync(atlasPath, "utf8");
const atlas = new TextureAtlas(atlasText);
const attachmentLoader = new AtlasAttachmentLoader(atlas);
const binary = new SkeletonBinary(attachmentLoader);
binary.scale = 0.61;
try {
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

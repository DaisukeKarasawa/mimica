#!/usr/bin/env node
/**
 * Align workspace package.json "version" fields with a release tag (vX.Y.Z).
 * Used by /loop-on-release before cutting an annotated tag.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Paths whose version must match the release tag (artifact names + workspace sync). */
const VERSION_PATHS = [
  "package.json",
  "apps/cursor-extension/package.json",
  "apps/companion/package.json",
  "packages/shared/package.json",
  "packages/ui/package.json",
  "packages/character-runtime/package.json",
  "packages/agent-orchestrator/package.json",
];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function parseArgs(argv) {
  let dryRun = false;
  let check = false;
  let tagOrVersion = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--check") check = true;
    else if (arg.startsWith("-")) {
      console.error(`error: unknown option ${arg}`);
      process.exit(1);
    } else if (tagOrVersion) {
      console.error("error: expected a single version or tag argument");
      process.exit(1);
    } else {
      tagOrVersion = arg;
    }
  }

  if (!tagOrVersion) {
    console.error("usage: bump-release-version.mjs [--dry-run|--check] <vX.Y.Z|X.Y.Z>");
    process.exit(1);
  }

  const version = tagOrVersion.startsWith("v") ? tagOrVersion.slice(1) : tagOrVersion;
  if (!SEMVER_RE.test(version)) {
    console.error(`error: invalid semver: ${tagOrVersion} (expected vMAJOR.MINOR.PATCH)`);
    process.exit(1);
  }

  return { dryRun, check, version, tag: `v${version}` };
}

function readVersion(relPath) {
  const abs = join(repoRoot, relPath);
  const pkg = JSON.parse(readFileSync(abs, "utf8"));
  if (typeof pkg.version !== "string") {
    throw new Error(`${relPath}: missing string "version"`);
  }
  return pkg.version;
}

function writeVersion(relPath, version) {
  const abs = join(repoRoot, relPath);
  const raw = readFileSync(abs, "utf8");
  const pkg = JSON.parse(raw);
  pkg.version = version;
  writeFileSync(abs, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function main() {
  const { dryRun, check, version, tag } = parseArgs(process.argv.slice(2));
  const changes = [];
  const mismatches = [];

  for (const relPath of VERSION_PATHS) {
    const current = readVersion(relPath);
    if (current === version) continue;
    mismatches.push({ relPath, current });
    if (!check) changes.push({ relPath, from: current, to: version });
  }

  if (check) {
    if (mismatches.length === 0) {
      console.log(`ok: all release package versions match ${tag}`);
      return;
    }
    for (const { relPath, current } of mismatches) {
      console.error(`${relPath}: ${current} (expected ${version})`);
    }
    process.exit(1);
  }

  if (changes.length === 0) {
    console.log(`ok: package versions already at ${version} (${tag})`);
    return;
  }

  for (const { relPath, from, to } of changes) {
    console.log(`${dryRun ? "[dry-run] " : ""}${relPath}: ${from} → ${to}`);
    if (!dryRun) writeVersion(relPath, to);
  }

  if (dryRun) {
    console.log(`dry-run: would align ${changes.length} file(s) to ${tag}`);
  } else {
    console.log(`bumped ${changes.length} file(s) to ${version} (${tag})`);
  }
}

main();

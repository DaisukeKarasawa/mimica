#!/usr/bin/env node
/**
 * Repo-root helper: copy mimica-assets packs into companion build/ for packaging.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, "apps/companion/scripts/copy-pack.mjs");
const result = spawnSync(process.execPath, [script], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

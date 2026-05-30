import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(appRoot));

// Cursor IDE terminals set ELECTRON_RUN_AS_NODE=1, which makes Electron behave like
// plain Node and makes require("electron") return the executable path instead of APIs.
delete process.env.ELECTRON_RUN_AS_NODE;

process.env.ELECTRON_EXEC_PATH = require("electron");
process.env.NODE_ENV_ELECTRON_VITE ??= process.argv[2] === "dev" ? "development" : "production";

const binCandidates = [
  join(appRoot, "node_modules", "electron-vite", "bin", "electron-vite.js"),
  join(repoRoot, "node_modules", "electron-vite", "bin", "electron-vite.js"),
];
const bin = binCandidates.find((p) => existsSync(p));
if (!bin) {
  console.error("electron-vite が見つかりません。リポジトリ直下で pnpm install を実行してください。");
  process.exit(1);
}

const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: appRoot,
  env: process.env,
});
process.exit(result.status ?? 1);

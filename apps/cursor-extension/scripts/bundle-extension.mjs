#!/usr/bin/env node
import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  entryPoints: [join(root, "src/extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(root, "dist/extension.js"),
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
});

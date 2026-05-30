import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

/** Bundled into main CJS (ESM-only exports). @mimica/agent-orchestrator pulls in @cursor/sdk — load via import() instead. */
const WORKSPACE_MAIN_DEPS = ["@mimica/shared"];

// Packaged persona templates: package.json "build.extraResources" → process.resourcesPath/templates/persona

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_MAIN_DEPS })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
    plugins: [react()],
  },
});

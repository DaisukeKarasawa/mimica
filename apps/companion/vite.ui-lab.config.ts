import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const companionRoot = resolve(import.meta.dirname);
const rendererRoot = resolve(companionRoot, "src/renderer");

/** Browser-only preview for Cursor Design Mode (no Electron). */
export default defineConfig({
  root: rendererRoot,
  envDir: companionRoot,
  plugins: [react()],
  define: {
    "import.meta.env.VITE_UI_LAB": JSON.stringify("true"),
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    open: false,
  },
  resolve: {
    alias: {
      "@renderer": resolve(rendererRoot, "src"),
      "@mimica/character-runtime": resolve(
        companionRoot,
        "../../packages/character-runtime/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@mimica/character-runtime"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
});

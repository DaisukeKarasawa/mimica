export type ElectronMain = typeof import("electron");

let cached: ElectronMain | null = null;

/** Electron main では組み込み `require("electron")` を使う（createRequire は npm パッケージに解決される）。 */
export function electron(): ElectronMain {
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("electron") as ElectronMain | string;
  if (typeof mod === "string" || !mod?.app) {
    throw new Error(
      "Electron API を取得できません。Cursor 内ターミナルでは ELECTRON_RUN_AS_NODE が有効なことがあります。`pnpm dev:companion` を再実行するか、外部ターミナルで起動してください。",
    );
  }
  cached = mod;
  return mod;
}

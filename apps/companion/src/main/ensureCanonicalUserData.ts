import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MIMICA_BRIDGE_TOKEN_FILENAME } from "@mimica/shared";
import {
  mimicaBridgeTokenPath,
  mimicaLegacyPackagedUserDataDir,
  mimicaUserDataDir,
} from "@mimica/shared/paths";
import type { ElectronMain } from "./electron.js";

function fileHasContent(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf8").trim().length > 0;
  } catch {
    return false;
  }
}

function migrateFileIfNeeded(source: string, dest: string, label: string): void {
  if (!existsSync(source)) return;
  if (existsSync(dest) && fileHasContent(dest)) return;
  try {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
  } catch (err) {
    console.error(`[ensureCanonicalUserData] Failed to migrate ${label}:`, err);
  }
}

function migrateSessionsDir(legacyDir: string, canonicalDir: string): void {
  if (!existsSync(legacyDir)) return;
  try {
    mkdirSync(canonicalDir, { recursive: true });
    for (const file of readdirSync(legacyDir)) {
      if (!file.endsWith(".json")) continue;
      const source = join(legacyDir, file);
      const dest = join(canonicalDir, file);
      if (existsSync(dest)) continue;
      copyFileSync(source, dest);
    }
  } catch (err) {
    console.error("[ensureCanonicalUserData] Failed to migrate sessions:", err);
  }
}

/** Force canonical userData and migrate persisted files from legacy packaged layout. */
export function ensureCanonicalUserData(app: ElectronMain["app"]): void {
  if (process.platform !== "darwin") return;

  const canonicalUserData = mimicaUserDataDir();
  const legacyUserData = mimicaLegacyPackagedUserDataDir();

  try {
    mkdirSync(canonicalUserData, { recursive: true });
  } catch (err) {
    console.error("[ensureCanonicalUserData] Failed to create canonical userData dir:", err);
    return;
  }

  migrateFileIfNeeded(
    join(legacyUserData, MIMICA_BRIDGE_TOKEN_FILENAME),
    mimicaBridgeTokenPath(),
    "bridge-token",
  );
  migrateSessionsDir(join(legacyUserData, "sessions"), join(canonicalUserData, "sessions"));
  migrateFileIfNeeded(
    join(legacyUserData, "window-state.json"),
    join(canonicalUserData, "window-state.json"),
    "window-state.json",
  );

  app.setPath("userData", canonicalUserData);
}

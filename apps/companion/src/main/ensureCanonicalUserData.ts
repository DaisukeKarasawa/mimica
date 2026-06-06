import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIMICA_BRIDGE_TOKEN_FILENAME } from "@mimica/shared";
import {
  mimicaBridgeTokenPath,
  mimicaLegacyPackagedUserDataDir,
  mimicaUserDataDir,
} from "@mimica/shared/paths";
import type { ElectronMain } from "./electron.js";

/** Force canonical userData and migrate bridge-token from legacy packaged layout. */
export function ensureCanonicalUserData(app: ElectronMain["app"]): void {
  if (process.platform !== "darwin") return;

  const canonicalUserData = mimicaUserDataDir();
  app.setPath("userData", canonicalUserData);

  const canonicalToken = mimicaBridgeTokenPath();
  if (existsSync(canonicalToken)) return;

  const legacyToken = `${mimicaLegacyPackagedUserDataDir()}/${MIMICA_BRIDGE_TOKEN_FILENAME}`;
  if (!existsSync(legacyToken)) return;

  mkdirSync(dirname(canonicalToken), { recursive: true });
  copyFileSync(legacyToken, canonicalToken);
}

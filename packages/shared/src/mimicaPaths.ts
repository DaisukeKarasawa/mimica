import { homedir } from "node:os";
import { join } from "node:path";
import { MIMICA_BRIDGE_TOKEN_FILENAME, MIMICA_USER_DATA_DIR_NAME } from "./mimicaPathConstants.js";

/** Companion userData root (macOS MVP). Matches Electron `app.getPath("userData")`. */
export function mimicaUserDataDir(homeDir: string = homedir()): string {
  if (process.platform !== "darwin") {
    throw new Error("Mimica userData dir is macOS-only in MVP");
  }
  return join(homeDir, "Library", "Application Support", MIMICA_USER_DATA_DIR_NAME);
}

export function mimicaBridgeTokenPath(homeDir?: string): string {
  return join(mimicaUserDataDir(homeDir ?? homedir()), MIMICA_BRIDGE_TOKEN_FILENAME);
}

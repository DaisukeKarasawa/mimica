import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function companionBridgeTokenPath(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Mimica", "bridge-token");
  }
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? homedir(), "Mimica", "bridge-token");
  }
  return join(homedir(), ".config", "Mimica", "bridge-token");
}

/** Resolve bridge token: env first, then Companion userData file (consumer path). */
export function getBridgeToken(): string | null {
  const fromEnv = process.env.MIMICA_BRIDGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const tokenPath = companionBridgeTokenPath();
  if (!existsSync(tokenPath)) return null;

  const persisted = readFileSync(tokenPath, "utf8").trim();
  return persisted || null;
}

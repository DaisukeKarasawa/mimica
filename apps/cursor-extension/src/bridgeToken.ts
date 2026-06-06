import { readFileSync } from "node:fs";
import { mimicaBridgeTokenPath } from "@mimica/shared";

/** Resolve bridge token: env first, then Companion userData file (consumer path). */
export function getBridgeToken(): string | null {
  const fromEnv = process.env.MIMICA_BRIDGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  if (process.platform !== "darwin") return null;

  const tokenPath = mimicaBridgeTokenPath();
  try {
    const persisted = readFileSync(tokenPath, "utf8").trim();
    return persisted || null;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES" || code === "EPERM") return null;
    throw err;
  }
}

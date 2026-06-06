import { existsSync, readFileSync } from "node:fs";
import { mimicaBridgeTokenCandidatePaths } from "@mimica/shared/paths";

/** Resolve bridge token: env first, then Companion userData file (consumer path). */
export function getBridgeToken(): string | null {
  const fromEnv = process.env.MIMICA_BRIDGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  if (process.platform !== "darwin") return null;

  const candidates = mimicaBridgeTokenCandidatePaths();
  for (let i = 0; i < candidates.length; i++) {
    const tokenPath = candidates[i];
    if (!existsSync(tokenPath)) continue;
    try {
      const persisted = readFileSync(tokenPath, "utf8").trim();
      if (persisted) return persisted;
      // Canonical file exists but is empty — treat as unset; do not read legacy token.
      if (i === 0) return null;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EACCES" || code === "EPERM") continue;
      throw err;
    }
  }

  return null;
}

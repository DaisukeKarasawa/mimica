import type { ElectronMain } from "./electron.js";
import { CHARACTER_ASSET_SCHEME } from "./assetProtocol.js";
import { ATTACHMENT_SCHEME } from "./attachmentProtocol.js";

const PRIVILEGED_SCHEME_OPTIONS = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
  stream: true,
} as const;

let registered = false;

/** Register all custom schemes in one call (Electron last-call-wins otherwise). */
export function registerPrivilegedProtocols(protocol: ElectronMain["protocol"]): void {
  if (registered) return;
  protocol.registerSchemesAsPrivileged([
    { scheme: CHARACTER_ASSET_SCHEME, privileges: PRIVILEGED_SCHEME_OPTIONS },
    { scheme: ATTACHMENT_SCHEME, privileges: PRIVILEGED_SCHEME_OPTIONS },
  ]);
  registered = true;
}

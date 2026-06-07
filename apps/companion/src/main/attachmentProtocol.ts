import { extname } from "node:path";
import type { ElectronMain } from "./electron.js";
import { resolveAttachmentPath } from "./imageAttachments.js";
import { IMAGE_MIME_BY_EXT, mimeFromExtension } from "./mime.js";
import { fileProtocolResponse } from "./protocolFileResponse.js";

export const ATTACHMENT_SCHEME = "mimica-attachment";

let electronApis: Pick<ElectronMain, "protocol"> | null = null;
let handlerRegistered = false;
let sessionExists: ((sessionId: string) => boolean) | null = null;

export function bindAttachmentProtocolApis(apis: Pick<ElectronMain, "protocol">): void {
  electronApis = apis;
}

export function bindAttachmentSessionGuard(guard: (sessionId: string) => boolean): void {
  sessionExists = guard;
}

function apis(): Pick<ElectronMain, "protocol"> {
  if (!electronApis) throw new Error("Attachment protocol APIs not bound");
  return electronApis;
}

export function setupAttachmentProtocolHandler(): void {
  if (handlerRegistered) return;
  const { protocol } = apis();
  protocol.handle(ATTACHMENT_SCHEME, (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 2) {
        return new Response("Not found", { status: 404 });
      }
      const [sessionId, storagePath] = parts;
      if (sessionExists && !sessionExists(sessionId)) {
        return new Response("Not found", { status: 404 });
      }
      const filePath = resolveAttachmentPath(sessionId, decodeURIComponent(storagePath));
      const mimeType = mimeFromExtension(extname(storagePath), IMAGE_MIME_BY_EXT);
      return fileProtocolResponse(filePath, mimeType);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  handlerRegistered = true;
}

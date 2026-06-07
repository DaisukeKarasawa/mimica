import { readFileSync } from "node:fs";
import type { ElectronMain } from "./electron.js";
import { resolveAttachmentPath } from "./imageAttachments.js";

export const ATTACHMENT_SCHEME = "mimica-attachment";

let electronApis: Pick<ElectronMain, "protocol"> | null = null;
let handlerRegistered = false;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function bindAttachmentProtocolApis(apis: Pick<ElectronMain, "protocol">): void {
  electronApis = apis;
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
      const filePath = resolveAttachmentPath(sessionId, decodeURIComponent(storagePath));
      const ext = storagePath.slice(storagePath.lastIndexOf(".")).toLowerCase();
      const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
      const data = readFileSync(filePath);
      return new Response(data, { headers: { "Content-Type": mimeType } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  handlerRegistered = true;
}

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { ChatAttachment } from "@mimica/shared";
import { userDataJoin } from "./userDataPaths.js";

export const MAX_IMAGE_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ImageAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAttachmentError";
  }
}

function safeSessionId(sessionId: string): string {
  if (!UUID_RE.test(sessionId)) {
    throw new ImageAttachmentError("Invalid session id");
  }
  return sessionId;
}

function attachmentsDir(sessionId: string): string {
  return userDataJoin("sessions", safeSessionId(sessionId), "attachments");
}

function mimeFromPath(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}

function assertSupportedImage(filePath: string): { mimeType: string; size: number } {
  const mimeType = mimeFromPath(filePath);
  if (!mimeType) {
    throw new ImageAttachmentError(`Unsupported image type: ${basename(filePath)}`);
  }
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    throw new ImageAttachmentError(`Could not read file: ${basename(filePath)}`);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new ImageAttachmentError(
      `Image exceeds ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit: ${basename(filePath)}`,
    );
  }
  return { mimeType, size };
}

function storageFileName(attachmentId: string, mimeType: string): string {
  const ext = EXT_BY_MIME[mimeType] ?? ".bin";
  return `${attachmentId}${ext}`;
}

export function saveImageFromPath(sessionId: string, sourcePath: string): ChatAttachment {
  const { mimeType } = assertSupportedImage(sourcePath);
  const attachmentId = uuidv4();
  const dir = attachmentsDir(sessionId);
  mkdirSync(dir, { recursive: true });
  const fileName = basename(sourcePath);
  const storagePath = storageFileName(attachmentId, mimeType);
  const destPath = join(dir, storagePath);
  copyFileSync(sourcePath, destPath);
  return {
    id: attachmentId,
    fileName,
    mimeType,
    storagePath,
  };
}

export function saveImageFromBuffer(
  sessionId: string,
  buffer: Buffer,
  mimeType: string,
  fileName = "pasted-image",
): ChatAttachment {
  if (!EXT_BY_MIME[mimeType]) {
    throw new ImageAttachmentError(`Unsupported image type: ${mimeType}`);
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageAttachmentError(
      `Image exceeds ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`,
    );
  }
  const attachmentId = uuidv4();
  const dir = attachmentsDir(sessionId);
  mkdirSync(dir, { recursive: true });
  const storagePath = storageFileName(attachmentId, mimeType);
  writeFileSync(join(dir, storagePath), buffer);
  return {
    id: attachmentId,
    fileName,
    mimeType,
    storagePath,
  };
}

export function resolveAttachmentPath(sessionId: string, storagePath: string): string {
  safeSessionId(sessionId);
  if (storagePath.includes("..") || storagePath.includes("/") || storagePath.includes("\\")) {
    throw new ImageAttachmentError("Invalid attachment path");
  }
  const fullPath = join(attachmentsDir(sessionId), storagePath);
  if (!existsSync(fullPath)) {
    throw new ImageAttachmentError("Attachment not found");
  }
  return fullPath;
}

export function readAttachmentBase64(
  sessionId: string,
  attachment: ChatAttachment,
): { data: string; mimeType: string } {
  const fullPath = resolveAttachmentPath(sessionId, attachment.storagePath);
  const mimeType = attachment.mimeType || mimeFromPath(fullPath);
  if (!mimeType || !EXT_BY_MIME[mimeType]) {
    throw new ImageAttachmentError(`Unsupported attachment: ${attachment.fileName}`);
  }
  return {
    data: readFileSync(fullPath).toString("base64"),
    mimeType,
  };
}

export function attachmentFileUrl(sessionId: string, storagePath: string): string {
  resolveAttachmentPath(sessionId, storagePath);
  return `mimica-attachment:///${safeSessionId(sessionId)}/${storagePath}`;
}

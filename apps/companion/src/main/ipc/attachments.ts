import type { BrowserWindow as BrowserWindowType } from "electron";
import type { ImagePastePayload } from "@mimica/shared";
import { isChatAttachment, isImagePastePayload } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import {
  deleteAttachmentFile,
  ImageAttachmentError,
  MAX_IMAGE_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  saveImageFromBuffer,
  saveImageFromPath,
} from "../imageAttachments.js";

type IpcMain = ElectronMain["ipcMain"];
type Dialog = ElectronMain["dialog"];

const IMAGE_DIALOG_FILTERS = [
  {
    name: "Images",
    extensions: ["png", "jpg", "jpeg", "webp", "gif"],
  },
];

/** Base64 expands by 4/3; reject strings that could decode larger than MAX_IMAGE_BYTES. */
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

function remainingAttachmentSlots(currentCount: unknown): number {
  const count = typeof currentCount === "number" && currentCount >= 0 ? currentCount : 0;
  return MAX_IMAGE_ATTACHMENTS - count;
}

export function registerAttachmentIpc(
  ipcMain: IpcMain,
  dialog: Dialog,
  getMainWindow: () => BrowserWindowType | null,
): void {
  ipcMain.handle("attachments:pick", async (_e, sessionId: unknown, currentCount: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to attach images");
    }
    const remaining = remainingAttachmentSlots(currentCount);
    if (remaining <= 0) {
      throw new ImageAttachmentError(`Maximum ${MAX_IMAGE_ATTACHMENTS} images per message`);
    }

    const mainWindow = getMainWindow();
    const properties =
      remaining > 1 ? (["openFile", "multiSelections"] as const) : (["openFile"] as const);
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: [...properties],
          filters: IMAGE_DIALOG_FILTERS,
        })
      : await dialog.showOpenDialog({
          properties: [...properties],
          filters: IMAGE_DIALOG_FILTERS,
        });

    if (result.canceled || result.filePaths.length === 0) return [];
    const saved = [];
    for (const filePath of result.filePaths.slice(0, remaining)) {
      saved.push(saveImageFromPath(sessionId, filePath));
    }
    return saved;
  });

  ipcMain.handle(
    "attachments:paste",
    (_e, sessionId: unknown, currentCount: unknown, payload: unknown) => {
      if (typeof sessionId !== "string" || !sessionId.trim()) {
        throw new ImageAttachmentError("Session is required to attach images");
      }
      if (remainingAttachmentSlots(currentCount) <= 0) {
        throw new ImageAttachmentError(`Maximum ${MAX_IMAGE_ATTACHMENTS} images per message`);
      }
      if (!isImagePastePayload(payload)) {
        throw new ImageAttachmentError("Invalid pasted image payload");
      }
      assertPastePayloadSize(payload);
      const buffer = Buffer.from(payload.data, "base64");
      return saveImageFromBuffer(sessionId, buffer, payload.mimeType, "pasted-image");
    },
  );

  ipcMain.handle("attachments:discard", (_e, sessionId: unknown, attachment: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to discard attachments");
    }
    if (!isChatAttachment(attachment)) {
      throw new ImageAttachmentError("Invalid attachment");
    }
    deleteAttachmentFile(sessionId, attachment);
  });

  ipcMain.handle("attachments:discardMany", (_e, sessionId: unknown, attachments: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to discard attachments");
    }
    if (!Array.isArray(attachments)) {
      throw new ImageAttachmentError("Invalid attachments list");
    }
    for (const attachment of attachments) {
      if (!isChatAttachment(attachment)) continue;
      deleteAttachmentFile(sessionId, attachment);
    }
  });
}

function assertPastePayloadSize(payload: ImagePastePayload): void {
  if (payload.data.length > MAX_BASE64_LENGTH) {
    throw new ImageAttachmentError("Pasted image is too large");
  }
}

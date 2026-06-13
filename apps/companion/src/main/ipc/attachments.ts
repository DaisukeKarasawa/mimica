import type { IpcMainInvokeEvent } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import type { ImagePastePayload } from "@mimica/shared";
import { isChatAttachment, isImagePastePayload } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import {
  formatPersonaErrorForUser,
  formatPersonaErrorKind,
  personaAttachmentLimitError,
  personaSessionRequiredError,
} from "../personaErrors.js";
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

const draftCounts = new Map<string, number>();

function draftKey(sessionId: string, webContentsId: number): string {
  return `${sessionId}:${webContentsId}`;
}

function getDraftCount(key: string): number {
  return draftCounts.get(key) ?? 0;
}

function remainingDraftSlots(key: string): number {
  return MAX_IMAGE_ATTACHMENTS - getDraftCount(key);
}

function reserveDraftSlots(key: string, count: number): boolean {
  if (count <= 0) return true;
  const current = getDraftCount(key);
  if (current + count > MAX_IMAGE_ATTACHMENTS) return false;
  draftCounts.set(key, current + count);
  return true;
}

function releaseDraftSlots(key: string, count: number): void {
  if (count <= 0) return;
  const current = getDraftCount(key);
  const next = Math.max(0, current - count);
  if (next === 0) {
    draftCounts.delete(key);
  } else {
    draftCounts.set(key, next);
  }
}

/** Called when draft attachments are sent with a message (files remain on disk). */
export function releaseDraftAttachments(
  webContentsId: number,
  sessionId: string,
  count: number,
): void {
  if (typeof sessionId !== "string" || !sessionId.trim() || count <= 0) return;
  releaseDraftSlots(draftKey(sessionId, webContentsId), count);
}

function draftKeyFromEvent(sessionId: string, event: IpcMainInvokeEvent): string {
  return draftKey(sessionId, event.sender.id);
}

function throwPersonaAttachmentError(error: unknown): never {
  if (error instanceof ImageAttachmentError) {
    throw new ImageAttachmentError(formatPersonaErrorForUser(error.message));
  }
  throw error;
}

export function registerAttachmentIpc(
  ipcMain: IpcMain,
  dialog: Dialog,
  getMainWindow: () => BrowserWindowType | null,
): void {
  ipcMain.handle("attachments:pick", async (event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError(personaSessionRequiredError());
    }
    const key = draftKeyFromEvent(sessionId, event);
    const remaining = remainingDraftSlots(key);
    if (remaining <= 0) {
      throw new ImageAttachmentError(personaAttachmentLimitError());
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

    const slotsAfterDialog = remainingDraftSlots(key);
    const toSaveCount = Math.min(result.filePaths.length, slotsAfterDialog);
    if (toSaveCount <= 0) {
      throw new ImageAttachmentError(personaAttachmentLimitError());
    }
    if (!reserveDraftSlots(key, toSaveCount)) {
      throw new ImageAttachmentError(personaAttachmentLimitError());
    }

    const saved = [];
    try {
      for (const filePath of result.filePaths.slice(0, toSaveCount)) {
        saved.push(saveImageFromPath(sessionId, filePath));
      }
    } catch (error) {
      for (const attachment of saved) {
        try {
          deleteAttachmentFile(sessionId, attachment);
        } catch {
          /* best-effort rollback */
        }
      }
      releaseDraftSlots(key, toSaveCount);
      throwPersonaAttachmentError(error);
    }
    return saved;
  });

  ipcMain.handle("attachments:paste", (event, sessionId: unknown, payload: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError(personaSessionRequiredError());
    }
    const key = draftKeyFromEvent(sessionId, event);
    if (remainingDraftSlots(key) <= 0) {
      throw new ImageAttachmentError(personaAttachmentLimitError());
    }
    if (!isImagePastePayload(payload)) {
      throw new ImageAttachmentError(
        formatPersonaErrorKind("attachment", "Invalid pasted image payload"),
      );
    }
    assertPastePayloadSize(payload);
    if (!reserveDraftSlots(key, 1)) {
      throw new ImageAttachmentError(personaAttachmentLimitError());
    }
    try {
      const buffer = Buffer.from(payload.data, "base64");
      return saveImageFromBuffer(sessionId, buffer, payload.mimeType, "pasted-image");
    } catch (error) {
      releaseDraftSlots(key, 1);
      throwPersonaAttachmentError(error);
    }
  });

  ipcMain.handle("attachments:discard", (event, sessionId: unknown, attachment: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to discard attachments");
    }
    if (!isChatAttachment(attachment)) {
      throw new ImageAttachmentError("Invalid attachment");
    }
    deleteAttachmentFile(sessionId, attachment);
    releaseDraftSlots(draftKeyFromEvent(sessionId, event), 1);
  });

  ipcMain.handle("attachments:discardMany", (event, sessionId: unknown, attachments: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to discard attachments");
    }
    if (!Array.isArray(attachments)) {
      throw new ImageAttachmentError("Invalid attachments list");
    }
    let discarded = 0;
    for (const attachment of attachments) {
      if (!isChatAttachment(attachment)) continue;
      try {
        deleteAttachmentFile(sessionId, attachment);
        discarded += 1;
      } catch {
        /* skip invalid refs */
      }
    }
    if (discarded > 0) {
      releaseDraftSlots(draftKeyFromEvent(sessionId, event), discarded);
    }
  });
}

function assertPastePayloadSize(payload: ImagePastePayload): void {
  if (payload.data.length > MAX_BASE64_LENGTH) {
    throw new ImageAttachmentError(
      formatPersonaErrorKind("attachment", "Pasted image is too large"),
    );
  }
}

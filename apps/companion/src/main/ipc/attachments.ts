import type { BrowserWindow as BrowserWindowType } from "electron";
import type { ElectronMain } from "../electron.js";
import {
  ImageAttachmentError,
  MAX_IMAGE_ATTACHMENTS,
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

export function registerAttachmentIpc(
  ipcMain: IpcMain,
  dialog: Dialog,
  getMainWindow: () => BrowserWindowType | null,
): void {
  ipcMain.handle("attachments:pick", async (_e, sessionId: unknown, currentCount: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to attach images");
    }
    const count = typeof currentCount === "number" ? currentCount : 0;
    const remaining = MAX_IMAGE_ATTACHMENTS - count;
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

  ipcMain.handle("attachments:paste", (_e, sessionId: unknown, payload: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new ImageAttachmentError("Session is required to attach images");
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      !("mimeType" in payload) ||
      !("data" in payload) ||
      typeof payload.mimeType !== "string" ||
      typeof payload.data !== "string"
    ) {
      throw new ImageAttachmentError("Invalid pasted image payload");
    }
    const buffer = Buffer.from(payload.data, "base64");
    return saveImageFromBuffer(sessionId, buffer, payload.mimeType, "pasted-image");
  });
}

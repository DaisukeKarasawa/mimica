import { installAbortRejectionHandler } from "@mimica/agent-orchestrator";
import { DEFAULT_WS_PORT } from "@mimica/shared";

installAbortRejectionHandler();
import { electron } from "./electron.js";
import {
  bindElectronApis,
  registerAssetProtocol,
  setupAssetProtocolHandler,
  getCharacterAssetStatus,
} from "./assetProtocol.js";
import { createMainWindow } from "./window.js";
import { SessionStore } from "./sessionStore.js";
import { CursorBridgeServer } from "./cursorBridge.js";
import { AgentService } from "./agentService.js";
import type { BrowserWindow as BrowserWindowType } from "electron";
import { openAllowedExternalUrl } from "./openExternal.js";
import { seedWorkspaceAllowlist } from "./workspaceAllowlist.js";
import { ensureCanonicalUserData } from "./ensureCanonicalUserData.js";
import { listSlashMenuSections } from "./cursorSlashInput.js";
import { resolveWorkspacePath } from "./paths.js";
import {
  bindAttachmentProtocolApis,
  registerAttachmentProtocol,
  setupAttachmentProtocolHandler,
} from "./attachmentProtocol.js";
import {
  ImageAttachmentError,
  MAX_IMAGE_ATTACHMENTS,
  saveImageFromBuffer,
  saveImageFromPath,
} from "./imageAttachments.js";
import type { AgentMode } from "@mimica/shared";

const electronApis = electron();

bindElectronApis(electronApis);
bindAttachmentProtocolApis(electronApis);
registerAssetProtocol();
registerAttachmentProtocol();

const { app, BrowserWindow, ipcMain, dialog } = electronApis;
ensureCanonicalUserData(app);
let mainWindow: BrowserWindowType | null = null;
let bridgeServer: CursorBridgeServer | null = null;
const sessionStore = new SessionStore();
let agentService: AgentService | null = null;

function attachMainWindow(win: BrowserWindowType): void {
  mainWindow = win;
  agentService = new AgentService(() => mainWindow?.webContents, sessionStore);
  mainWindow.on("closed", () => {
    void agentService?.dispose().catch((err) => {
      console.error("[agentService] dispose failed:", err);
    });
    mainWindow = null;
    agentService = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    setupAssetProtocolHandler();
    setupAttachmentProtocolHandler();
    sessionStore.load();
    seedWorkspaceAllowlist(sessionStore.list().map((s) => s.workspacePath));
    bridgeServer = new CursorBridgeServer(DEFAULT_WS_PORT, (context) => {
      mainWindow?.webContents.send("editor-context", context);
    });
    await bridgeServer.start();

    attachMainWindow(createMainWindow());

    ipcMain.handle("character:assets", () => getCharacterAssetStatus());
    ipcMain.handle("agent:submit", (_e, payload) => {
      if (!agentService) throw new Error("Agent service is unavailable");
      return agentService.submit(payload);
    });
    ipcMain.handle("agent:cancel", () => {
      if (!agentService) throw new Error("Agent service is unavailable");
      return agentService.cancel();
    });

    ipcMain.handle("sessions:list", () => sessionStore.list());
    ipcMain.handle("sessions:create", (_e, workspacePath: string) =>
      sessionStore.create(workspacePath),
    );
    ipcMain.handle("sessions:delete", async (_e, id: string) => {
      if (agentService) {
        await agentService.closeSession(id);
      }
      sessionStore.delete(id);
    });
    ipcMain.handle("sessions:save", (_e, session) => sessionStore.save(session));
    ipcMain.handle("bridge:status", () => ({
      connected: bridgeServer?.hasClient() ?? false,
      port: DEFAULT_WS_PORT,
    }));
    ipcMain.handle("shell:openExternal", (_e, url: unknown) => {
      if (typeof url !== "string") return false;
      return openAllowedExternalUrl(url);
    });
    ipcMain.handle("slashMenu:list", (_e, workspacePath: unknown, mode: unknown) => {
      if (typeof workspacePath !== "string" || !workspacePath.trim()) return [];
      const agentMode: AgentMode =
        mode === "ask" || mode === "agent" || mode === "plan" ? mode : "agent";
      try {
        const cwd = resolveWorkspacePath(workspacePath);
        return listSlashMenuSections(cwd, agentMode);
      } catch {
        return [];
      }
    });
    ipcMain.handle("attachments:pick", async (_e, sessionId: unknown, currentCount: unknown) => {
      if (typeof sessionId !== "string" || !sessionId.trim()) {
        throw new ImageAttachmentError("Session is required to attach images");
      }
      const count = typeof currentCount === "number" ? currentCount : 0;
      const remaining = MAX_IMAGE_ATTACHMENTS - count;
      if (remaining <= 0) {
        throw new ImageAttachmentError(`Maximum ${MAX_IMAGE_ATTACHMENTS} images per message`);
      }
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, {
            properties: remaining > 1 ? ["openFile", "multiSelections"] : ["openFile"],
            filters: [
              {
                name: "Images",
                extensions: ["png", "jpg", "jpeg", "webp", "gif"],
              },
            ],
          })
        : await dialog.showOpenDialog({
            properties: remaining > 1 ? ["openFile", "multiSelections"] : ["openFile"],
            filters: [
              {
                name: "Images",
                extensions: ["png", "jpg", "jpeg", "webp", "gif"],
              },
            ],
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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        attachMainWindow(createMainWindow());
      }
    });
  });

  app.on("window-all-closed", () => {
    bridgeServer?.stop();
    // Consumer MVP: quit when the window closes on all platforms. Keeping a macOS
    // dock process without a bridge caused ECONNREFUSED on the next Open Companion.
    app.quit();
  });

  app.on("before-quit", () => {
    bridgeServer?.stop();
  });
}

if (process.env.NODE_ENV === "development") {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

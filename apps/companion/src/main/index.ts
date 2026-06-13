import { installAbortRejectionHandler } from "@mimica/agent-orchestrator";
import { DEFAULT_WS_PORT, type AgentCancelPayload } from "@mimica/shared";

installAbortRejectionHandler();
import { electron } from "./electron.js";
import {
  bindElectronApis,
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
import { resolveWorkspacePath } from "./paths.js";
import {
  bindAttachmentProtocolApis,
  bindAttachmentSessionGuard,
  setupAttachmentProtocolHandler,
} from "./attachmentProtocol.js";
import { registerPrivilegedProtocols } from "./privilegedProtocols.js";
import { registerSlashMenuIpc } from "./ipc/slashMenu.js";
import { registerAtMenuIpc } from "./ipc/atMenu.js";
import { registerAttachmentIpc, releaseDraftAttachments } from "./ipc/attachments.js";
import {
  formatPersonaErrorKind,
  parsePersonaFormatRequest,
  rethrowPersonaIpcError,
} from "./personaErrors.js";

const electronApis = electron();

bindElectronApis(electronApis);
bindAttachmentProtocolApis(electronApis);
registerPrivilegedProtocols(electronApis.protocol);

const { app, BrowserWindow, ipcMain, dialog } = electronApis;
const getMainWindow = () => mainWindow;
ensureCanonicalUserData(app);
let mainWindow: BrowserWindowType | null = null;
let bridgeServer: CursorBridgeServer | null = null;
const sessionStore = new SessionStore();
let agentService: AgentService | null = null;

function sendBridgeStatus(connected: boolean): void {
  mainWindow?.webContents.send("bridge-status", { connected });
}

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
    bindAttachmentSessionGuard((id) => sessionStore.get(id) != null);
    seedWorkspaceAllowlist(sessionStore.list().map((s) => s.workspacePath));
    bridgeServer = new CursorBridgeServer(
      DEFAULT_WS_PORT,
      (context) => {
        mainWindow?.webContents.send("editor-context", context);
      },
      undefined,
      sendBridgeStatus,
    );
    await bridgeServer.start();

    attachMainWindow(createMainWindow());

    ipcMain.handle("character:assets", () => getCharacterAssetStatus());
    ipcMain.handle("persona:formatError", (_e, kind: unknown, detail?: unknown) => {
      const runError = parsePersonaFormatRequest(kind, detail);
      if (!runError) {
        throw new Error(formatPersonaErrorKind("generic"));
      }
      return formatPersonaErrorKind(runError.kind, runError.detail);
    });
    ipcMain.handle("agent:submit", async (event, payload) => {
      if (!agentService) throw new Error("Agent service is unavailable");
      const attachmentCount = Array.isArray(payload?.attachments) ? payload.attachments.length : 0;
      if (attachmentCount > 0 && typeof payload?.sessionId === "string") {
        releaseDraftAttachments(event.sender.id, payload.sessionId, attachmentCount);
      }
      try {
        return await agentService.submit(payload);
      } catch (error) {
        rethrowPersonaIpcError(error);
      }
    });
    ipcMain.handle("agent:cancel", (_event, payload: AgentCancelPayload) => {
      if (!agentService) throw new Error("Agent service is unavailable");
      if (!payload?.sessionId || typeof payload.sessionId !== "string") {
        throw new Error("sessionId is required");
      }
      return agentService.cancel(payload);
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
    registerSlashMenuIpc(ipcMain, resolveWorkspacePath);
    registerAtMenuIpc(ipcMain, resolveWorkspacePath, {
      sessionStore,
      getBridge: () => bridgeServer,
    });
    registerAttachmentIpc(ipcMain, dialog, getMainWindow);

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

import { DEFAULT_WS_PORT } from "@mimica/shared";
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

const electronApis = electron();

bindElectronApis(electronApis);
registerAssetProtocol();

const { app, BrowserWindow, ipcMain } = electronApis;
let mainWindow: BrowserWindowType | null = null;
let bridgeServer: CursorBridgeServer | null = null;
const sessionStore = new SessionStore();
let agentService: AgentService | null = null;

function attachMainWindow(win: BrowserWindowType): void {
  mainWindow = win;
  agentService = new AgentService(() => mainWindow?.webContents, sessionStore);
  mainWindow.on("closed", () => {
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
    sessionStore.load();
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
    ipcMain.handle("sessions:delete", (_e, id: string) => sessionStore.delete(id));
    ipcMain.handle("sessions:save", (_e, session) => sessionStore.save(session));
    ipcMain.handle("bridge:status", () => ({
      connected: bridgeServer?.hasClient() ?? false,
      port: DEFAULT_WS_PORT,
    }));
    ipcMain.handle("shell:openExternal", (_e, url: unknown) => {
      if (typeof url !== "string") return false;
      return openAllowedExternalUrl(url);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        attachMainWindow(createMainWindow());
      }
    });
  });

  app.on("window-all-closed", () => {
    bridgeServer?.stop();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    bridgeServer?.stop();
  });
}

if (process.env.NODE_ENV === "development") {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

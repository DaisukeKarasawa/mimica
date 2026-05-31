import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import type { BrowserWindow as BrowserWindowType } from "electron";
import { electron } from "./electron.js";
import { userDataJoin } from "./userDataPaths.js";
import { openAllowedExternalUrl } from "./openExternal.js";

const MIN_WIDTH = 960;
const MIN_HEIGHT = 640;

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

function windowStatePath(): string {
  return userDataJoin("window-state.json");
}

function loadWindowState(): WindowState {
  try {
    const path = windowStatePath();
    if (existsSync(path)) {
      const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (parsed !== null && typeof parsed === "object") {
        const { width, height, x, y } = parsed as Record<string, unknown>;
        if (
          typeof width === "number" &&
          isFinite(width) &&
          typeof height === "number" &&
          isFinite(height)
        ) {
          const state: WindowState = { width, height };
          if (typeof x === "number" && isFinite(x)) state.x = x;
          if (typeof y === "number" && isFinite(y)) state.y = y;
          return state;
        }
      }
    }
  } catch {
    /* use defaults */
  }
  return { width: 1280, height: 800 };
}

function saveWindowState(win: BrowserWindowType): void {
  const bounds = win.getBounds();
  const path = windowStatePath();
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y }),
  );
}

function isAllowedNavigation(url: string, devServerUrl?: string, appIndexUrl?: string): boolean {
  try {
    const parsed = new URL(url);
    if (devServerUrl && parsed.origin === new URL(devServerUrl).origin) return true;
    if (appIndexUrl && url === appIndexUrl) return true;
    return false;
  } catch {
    return false;
  }
}

export function createMainWindow(): BrowserWindowType {
  const { BrowserWindow, screen } = electron();
  const state = loadWindowState();
  const display = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(state.width, display.width);
  const height = Math.min(state.height, display.height);

  const win = new BrowserWindow({
    width,
    height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Mimica",
    backgroundColor: "#0d0c0c",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;
  const appIndexPath = join(__dirname, "../renderer/index.html");
  const appIndexUrl = pathToFileURL(appIndexPath).href;

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(appIndexPath);
  }

  win.on("close", () => saveWindowState(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openAllowedExternalUrl(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, devServerUrl, appIndexUrl)) {
      event.preventDefault();
      void openAllowedExternalUrl(url);
    }
  });

  // Electron closes the window on Cmd/Ctrl+W by default; suppress so chat tab shortcuts can use it.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const mod = process.platform === "darwin" ? input.meta : input.control;
    if (mod && !input.alt && !input.shift && input.key?.toLowerCase() === "w") {
      event.preventDefault();
    }
  });

  return win;
}

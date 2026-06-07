import type { AtMenuSection } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import type { CursorBridgeServer } from "../cursorBridge.js";
import { searchAtMenuSections } from "../cursorAt/menuSearch.js";
import type { SessionStore } from "../sessionStore.js";

type IpcMain = ElectronMain["ipcMain"];

export interface AtMenuIpcDeps {
  sessionStore: SessionStore;
  getBridge: () => CursorBridgeServer | null;
}

export function registerAtMenuIpc(
  ipcMain: IpcMain,
  resolveWorkspacePath: (workspacePath: string) => string,
  deps: AtMenuIpcDeps,
): void {
  ipcMain.handle(
    "atMenu:search",
    async (_e, workspacePath: unknown, query: unknown, sessionId: unknown) => {
      if (typeof workspacePath !== "string" || !workspacePath.trim()) return [] as AtMenuSection[];
      if (typeof query !== "string") return [] as AtMenuSection[];
      const currentSessionId = typeof sessionId === "string" ? sessionId : null;
      try {
        const cwd = resolveWorkspacePath(workspacePath);
        const bridge = deps.getBridge();
        return await searchAtMenuSections({
          workspacePath: cwd,
          query,
          currentSessionId,
          listSessions: () => deps.sessionStore.listHistory(),
          symbolSearch: (symbolQuery, limit) =>
            bridge?.searchSymbols(symbolQuery, limit) ?? Promise.resolve([]),
          bridgeConnected: bridge?.hasClient() ?? false,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[atMenu:search] failed for ${workspacePath}: ${message}`);
        }
        return [] as AtMenuSection[];
      }
    },
  );
}

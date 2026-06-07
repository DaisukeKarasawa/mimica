import type { AgentMode } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import { listSlashMenuSections } from "../cursorSlash/index.js";
import { resolveSlashWorkspaceOrNull } from "../cursorSlash/discovery.js";

type IpcMain = ElectronMain["ipcMain"];

export function registerSlashMenuIpc(
  ipcMain: IpcMain,
  resolveWorkspacePath: (workspacePath: string) => string,
): void {
  ipcMain.handle("slashMenu:list", (_e, workspacePath: unknown, mode: unknown) => {
    const agentMode: AgentMode =
      mode === "ask" || mode === "agent" || mode === "plan" ? mode : "agent";
    const raw = typeof workspacePath === "string" ? workspacePath : "";
    try {
      const cwd = resolveSlashWorkspaceOrNull(raw, resolveWorkspacePath);
      if (cwd === null && raw.trim() && process.env.NODE_ENV === "development") {
        console.warn("[slashMenu:list] workspace unavailable, using user-only catalog");
      }
      return listSlashMenuSections(cwd, agentMode);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[slashMenu:list] failed: ${message}`);
      }
      return [];
    }
  });
}

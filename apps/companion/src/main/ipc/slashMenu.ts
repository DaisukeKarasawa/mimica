import type { AgentMode } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import { listSlashMenuSections } from "../cursorSlash/index.js";

type IpcMain = ElectronMain["ipcMain"];

export function registerSlashMenuIpc(
  ipcMain: IpcMain,
  resolveWorkspacePath: (workspacePath: string) => string,
): void {
  ipcMain.handle("slashMenu:list", (_e, workspacePath: unknown, mode: unknown) => {
    if (typeof workspacePath !== "string" || !workspacePath.trim()) return [];
    const agentMode: AgentMode =
      mode === "ask" || mode === "agent" || mode === "plan" ? mode : "agent";
    try {
      const cwd = resolveWorkspacePath(workspacePath);
      return listSlashMenuSections(cwd, agentMode);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[slashMenu:list] failed for ${workspacePath}: ${message}`);
      }
      return [];
    }
  });
}

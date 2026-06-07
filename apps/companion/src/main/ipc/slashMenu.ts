import type { AgentMode } from "@mimica/shared";
import type { ElectronMain } from "../electron.js";
import { listSlashMenuSections } from "../cursorSlash/index.js";

type IpcMain = ElectronMain["ipcMain"];

function resolveSlashWorkspacePath(
  raw: string,
  resolveWorkspacePath: (workspacePath: string) => string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return resolveWorkspacePath(trimmed);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[slashMenu:list] workspace unavailable, using user-only catalog: ${message}`);
    }
    return null;
  }
}

export function registerSlashMenuIpc(
  ipcMain: IpcMain,
  resolveWorkspacePath: (workspacePath: string) => string,
): void {
  ipcMain.handle("slashMenu:list", (_e, workspacePath: unknown, mode: unknown) => {
    const agentMode: AgentMode =
      mode === "ask" || mode === "agent" || mode === "plan" ? mode : "agent";
    const raw = typeof workspacePath === "string" ? workspacePath : "";
    try {
      const cwd = resolveSlashWorkspacePath(raw, resolveWorkspacePath);
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

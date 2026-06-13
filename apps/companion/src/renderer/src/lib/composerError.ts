import type { ErrorKind } from "@mimica/shared";

/** IPC and preload errors arrive as pre-formatted persona copy from main. */
export function ipcErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || "エラーが発生しました。";
  }
  const message = String(error).trim();
  return message || "エラーが発生しました。";
}

export async function formatClientPersonaError(kind: ErrorKind, detail?: string): Promise<string> {
  return window.mimica.formatPersonaError(kind, detail);
}

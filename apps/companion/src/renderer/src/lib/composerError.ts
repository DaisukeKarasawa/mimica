import type { ErrorKind } from "@mimica/shared";

/** IPC and preload errors arrive as pre-formatted persona copy from main. */
export function ipcErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || "An error occurred.";
  }
  const message = String(error).trim();
  return message || "An error occurred.";
}

const CLIENT_PERSONA_ERROR_FALLBACK = "An error occurred.";

export async function formatClientPersonaError(kind: ErrorKind, detail?: string): Promise<string> {
  try {
    const message = await window.mimica.formatPersonaError(kind, detail);
    return message?.trim() || CLIENT_PERSONA_ERROR_FALLBACK;
  } catch {
    return CLIENT_PERSONA_ERROR_FALLBACK;
  }
}

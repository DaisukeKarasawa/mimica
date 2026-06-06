import type { Run } from "@cursor/sdk";

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/** Cancel a run without surfacing SDK AbortError from intentional cancellation. */
export async function cancelRun(run: Run | null | undefined): Promise<void> {
  if (!run) return;
  try {
    if (typeof run.supports === "function" && !run.supports("cancel")) return;
    await run.cancel();
  } catch (err) {
    if (!isAbortError(err)) throw err;
  }
}

let abortRejectionHandlerInstalled = false;

/** Suppress unhandled AbortError rejections from @cursor/sdk during cancel. */
export function installAbortRejectionHandler(): void {
  if (abortRejectionHandlerInstalled) return;
  abortRejectionHandlerInstalled = true;
  process.on("unhandledRejection", (reason, promise) => {
    if (isAbortError(reason)) return;
    console.error("Unhandled rejection:", promise, reason);
    setImmediate(() => {
      throw reason instanceof Error ? reason : new Error(String(reason));
    });
  });
}

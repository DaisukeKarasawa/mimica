import type { Run } from "@cursor/sdk";

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

const trackedCanceledPromises = new WeakSet<Promise<unknown>>();

/** Register a promise tied to an intentional SDK cancel so its AbortError may be suppressed. */
export function registerIntentionalCancel(promise: Promise<unknown>): void {
  trackedCanceledPromises.add(promise);
}

/** Unregister after the cancel-scoped promise settles. */
export function unregisterIntentionalCancel(promise: Promise<unknown>): void {
  trackedCanceledPromises.delete(promise);
}

/** Track a promise for the lifetime of its settlement. */
export function trackIntentionalCancelPromise<T>(promise: Promise<T>): Promise<T> {
  registerIntentionalCancel(promise);
  return promise.finally(() => unregisterIntentionalCancel(promise));
}

/** Cancel a run without surfacing SDK AbortError from intentional cancellation. */
export async function cancelRun(run: Run | null | undefined): Promise<void> {
  if (!run) return;
  try {
    if (typeof run.supports === "function" && !run.supports("cancel")) return;
    await trackIntentionalCancelPromise(run.cancel());
  } catch (err) {
    if (!isAbortError(err)) throw err;
  }
}

let abortRejectionHandlerInstalled = false;

/** Suppress unhandled AbortError rejections from tracked SDK cancel promises only. */
export function installAbortRejectionHandler(): void {
  if (abortRejectionHandlerInstalled) return;
  abortRejectionHandlerInstalled = true;
  process.on("unhandledRejection", (reason, promise) => {
    if (isAbortError(reason) && trackedCanceledPromises.has(promise)) return;
    console.error("Unhandled rejection:", promise, reason);
    setImmediate(() => {
      throw reason instanceof Error ? reason : new Error(String(reason));
    });
  });
}

import type { Run } from "@cursor/sdk";
import { isConnectCanceledError } from "./sdkTransportError.js";

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  if (typeof err === "object" && err !== null && "name" in err && err.name === "AbortError") {
    return true;
  }
  return false;
}

/** Intentional cancellation: AbortError or SDK Connect [canceled]. */
export function isIntentionalCancellationError(err: unknown): boolean {
  return isAbortError(err) || isConnectCanceledError(err);
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
  const tracked = promise.finally(() => {
    unregisterIntentionalCancel(tracked);
  });
  registerIntentionalCancel(tracked);
  return tracked;
}

export function shouldSuppressTrackedAbortRejection(
  reason: unknown,
  promise: Promise<unknown>,
): boolean {
  return isAbortError(reason) && trackedCanceledPromises.has(promise);
}

/** Cancel a run without surfacing SDK AbortError from intentional cancellation. */
export async function cancelRun(run: Run | null | undefined): Promise<void> {
  if (!run) return;
  try {
    if (typeof run.supports === "function" && !run.supports("cancel")) return;
    await trackIntentionalCancelPromise(run.cancel());
  } catch (err) {
    if (!isIntentionalCancellationError(err)) throw err;
  }
}

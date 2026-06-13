import { shouldSuppressTrackedAbortRejection } from "./abortError.js";
import {
  formatSdkRejection,
  isConnectCanceledError,
  isSdkConnectRejection,
} from "./sdkTransportError.js";

let sdkRejectionHandlerInstalled = false;

/** Resets one-time handler registration between unit tests. */
export function resetSdkRejectionHandlerForTests(): void {
  sdkRejectionHandlerInstalled = false;
}

function fatalizeRejection(reason: unknown): void {
  setImmediate(() => {
    throw reason instanceof Error ? reason : new Error(String(reason));
  });
}

/** Suppress SDK Connect / tracked Abort rejections; fail-fast on everything else. */
export function installAbortRejectionHandler(): void {
  if (sdkRejectionHandlerInstalled) return;
  sdkRejectionHandlerInstalled = true;
  process.on("unhandledRejection", (reason, promise) => {
    if (shouldSuppressTrackedAbortRejection(reason, promise)) return;
    if (isConnectCanceledError(reason)) {
      console.debug(
        "[agent-orchestrator] suppressed Connect canceled rejection:",
        formatSdkRejection(reason),
      );
      return;
    }
    if (isSdkConnectRejection(reason)) {
      console.error(
        "[agent-orchestrator] SDK Connect rejection (non-fatal):",
        formatSdkRejection(reason),
      );
      return;
    }
    console.error("[agent-orchestrator] unhandled rejection:", promise, reason);
    fatalizeRejection(reason);
  });
}

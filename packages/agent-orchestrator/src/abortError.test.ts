import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { ConnectError, Code } from "@connectrpc/connect";
import {
  isAbortError,
  isIntentionalCancellationError,
  shouldSuppressTrackedAbortRejection,
} from "./abortError.js";
import {
  installAbortRejectionHandler,
  resetSdkRejectionHandlerForTests,
} from "./sdkRejectionHandler.js";

describe("isIntentionalCancellationError", () => {
  it("recognizes AbortError", () => {
    assert.equal(isIntentionalCancellationError(new DOMException("aborted", "AbortError")), true);
    assert.equal(
      isIntentionalCancellationError(Object.assign(new Error("aborted"), { name: "AbortError" })),
      true,
    );
  });

  it("recognizes ConnectError [canceled]", () => {
    const err = new ConnectError("This operation was aborted", Code.Canceled);
    assert.equal(isIntentionalCancellationError(err), true);
  });

  it("rejects unrelated errors", () => {
    assert.equal(isIntentionalCancellationError(new Error("boom")), false);
  });
});

describe("isAbortError", () => {
  it("does not treat Connect canceled as AbortError", () => {
    const err = new ConnectError("This operation was aborted", Code.Canceled);
    assert.equal(isAbortError(err), false);
    assert.equal(isIntentionalCancellationError(err), true);
  });
});

describe("shouldSuppressTrackedAbortRejection", () => {
  it("suppresses only tracked AbortError promises", () => {
    const promise = Promise.resolve();
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    assert.equal(shouldSuppressTrackedAbortRejection(err, promise), false);
  });
});

describe("installAbortRejectionHandler", () => {
  it("does not fatalize ConnectError rejections", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const proc = {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      },
    };

    const originalProcess = globalThis.process;
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: proc,
    });

    try {
      resetSdkRejectionHandlerForTests();
      installAbortRejectionHandler();
      const handler = listeners.get("unhandledRejection");
      assert.ok(handler);

      const throwImmediate = mock.fn(() => {
        throw new Error("should not fatalize");
      });
      const originalSetImmediate = globalThis.setImmediate;
      Object.defineProperty(globalThis, "setImmediate", {
        configurable: true,
        value: throwImmediate,
      });

      try {
        handler(
          new ConnectError("Stream closed with error code NGHTTP2_REFUSED_STREAM", Code.Internal),
          Promise.resolve(),
        );
        assert.equal(throwImmediate.mock.calls.length, 0);
      } finally {
        Object.defineProperty(globalThis, "setImmediate", {
          configurable: true,
          value: originalSetImmediate,
        });
      }
    } finally {
      Object.defineProperty(globalThis, "process", {
        configurable: true,
        value: originalProcess,
      });
    }
  });

  it("fatalizes non-SDK rejections", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const proc = {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      },
    };

    const originalProcess = globalThis.process;
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: proc,
    });

    try {
      resetSdkRejectionHandlerForTests();
      installAbortRejectionHandler();
      const handler = listeners.get("unhandledRejection");
      assert.ok(handler);

      const scheduled: Array<() => void> = [];
      const throwImmediate = mock.fn((fn: () => void) => {
        scheduled.push(fn);
      });
      const originalSetImmediate = globalThis.setImmediate;
      Object.defineProperty(globalThis, "setImmediate", {
        configurable: true,
        value: throwImmediate,
      });

      try {
        handler(new Error("logic bug"), Promise.resolve());
        assert.equal(throwImmediate.mock.calls.length, 1);
        assert.throws(() => scheduled[0]?.(), /logic bug/);
      } finally {
        Object.defineProperty(globalThis, "setImmediate", {
          configurable: true,
          value: originalSetImmediate,
        });
      }
    } finally {
      Object.defineProperty(globalThis, "process", {
        configurable: true,
        value: originalProcess,
      });
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConnectError, Code } from "@connectrpc/connect";
import { AuthenticationError, NetworkError } from "@cursor/sdk";
import {
  classifySdkTransportError,
  isConnectCanceledError,
  mapSdkTransportToAgentRunError,
  shouldRetrySdkTransportError,
} from "./sdkTransportError.js";

describe("isConnectCanceledError", () => {
  it("detects Connect Code.Canceled", () => {
    const err = new ConnectError("This operation was aborted", Code.Canceled);
    assert.equal(isConnectCanceledError(err), true);
  });
});

describe("classifySdkTransportError", () => {
  it("classifies unauthenticated", () => {
    const err = new ConnectError("Error", Code.Unauthenticated);
    const result = classifySdkTransportError(err);
    assert.ok(result);
    assert.equal(result.category, "unauthenticated");
    assert.equal(result.invalidatePool, true);
    assert.equal(result.retryOnce, false);
    assert.equal(result.errorKind, "auth_missing");
  });

  it("classifies NGHTTP2_REFUSED_STREAM as transport with retry", () => {
    const err = new ConnectError(
      "Stream closed with error code NGHTTP2_REFUSED_STREAM",
      Code.Internal,
    );
    const result = classifySdkTransportError(err);
    assert.ok(result);
    assert.equal(result.category, "transport");
    assert.equal(result.retryOnce, true);
    assert.equal(result.errorKind, "sdk_transport");
  });

  it("classifies canceled without retry", () => {
    const err = new ConnectError("This operation was aborted", Code.Canceled);
    const result = classifySdkTransportError(err);
    assert.ok(result);
    assert.equal(result.category, "canceled");
    assert.equal(result.retryOnce, false);
  });

  it("respects AuthenticationError", () => {
    const err = new AuthenticationError("Invalid API key");
    const result = classifySdkTransportError(err);
    assert.ok(result);
    assert.equal(result.category, "unauthenticated");
    assert.equal(result.errorKind, "auth_missing");
  });

  it("maps retryable NetworkError", () => {
    const err = new NetworkError("Service unavailable", { isRetryable: true });
    const result = classifySdkTransportError(err);
    assert.ok(result);
    assert.equal(result.retryOnce, true);
    assert.equal(result.errorKind, "sdk_transport");
  });
});

describe("shouldRetrySdkTransportError", () => {
  const retryableErr = new ConnectError("unavailable", Code.Unavailable);

  it("retries once before agent.send when transport is retryable", () => {
    assert.equal(shouldRetrySdkTransportError(retryableErr, false, true), true);
  });

  it("does not retry after agent.send even when transport is retryable", () => {
    assert.equal(shouldRetrySdkTransportError(retryableErr, false, false), false);
  });

  it("does not retry a second time", () => {
    assert.equal(shouldRetrySdkTransportError(retryableErr, true, true), false);
  });
});

describe("mapSdkTransportToAgentRunError", () => {
  it("maps transport errors to sdk_transport kind", () => {
    const err = new ConnectError("unavailable", Code.Unavailable);
    const mapped = mapSdkTransportToAgentRunError(err);
    assert.equal(mapped.kind, "sdk_transport");
    assert.match(mapped.detail ?? "", /unavailable/i);
  });

  it("maps Connect canceled to cancelled kind", () => {
    const err = new ConnectError("This operation was aborted", Code.Canceled);
    const mapped = mapSdkTransportToAgentRunError(err);
    assert.equal(mapped.kind, "cancelled");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConnectError, Code } from "@connectrpc/connect";
import { AuthenticationError, NetworkError } from "@cursor/sdk";
import {
  classifySdkTransportError,
  isConnectCanceledError,
  mapSdkTransportToAgentRunError,
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
    assert.equal(result.errorKind, "connection");
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
    assert.equal(result.errorKind, "connection");
  });
});

describe("mapSdkTransportToAgentRunError", () => {
  it("maps transport errors to connection kind", () => {
    const err = new ConnectError("unavailable", Code.Unavailable);
    const mapped = mapSdkTransportToAgentRunError(err);
    assert.equal(mapped.kind, "connection");
    assert.match(mapped.detail ?? "", /unavailable/i);
  });
});

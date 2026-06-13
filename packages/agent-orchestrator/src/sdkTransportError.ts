import { ConnectError, Code } from "@connectrpc/connect";
import { AuthenticationError, CursorAgentError } from "@cursor/sdk";
import {
  agentRunError,
  agentRunErrorFromUnknown,
  type AgentRunError,
  type ErrorKind,
} from "@mimica/shared";

export function unwrapConnectError(err: unknown): ConnectError | null {
  if (err instanceof ConnectError) return err;
  if (err instanceof CursorAgentError && err.cause instanceof ConnectError) {
    return err.cause;
  }
  if (err instanceof Error && err.name === "ConnectError" && "code" in err) {
    return err as ConnectError;
  }
  if (err instanceof Error) {
    const converted = ConnectError.from(err);
    if (converted.code === Code.Canceled && /abort|canceled|cancelled/i.test(err.message)) {
      return converted;
    }
    if (/\[(internal|canceled|unauthenticated|unavailable)\]/i.test(err.message)) {
      return converted;
    }
  }
  return null;
}

export function isConnectCanceledError(err: unknown): boolean {
  return unwrapConnectError(err)?.code === Code.Canceled;
}

export function isSdkConnectError(err: unknown): boolean {
  return unwrapConnectError(err) !== null || err instanceof CursorAgentError;
}

export function formatSdkRejection(reason: unknown): string {
  const connectErr = unwrapConnectError(reason);
  if (connectErr) {
    return `ConnectError code=${connectErr.code} message=${connectErr.rawMessage}`;
  }
  if (reason instanceof CursorAgentError) {
    return `CursorAgentError message=${reason.message} retryable=${reason.isRetryable}`;
  }
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`;
  }
  return String(reason);
}

function isRefusedStreamMessage(message: string): boolean {
  return /NGHTTP2_REFUSED_STREAM|REFUSED_STREAM/i.test(message);
}

export type SdkTransportErrorCategory = "canceled" | "unauthenticated" | "transport" | "sdk";

export interface SdkTransportClassification {
  category: SdkTransportErrorCategory;
  invalidatePool: boolean;
  retryOnce: boolean;
  errorKind: ErrorKind;
  logDetail: string;
}

export function classifySdkTransportError(err: unknown): SdkTransportClassification | null {
  if (isConnectCanceledError(err)) {
    return {
      category: "canceled",
      invalidatePool: true,
      retryOnce: false,
      errorKind: "cancelled",
      logDetail: "Connect RPC canceled",
    };
  }

  if (err instanceof AuthenticationError) {
    return {
      category: "unauthenticated",
      invalidatePool: true,
      retryOnce: false,
      errorKind: "auth_missing",
      logDetail: err.message,
    };
  }

  const connectErr = unwrapConnectError(err);
  if (connectErr) {
    const msg = connectErr.rawMessage || connectErr.message;
    if (connectErr.code === Code.Unauthenticated) {
      return {
        category: "unauthenticated",
        invalidatePool: true,
        retryOnce: false,
        errorKind: "auth_missing",
        logDetail: msg,
      };
    }
    if (
      connectErr.code === Code.Internal ||
      connectErr.code === Code.Unavailable ||
      connectErr.code === Code.DeadlineExceeded ||
      isRefusedStreamMessage(msg)
    ) {
      return {
        category: "transport",
        invalidatePool: true,
        retryOnce: true,
        errorKind: "connection",
        logDetail: msg,
      };
    }
    return {
      category: "transport",
      invalidatePool: true,
      retryOnce: false,
      errorKind: "connection",
      logDetail: msg,
    };
  }

  if (err instanceof CursorAgentError) {
    return {
      category: "sdk",
      invalidatePool: true,
      retryOnce: err.isRetryable,
      errorKind: err instanceof AuthenticationError ? "auth_missing" : "connection",
      logDetail: err.message,
    };
  }

  return null;
}

export function mapSdkTransportToAgentRunError(err: unknown): AgentRunError {
  const classified = classifySdkTransportError(err);
  if (classified && classified.category !== "canceled") {
    return agentRunError(classified.errorKind, classified.logDetail);
  }
  return agentRunErrorFromUnknown(err);
}

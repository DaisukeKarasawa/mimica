import {
  agentRunError,
  agentRunErrorFromUnknown,
  formatPersonaErrorMessage,
  type AgentRunError,
  type ErrorKind,
} from "@mimica/shared";
import { ImageAttachmentError } from "./imageAttachments.js";
import { resolvePersonaPack } from "./personaSetup.js";

const ERROR_KINDS: ErrorKind[] = [
  "agent_failed",
  "agent_timeout",
  "auth_missing",
  "connection",
  "sdk_transport",
  "attachment",
  "session",
  "read_only_blocked",
  "cancelled",
  "generic",
];

function reactions() {
  return resolvePersonaPack().reactions;
}

function isErrorKind(value: string): value is ErrorKind {
  return (ERROR_KINDS as string[]).includes(value);
}

/** Typed pre-run / attachment failure; format at the IPC boundary via toPersonaUserMessage. */
export class PersonaFacingError extends Error {
  readonly runError: AgentRunError;

  constructor(runError: AgentRunError) {
    super(runError.detail ?? runError.kind);
    this.name = "PersonaFacingError";
    this.runError = runError;
  }
}

export function formatPersonaErrorForUser(input: string | AgentRunError): string {
  return formatPersonaErrorMessage(input, reactions());
}

export function formatPersonaErrorKind(kind: ErrorKind, detail?: string): string {
  return formatPersonaErrorMessage(agentRunError(kind, detail), reactions());
}

export function toPersonaUserMessage(error: unknown): string {
  if (error instanceof PersonaFacingError) {
    return formatPersonaErrorForUser(error.runError);
  }
  if (error instanceof ImageAttachmentError) {
    return formatPersonaErrorForUser(error.message);
  }
  if (error instanceof Error) {
    return formatPersonaErrorForUser(agentRunErrorFromUnknown(error));
  }
  return formatPersonaErrorForUser(agentRunErrorFromUnknown(error));
}

export function rethrowPersonaIpcError(error: unknown): never {
  throw new Error(toPersonaUserMessage(error));
}

export function parsePersonaFormatRequest(kind: unknown, detail?: unknown): AgentRunError | null {
  if (typeof kind !== "string" || !isErrorKind(kind)) return null;
  if (detail === undefined || detail === null) {
    return agentRunError(kind);
  }
  if (typeof detail === "string") {
    return agentRunError(kind, detail);
  }
  return null;
}

export { agentRunError };

import {
  agentRunError,
  buildPersonaErrorMessage,
  formatPersonaErrorMessage,
  type AgentRunError,
  type ErrorKind,
} from "@mimica/shared";
import { resolvePersonaPack } from "./personaSetup.js";

function reactions() {
  return resolvePersonaPack().reactions;
}

export function formatPersonaErrorForUser(input: string | AgentRunError): string {
  return formatPersonaErrorMessage(input, reactions());
}

export function formatPersonaErrorKind(kind: ErrorKind, detail?: string): string {
  return buildPersonaErrorMessage(kind, detail, reactions());
}

export function personaSessionRequiredError(): string {
  return formatPersonaErrorKind("session");
}

export function personaAttachmentLimitError(): string {
  return formatPersonaErrorKind("attachment");
}

export function getPersonaReactionsForRenderer() {
  return resolvePersonaPack().reactions ?? null;
}

export { agentRunError };

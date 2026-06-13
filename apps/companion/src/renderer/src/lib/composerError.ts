import { agentRunError, formatPersonaErrorMessage, type PersonaReactions } from "@mimica/shared";

export function formatComposerSessionError(reactions?: PersonaReactions): string {
  return formatPersonaErrorMessage(agentRunError("session"), reactions);
}

export function formatComposerSubmitError(error: unknown, reactions?: PersonaReactions): string {
  if (error instanceof Error) {
    return error.message.trim() || formatPersonaErrorMessage(agentRunError("generic"), reactions);
  }
  return formatPersonaErrorMessage(String(error), reactions);
}

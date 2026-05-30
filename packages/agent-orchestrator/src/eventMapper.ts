import type { AgentRunState, AvatarState, MessageContext } from "@mimica/shared";
import { mapAgentRunToAvatar } from "@mimica/shared";

export function mapRunStateToAvatar(state: AgentRunState): AvatarState {
  return mapAgentRunToAvatar(state);
}

export function buildContextPrompt(context: MessageContext): string {
  const parts: string[] = [];
  if (context.workspacePath) {
    parts.push(`Workspace: ${context.workspacePath}`);
  }
  if (context.currentFilePath) {
    parts.push(`Current file: ${context.currentFilePath}`);
  }
  if (context.currentFileLanguage) {
    parts.push(`Language: ${context.currentFileLanguage}`);
  }
  if (context.selectedText) {
    parts.push(
      `Selected text (${context.selectionStartLine ?? "?"}-${context.selectionEndLine ?? "?"}):\n${context.selectedText}`,
    );
  }
  return parts.join("\n");
}

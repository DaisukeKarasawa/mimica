import type { EditorContext } from "./protocol.js";
import type { MessageContext } from "./chat.js";

export function toMessageContext(ctx: EditorContext): MessageContext {
  return {
    workspacePath: ctx.workspacePath,
    currentFilePath: ctx.currentFilePath,
    currentFileLanguage: ctx.currentFileLanguage,
    selectedText: ctx.selectedText,
    selectionStartLine: ctx.selectionStartLine,
    selectionEndLine: ctx.selectionEndLine,
  };
}

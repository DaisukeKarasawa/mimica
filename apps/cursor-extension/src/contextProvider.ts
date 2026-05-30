import * as vscode from "vscode";
import type { EditorContext } from "@mimica/shared";

export function getEditorContext(): EditorContext | null {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return null;

  const editor = vscode.window.activeTextEditor;
  const ctx: EditorContext = { workspacePath };

  if (editor) {
    const doc = editor.document;
    ctx.currentFilePath = doc.uri.fsPath;
    ctx.currentFileLanguage = doc.languageId;
    const selection = editor.selection;
    if (!selection.isEmpty) {
      ctx.selectedText = doc.getText(selection);
      ctx.selectionStartLine = selection.start.line + 1;
      ctx.selectionEndLine = selection.end.line + 1;
    }
  }

  return ctx;
}

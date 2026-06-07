import * as vscode from "vscode";
import type { CodeSymbolResult } from "@mimica/shared";
import { relative } from "node:path";

const SYMBOL_KIND_NAMES: Record<number, string> = {
  [vscode.SymbolKind.File]: "file",
  [vscode.SymbolKind.Module]: "module",
  [vscode.SymbolKind.Namespace]: "namespace",
  [vscode.SymbolKind.Package]: "package",
  [vscode.SymbolKind.Class]: "class",
  [vscode.SymbolKind.Method]: "method",
  [vscode.SymbolKind.Property]: "property",
  [vscode.SymbolKind.Field]: "field",
  [vscode.SymbolKind.Constructor]: "constructor",
  [vscode.SymbolKind.Enum]: "enum",
  [vscode.SymbolKind.Interface]: "interface",
  [vscode.SymbolKind.Function]: "function",
  [vscode.SymbolKind.Variable]: "variable",
  [vscode.SymbolKind.Constant]: "constant",
  [vscode.SymbolKind.String]: "string",
  [vscode.SymbolKind.Number]: "number",
  [vscode.SymbolKind.Boolean]: "boolean",
  [vscode.SymbolKind.Array]: "array",
  [vscode.SymbolKind.Object]: "object",
  [vscode.SymbolKind.Key]: "key",
  [vscode.SymbolKind.Null]: "null",
  [vscode.SymbolKind.EnumMember]: "enum-member",
  [vscode.SymbolKind.Struct]: "struct",
  [vscode.SymbolKind.Event]: "event",
  [vscode.SymbolKind.Operator]: "operator",
  [vscode.SymbolKind.TypeParameter]: "type-parameter",
};

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function toRelativePath(absPath: string): string | null {
  const root = workspaceRoot();
  if (!root) return null;
  const rel = relative(root, absPath).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..")) return null;
  return rel;
}

function symbolKindName(kind: vscode.SymbolKind): string {
  return SYMBOL_KIND_NAMES[kind] ?? "symbol";
}

function flattenDocumentSymbols(
  symbols: vscode.DocumentSymbol[],
  filePath: string,
  query: string,
  results: CodeSymbolResult[],
  limit: number,
): void {
  const lowerQuery = query.toLowerCase();
  for (const symbol of symbols) {
    if (results.length >= limit) return;
    if (symbol.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        name: symbol.name,
        kind: symbolKindName(symbol.kind),
        filePath,
        startLine: symbol.range.start.line + 1,
        endLine: symbol.range.end.line + 1,
      });
    }
    if (symbol.children.length > 0) {
      flattenDocumentSymbols(symbol.children, filePath, query, results, limit);
    }
  }
}

export async function searchWorkspaceSymbols(
  query: string,
  limit: number,
): Promise<CodeSymbolResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const root = workspaceRoot();
  if (!root) return [];

  const results: CodeSymbolResult[] = [];
  const seen = new Set<string>();

  const push = (symbol: CodeSymbolResult): void => {
    const key = `${symbol.filePath}:${symbol.name}:${symbol.startLine}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(symbol);
  };

  try {
    const workspaceSymbols =
      (await vscode.commands.executeCommand<vscode.SymbolInformation[] | undefined>(
        "vscode.executeWorkspaceSymbolProvider",
        trimmed,
      )) ?? [];

    for (const symbol of workspaceSymbols) {
      if (results.length >= limit) break;
      const filePath = toRelativePath(symbol.location.uri.fsPath);
      if (!filePath) continue;
      push({
        name: symbol.name,
        kind: symbolKindName(symbol.kind),
        filePath,
        startLine: symbol.location.range.start.line + 1,
        endLine: symbol.location.range.end.line + 1,
      });
    }
  } catch {
    // Provider may be unavailable for some workspaces.
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && results.length < limit) {
    const filePath = toRelativePath(editor.document.uri.fsPath);
    if (filePath) {
      try {
        const documentSymbols =
          (await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
            "vscode.executeDocumentSymbolProvider",
            editor.document.uri,
          )) ?? [];
        const docResults: CodeSymbolResult[] = [];
        flattenDocumentSymbols(documentSymbols, filePath, trimmed, docResults, limit);
        for (const symbol of docResults) {
          if (results.length >= limit) break;
          push(symbol);
        }
      } catch {
        // Document symbols unavailable.
      }
    }
  }

  return results.slice(0, limit);
}

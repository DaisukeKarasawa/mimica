import type { AtMenuSection, ChatSession, CodeSymbolResult } from "@mimica/shared";
import { AT_MENU_SECTION_LABELS } from "@mimica/shared";
import { searchAtPaths } from "./enumerate.js";
import { codeSymbolsToMenuItems } from "./codeSymbols.js";
import { listGitMenuItems } from "./gitContext.js";
import { listPastChatMenuItems } from "./pastChats.js";

export interface AtMenuSearchParams {
  workspacePath: string;
  query: string;
  currentSessionId: string | null;
  listSessions: () => ChatSession[];
  symbolSearch?: (query: string, limit: number) => Promise<CodeSymbolResult[]>;
  bridgeConnected?: boolean;
}

export async function searchAtMenuSections(params: AtMenuSearchParams): Promise<AtMenuSection[]> {
  const query = params.query.replace(/\\/g, "/");
  const sections: AtMenuSection[] = [];

  const symbolPromise =
    params.bridgeConnected && params.symbolSearch && query.length > 0
      ? params.symbolSearch(query, 50).catch(() => [] as CodeSymbolResult[])
      : Promise.resolve([] as CodeSymbolResult[]);

  const pastChats = listPastChatMenuItems(
    params.listSessions(),
    params.workspacePath,
    params.currentSessionId,
    query,
  );
  if (pastChats.length > 0) {
    sections.push({
      category: "past-chats",
      label: AT_MENU_SECTION_LABELS["past-chats"],
      items: pastChats,
    });
  }

  const gitItems = listGitMenuItems(params.workspacePath, query);
  if (gitItems.length > 0) {
    sections.push({
      category: "git",
      label: AT_MENU_SECTION_LABELS.git,
      items: gitItems,
    });
  }

  const fileItems = searchAtPaths(params.workspacePath, query);

  try {
    const symbols = await symbolPromise;
    const codeItems = codeSymbolsToMenuItems(symbols, query);
    if (codeItems.length > 0) {
      sections.push({
        category: "code",
        label: AT_MENU_SECTION_LABELS.code,
        items: codeItems,
      });
    }
  } catch {
    // Graceful degrade when symbol search fails.
  }

  if (fileItems.length > 0) {
    sections.push({
      category: "files",
      label: AT_MENU_SECTION_LABELS.files,
      items: fileItems,
    });
  }

  return sections;
}

import type { AtMenuSection, ChatSession, CodeSymbolResult } from "@mimica/shared";
import { AT_MENU_SECTION_LABELS } from "@mimica/shared";
import { searchAtPaths } from "./enumerate.js";
import { codeSectionLabel, codeSymbolsToMenuItems } from "./codeSymbols.js";
import { gitSectionLabel, listGitMenuItems } from "./gitContext.js";
import { listPastChatMenuItems, pastChatSectionLabel } from "./pastChats.js";

export interface AtMenuSearchParams {
  workspacePath: string;
  query: string;
  currentSessionId: string | null;
  listSessions: () => ChatSession[];
  symbolSearch?: (query: string, limit: number) => Promise<CodeSymbolResult[]>;
  bridgeConnected?: boolean;
}

function fileSectionLabel(): string {
  return AT_MENU_SECTION_LABELS.files;
}

export async function searchAtMenuSections(params: AtMenuSearchParams): Promise<AtMenuSection[]> {
  const sections: AtMenuSection[] = [];
  const query = params.query.replace(/\\/g, "/");

  const pastChats = listPastChatMenuItems(
    params.listSessions(),
    params.workspacePath,
    params.currentSessionId,
    query,
  );
  if (pastChats.length > 0) {
    sections.push({
      category: "past-chats",
      label: pastChatSectionLabel(),
      items: pastChats,
    });
  }

  const gitItems = listGitMenuItems(params.workspacePath, query);
  if (gitItems.length > 0) {
    sections.push({
      category: "git",
      label: gitSectionLabel(),
      items: gitItems,
    });
  }

  if (params.bridgeConnected && params.symbolSearch && query.length > 0) {
    try {
      const symbols = await params.symbolSearch(query, 50);
      const codeItems = codeSymbolsToMenuItems(symbols, query);
      if (codeItems.length > 0) {
        sections.push({
          category: "code",
          label: codeSectionLabel(),
          items: codeItems,
        });
      }
    } catch {
      // Graceful degrade when symbol search fails.
    }
  }

  const fileItems = searchAtPaths(params.workspacePath, query);
  if (fileItems.length > 0) {
    sections.push({
      category: "files",
      label: fileSectionLabel(),
      items: fileItems,
    });
  }

  return sections;
}

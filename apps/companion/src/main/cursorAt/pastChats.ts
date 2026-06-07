import type { AtMenuItem, ChatSession } from "@mimica/shared";
import { AT_MENU_MAX_RESULTS } from "@mimica/shared";
import { normalize } from "node:path";

export const MAX_PAST_CHAT_TURNS = 20;
export const MAX_PAST_CHAT_CHARS = 32_000;

function normalizeWorkspacePath(path: string): string {
  return normalize(path).replace(/\\/g, "/");
}

export { normalizeWorkspacePath };

function matchesPastChatQuery(session: ChatSession, query: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  return session.title.toLowerCase().includes(lower) || session.id.toLowerCase().includes(lower);
}

export function listPastChatMenuItems(
  sessions: ChatSession[],
  workspacePath: string,
  currentSessionId: string | null,
  query: string,
  limit = AT_MENU_MAX_RESULTS,
): AtMenuItem[] {
  const normalizedWorkspace = normalizeWorkspacePath(workspacePath);
  const items: AtMenuItem[] = [];

  for (const session of sessions) {
    if (session.id === currentSessionId) continue;
    if (normalizeWorkspacePath(session.workspacePath) !== normalizedWorkspace) continue;
    if (session.messages.length === 0) continue;
    if (!matchesPastChatQuery(session, query)) continue;

    items.push({
      kind: "past-chat",
      path: session.id,
      name: session.title,
      description: new Date(session.updatedAt).toLocaleString(),
    });
    if (items.length >= limit) break;
  }

  return items;
}

export function formatPastChatForPrompt(session: ChatSession): {
  text: string;
  warning?: string;
} {
  const recent = session.messages.slice(-MAX_PAST_CHAT_TURNS);
  const lines: string[] = [
    "## Referenced past chat",
    "",
    `Session: ${session.title}`,
    `Updated: ${session.updatedAt}`,
    "",
  ];

  for (const message of recent) {
    lines.push(`### ${message.role}`, "", message.content.trim(), "");
  }

  let body = lines.join("\n").trim();
  let warning: string | undefined;
  if (body.length > MAX_PAST_CHAT_CHARS) {
    body = body.slice(0, MAX_PAST_CHAT_CHARS);
    const lastNewline = body.lastIndexOf("\n");
    if (lastNewline > 0) body = body.slice(0, lastNewline);
    warning = `@Past Chat: ${session.id} は長すぎるため先頭部分のみ注入しました（${MAX_PAST_CHAT_TURNS} ターン / ${MAX_PAST_CHAT_CHARS} 文字上限）`;
  }

  return { text: body, warning };
}

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { ChatSession } from "@mimica/shared";
import { DEFAULT_SESSION_TITLE, DEFAULT_SETTINGS, hasSessionHistory } from "@mimica/shared";
import { userDataJoin } from "./userDataPaths.js";
import { registerWorkspaceRoot } from "./workspaceAllowlist.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionsDir(): string {
  return userDataJoin("sessions");
}

function safeSessionId(id: string): string | null {
  return UUID_RE.test(id) ? id : null;
}

function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export class SessionStore {
  private sessions = new Map<string, ChatSession>();
  private saveChatHistory = DEFAULT_SETTINGS.saveChatHistory;

  load(): void {
    const dir = sessionsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      return;
    }
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const id = file.slice(0, -".json".length);
      if (!safeSessionId(id)) continue;
      const path = join(dir, file);
      try {
        const session = JSON.parse(readFileSync(path, "utf8")) as ChatSession;
        if (!safeSessionId(session.id)) continue;
        if (!hasSessionHistory(session)) {
          try {
            unlinkSync(path);
          } catch (err) {
            console.error(`Failed to delete empty session file: ${path}`, err);
          }
          continue;
        }
        this.sessions.set(session.id, session);
      } catch {
        /* skip corrupt files */
      }
    }
  }

  list(): ChatSession[] {
    return sortSessions([...this.sessions.values()]);
  }

  listHistory(): ChatSession[] {
    return sortSessions([...this.sessions.values()].filter(hasSessionHistory));
  }

  get(id: string): ChatSession | undefined {
    const safeId = safeSessionId(id);
    return safeId ? this.sessions.get(safeId) : undefined;
  }

  create(workspacePath: string): ChatSession {
    const resolvedWorkspace = registerWorkspaceRoot(workspacePath);
    const max = DEFAULT_SETTINGS.maxChatSessions;
    const history = this.listHistory();
    if (history.length >= max) {
      const oldest = history[history.length - 1];
      if (oldest) this.delete(oldest.id);
    }
    this.evictOldestEmptyDrafts(max);
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: uuidv4(),
      title: DEFAULT_SESSION_TITLE,
      createdAt: now,
      updatedAt: now,
      workspacePath: resolvedWorkspace,
      characterId: "rio",
      messages: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  save(session: ChatSession): ChatSession {
    const safeId = safeSessionId(session.id);
    if (!safeId) {
      throw new Error("Invalid session id");
    }
    const updated = { ...session, id: safeId, updatedAt: new Date().toISOString() };
    this.sessions.set(updated.id, updated);
    if (hasSessionHistory(updated)) {
      this.persist(updated);
    } else {
      this.removePersistedFile(safeId);
    }
    return updated;
  }

  delete(id: string): void {
    const safeId = safeSessionId(id);
    if (!safeId) return;
    this.sessions.delete(safeId);
    this.removePersistedFile(safeId);
  }

  setSaveChatHistory(enabled: boolean): void {
    this.saveChatHistory = enabled;
  }

  private removePersistedFile(id: string): void {
    const path = join(sessionsDir(), `${id}.json`);
    if (!existsSync(path)) return;
    try {
      unlinkSync(path);
    } catch (err) {
      console.error(`Failed to delete session file: ${path}`, err);
    }
  }

  /** Drop oldest in-memory drafts so spamming New Chat cannot grow the map without bound. */
  private evictOldestEmptyDrafts(maxEmptyDrafts: number): void {
    const emptyDrafts = sortSessions(
      [...this.sessions.values()].filter((session) => !hasSessionHistory(session)),
    );
    while (emptyDrafts.length >= maxEmptyDrafts) {
      const oldest = emptyDrafts.pop();
      if (!oldest) break;
      this.sessions.delete(oldest.id);
      this.removePersistedFile(oldest.id);
    }
  }

  private persist(session: ChatSession): void {
    if (!this.saveChatHistory) return;
    const safeId = safeSessionId(session.id);
    if (!safeId) return;
    const dir = sessionsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${safeId}.json`), JSON.stringify({ ...session, id: safeId }, null, 2));
  }
}

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
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { userDataJoin } from "./userDataPaths.js";
import { registerWorkspaceRoot } from "./workspaceAllowlist.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionsDir(): string {
  return userDataJoin("sessions");
}

function safeSessionId(id: string): string | null {
  return UUID_RE.test(id) ? id : null;
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
      try {
        const session = JSON.parse(readFileSync(join(dir, file), "utf8")) as ChatSession;
        if (safeSessionId(session.id)) {
          this.sessions.set(session.id, session);
        }
      } catch {
        /* skip corrupt files */
      }
    }
  }

  list(): ChatSession[] {
    return [...this.sessions.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  get(id: string): ChatSession | undefined {
    const safeId = safeSessionId(id);
    return safeId ? this.sessions.get(safeId) : undefined;
  }

  create(workspacePath: string): ChatSession {
    const resolvedWorkspace = registerWorkspaceRoot(workspacePath);
    const max = DEFAULT_SETTINGS.maxChatSessions;
    const existing = this.list();
    if (existing.length >= max) {
      const oldest = existing[existing.length - 1];
      if (oldest) this.delete(oldest.id);
    }
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: uuidv4(),
      title: "新規チャット",
      createdAt: now,
      updatedAt: now,
      workspacePath: resolvedWorkspace,
      characterId: "rio",
      messages: [],
    };
    this.sessions.set(session.id, session);
    this.persist(session);
    return session;
  }

  save(session: ChatSession): ChatSession {
    const safeId = safeSessionId(session.id);
    if (!safeId) {
      throw new Error("Invalid session id");
    }
    const updated = { ...session, id: safeId, updatedAt: new Date().toISOString() };
    this.sessions.set(updated.id, updated);
    this.persist(updated);
    return updated;
  }

  delete(id: string): void {
    const safeId = safeSessionId(id);
    if (!safeId) return;
    this.sessions.delete(safeId);
    const path = join(sessionsDir(), `${safeId}.json`);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch (err) {
        console.error(`Failed to delete session file: ${path}`, err);
      }
    }
  }

  setSaveChatHistory(enabled: boolean): void {
    this.saveChatHistory = enabled;
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

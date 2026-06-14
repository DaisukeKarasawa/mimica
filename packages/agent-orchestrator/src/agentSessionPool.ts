import type { SDKAgent } from "@cursor/sdk";
import type { AgentMode } from "@mimica/shared";
import { createCursorAgent, type CursorSdkConversationMode } from "./createCursorAgent.js";
import { isAgentPerfEnabled } from "./agentRunTiming.js";

export interface AgentSessionHandle {
  agent: SDKAgent;
  isFollowUp: boolean;
}

interface PooledSession {
  agent: SDKAgent;
  workspacePath: string;
  mode: AgentMode;
  apiKey: string;
  personaFingerprint: string;
  turnsSent: number;
  lastActivityAt: number;
  activeRuns: number;
}

/** Default idle eviction: 30 minutes without a completed turn. */
export const DEFAULT_IDLE_EVICT_MS = 30 * 60 * 1000;

/**
 * Pooled SDK agents keyed by Mimica chat session id.
 *
 * Lifecycle: agents stay open between turns for the same session. Idle sessions are evicted after
 * {@link DEFAULT_IDLE_EVICT_MS}. Call `closeSession` when the user deletes a chat tab, and
 * `closeAll` on app shutdown (`AgentService.dispose`).
 */
export class AgentSessionPool {
  private readonly sessions = new Map<string, PooledSession>();
  private readonly idleEvictMs: number;

  constructor(idleEvictMs = DEFAULT_IDLE_EVICT_MS) {
    this.idleEvictMs = idleEvictMs;
  }

  async acquire(params: {
    sessionId: string;
    apiKey: string;
    workspacePath: string;
    mode: AgentMode;
    sdkMode: CursorSdkConversationMode;
    personaFingerprint?: string;
  }): Promise<AgentSessionHandle> {
    this.evictIdleSessions();

    const personaFingerprint = params.personaFingerprint ?? "";
    const existing = this.sessions.get(params.sessionId);
    if (
      existing &&
      existing.workspacePath === params.workspacePath &&
      existing.mode === params.mode &&
      existing.apiKey === params.apiKey &&
      existing.personaFingerprint === personaFingerprint
    ) {
      existing.lastActivityAt = Date.now();
      return { agent: existing.agent, isFollowUp: existing.turnsSent > 0 };
    }

    if (existing) {
      existing.agent.close();
      this.sessions.delete(params.sessionId);
    }

    const agent = await createCursorAgent({
      apiKey: params.apiKey,
      workspacePath: params.workspacePath,
      mode: params.sdkMode,
    });

    const now = Date.now();
    this.sessions.set(params.sessionId, {
      agent,
      workspacePath: params.workspacePath,
      mode: params.mode,
      apiKey: params.apiKey,
      personaFingerprint,
      turnsSent: 0,
      lastActivityAt: now,
      activeRuns: 0,
    });

    this.logPoolDebug("acquire", params.sessionId);

    return { agent, isFollowUp: false };
  }

  markTurnSent(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.turnsSent += 1;
    session.lastActivityAt = Date.now();
  }

  /** Marks an in-flight turn so idle eviction does not close the pooled agent. */
  beginRun(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.activeRuns += 1;
  }

  /** Clears an in-flight turn marker after the turn settles. */
  endRun(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.activeRuns = Math.max(0, session.activeRuns - 1);
  }

  /** Drop a pooled agent after a non-completed turn so the next send starts fresh. */
  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.agent.close();
    this.sessions.delete(sessionId);
    this.logPoolDebug("invalidate", sessionId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.agent.close();
    this.sessions.delete(sessionId);
    this.logPoolDebug("close", sessionId);
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.agent.close();
    }
    this.sessions.clear();
    this.logPoolDebug("closeAll");
  }

  /** Evict agents idle longer than {@link idleEvictMs}. Does not interrupt in-flight runs. */
  evictIdleSessions(now = Date.now()): number {
    let evicted = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.activeRuns > 0) continue;
      if (now - session.lastActivityAt < this.idleEvictMs) continue;
      session.agent.close();
      this.sessions.delete(sessionId);
      evicted += 1;
      this.logPoolDebug("evict_idle", sessionId);
    }
    return evicted;
  }

  getPoolSize(): number {
    return this.sessions.size;
  }

  /** Package test seam: seed idle metadata without a live SDK agent. */
  seedIdleSessionForTests(
    sessionId: string,
    lastActivityAt: number,
    options?: { activeRuns?: number },
  ): void {
    this.sessions.set(sessionId, {
      agent: { close() {} } as SDKAgent,
      workspacePath: "/test",
      mode: "agent",
      apiKey: "test-key",
      personaFingerprint: "",
      turnsSent: 0,
      lastActivityAt,
      activeRuns: options?.activeRuns ?? 0,
    });
  }

  private logPoolDebug(reason: string, sessionId?: string): void {
    if (!isAgentPerfEnabled()) return;
    const suffix = sessionId ? ` session=${sessionId}` : "";
    console.info(
      `[mimica:agent-pool] ${reason}${suffix} size=${this.sessions.size} idleEvictMs=${this.idleEvictMs}`,
    );
  }
}

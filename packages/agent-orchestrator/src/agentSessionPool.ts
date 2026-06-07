import type { SDKAgent } from "@cursor/sdk";
import type { AgentMode } from "@mimica/shared";
import { createCursorAgent, type CursorSdkConversationMode } from "./createCursorAgent.js";

export interface AgentSessionHandle {
  agent: SDKAgent;
  isFollowUp: boolean;
}

interface PooledSession {
  agent: SDKAgent;
  workspacePath: string;
  mode: AgentMode;
  apiKey: string;
  turnsSent: number;
}

export class AgentSessionPool {
  private readonly sessions = new Map<string, PooledSession>();

  async acquire(params: {
    sessionId: string;
    apiKey: string;
    workspacePath: string;
    mode: AgentMode;
    sdkMode: CursorSdkConversationMode;
  }): Promise<AgentSessionHandle> {
    const existing = this.sessions.get(params.sessionId);
    if (
      existing &&
      existing.workspacePath === params.workspacePath &&
      existing.mode === params.mode &&
      existing.apiKey === params.apiKey
    ) {
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

    this.sessions.set(params.sessionId, {
      agent,
      workspacePath: params.workspacePath,
      mode: params.mode,
      apiKey: params.apiKey,
      turnsSent: 0,
    });

    return { agent, isFollowUp: false };
  }

  markTurnSent(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.turnsSent += 1;
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.agent.close();
    this.sessions.delete(sessionId);
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.agent.close();
    }
    this.sessions.clear();
  }
}

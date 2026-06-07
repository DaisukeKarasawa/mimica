import type { Run } from "@cursor/sdk";
import type { AgentMode, ChatMessage, MessageContext } from "@mimica/shared";
import { cancelRun, isAbortError } from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { AgentSessionPool } from "./agentSessionPool.js";
import { type CursorSdkConversationMode } from "./createCursorAgent.js";
import { ensureReadOnlyHooks } from "./ensureReadOnlyHooks.js";
import { buildContextPrompt } from "./eventMapper.js";
import { processAgentStream, resolveFinalAssistantText } from "./processAgentStream.js";
import { ReadOnlyRunGuard } from "./readOnlyRunGuard.js";
import { READ_ONLY_HOOK_INSTALL_WARNING } from "./readOnlyPolicy.js";
import { AgentRunTimingTrace } from "./agentRunTiming.js";
import { resolveCursorApiKey } from "./resolveApiKey.js";
import { trimChatHistoryForPrompt } from "./trimChatHistory.js";

export type { AgentRunCallbacks } from "./agentCallbacks.js";

export interface RunChatParams {
  sessionId: string;
  prompt: string;
  workspacePath: string;
  mode: AgentMode;
  context?: MessageContext;
  history?: ChatMessage[];
  apiKey?: string;
  /** Persona pack (SKILL.md + style). When set, 調月リオの口調ルールを適用 */
  personaSystemPrompt?: string;
  callbacks: AgentRunCallbacks;
  signal?: AbortSignal;
  /** When set (MIMICA_AGENT_PERF=1), emits `[mimica:agent-perf]` timing logs. */
  timing?: AgentRunTimingTrace;
}

const OUTPUT_RULES = `CRITICAL output rule for the user-visible message:
- Output ONLY the final answer in 調月リオ persona (short intro + substantive reply + optional short closing).
- NEVER write planning, process narration, or tool preamble to the user. Forbidden examples: 「調べます」「確認します」「ペルソナ設定を確認」「ワークスペースを読み取ります」「最新の情報を取得します」.
- Do planning silently via tools. The user must not see your internal steps.
- Format the substantive reply as GitHub-Flavored Markdown: use blank lines between sections; tables must have one row per line (never collapse table rows onto a single line).

Reply in Japanese when the user writes in Japanese. Follow the persona instructions below.`;

const ASK_PREAMBLE = `You are the Mimica coding companion (調月リオ UI) in Ask mode: do not create, edit, delete, or run commands that modify the workspace. You may read and analyze files.

${OUTPUT_RULES}`;

const AGENT_PREAMBLE = `You are the Mimica coding companion (調月リオ UI) in Agent mode: you may read, edit, and run shell commands in the workspace when needed to answer the user.

${OUTPUT_RULES}`;

const PLAN_PREAMBLE = `You are the Mimica coding companion (調月リオ UI) in Plan mode: explore the codebase, propose a clear plan, and only implement when the user confirms or asks you to build.

${OUTPUT_RULES}`;

function preambleForMode(mode: AgentMode): string {
  switch (mode) {
    case "ask":
      return ASK_PREAMBLE;
    case "plan":
      return PLAN_PREAMBLE;
    default:
      return AGENT_PREAMBLE;
  }
}

function sdkModeFor(mode: AgentMode): CursorSdkConversationMode {
  return mode === "plan" ? "plan" : "agent";
}

function buildHistoryPrompt(messages: ChatMessage[]): string {
  const turns = trimChatHistoryForPrompt(messages);
  if (turns.length === 0) return "";
  const lines = turns.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content.trim()}`;
  });
  return `## Conversation history\n${lines.join("\n\n")}`;
}

export class AgentRunner {
  private activeRun: Run | null = null;
  private activeSessionId: string | null = null;
  private cancelled = false;
  private readonly sessionPool = new AgentSessionPool();

  async runChat(params: RunChatParams): Promise<void> {
    const apiKey = params.apiKey ?? resolveCursorApiKey();
    if (!apiKey) {
      params.callbacks.onError("CURSOR_API_KEY が設定されていません");
      params.callbacks.onState("failed");
      return;
    }

    this.cancelled = false;
    this.activeSessionId = params.sessionId;
    const enforceReadOnly = params.mode === "ask";
    const sdkMode = sdkModeFor(params.mode);

    params.callbacks.onState("thinking");

    if (enforceReadOnly) {
      const hooksResult = await ensureReadOnlyHooks(params.workspacePath);
      if (!hooksResult.ok) {
        params.callbacks.onWarning?.(`${READ_ONLY_HOOK_INSTALL_WARNING} (${hooksResult.message})`);
      }
    }

    const timing = params.timing;
    let sessionHandle: Awaited<ReturnType<AgentSessionPool["acquire"]>>;
    try {
      sessionHandle = await this.sessionPool.acquire({
        sessionId: params.sessionId,
        apiKey,
        workspacePath: params.workspacePath,
        mode: params.mode,
        sdkMode,
      });
      timing?.markOnce("T1_agent_ready");
    } catch (err) {
      timing?.report("failed");
      params.callbacks.onState("failed");
      params.callbacks.onError(err instanceof Error ? err.message : String(err));
      return;
    }

    const { agent, isFollowUp } = sessionHandle;
    if (timing) {
      timing.meta.isFollowUp = isFollowUp;
    }
    const fullPrompt = this.buildFullPrompt(params, isFollowUp);
    const callbacks = this.wrapCallbacksForTiming(params.callbacks, timing);

    try {
      let readOnlyGuard: ReadOnlyRunGuard | undefined;
      if (enforceReadOnly) {
        readOnlyGuard = new ReadOnlyRunGuard(() => this.activeRun, callbacks);
      }

      const run = await agent.send(fullPrompt, {
        mode: sdkMode,
        onDelta: async ({ update }) => {
          await readOnlyGuard?.handleSendDelta(update, () => this.cancelled, params.signal);
        },
      });
      this.activeRun = run;
      timing?.markOnce("T1_send_done");

      const streamResult = await processAgentStream({
        run,
        callbacks,
        signal: params.signal,
        isCancelled: () => this.cancelled,
        readOnlyGuard,
        timing,
      });

      if (readOnlyGuard?.isBlocked) {
        timing?.report("blocked");
        return;
      }

      if (this.cancelled || params.signal?.aborted) {
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }

      let result;
      try {
        result = await run.wait();
      } catch (err) {
        if (isAbortError(err) || this.cancelled) {
          timing?.report("cancelled");
          callbacks.onState("cancelled");
          return;
        }
        throw err;
      }
      timing?.markOnce("T4_run_wait");

      if (result.status === "cancelled") {
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }
      if (result.status === "error") {
        timing?.report("failed");
        callbacks.onState("failed");
        callbacks.onError(result.result ?? "Agent の実行に失敗しました");
        return;
      }

      const finalText = resolveFinalAssistantText(
        streamResult.sawToolCall,
        streamResult.preToolText,
        streamResult.postToolText,
        result.result,
      );

      this.sessionPool.markTurnSent(params.sessionId);
      timing?.markOnce("T4_complete");
      timing?.report("completed");
      callbacks.onState("completed");
      callbacks.onComplete(finalText);
    } catch (err) {
      if (isAbortError(err) || this.cancelled) {
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }
      timing?.report("failed");
      callbacks.onState("failed");
      callbacks.onError(err instanceof Error ? err.message : String(err));
    } finally {
      this.activeRun = null;
      this.activeSessionId = null;
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    await cancelRun(this.activeRun);
  }

  async closeSession(sessionId: string): Promise<void> {
    if (this.activeSessionId === sessionId) {
      await this.cancel();
    }
    this.sessionPool.closeSession(sessionId);
  }

  closeAllSessions(): void {
    this.sessionPool.closeAll();
  }

  private wrapCallbacksForTiming(
    callbacks: AgentRunCallbacks,
    timing?: AgentRunTimingTrace,
  ): AgentRunCallbacks {
    if (!timing) return callbacks;
    return {
      ...callbacks,
      onDelta: (chunk) => {
        if (chunk.length > 0) {
          timing.markOnce("T2_first_delta");
        }
        callbacks.onDelta(chunk);
      },
    };
  }

  private buildFullPrompt(params: RunChatParams, isFollowUp: boolean): string {
    const contextBlock = params.context ? buildContextPrompt(params.context) : "";

    if (isFollowUp) {
      return [contextBlock, `## User message\n${params.prompt}`].filter(Boolean).join("\n\n");
    }

    const historyBlock = params.history ? buildHistoryPrompt(params.history) : "";
    return [
      preambleForMode(params.mode),
      params.personaSystemPrompt,
      historyBlock,
      contextBlock,
      `## User message\n${params.prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
}

import type { Run, SDKImage } from "@cursor/sdk";
import type { AgentMode, ChatMessage, MessageContext } from "@mimica/shared";
import { agentRunError, agentRunErrorFromUnknown } from "@mimica/shared";
import { cancelRun, isAbortError } from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { AgentSessionPool } from "./agentSessionPool.js";
import { type CursorSdkConversationMode } from "./createCursorAgent.js";
import { ensureReadOnlyHooks } from "./ensureReadOnlyHooks.js";
import { buildAgentFullPrompt } from "./buildAgentPrompt.js";
import { processAgentStream, resolveFinalAssistantText } from "./processAgentStream.js";
import { releaseAskQuestionStreamRun } from "./toolCallStreamQuestionAdapter.js";
import { ReadOnlyRunGuard } from "./readOnlyRunGuard.js";
import { READ_ONLY_HOOK_INSTALL_WARNING } from "./readOnlyPolicy.js";
import { AgentRunTimingTrace } from "./agentRunTiming.js";
import { resolveCursorApiKey } from "./resolveApiKey.js";

export type { AgentRunCallbacks } from "./agentCallbacks.js";

export interface RunChatParams {
  sessionId: string;
  prompt: string;
  images?: SDKImage[];
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

interface SessionRunContext {
  run: Run | null;
  runGeneration: number;
  /** Runs with generation <= this value were cancelled. */
  cancelledThroughGeneration: number;
}

function sdkModeFor(mode: AgentMode): CursorSdkConversationMode {
  return mode === "plan" ? "plan" : "agent";
}

export class AgentRunner {
  private readonly sessionRuns = new Map<string, SessionRunContext>();
  private readonly sessionPool = new AgentSessionPool();

  private contextFor(sessionId: string): SessionRunContext {
    let ctx = this.sessionRuns.get(sessionId);
    if (!ctx) {
      ctx = { run: null, runGeneration: 0, cancelledThroughGeneration: 0 };
      this.sessionRuns.set(sessionId, ctx);
    }
    return ctx;
  }

  async runChat(params: RunChatParams): Promise<void> {
    const apiKey = params.apiKey ?? resolveCursorApiKey();
    if (!apiKey) {
      params.callbacks.onError(agentRunError("auth_missing"));
      params.callbacks.onState("failed");
      return;
    }

    const ctx = this.contextFor(params.sessionId);
    const runGen = ++ctx.runGeneration;
    const isRunCancelled = () => runGen <= ctx.cancelledThroughGeneration;
    const enforceReadOnly = params.mode === "ask";
    const sdkMode = sdkModeFor(params.mode);

    params.callbacks.onState("thinking");

    if (enforceReadOnly) {
      const hooksResult = await ensureReadOnlyHooks(params.workspacePath);
      if (!hooksResult.ok) {
        params.callbacks.onWarning?.(`${READ_ONLY_HOOK_INSTALL_WARNING} (${hooksResult.message})`);
      }
    }

    if (isRunCancelled() || params.signal?.aborted) {
      params.timing?.report("cancelled");
      params.callbacks.onState("cancelled");
      return;
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
        personaFingerprint: params.personaSystemPrompt ?? "",
      });
      timing?.markOnce("T1_agent_ready");
    } catch (err) {
      timing?.report("failed");
      params.callbacks.onState("failed");
      params.callbacks.onError(agentRunErrorFromUnknown(err));
      return;
    }

    if (isRunCancelled() || params.signal?.aborted) {
      this.sessionPool.invalidateSession(params.sessionId);
      timing?.report("cancelled");
      params.callbacks.onState("cancelled");
      return;
    }

    const { agent, isFollowUp } = sessionHandle;
    if (timing) {
      timing.meta.isFollowUp = isFollowUp;
    }
    const fullPrompt = this.buildFullPrompt(params, isFollowUp);
    const callbacks = this.wrapCallbacksForTiming(params.callbacks, timing);
    let streamRunId: string | undefined;

    try {
      let readOnlyGuard: ReadOnlyRunGuard | undefined;
      if (enforceReadOnly) {
        readOnlyGuard = new ReadOnlyRunGuard(() => ctx.run, callbacks);
      }

      if (isRunCancelled() || params.signal?.aborted) {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }

      const message =
        params.images && params.images.length > 0
          ? { text: fullPrompt, images: params.images }
          : fullPrompt;
      const run = await agent.send(message, {
        mode: sdkMode,
        onDelta: async ({ update }) => {
          await readOnlyGuard?.handleSendDelta(update, isRunCancelled, params.signal);
        },
      });
      if (ctx.runGeneration === runGen) {
        ctx.run = run;
      }
      streamRunId = run.id;
      timing?.markOnce("T1_send_done");

      const streamResult = await processAgentStream({
        run,
        callbacks,
        signal: params.signal,
        isCancelled: isRunCancelled,
        readOnlyGuard,
        timing,
      });

      if (readOnlyGuard?.isBlocked) {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("blocked");
        return;
      }

      if (isRunCancelled() || params.signal?.aborted) {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }

      let result;
      try {
        result = await run.wait();
      } catch (err) {
        if (isAbortError(err) || isRunCancelled()) {
          this.sessionPool.invalidateSession(params.sessionId);
          timing?.report("cancelled");
          callbacks.onState("cancelled");
          return;
        }
        throw err;
      }
      timing?.markOnce("T4_run_wait");

      if (result.status === "cancelled") {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }
      if (result.status === "error") {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("failed");
        callbacks.onState("failed");
        callbacks.onError(agentRunError("agent_failed", result.result ?? undefined));
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
      if (isAbortError(err) || isRunCancelled()) {
        this.sessionPool.invalidateSession(params.sessionId);
        timing?.report("cancelled");
        callbacks.onState("cancelled");
        return;
      }
      this.sessionPool.invalidateSession(params.sessionId);
      timing?.report("failed");
      callbacks.onState("failed");
      callbacks.onError(agentRunErrorFromUnknown(err));
    } finally {
      if (streamRunId) {
        releaseAskQuestionStreamRun(streamRunId);
      }
      if (ctx.runGeneration === runGen) {
        ctx.run = null;
        this.sessionRuns.delete(params.sessionId);
      }
    }
  }

  async cancel(sessionId?: string): Promise<void> {
    if (sessionId === undefined) {
      const ids = [...this.sessionRuns.keys()];
      await Promise.all(ids.map((id) => this.cancel(id)));
      return;
    }
    const ctx = this.sessionRuns.get(sessionId);
    if (!ctx) return;
    ctx.cancelledThroughGeneration = ctx.runGeneration;
    await cancelRun(ctx.run);
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.cancel(sessionId);
    this.sessionRuns.delete(sessionId);
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
    return buildAgentFullPrompt(params, isFollowUp);
  }
}

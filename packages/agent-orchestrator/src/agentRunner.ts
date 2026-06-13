import type { Run, SDKImage } from "@cursor/sdk";
import type { AgentMode, AgentRunError, ChatMessage, MessageContext } from "@mimica/shared";
import { agentRunError } from "@mimica/shared";
import { cancelRun, isIntentionalCancellationError } from "./abortError.js";
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
import { classifySdkTransportError, mapSdkTransportToAgentRunError } from "./sdkTransportError.js";

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

type ChatTurnOutcome =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "blocked" }
  | { status: "failed"; error: AgentRunError }
  | { status: "transport_retry" };

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

    let transportRetried = false;

    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await this.executeChatTurn({
          params,
          ctx,
          runGen,
          isRunCancelled,
          enforceReadOnly,
          sdkMode,
          apiKey,
          transportRetried,
        });

        switch (outcome.status) {
          case "completed":
            return;
          case "cancelled":
            params.timing?.report("cancelled");
            params.callbacks.onState("cancelled");
            return;
          case "blocked":
            params.timing?.report("blocked");
            return;
          case "failed":
            params.timing?.report("failed");
            params.callbacks.onState("failed");
            params.callbacks.onError(outcome.error);
            return;
          case "transport_retry":
            transportRetried = true;
            continue;
          default: {
            const never: never = outcome;
            throw new Error(`Unexpected chat turn outcome: ${String(never)}`);
          }
        }
      }
    } finally {
      if (ctx.runGeneration === runGen) {
        this.sessionRuns.delete(params.sessionId);
      }
    }
  }

  private resolveTransportFailure(
    sessionId: string,
    err: unknown,
    transportRetried: boolean,
  ): ChatTurnOutcome {
    const classified = classifySdkTransportError(err);
    if (classified?.invalidatePool) {
      this.sessionPool.invalidateSession(sessionId);
    }
    if (classified?.retryOnce && !transportRetried) {
      return { status: "transport_retry" };
    }
    return { status: "failed", error: mapSdkTransportToAgentRunError(err) };
  }

  private async executeChatTurn(args: {
    params: RunChatParams;
    ctx: SessionRunContext;
    runGen: number;
    isRunCancelled: () => boolean;
    enforceReadOnly: boolean;
    sdkMode: CursorSdkConversationMode;
    apiKey: string;
    transportRetried: boolean;
  }): Promise<ChatTurnOutcome> {
    const {
      params,
      ctx,
      runGen,
      isRunCancelled,
      enforceReadOnly,
      sdkMode,
      apiKey,
      transportRetried,
    } = args;
    const { sessionId, timing } = params;
    let streamRunId: string | undefined;

    try {
      let sessionHandle: Awaited<ReturnType<AgentSessionPool["acquire"]>>;
      try {
        sessionHandle = await this.sessionPool.acquire({
          sessionId,
          apiKey,
          workspacePath: params.workspacePath,
          mode: params.mode,
          sdkMode,
          personaFingerprint: params.personaSystemPrompt ?? "",
        });
        timing?.markOnce("T1_agent_ready");
      } catch (err) {
        return this.resolveTransportFailure(sessionId, err, transportRetried);
      }

      if (isRunCancelled() || params.signal?.aborted) {
        this.sessionPool.invalidateSession(sessionId);
        return { status: "cancelled" };
      }

      const { agent, isFollowUp } = sessionHandle;
      if (timing) {
        timing.meta.isFollowUp = isFollowUp;
      }
      const fullPrompt = this.buildFullPrompt(params, isFollowUp);
      const callbacks = this.wrapCallbacksForTiming(params.callbacks, timing);

      let readOnlyGuard: ReadOnlyRunGuard | undefined;
      if (enforceReadOnly) {
        readOnlyGuard = new ReadOnlyRunGuard(() => ctx.run, callbacks);
      }

      if (isRunCancelled() || params.signal?.aborted) {
        this.sessionPool.invalidateSession(sessionId);
        return { status: "cancelled" };
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
        this.sessionPool.invalidateSession(sessionId);
        return { status: "blocked" };
      }

      if (isRunCancelled() || params.signal?.aborted) {
        this.sessionPool.invalidateSession(sessionId);
        return { status: "cancelled" };
      }

      let result;
      try {
        result = await run.wait();
      } catch (err) {
        if (isIntentionalCancellationError(err) || isRunCancelled()) {
          this.sessionPool.invalidateSession(sessionId);
          return { status: "cancelled" };
        }
        throw err;
      }
      timing?.markOnce("T4_run_wait");

      if (result.status === "cancelled") {
        this.sessionPool.invalidateSession(sessionId);
        return { status: "cancelled" };
      }
      if (result.status === "error") {
        this.sessionPool.invalidateSession(sessionId);
        return {
          status: "failed",
          error: agentRunError("agent_failed", result.result ?? undefined),
        };
      }

      const finalText = resolveFinalAssistantText(
        streamResult.sawToolCall,
        streamResult.preToolText,
        streamResult.postToolText,
        result.result,
      );

      this.sessionPool.markTurnSent(sessionId);
      timing?.markOnce("T4_complete");
      timing?.report("completed");
      callbacks.onState("completed");
      callbacks.onComplete(finalText);
      return { status: "completed" };
    } catch (err) {
      if (isIntentionalCancellationError(err) || isRunCancelled()) {
        this.sessionPool.invalidateSession(sessionId);
        return { status: "cancelled" };
      }
      return this.resolveTransportFailure(sessionId, err, transportRetried);
    } finally {
      if (streamRunId) {
        releaseAskQuestionStreamRun(streamRunId);
      }
      if (ctx.runGeneration === runGen) {
        ctx.run = null;
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

  evictIdleSessions(): void {
    this.sessionPool.evictIdleSessions();
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

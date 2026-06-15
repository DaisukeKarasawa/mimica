import { relative } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { WebContents } from "electron";
import type {
  AgentCancelPayload,
  AgentMode,
  AgentQuestionAnswerInput,
  AgentQuestionDismissInput,
  AgentQuestionPrompt,
  AgentRunError,
  ChatAttachment,
  ChatSession,
  EditorContext,
} from "@mimica/shared";
import {
  agentRunErrorFromUnknown,
  findAgentQuestionPrompt,
  isChatAttachment,
  toMessageContext,
  updateAgentQuestionStatus,
  upsertAssistantQuestion,
} from "@mimica/shared";
import {
  AgentRunTimingTrace,
  buildAskQuestionFollowUpText,
  isAgentPerfEnabled,
  type AgentRunner,
} from "@mimica/agent-orchestrator";
import { resolveWorkspacePath } from "./paths.js";
import {
  resolveAgentSubmitWorkspace,
  shouldWarnUnlinkedAtExpansion,
  UNLINKED_AT_EXPANSION_WARNING,
} from "./agentSubmitWorkspace.js";
import { agentRunError, formatPersonaErrorForUser, PersonaFacingError } from "./personaErrors.js";
import { resolvePersonaSystemPrompt } from "./personaSetup.js";
import type { SessionStore } from "./sessionStore.js";
import { AgentRunEmitter, emitAgentEvent, emitQuestionResolved } from "./agentRunEmitter.js";
import {
  appendAssistantMessage,
  appendUserMessage,
  historyForAgentPrompt,
} from "./sessionMessages.js";
import { debugLogSlashResolution, resolveSlashInput } from "./cursorSlash/index.js";
import { debugLogAtResolution, resolveAtInput } from "./cursorAt/index.js";
import { MAX_IMAGE_ATTACHMENTS, readAttachmentBase64 } from "./imageAttachments.js";
import { answerDeliveryCoordinator } from "./answerDeliveryCoordinator.js";

export type { AgentQuestionAnswerInput, AgentQuestionDismissInput };

export interface AgentSubmitPayload {
  sessionId: string;
  content: string;
  workspacePath: string;
  mode: AgentMode;
  editorContext?: EditorContext | null;
  attachments?: ChatAttachment[];
}

interface RunSubmitOptions {
  onSettled?: (success: boolean) => void;
}

async function loadAgentRunner(): Promise<AgentRunner> {
  const { AgentRunner: Runner } = await import("@mimica/agent-orchestrator");
  return new Runner();
}

function resolvePendingQuestion(
  session: ChatSession,
  runId: string,
  questionPromptId: string,
): AgentQuestionPrompt | null {
  const prompt = findAgentQuestionPrompt(session, questionPromptId);
  if (!prompt || prompt.runId !== runId) {
    throw new Error("Question not found");
  }
  if (prompt.status !== "pending") {
    return null;
  }
  return prompt;
}

export class AgentService {
  private runner: AgentRunner | null = null;
  private runnerReady: Promise<AgentRunner> | null = null;
  private readonly activeRuns = new Map<string, { runId: string }>();

  constructor(
    private readonly getWebContents: () => WebContents | undefined,
    private readonly sessionStore: SessionStore,
  ) {}

  private persistAgentRunError(
    sessionId: string,
    runId: string,
    error: AgentRunError,
    emitter: AgentRunEmitter,
  ): void {
    if (!this.isRunActive(sessionId, runId)) return;

    const userMessage = formatPersonaErrorForUser(error);
    console.error(`[agentService] run ${runId} error (${error.kind}):`, error.detail ?? error.kind);

    const current = this.sessionStore.get(sessionId);
    if (current) {
      try {
        this.sessionStore.save(appendAssistantMessage(current, userMessage, runId));
      } catch (err) {
        console.error("[agentService] failed to persist error message:", err);
      }
    }

    emitter.terminalError(userMessage);
  }

  private async getRunner(): Promise<AgentRunner> {
    if (this.runner) return this.runner;
    if (!this.runnerReady) {
      this.runnerReady = loadAgentRunner().then((r) => {
        this.runner = r;
        return r;
      });
    }
    return this.runnerReady;
  }

  private isRunActive(sessionId: string, runId: string): boolean {
    return this.activeRuns.get(sessionId)?.runId === runId;
  }

  /** True while an SDK run or deferred answer delivery is in flight. */
  private isSessionBusy(sessionId: string): boolean {
    return this.activeRuns.has(sessionId) || answerDeliveryCoordinator.hasPending(sessionId);
  }

  private emitCancelledWhenInactive(
    wc: WebContents | undefined,
    sessionId: string,
    runId: string,
  ): void {
    if (this.isRunActive(sessionId, runId)) return;
    emitAgentEvent(wc, {
      type: "agent_state",
      sessionId,
      runId,
      state: "cancelled",
    });
  }

  private assertSubmitAllowed(
    payload: AgentSubmitPayload,
  ): NonNullable<ReturnType<SessionStore["get"]>> {
    if (this.isSessionBusy(payload.sessionId)) {
      throw new Error("Session already has an active agent run");
    }

    const session = this.sessionStore.get(payload.sessionId);
    if (!session) {
      throw new PersonaFacingError(agentRunError("session"));
    }
    if ((payload.attachments?.length ?? 0) > MAX_IMAGE_ATTACHMENTS) {
      throw new PersonaFacingError(
        agentRunError("attachment", `Maximum ${MAX_IMAGE_ATTACHMENTS} images per message`),
      );
    }
    return session;
  }

  async submit(payload: AgentSubmitPayload): Promise<void> {
    const session = this.assertSubmitAllowed(payload);
    const runId = uuidv4();
    this.activeRuns.set(payload.sessionId, { runId });
    void this.runSubmit(payload, runId, session);
  }

  private async submitAndWaitForCompletion(payload: AgentSubmitPayload): Promise<boolean> {
    const session = this.assertSubmitAllowed(payload);
    const runId = uuidv4();
    this.activeRuns.set(payload.sessionId, { runId });
    return new Promise((resolve) => {
      void this.runSubmit(payload, runId, session, {
        onSettled: (success) => resolve(success),
      });
    });
  }

  private async runSubmit(
    payload: AgentSubmitPayload,
    runId: string,
    session: NonNullable<ReturnType<SessionStore["get"]>>,
    options?: RunSubmitOptions,
  ): Promise<void> {
    const wc = this.getWebContents();
    const emitter = new AgentRunEmitter(wc, payload.sessionId, runId, () =>
      this.isRunActive(payload.sessionId, runId),
    );
    let runSucceeded = false;
    let delivery: Promise<void> | undefined;
    let settled = false;
    const settle = (success: boolean): void => {
      if (settled) return;
      settled = true;
      options?.onSettled?.(success);
    };

    try {
      const runner = await this.getRunner();
      runner.evictIdleSessions();
      if (!this.isRunActive(payload.sessionId, runId)) {
        this.emitCancelledWhenInactive(wc, payload.sessionId, runId);
        return;
      }

      const editorContext = payload.editorContext;
      const context = editorContext
        ? toMessageContext(editorContext)
        : { workspacePath: payload.workspacePath };

      const allMessages = session.messages;
      const history = historyForAgentPrompt(allMessages, payload.content);

      const rawWorkspace =
        editorContext?.workspacePath ?? payload.workspacePath ?? session?.workspacePath ?? "";

      const { slashWorkspace, cwd, canExpandAt } = resolveAgentSubmitWorkspace(
        rawWorkspace,
        resolveWorkspacePath,
      );

      const resolved = resolveSlashInput(slashWorkspace, payload.content, payload.mode);
      if (resolved.warning) {
        emitter.warning(resolved.warning);
      }
      if (resolved.kind && resolved.name) {
        debugLogSlashResolution(resolved.kind, resolved.name, resolved.expanded.length);
      }

      let atResolved: Awaited<ReturnType<typeof resolveAtInput>>;
      if (canExpandAt) {
        const skipAtPaths: string[] = [];
        if (editorContext?.currentFilePath) {
          const rel = relative(cwd, editorContext.currentFilePath).replace(/\\/g, "/");
          if (rel && !rel.startsWith("..")) {
            skipAtPaths.push(rel);
          }
        }
        atResolved = await resolveAtInput(cwd, resolved.expanded, {
          tokenSource: payload.content,
          skipPaths: skipAtPaths,
          getSession: (id) => this.sessionStore.get(id),
        });
      } else {
        atResolved = { expanded: resolved.expanded };
        if (shouldWarnUnlinkedAtExpansion(canExpandAt, payload.content)) {
          emitter.warning(UNLINKED_AT_EXPANSION_WARNING);
        }
      }
      if (!this.isRunActive(payload.sessionId, runId)) {
        this.emitCancelledWhenInactive(wc, payload.sessionId, runId);
        return;
      }
      if (atResolved.warning) {
        emitter.warning(atResolved.warning);
      }
      if (atResolved.paths?.length) {
        debugLogAtResolution(atResolved.paths, atResolved.expanded.length);
      }

      const sdkImages: Array<{ data: string; mimeType: string }> = [];
      for (const attachment of payload.attachments ?? []) {
        if (!isChatAttachment(attachment)) {
          emitter.warning("Invalid attachment payload was skipped");
          continue;
        }
        try {
          sdkImages.push(readAttachmentBase64(payload.sessionId, attachment));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          emitter.warning(`画像を読み取れませんでした (${attachment.fileName}): ${message}`);
        }
      }

      let promptText = atResolved.expanded;
      if (!promptText.trim() && sdkImages.length > 0) {
        promptText = "Please analyze the attached image(s).";
      }

      const timing = isAgentPerfEnabled()
        ? new AgentRunTimingTrace(runId, {
            mode: payload.mode,
            workspacePath: cwd,
            promptChars: promptText.length,
          })
        : undefined;
      if (timing) {
        emitter.perf(Date.now());
      }

      if (!this.isRunActive(payload.sessionId, runId)) {
        this.emitCancelledWhenInactive(wc, payload.sessionId, runId);
        return;
      }

      await runner.runChat({
        sessionId: payload.sessionId,
        prompt: promptText,
        images: sdkImages.length > 0 ? sdkImages : undefined,
        workspacePath: cwd,
        mode: payload.mode,
        context,
        history,
        personaSystemPrompt: resolvePersonaSystemPrompt(),
        timing,
        callbacks: {
          onState: (state) => emitter.state(state),
          onDelta: (chunk) => emitter.delta(chunk),
          onTool: (name, detail) => emitter.tool(name, detail),
          onWarning: (message) => emitter.warning(message),
          onQuestion: (question) => {
            const correlated = { ...question, runId };
            const current = this.sessionStore.get(payload.sessionId);
            if (current) {
              this.sessionStore.save(
                upsertAssistantQuestion(current, { runId, question: correlated }),
              );
            }
            emitter.question(correlated);
          },
          onComplete: (content) => {
            if (!this.isRunActive(payload.sessionId, runId)) return;
            runSucceeded = true;
            const current = this.sessionStore.get(payload.sessionId);
            if (current) {
              this.sessionStore.save(appendAssistantMessage(current, content, runId));
            }

            delivery = answerDeliveryCoordinator.deliver({
              wc,
              sessionId: payload.sessionId,
              runId,
              content,
              workspacePath: cwd,
              getRunner: () => this.getRunner(),
            });
          },
          onError: (error) => {
            this.persistAgentRunError(payload.sessionId, runId, error, emitter);
          },
        },
      });
    } catch (error) {
      if (!this.isRunActive(payload.sessionId, runId)) {
        this.emitCancelledWhenInactive(wc, payload.sessionId, runId);
        return;
      }
      this.persistAgentRunError(payload.sessionId, runId, agentRunErrorFromUnknown(error), emitter);
    } finally {
      if (this.isRunActive(payload.sessionId, runId)) {
        this.activeRuns.delete(payload.sessionId);
      }
      if (!runSucceeded) {
        settle(false);
      } else {
        void (delivery ?? Promise.resolve()).then(() => settle(true));
      }
    }
  }

  async cancel(payload: AgentCancelPayload): Promise<void> {
    const active = this.activeRuns.get(payload.sessionId);
    if (!this.isSessionBusy(payload.sessionId)) {
      console.warn(`[agentService] cancel ignored: no active run for session ${payload.sessionId}`);
      return;
    }
    if (active && payload.runId && active.runId !== payload.runId) {
      console.warn("[agentService] cancel ignored: stale runId");
      return;
    }
    if (!this.sessionStore.get(payload.sessionId)) {
      console.warn(`[agentService] cancel ignored: unknown session ${payload.sessionId}`);
      return;
    }
    if (active && this.runner) {
      await this.runner.cancel(payload.sessionId);
    }
    answerDeliveryCoordinator.cancelSession(payload.sessionId);
    if (active) {
      this.activeRuns.delete(payload.sessionId);
    }
  }

  async answerQuestion(input: AgentQuestionAnswerInput): Promise<ChatSession> {
    const session = this.sessionStore.get(input.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const prompt = resolvePendingQuestion(session, input.runId, input.payload.questionPromptId);
    if (!prompt) {
      return session;
    }

    if (this.isSessionBusy(input.sessionId)) {
      throw new Error("Cannot answer while an agent run is in progress");
    }

    const followUp = buildAskQuestionFollowUpText(prompt, input.payload);
    const withUserMessage = appendUserMessage(session, followUp);
    this.sessionStore.save(withUserMessage);

    try {
      const followUpSucceeded = await this.submitAndWaitForCompletion({
        sessionId: input.sessionId,
        content: followUp,
        workspacePath: session.workspacePath,
        mode: input.mode,
      });
      if (!followUpSucceeded) {
        throw new Error("Follow-up agent run failed");
      }
    } catch (error) {
      // Follow-up run failed; rollback to pre-answer session so the question stays pending.
      this.sessionStore.save(session);
      throw error;
    }

    let updated = this.sessionStore.get(input.sessionId) ?? withUserMessage;
    updated = updateAgentQuestionStatus(updated, input.payload.questionPromptId, "answered");
    this.sessionStore.save(updated);

    emitQuestionResolved(
      this.getWebContents(),
      input.sessionId,
      input.runId,
      input.payload.questionPromptId,
      "answered",
    );

    return this.sessionStore.get(input.sessionId) ?? updated;
  }

  async dismissQuestion(input: AgentQuestionDismissInput): Promise<ChatSession> {
    const session = this.sessionStore.get(input.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const prompt = resolvePendingQuestion(session, input.runId, input.questionPromptId);
    if (!prompt) {
      return session;
    }

    const updated = updateAgentQuestionStatus(session, input.questionPromptId, "dismissed");
    this.sessionStore.save(updated);

    emitQuestionResolved(
      this.getWebContents(),
      input.sessionId,
      input.runId,
      input.questionPromptId,
      "dismissed",
    );

    return this.sessionStore.get(input.sessionId) ?? updated;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (this.isSessionBusy(sessionId)) {
      await this.cancel({ sessionId });
    }
    if (this.runner) {
      await this.runner.closeSession(sessionId);
    }
  }

  async dispose(): Promise<void> {
    answerDeliveryCoordinator.cancelAll();
    const runner = this.runner;
    this.runner = null;
    this.runnerReady = null;
    this.activeRuns.clear();
    if (!runner) return;
    const results = await Promise.allSettled([
      runner.cancel(),
      Promise.resolve(runner.closeAllSessions()),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[agentService] dispose cleanup failed:", result.reason);
      }
    }
  }
}

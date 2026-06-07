import { v4 as uuidv4 } from "uuid";
import type { WebContents } from "electron";
import type { AgentMode, EditorContext } from "@mimica/shared";
import { toMessageContext } from "@mimica/shared";
import {
  AgentRunTimingTrace,
  isAgentPerfEnabled,
  type AgentRunner,
} from "@mimica/agent-orchestrator";
import { resolveWorkspacePath } from "./paths.js";
import { resolvePersonaSystemPrompt } from "./personaSetup.js";
import type { SessionStore } from "./sessionStore.js";
import { AgentRunEmitter, emitAgentEvent } from "./agentRunEmitter.js";
import { appendAssistantMessage, historyForAgentPrompt } from "./sessionMessages.js";
import { debugLogSlashResolution, resolveSlashInput } from "./cursorSlash/index.js";
import { readAttachmentBase64 } from "./imageAttachments.js";
import type { ChatAttachment } from "@mimica/shared";

export interface AgentSubmitPayload {
  sessionId: string;
  content: string;
  workspacePath: string;
  mode: AgentMode;
  editorContext?: EditorContext | null;
  attachments?: ChatAttachment[];
}

async function loadAgentRunner(): Promise<AgentRunner> {
  const { AgentRunner: Runner } = await import("@mimica/agent-orchestrator");
  return new Runner();
}

export class AgentService {
  private runner: AgentRunner | null = null;
  private runnerReady: Promise<AgentRunner> | null = null;
  private activeRunId: string | null = null;

  constructor(
    private readonly getWebContents: () => WebContents | undefined,
    private readonly sessionStore: SessionStore,
  ) {}

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

  async submit(payload: AgentSubmitPayload): Promise<void> {
    await this.cancel();

    const runId = uuidv4();
    this.activeRunId = runId;
    const wc = this.getWebContents();
    const emitter = new AgentRunEmitter(
      wc,
      payload.sessionId,
      runId,
      () => runId === this.activeRunId,
    );
    const runner = await this.getRunner();

    const editorContext = payload.editorContext;
    const context = editorContext
      ? toMessageContext(editorContext)
      : { workspacePath: payload.workspacePath };

    const session = this.sessionStore.get(payload.sessionId);
    const allMessages = session?.messages ?? [];
    const history = historyForAgentPrompt(allMessages, payload.content);

    const cwd = resolveWorkspacePath(
      editorContext?.workspacePath ?? payload.workspacePath ?? session?.workspacePath ?? "",
    );

    const resolved = resolveSlashInput(cwd, payload.content, payload.mode);
    if (resolved.warning) {
      emitter.warning(resolved.warning);
    }
    if (resolved.kind && resolved.name) {
      debugLogSlashResolution(resolved.kind, resolved.name, resolved.expanded.length);
    }

    const sdkImages: Array<{ data: string; mimeType: string }> = [];
    for (const attachment of payload.attachments ?? []) {
      try {
        sdkImages.push(readAttachmentBase64(payload.sessionId, attachment));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitter.warning(`画像を読み取れませんでした (${attachment.fileName}): ${message}`);
      }
    }

    let promptText = resolved.expanded;
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

    try {
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
          onComplete: (content) => {
            const current = this.sessionStore.get(payload.sessionId);
            if (current) {
              this.sessionStore.save(appendAssistantMessage(current, content, runId));
            }
            emitter.complete(content);
            this.activeRunId = null;
          },
          onError: (message) => {
            emitter.error(message);
            this.activeRunId = null;
          },
        },
      });
    } catch (error) {
      if (runId !== this.activeRunId) return;
      const message = error instanceof Error ? error.message : String(error);
      emitAgentEvent(wc, {
        type: "agent_error",
        sessionId: payload.sessionId,
        runId,
        message,
      });
    } finally {
      if (this.activeRunId === runId) {
        this.activeRunId = null;
      }
    }
  }

  async cancel(): Promise<void> {
    if (this.runner) {
      await this.runner.cancel();
    }
    this.activeRunId = null;
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.runner) return;
    await this.runner.closeSession(sessionId);
  }

  async dispose(): Promise<void> {
    const runner = this.runner;
    this.runner = null;
    this.runnerReady = null;
    this.activeRunId = null;
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

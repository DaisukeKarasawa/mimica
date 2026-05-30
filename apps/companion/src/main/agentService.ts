import { v4 as uuidv4 } from "uuid";
import type { WebContents } from "electron";
import type { AgentRunState, EditorContext } from "@mimica/shared";
import { toMessageContext } from "@mimica/shared";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import { expandHomePath } from "./paths.js";
import { resolvePersonaSystemPrompt } from "./personaSetup.js";
import type { SessionStore } from "./sessionStore.js";

export interface AgentSubmitPayload {
  sessionId: string;
  content: string;
  workspacePath: string;
  editorContext?: EditorContext | null;
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
    const runner = await this.getRunner();

    const emitState = (state: AgentRunState) => {
      wc?.send("agent-event", {
        type: "agent_state",
        sessionId: payload.sessionId,
        state,
        runId,
      });
    };

    const editorContext = payload.editorContext;
    const context = editorContext
      ? toMessageContext(editorContext)
      : { workspacePath: payload.workspacePath };

    const session = this.sessionStore.get(payload.sessionId);
    const allMessages = session?.messages ?? [];
    const last = allMessages.at(-1);
    const history =
      last?.role === "user" && last.content === payload.content
        ? allMessages.slice(0, -1)
        : allMessages;

    const cwd = expandHomePath(context.workspacePath ?? payload.workspacePath);

    await runner.runChat({
      prompt: payload.content,
      workspacePath: cwd,
      context,
      history,
      personaSystemPrompt: resolvePersonaSystemPrompt(),
      callbacks: {
        onState: emitState,
        onDelta: (chunk) => {
          wc?.send("agent-event", {
            type: "agent_delta",
            sessionId: payload.sessionId,
            runId,
            content: chunk,
          });
        },
        onTool: (name, detail) => {
          wc?.send("agent-event", {
            type: "agent_tool",
            sessionId: payload.sessionId,
            runId,
            name,
            detail,
          });
        },
        onComplete: (content) => {
          wc?.send("agent-event", {
            type: "agent_complete",
            sessionId: payload.sessionId,
            runId,
            content,
          });
          this.activeRunId = null;
        },
        onError: (message) => {
          wc?.send("agent-event", {
            type: "agent_error",
            sessionId: payload.sessionId,
            runId,
            message,
          });
          this.activeRunId = null;
        },
      },
    });
  }

  async cancel(): Promise<void> {
    if (this.runner) {
      await this.runner.cancel();
    }
    this.activeRunId = null;
  }
}

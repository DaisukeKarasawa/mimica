import type { Run } from "@cursor/sdk";
import type { ChatMessage, MessageContext } from "@mimica/shared";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { createCursorAgent } from "./createCursorAgent.js";
import { ensureReadOnlyHooks } from "./ensureReadOnlyHooks.js";
import { buildContextPrompt } from "./eventMapper.js";
import {
  handleSendToolDelta,
  processAgentStream,
  resolveFinalAssistantText,
} from "./processAgentStream.js";
import {
  READ_ONLY_HOOK_INSTALL_WARNING,
  READ_ONLY_TOOL_ERROR,
} from "./readOnlyPolicy.js";
import { resolveCursorApiKey } from "./resolveApiKey.js";

export type { AgentRunCallbacks } from "./agentCallbacks.js";

export interface RunChatParams {
  prompt: string;
  workspacePath: string;
  context?: MessageContext;
  history?: ChatMessage[];
  apiKey?: string;
  /** Persona pack (SKILL.md + style/lines). When set, 調月リオの口調ルールを適用 */
  personaSystemPrompt?: string;
  callbacks: AgentRunCallbacks;
  signal?: AbortSignal;
}

const READ_ONLY_PREAMBLE = `You are the Mimica coding companion (調月リオ UI). Read-only mode: do not create, edit, delete, or run commands that modify the workspace. You may read and analyze files.

CRITICAL output rule for the user-visible message:
- Output ONLY the final answer in 調月リオ persona (short intro + substantive reply + optional short closing).
- NEVER write planning, process narration, or tool preamble to the user. Forbidden examples: 「調べます」「確認します」「ペルソナ設定を確認」「ワークスペースを読み取ります」「最新の情報を取得します」.
- Do planning silently via tools. The user must not see your internal steps.
- Format the substantive reply as GitHub-Flavored Markdown: use blank lines between sections; tables must have one row per line (never collapse table rows onto a single line).

Reply in Japanese when the user writes in Japanese. Follow the persona instructions below.`;

function buildHistoryPrompt(messages: ChatMessage[]): string {
  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (turns.length === 0) return "";
  const lines = turns.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content.trim()}`;
  });
  return `## Conversation history\n${lines.join("\n\n")}`;
}

export class AgentRunner {
  private activeRun: Run | null = null;
  private cancelled = false;

  async runChat(params: RunChatParams): Promise<void> {
    const apiKey = params.apiKey ?? resolveCursorApiKey();
    if (!apiKey) {
      params.callbacks.onError("CURSOR_API_KEY が設定されていません");
      params.callbacks.onState("failed");
      return;
    }

    this.cancelled = false;
    const fullPrompt = this.buildFullPrompt(params);

    params.callbacks.onState("thinking");

    const hooksResult = await ensureReadOnlyHooks(params.workspacePath);
    if (!hooksResult.ok) {
      params.callbacks.onWarning?.(
        `${READ_ONLY_HOOK_INSTALL_WARNING} (${hooksResult.message})`,
      );
    }

    let agent: Awaited<ReturnType<typeof createCursorAgent>>;
    try {
      agent = await createCursorAgent({ apiKey, workspacePath: params.workspacePath });
    } catch (err) {
      params.callbacks.onState("failed");
      params.callbacks.onError(err instanceof Error ? err.message : String(err));
      return;
    }

    try {
      let writeToolBlocked = false;
      const blockWriteTool = async (name: string): Promise<void> => {
        if (writeToolBlocked) return;
        writeToolBlocked = true;
        await this.activeRun?.cancel();
        params.callbacks.onState("failed");
        params.callbacks.onError(READ_ONLY_TOOL_ERROR(name));
      };

      let run!: Run;
      run = await agent.send(fullPrompt, {
        onDelta: async ({ update }) => {
          const blocked = await handleSendToolDelta({
            update,
            run,
            writeToolBlocked,
            isCancelled: () => this.cancelled,
            signal: params.signal,
            blockWriteTool,
          });
          if (blocked) writeToolBlocked = true;
        },
      });
      this.activeRun = run;

      const streamResult = await processAgentStream({
        run,
        callbacks: params.callbacks,
        signal: params.signal,
        isCancelled: () => this.cancelled,
      });

      if (streamResult.writeToolBlocked || writeToolBlocked) {
        return;
      }

      const result = await run.wait();
      if (result.status === "cancelled") {
        params.callbacks.onState("cancelled");
        return;
      }
      if (result.status === "error") {
        params.callbacks.onState("failed");
        params.callbacks.onError(result.result ?? "Agent の実行に失敗しました");
        return;
      }

      const finalText = resolveFinalAssistantText(
        streamResult.sawToolCall,
        streamResult.preToolText,
        streamResult.postToolText,
        result.result,
      );

      params.callbacks.onState("completed");
      params.callbacks.onComplete(finalText);
    } catch (err) {
      params.callbacks.onState("failed");
      params.callbacks.onError(err instanceof Error ? err.message : String(err));
    } finally {
      this.activeRun = null;
      agent.close();
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    await this.activeRun?.cancel();
  }

  private buildFullPrompt(params: RunChatParams): string {
    const contextBlock = params.context ? buildContextPrompt(params.context) : "";
    const historyBlock = params.history ? buildHistoryPrompt(params.history) : "";
    return [
      READ_ONLY_PREAMBLE,
      params.personaSystemPrompt,
      historyBlock,
      contextBlock,
      `## User message\n${params.prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
}

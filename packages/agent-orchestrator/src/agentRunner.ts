import { Agent } from "@cursor/sdk";
import type { Run } from "@cursor/sdk";
import type { AgentRunState, ChatMessage, MessageContext } from "@mimica/shared";
import { ensureReadOnlyHooks } from "./ensureReadOnlyHooks.js";
import { buildContextPrompt } from "./eventMapper.js";
import { resolveCursorApiKey } from "./resolveApiKey.js";
import { isWriteTool, READ_ONLY_TOOL_ERROR } from "./readOnlyTools.js";
import { stripMetaNarration } from "./userFacingText.js";

export interface AgentRunCallbacks {
  onState: (state: AgentRunState) => void;
  onDelta: (chunk: string) => void;
  onComplete: (content: string) => void;
  onError: (message: string) => void;
  onTool?: (name: string, detail?: string) => void;
}

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

function streamVisibleText(
  accumulated: string,
  visibleLen: number,
  onDelta: (chunk: string) => void,
): { text: string; visibleLen: number } {
  const visible = stripMetaNarration(accumulated);
  const delta = visible.slice(visibleLen);
  if (delta) onDelta(delta);
  return { text: accumulated, visibleLen: visible.length };
}

function toolCallName(toolCall: unknown): string | undefined {
  if (!toolCall || typeof toolCall !== "object") return undefined;
  const record = toolCall as Record<string, unknown>;
  for (const key of ["toolName", "name", "type"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function isBlockedToolCallStatus(status: string | undefined): boolean {
  return status !== "completed" && status !== "error";
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
    const contextBlock = params.context ? buildContextPrompt(params.context) : "";
    const historyBlock = params.history ? buildHistoryPrompt(params.history) : "";
    const fullPrompt = [
      READ_ONLY_PREAMBLE,
      params.personaSystemPrompt,
      historyBlock,
      contextBlock,
      `## User message\n${params.prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    params.callbacks.onState("thinking");

    try {
      await ensureReadOnlyHooks(params.workspacePath);
    } catch {
      // Hook install failure is non-fatal; stream/onDelta checks remain as fallback.
    }

    const localOptions = {
      cwd: params.workspacePath,
      settingSources: [] as const,
      sandboxOptions: { enabled: true },
    };

    let agent: Awaited<ReturnType<typeof Agent.create>>;
    try {
      agent = await Agent.create({
        apiKey,
        model: { id: "composer-2.5" },
        local: localOptions,
        name: "Mimica",
      });
    } catch {
      try {
        agent = await Agent.create({
          apiKey,
          model: { id: "composer-2.5" },
          local: { cwd: params.workspacePath, settingSources: [] },
          name: "Mimica",
        });
      } catch (err) {
        params.callbacks.onState("failed");
        params.callbacks.onError(err instanceof Error ? err.message : String(err));
        return;
      }
    }

    try {
      let writeToolBlocked = false;
      const blockWriteTool = async (run: Run, name: string): Promise<void> => {
        if (writeToolBlocked) return;
        writeToolBlocked = true;
        await run.cancel();
        params.callbacks.onState("failed");
        params.callbacks.onError(READ_ONLY_TOOL_ERROR(name));
      };

      let run!: Run;
      run = await agent.send(fullPrompt, {
        onDelta: async ({ update }) => {
          if (writeToolBlocked || this.cancelled || params.signal?.aborted) return;
          if (update.type !== "tool-call-started" && update.type !== "partial-tool-call") {
            return;
          }
          const name = toolCallName(update.toolCall);
          if (name && isWriteTool(name)) {
            await blockWriteTool(run, name);
          }
        },
      });
      this.activeRun = run;

      let sawToolCall = false;
      let preToolText = "";
      let postToolText = "";
      let preToolVisibleLen = 0;
      let postToolVisibleLen = 0;

      for await (const event of run.stream()) {
        if (writeToolBlocked) {
          return;
        }

        if (this.cancelled || params.signal?.aborted) {
          await run.cancel();
          params.callbacks.onState("cancelled");
          return;
        }

        if (event.type === "request") {
          params.callbacks.onState("waiting");
          continue;
        }

        if (event.type === "tool_call") {
          if (isWriteTool(event.name) && isBlockedToolCallStatus(event.status)) {
            await blockWriteTool(run, event.name);
            return;
          }

          if (event.status === "running") {
            sawToolCall = true;
            params.callbacks.onState("thinking");
            params.callbacks.onTool?.(event.name, event.status);
          }
          continue;
        }

        if (event.type === "thinking" || event.type === "task") {
          params.callbacks.onState("thinking");
          continue;
        }

        if (event.type !== "assistant") continue;

        params.callbacks.onState("streaming");
        for (const block of event.message.content) {
          if (block.type !== "text" || !block.text) continue;

          if (!sawToolCall) {
            preToolText += block.text;
            const streamed = streamVisibleText(preToolText, preToolVisibleLen, params.callbacks.onDelta);
            preToolVisibleLen = streamed.visibleLen;
            continue;
          }

          postToolText += block.text;
          const streamed = streamVisibleText(postToolText, postToolVisibleLen, params.callbacks.onDelta);
          postToolVisibleLen = streamed.visibleLen;
        }
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

      let finalText = stripMetaNarration(sawToolCall ? postToolText : preToolText);
      if (!finalText.trim()) {
        finalText = stripMetaNarration(result.result ?? preToolText + postToolText);
      }

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
}

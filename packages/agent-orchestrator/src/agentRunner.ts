import { Agent } from "@cursor/sdk";
import type { Run } from "@cursor/sdk";
import type { AgentRunState, ChatMessage, MessageContext } from "@mimica/shared";
import { buildContextPrompt } from "./eventMapper.js";
import { resolveCursorApiKey } from "./resolveApiKey.js";
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

const WRITE_TOOL_RE =
  /^(write|edit|delete|shell|run_terminal|terminal|apply_patch|create|str_replace|patch|execute)/i;

function isWriteTool(name: string): boolean {
  return WRITE_TOOL_RE.test(name);
}

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

    let agent: Awaited<ReturnType<typeof Agent.create>>;
    try {
      agent = await Agent.create({
        apiKey,
        model: { id: "composer-2.5" },
        local: {
          cwd: params.workspacePath,
          sandboxOptions: { enabled: true },
        },
        name: "Mimica",
      });
    } catch {
      agent = await Agent.create({
        apiKey,
        model: { id: "composer-2.5" },
        local: { cwd: params.workspacePath },
        name: "Mimica",
      });
    }

    try {
      const run = await agent.send(fullPrompt);
      this.activeRun = run;

      let sawToolCall = false;
      let preToolText = "";
      let postToolText = "";
      let preToolVisibleLen = 0;
      let postToolVisibleLen = 0;

      for await (const event of run.stream()) {
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
          if (event.status === "running" && isWriteTool(event.name)) {
            await run.cancel();
            params.callbacks.onState("failed");
            params.callbacks.onError(
              `Read-only mode: ツール "${event.name}" は MVP では利用できません`,
            );
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

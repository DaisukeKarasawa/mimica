import type { AgentMode, ChatMessage, MessageContext } from "@mimica/shared";
import { buildContextPrompt } from "./eventMapper.js";
import { promptStrategyForFollowUp } from "./promptStrategy.js";
import { trimChatHistoryForPrompt } from "./trimChatHistory.js";

export interface BuildAgentPromptParams {
  prompt: string;
  mode: AgentMode;
  context?: MessageContext;
  history?: ChatMessage[];
  personaSystemPrompt?: string;
}

const OUTPUT_RULES = `CRITICAL output rule for the user-visible message:
- Output ONLY the final answer in 調月リオ persona using three layers:
  - **Strong (C)**: short intro (≤1 sentence), optional short closing (≤1 sentence), status-style reactions.
  - **Light (B)**: explanatory prose — conclusions, reasoning, comparisons, trade-offs, recommendations, cautions. Use 先生/貴方, tone (～わ/～わね), and 合理/非合理 framing where natural.
  - **Neutral (A)**: code blocks, commands, tables of facts, API specs, step/checklist bullets, error log quotes — no character voice.
- NEVER write planning, process narration, or tool preamble to the user. Forbidden examples: 「調べます」「確認します」「ペルソナ設定を確認」「ワークスペースを読み取ります」「最新の情報を取得します」.
- Do planning silently via tools. The user must not see your internal steps.
- Format the substantive reply as GitHub-Flavored Markdown: use blank lines between sections; tables must have one row per line (never collapse table rows onto a single line).

Reply in Japanese when the user writes in Japanese. Follow the persona instructions below.`;

const FOLLOW_UP_PERSONA_REMINDER = `Persona reminder (調月リオ): Strong persona on intro/closing; light persona on explanatory prose (reasons, comparisons, conclusions); keep code, commands, tables, and step lists neutral.`;

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

function buildHistoryPrompt(messages: ChatMessage[]): string {
  const turns = trimChatHistoryForPrompt(messages);
  if (turns.length === 0) return "";
  const lines = turns.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content.trim()}`;
  });
  return `## Conversation history\n${lines.join("\n\n")}`;
}

export function buildAgentFullPrompt(params: BuildAgentPromptParams, isFollowUp: boolean): string {
  const contextBlock = params.context ? buildContextPrompt(params.context) : "";

  if (promptStrategyForFollowUp(isFollowUp) === "followUp") {
    return [
      preambleForMode(params.mode),
      FOLLOW_UP_PERSONA_REMINDER,
      params.personaSystemPrompt,
      contextBlock,
      `## User message\n${params.prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
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

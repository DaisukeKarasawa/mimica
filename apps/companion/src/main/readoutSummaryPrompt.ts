import type { WebContents } from "electron";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import { resolveTuttiSpeakerId, type TuttiSpeakerId } from "@mimica/shared";
import { MAX_SPEECH_CHARS } from "./readoutText.js";

const MAX_ANSWER_CONTEXT_CHARS = 6_000;

const SPEAKER_VOICE_GUIDE: Record<TuttiSpeakerId, string> = {
  rio: [
    "話者: 調月リオ。一人称「私」。二人称は「先生」。",
    "冷静で分析的な口調。文末は「わ」「かしら」「のだけれど」「ね」「でしょう？」などを自然に混ぜる。",
    "合理・結論・要点を短く。感情は「……」で控えめに。",
  ].join("\n"),
  mari: [
    "話者: マリ。敬虔で穏やかな丁寧語（です・ます）。二人称は「先生」。",
    "祈りと平和の語り口。柔らかく、励ましと配慮を一言入れてよい。",
  ].join("\n"),
  mine: [
    "話者: 蒼森ミネ。礼節正しい騎士団長口調（です・ます）。二人称は「先生」。",
    "落ち着きと温かみ。任務感と気遣いを短く表す。",
  ].join("\n"),
};

function speakerGuide(speaker: string): string {
  return SPEAKER_VOICE_GUIDE[resolveTuttiSpeakerId(speaker)];
}

export function buildReadoutSummaryPrompt(answerMarkdown: string, speaker: string): string {
  const context =
    answerMarkdown.length > MAX_ANSWER_CONTEXT_CHARS
      ? `${answerMarkdown.slice(0, MAX_ANSWER_CONTEXT_CHARS)}…`
      : answerMarkdown;

  return [
    "You produce a short Japanese script for text-to-speech (voice readout).",
    "The user already sees the full technical answer in chat; your script is ONLY for audio.",
    "",
    "Hard rules:",
    `- Output ONLY plain Japanese prose (no markdown, bullets, code, paths, URLs, English identifiers).`,
    `- At most ${MAX_SPEECH_CHARS} characters total, ideally 1–3 short sentences.`,
    "- Summarize the conclusion and one key reason; omit steps, stack traces, and implementation detail.",
    "- Do not use tools. Do not ask questions. No preamble like 「要約します」.",
    "",
    speakerGuide(speaker),
    "",
    "## Full answer (reference only — do not read verbatim)",
    context,
    "",
    "## Output",
    "Spoken summary in character voice:",
  ].join("\n");
}

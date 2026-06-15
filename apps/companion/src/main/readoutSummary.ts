import type { AgentRunner } from "@mimica/agent-orchestrator";
import { buildReadoutSummaryPrompt } from "./readoutSummaryPrompt.js";
import { parseEnvBool } from "./envBool.js";
import { MAX_SPEECH_CHARS, prepareReadoutText, summarizeForReadout } from "./readoutText.js";

const READOUT_SUMMARY_TIMEOUT_MS = 60_000;
const LOG_PREFIX = "[readoutSummary]";
const ABORT_ERROR_MESSAGE = "readout summary aborted";

export interface GenerateReadoutSummaryParams {
  runner: AgentRunner;
  workspacePath: string;
  sessionId: string;
  runId: string;
  answerMarkdown: string;
  speaker: string;
  signal?: AbortSignal;
}

function isLlmSummaryEnabled(): boolean {
  return parseEnvBool(process.env.MIMICA_READOUT_LLM_SUMMARY) ?? true;
}

function normalizeLlmReadout(text: string): string {
  const plain = prepareReadoutText(text);
  if (!plain) return "";
  if (plain.length <= MAX_SPEECH_CHARS) return plain;
  return summarizeForReadout(plain, MAX_SPEECH_CHARS);
}

async function runLlmReadoutSummary(params: GenerateReadoutSummaryParams): Promise<string> {
  const ephemeralSessionId = `${params.sessionId}__readout__${params.runId}`;
  let latest = "";

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      void params.runner
        .runChat({
          sessionId: ephemeralSessionId,
          workspacePath: params.workspacePath,
          mode: "ask",
          prompt: "",
          fullPromptOverride: buildReadoutSummaryPrompt(params.answerMarkdown, params.speaker),
          signal: params.signal,
          callbacks: {
            onState: () => {},
            onDelta: (chunk) => {
              latest += chunk;
            },
            onComplete: (content) => {
              latest = content;
              finish(resolve);
            },
            onError: (error) => {
              finish(() => reject(new Error(error.detail ?? error.kind)));
            },
          },
        })
        .catch((error: unknown) => {
          finish(() => reject(error));
        });
    });

    return normalizeLlmReadout(latest);
  } finally {
    await params.runner.closeSession(ephemeralSessionId);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("readout summary timed out")), ms);
    const onAbort = () => reject(new Error(ABORT_ERROR_MESSAGE));
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    promise
      .then((value) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}

/**
 * Build TTS text from the full assistant answer. Uses a silent ask-mode agent turn;
 * falls back to mechanical excerpt on failure.
 */
export async function generateReadoutSummary(
  params: GenerateReadoutSummaryParams,
): Promise<string> {
  const fallback = summarizeForReadout(params.answerMarkdown);
  if (!fallback) return "";
  if (!isLlmSummaryEnabled()) return fallback;

  try {
    const llmText = await withTimeout(
      runLlmReadoutSummary(params),
      READOUT_SUMMARY_TIMEOUT_MS,
      params.signal,
    );
    if (llmText.trim()) {
      console.info(`${LOG_PREFIX} LLM summary (${llmText.length} chars)`);
      return llmText;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== ABORT_ERROR_MESSAGE) {
      console.warn(`${LOG_PREFIX} LLM failed, using mechanical excerpt:`, message);
    }
  }

  return fallback;
}

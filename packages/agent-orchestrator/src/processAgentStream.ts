import type { Run } from "@cursor/sdk";
import { cancelRun, isAbortError } from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import type { ReadOnlyRunGuard } from "./readOnlyRunGuard.js";
import { streamVisibleText } from "./streamVisibleText.js";
import { stripMetaNarration } from "./userFacingText.js";

export interface ProcessAgentStreamResult {
  sawToolCall: boolean;
  preToolText: string;
  postToolText: string;
}

export async function processAgentStream(params: {
  run: Run;
  callbacks: AgentRunCallbacks;
  signal?: AbortSignal;
  isCancelled: () => boolean;
  readOnlyGuard?: ReadOnlyRunGuard;
}): Promise<ProcessAgentStreamResult> {
  const { run, callbacks, signal, isCancelled, readOnlyGuard } = params;
  let sawToolCall = false;
  let preToolText = "";
  let postToolText = "";
  let preToolVisible = "";
  let postToolVisible = "";

  try {
    for await (const event of run.stream()) {
      if (readOnlyGuard?.isBlocked) break;

      if (isCancelled() || signal?.aborted) {
        await cancelRun(run);
        callbacks.onState("cancelled");
        return { sawToolCall, preToolText, postToolText };
      }

      if (event.type === "request") {
        callbacks.onState("waiting");
        continue;
      }

      if (event.type === "tool_call") {
        if (readOnlyGuard) {
          const blocked = await readOnlyGuard.handleStreamToolCall(event.name, event.status);
          if (blocked) break;
        }

        if (event.status === "running") {
          sawToolCall = true;
          callbacks.onState("thinking");
          callbacks.onTool?.(event.name, event.status);
        }
        continue;
      }

      if (event.type === "thinking" || event.type === "task") {
        callbacks.onState("thinking");
        continue;
      }

      if (event.type !== "assistant") continue;

      callbacks.onState("streaming");
      for (const block of event.message.content) {
        if (block.type !== "text" || !block.text) continue;

        if (!sawToolCall) {
          preToolText += block.text;
          const streamed = streamVisibleText(preToolText, preToolVisible, callbacks.onDelta);
          preToolVisible = streamed.visible;
        } else {
          postToolText += block.text;
          const streamed = streamVisibleText(postToolText, postToolVisible, callbacks.onDelta);
          postToolVisible = streamed.visible;
        }
      }
    }
  } catch (err) {
    if (isAbortError(err) || isCancelled() || signal?.aborted) {
      callbacks.onState("cancelled");
      return { sawToolCall, preToolText, postToolText };
    }
    throw err;
  }

  return { sawToolCall, preToolText, postToolText };
}

export function resolveFinalAssistantText(
  sawToolCall: boolean,
  preToolText: string,
  postToolText: string,
  resultText: string | undefined,
): string {
  let finalText = stripMetaNarration(sawToolCall ? postToolText : preToolText);
  if (!finalText.trim()) {
    finalText = stripMetaNarration(resultText ?? preToolText + postToolText);
  }
  return finalText;
}

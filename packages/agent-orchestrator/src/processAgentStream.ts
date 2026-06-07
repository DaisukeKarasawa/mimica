import type { Run } from "@cursor/sdk";
import { cancelRun, isAbortError, trackIntentionalCancelPromise } from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import type { AgentRunTimingTrace } from "./agentRunTiming.js";
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
  timing?: AgentRunTimingTrace;
}): Promise<ProcessAgentStreamResult> {
  const { run, callbacks, signal, isCancelled, readOnlyGuard, timing } = params;
  let sawToolCall = false;
  let preToolText = "";
  let postToolText = "";
  let preToolVisible = "";
  let postToolVisible = "";

  const consumeStream = async (): Promise<void> => {
    for await (const event of run.stream()) {
      if (readOnlyGuard?.isBlocked) break;

      if (isCancelled() || signal?.aborted) {
        await cancelRun(run);
        callbacks.onState("cancelled");
        return;
      }

      if (event.type === "request") {
        callbacks.onState("waiting");
        continue;
      }

      if (event.type === "tool_call") {
        timing?.markOnce("T2_first_activity");
        if (readOnlyGuard) {
          const blocked = await readOnlyGuard.handleStreamToolCall(event.name, event.status);
          if (blocked) break;
        }

        if (event.status === "running") {
          sawToolCall = true;
          timing?.markOnce("T2_first_tool");
          callbacks.onState("thinking");
          callbacks.onTool?.(event.name, event.status);
        }
        if (event.status === "completed") {
          timing?.markLatest("T3_last_tool_done");
        }
        continue;
      }

      if (event.type === "task") {
        timing?.markOnce("T2_first_activity");
        if (readOnlyGuard) {
          await readOnlyGuard.blockDeniedTask();
          break;
        }
        callbacks.onState("thinking");
        continue;
      }

      if (event.type === "thinking") {
        timing?.markOnce("T2_first_activity");
        callbacks.onState("thinking");
        continue;
      }

      if (event.type !== "assistant") continue;

      timing?.markOnce("T2_first_activity");
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
  };

  try {
    await trackIntentionalCancelPromise(consumeStream());
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

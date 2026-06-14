import type { Run } from "@cursor/sdk";
import {
  cancelRun,
  isIntentionalCancellationError,
  trackIntentionalCancelPromise,
} from "./abortError.js";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import type { AgentRunTimingTrace } from "./agentRunTiming.js";
import type { ReadOnlyRunGuard } from "./readOnlyRunGuard.js";
import { streamVisibleText } from "./streamVisibleText.js";
import { formatToolCallDetail } from "./toolCallDetail.js";
import { tryParseAskQuestionStreamEvent } from "./toolCallStreamQuestionAdapter.js";
import { stripMetaNarration } from "./userFacingText.js";

export interface ProcessAgentStreamResult {
  sawToolCall: boolean;
  preToolText: string;
  postToolText: string;
}

type StreamEvent = Awaited<ReturnType<Run["stream"]>> extends AsyncIterable<infer E> ? E : never;

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

  const markFirstActivity = () => {
    timing?.markOnce("T2_first_activity");
  };

  const setThinking = () => {
    callbacks.onState("thinking");
  };

  const handleToolCall = async (
    event: Extract<StreamEvent, { type: "tool_call" }>,
  ): Promise<boolean> => {
    markFirstActivity();
    if (readOnlyGuard) {
      const blocked = await readOnlyGuard.handleStreamToolCall(event.name, event.status);
      if (blocked) return true;
    }

    if (event.status === "running") {
      sawToolCall = true;
      timing?.markOnce("T2_first_tool");
      const toolEvent = {
        type: "tool_call" as const,
        name: event.name,
        status: event.status,
        args: "args" in event ? event.args : undefined,
        runId: run.id,
        toolCallId:
          "callId" in event && typeof event.callId === "string" ? event.callId : undefined,
      };
      const prompt = tryParseAskQuestionStreamEvent(toolEvent);
      if (prompt) {
        callbacks.onQuestion?.(prompt);
        callbacks.onState("waiting");
      } else {
        setThinking();
      }
      callbacks.onTool?.(
        event.name,
        formatToolCallDetail(event.name, event.status, toolEvent.args),
      );
    }
    if (event.status === "completed") {
      timing?.markLatest("T3_last_tool_done");
      callbacks.onTool?.(
        event.name,
        formatToolCallDetail(event.name, event.status, "args" in event ? event.args : undefined),
      );
    }
    return false;
  };

  const handleDeniedStreamEvent = async (toolName: string): Promise<boolean> => {
    markFirstActivity();
    if (readOnlyGuard) {
      await readOnlyGuard.blockDeniedTool(toolName);
      return true;
    }
    setThinking();
    return false;
  };

  const handleAssistant = (event: Extract<StreamEvent, { type: "assistant" }>): void => {
    markFirstActivity();
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
  };

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

      let shouldBreak = false;
      switch (event.type) {
        case "tool_call":
          shouldBreak = await handleToolCall(event);
          break;
        case "task":
          shouldBreak = await handleDeniedStreamEvent("task");
          break;
        case "thinking":
          markFirstActivity();
          setThinking();
          break;
        case "assistant":
          handleAssistant(event);
          break;
        default:
          break;
      }
      if (shouldBreak) break;
    }
  };

  try {
    await trackIntentionalCancelPromise(consumeStream());
  } catch (err) {
    if (isIntentionalCancellationError(err) || isCancelled() || signal?.aborted) {
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

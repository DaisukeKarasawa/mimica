import type { Run } from "@cursor/sdk";
import type { AgentRunCallbacks } from "./agentCallbacks.js";
import { isWriteTool, READ_ONLY_TOOL_ERROR } from "./readOnlyPolicy.js";
import { streamVisibleText } from "./streamVisibleText.js";
import { isBlockedToolCallStatus, toolCallName } from "./toolCallName.js";
import { stripMetaNarration } from "./userFacingText.js";

export interface ProcessAgentStreamResult {
  sawToolCall: boolean;
  preToolText: string;
  postToolText: string;
  writeToolBlocked: boolean;
}

export async function processAgentStream(params: {
  run: Run;
  callbacks: AgentRunCallbacks;
  signal?: AbortSignal;
  isCancelled: () => boolean;
}): Promise<ProcessAgentStreamResult> {
  const { run, callbacks, signal, isCancelled } = params;
  let writeToolBlocked = false;
  let sawToolCall = false;
  let preToolText = "";
  let postToolText = "";
  let preToolVisible = "";
  let postToolVisible = "";

  const blockWriteTool = async (name: string): Promise<void> => {
    if (writeToolBlocked) return;
    writeToolBlocked = true;
    await run.cancel();
    callbacks.onState("failed");
    callbacks.onError(READ_ONLY_TOOL_ERROR(name));
  };

  for await (const event of run.stream()) {
    if (writeToolBlocked) break;

    if (isCancelled() || signal?.aborted) {
      await run.cancel();
      callbacks.onState("cancelled");
      return { sawToolCall, preToolText, postToolText, writeToolBlocked: true };
    }

    if (event.type === "request") {
      callbacks.onState("waiting");
      continue;
    }

    if (event.type === "tool_call") {
      if (isWriteTool(event.name) && isBlockedToolCallStatus(event.status)) {
        await blockWriteTool(event.name);
        break;
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

  return { sawToolCall, preToolText, postToolText, writeToolBlocked };
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

export async function handleSendToolDelta(params: {
  update: { type: string; toolCall?: unknown };
  run: Run;
  writeToolBlocked: boolean;
  isCancelled: () => boolean;
  signal?: AbortSignal;
  blockWriteTool: (name: string) => Promise<void>;
}): Promise<boolean> {
  const { update, writeToolBlocked, isCancelled, signal } = params;
  if (writeToolBlocked || isCancelled() || signal?.aborted) return true;
  if (update.type !== "tool-call-started" && update.type !== "partial-tool-call") {
    return false;
  }
  const name = toolCallName(update.toolCall);
  if (name && isWriteTool(name)) {
    await params.blockWriteTool(name);
    return true;
  }
  return false;
}

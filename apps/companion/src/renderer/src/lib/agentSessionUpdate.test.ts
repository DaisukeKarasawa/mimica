import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentQuestionPrompt, ChatSession } from "@mimica/shared";
import { applyAgentDelta } from "./agentSessionUpdate.js";

const pendingQuestion = {
  id: "q-1",
  runId: "run-1",
  title: "Choose one",
  prompt: "Pick an option",
  options: [{ id: "opt-a", label: "A" }],
  status: "pending",
  source: "tool_call_stream",
} satisfies AgentQuestionPrompt;

function sessionWithQuestion(): ChatSession {
  return {
    id: "session-1",
    title: "Test",
    workspacePath: "/tmp/ws",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [
      {
        id: "stream-1",
        role: "assistant",
        content: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        agentRunId: "run-1",
        agentQuestion: pendingQuestion,
      },
    ],
  };
}

describe("applyAgentDelta", () => {
  it("preserves agentQuestion when rebuilding the stream bubble", () => {
    const sessions = [sessionWithQuestion()];
    const updated = applyAgentDelta(sessions, "session-1", "run-1", "stream-1", "");
    const message = updated[0]!.messages[0]!;

    assert.equal(message.agentQuestion?.id, "q-1");
    assert.equal(message.agentQuestion?.status, "pending");
  });

  it("preserves toolCalls when rebuilding the stream bubble", () => {
    const sessions: ChatSession[] = [
      {
        ...sessionWithQuestion(),
        messages: [
          {
            id: "stream-1",
            role: "assistant",
            content: "partial",
            createdAt: "2026-01-01T00:00:00.000Z",
            agentRunId: "run-1",
            toolCalls: [{ id: "tool-1", name: "Read", detail: "file.ts" }],
          },
        ],
      },
    ];

    const updated = applyAgentDelta(sessions, "session-1", "run-1", "stream-1", "next");
    const message = updated[0]!.messages[0]!;

    assert.equal(message.content, "next");
    assert.deepEqual(message.toolCalls, [{ id: "tool-1", name: "Read", detail: "file.ts" }]);
  });
});

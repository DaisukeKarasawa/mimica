import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentQuestionPrompt, ChatSession } from "@mimica/shared";
import { applyAgentDelta, applyAgentTool } from "./agentSessionUpdate.js";

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

describe("applyAgentTool", () => {
  const baseSession: ChatSession = {
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
      },
    ],
  };

  it("updates the latest running tool call when completed arrives", () => {
    const withRunning = applyAgentTool(
      [baseSession],
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "running · file.ts",
    );
    const withCompleted = applyAgentTool(
      withRunning,
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "completed · file.ts",
    );
    const toolCalls = withCompleted[0]!.messages[0]!.toolCalls ?? [];

    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0]?.detail, "completed · file.ts");
    assert.equal(toolCalls[0]?.id, withRunning[0]!.messages[0]!.toolCalls?.[0]?.id);
  });

  it("keeps separate entries for sequential calls with the same tool name", () => {
    let sessions = applyAgentTool(
      [baseSession],
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "running · a.ts",
    );
    sessions = applyAgentTool(
      sessions,
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "completed · a.ts",
    );
    sessions = applyAgentTool(
      sessions,
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "running · b.ts",
    );
    sessions = applyAgentTool(
      sessions,
      "session-1",
      "run-1",
      "stream-1",
      "",
      "Read",
      "completed · b.ts",
    );

    const toolCalls = sessions[0]!.messages[0]!.toolCalls ?? [];
    assert.equal(toolCalls.length, 2);
    assert.equal(toolCalls[0]?.detail, "completed · a.ts");
    assert.equal(toolCalls[1]?.detail, "completed · b.ts");
  });
});

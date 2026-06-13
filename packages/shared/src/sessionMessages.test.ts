import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatSession } from "./chat.js";
import { upsertAssistantTurn } from "./sessionMessages.js";

function makeSession(messages: ChatSession["messages"] = []): ChatSession {
  return {
    id: "s1",
    title: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages,
  };
}

describe("upsertAssistantTurn", () => {
  it("replaces partial stream content with error message for the same runId", () => {
    const session = makeSession([
      { id: "u1", role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "stream-run-1",
        role: "assistant",
        content: "partial…",
        createdAt: "2026-01-01T00:00:01.000Z",
        agentRunId: "run-1",
      },
    ]);

    const updated = upsertAssistantTurn(session, {
      runId: "run-1",
      content: "……想定外ね。\n\nAgent の実行に失敗しました。",
      streamId: "stream-run-1",
    });

    assert.equal(updated.messages.length, 2);
    assert.match(updated.messages[1]?.content ?? "", /想定外/);
    assert.equal(updated.messages[1]?.agentRunId, "run-1");
  });

  it("is idempotent when persisting the same error twice", () => {
    const session = makeSession([
      { id: "u1", role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const errorText = "……設定が足りないわね。\n\nCURSOR_API_KEY が設定されていません。";

    const once = upsertAssistantTurn(session, { runId: "run-2", content: errorText });
    const twice = upsertAssistantTurn(once, { runId: "run-2", content: errorText });

    assert.equal(twice.messages.filter((m) => m.role === "assistant").length, 1);
    assert.equal(twice.messages[1]?.content, errorText);
  });
});

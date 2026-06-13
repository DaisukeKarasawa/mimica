import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAskQuestionToolCall } from "./parseAskQuestionToolCall.js";
import {
  releaseAskQuestionStreamRun,
  tryParseAskQuestionStreamEvent,
} from "./toolCallStreamQuestionAdapter.js";

describe("parseAskQuestionToolCall", () => {
  it("parses SDK-shaped args", () => {
    const prompt = parseAskQuestionToolCall(
      {
        title: "Auth",
        questions: [
          {
            id: "q1",
            prompt: "Which auth?",
            options: [
              { id: "jwt", label: "JWT" },
              { id: "oauth", label: "OAuth" },
            ],
            allow_multiple: false,
          },
        ],
      },
      "run-1",
      "tool-1",
    );

    assert.ok(prompt);
    assert.equal(prompt.runId, "run-1");
    assert.equal(prompt.toolCallId, "tool-1");
    assert.equal(prompt.title, "Auth");
    assert.equal(prompt.source, "tool_call_stream");
    assert.equal(prompt.status, "pending");
    assert.equal(prompt.questions.length, 1);
    assert.equal(prompt.questions[0]?.allowMultiple, false);
  });

  it("returns null for invalid args without throwing", () => {
    assert.equal(parseAskQuestionToolCall(null, "run-1"), null);
    assert.equal(parseAskQuestionToolCall({ questions: [] }, "run-1"), null);
    assert.equal(
      parseAskQuestionToolCall({ questions: [{ id: "q1", prompt: "x", options: [] }] }, "run-1"),
      null,
    );
  });
});

describe("tryParseAskQuestionStreamEvent", () => {
  it("suppresses duplicate pending emits for the same runId", () => {
    const event = {
      type: "tool_call" as const,
      name: "AskQuestion",
      status: "running",
      runId: "run-dup",
      args: {
        questions: [
          {
            id: "q1",
            prompt: "Pick one",
            options: [{ id: "a", label: "A" }],
          },
        ],
      },
    };

    assert.ok(tryParseAskQuestionStreamEvent(event));
    assert.equal(tryParseAskQuestionStreamEvent(event), null);
    releaseAskQuestionStreamRun("run-dup");
    assert.ok(tryParseAskQuestionStreamEvent(event));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSessionRunActive, mapSessionRunToAvatar, runStatusFromAgentState, shouldShowAssistantPendingIndicator } from "./sessionRunState.js";

describe("runStatusFromAgentState", () => {
  it("maps agent states to renderer run status", () => {
    assert.equal(runStatusFromAgentState("thinking"), "thinking");
    assert.equal(runStatusFromAgentState("streaming"), "streaming");
    assert.equal(runStatusFromAgentState("failed"), "error");
    assert.equal(runStatusFromAgentState("completed"), "idle");
    assert.equal(runStatusFromAgentState("cancelled"), "idle");
    assert.equal(runStatusFromAgentState("idle"), "idle");
    assert.equal(runStatusFromAgentState("waiting"), "idle");
  });
});

describe("isSessionRunActive", () => {
  it("includes readout and revealing", () => {
    assert.equal(isSessionRunActive({ status: "readout" }), true);
    assert.equal(isSessionRunActive({ status: "revealing" }), true);
    assert.equal(isSessionRunActive({ status: "idle" }), false);
  });
});

describe("mapSessionRunToAvatar", () => {
  it("uses talking only during readout", () => {
    assert.equal(mapSessionRunToAvatar("readout"), "talking");
    assert.equal(mapSessionRunToAvatar("streaming"), "thinking");
    assert.equal(mapSessionRunToAvatar("thinking"), "thinking");
    assert.equal(mapSessionRunToAvatar("revealing"), "idle");
  });
});

describe("shouldShowAssistantPendingIndicator", () => {
  const session = {
    id: "s1",
    title: "t",
    workspacePath: "/w",
    messages: [
      { id: "u1", role: "user" as const, content: "hi", createdAt: "" },
    ],
  };

  it("shows during thinking, streaming, and readout until answer text exists", () => {
    assert.equal(shouldShowAssistantPendingIndicator("thinking", session, "run-1"), true);
    assert.equal(shouldShowAssistantPendingIndicator("streaming", session, "run-1"), true);
    assert.equal(shouldShowAssistantPendingIndicator("readout", session, "run-1"), true);
    assert.equal(shouldShowAssistantPendingIndicator("revealing", session, "run-1"), false);
  });

  it("hides once assistant content for the run is visible", () => {
    const withAnswer = {
      ...session,
      messages: [
        ...session.messages,
        {
          id: "a1",
          role: "assistant" as const,
          content: "answer",
          createdAt: "",
          agentRunId: "run-1",
        },
      ],
    };
    assert.equal(shouldShowAssistantPendingIndicator("readout", withAnswer, "run-1"), false);
    assert.equal(shouldShowAssistantPendingIndicator("streaming", withAnswer, "run-1"), false);
  });
});

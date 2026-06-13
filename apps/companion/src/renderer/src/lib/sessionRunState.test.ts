import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runStatusFromAgentState } from "./sessionRunState.js";

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

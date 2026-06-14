import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldApplyAgentStateToSessionRun } from "./agentSessionRunState";

describe("shouldApplyAgentStateToSessionRun", () => {
  it("defers completed for the active session", () => {
    assert.equal(shouldApplyAgentStateToSessionRun("completed", true), false);
  });

  it("applies completed for background sessions", () => {
    assert.equal(shouldApplyAgentStateToSessionRun("completed", false), true);
  });

  it("applies other states for the active session", () => {
    assert.equal(shouldApplyAgentStateToSessionRun("streaming", true), true);
    assert.equal(shouldApplyAgentStateToSessionRun("failed", true), true);
  });
});

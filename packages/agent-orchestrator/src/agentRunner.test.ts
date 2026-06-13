import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentRunner } from "./agentRunner.js";

describe("AgentRunner concurrent sessions", () => {
  it("cancel no-ops for unknown session", async () => {
    const runner = new AgentRunner();
    await assert.doesNotReject(() => runner.cancel("missing-session"));
  });

  it("cancel with no sessionId resolves without active runs", async () => {
    const runner = new AgentRunner();
    await assert.doesNotReject(() => runner.cancel());
  });

  it("closeSession no-ops pool cleanup for unknown session", async () => {
    const runner = new AgentRunner();
    await assert.doesNotReject(() => runner.closeSession("missing-session"));
  });
});

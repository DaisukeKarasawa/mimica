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

  it("cancel on one session does not throw when another session id is unknown", async () => {
    const runner = new AgentRunner();
    await runner.cancel("session-a");
    await assert.doesNotReject(() => runner.cancel("session-b"));
  });

  it("closeSession on one session leaves cancel on another as no-op", async () => {
    const runner = new AgentRunner();
    await runner.closeSession("session-a");
    await assert.doesNotReject(() => runner.cancel("session-b"));
  });
});

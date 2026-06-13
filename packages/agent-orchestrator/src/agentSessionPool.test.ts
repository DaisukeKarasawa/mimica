import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentSessionPool, DEFAULT_IDLE_EVICT_MS } from "./agentSessionPool.js";

describe("AgentSessionPool idle eviction", () => {
  it("evicts sessions idle longer than the threshold", () => {
    const pool = new AgentSessionPool(1_000);
    const sessions = (
      pool as unknown as {
        sessions: Map<string, { lastActivityAt: number; agent: { close(): void } }>;
      }
    ).sessions;

    sessions.set("s1", {
      agent: { close() {} },
      lastActivityAt: Date.now() - DEFAULT_IDLE_EVICT_MS - 1,
    } as never);
    sessions.set("s2", {
      agent: { close() {} },
      lastActivityAt: Date.now(),
    } as never);

    const evicted = pool.evictIdleSessions();
    assert.equal(evicted, 1);
    assert.equal(pool.getPoolSize(), 1);
    assert.ok(!sessions.has("s1"));
    assert.ok(sessions.has("s2"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentSessionPool, DEFAULT_IDLE_EVICT_MS } from "./agentSessionPool.js";

describe("AgentSessionPool idle eviction", () => {
  it("evicts sessions idle longer than the threshold", () => {
    const pool = new AgentSessionPool(1_000);
    const staleAt = Date.now() - DEFAULT_IDLE_EVICT_MS - 1;
    pool.seedIdleSessionForTests("s1", staleAt);
    pool.seedIdleSessionForTests("s2", Date.now());

    const evicted = pool.evictIdleSessions();
    assert.equal(evicted, 1);
    assert.equal(pool.getPoolSize(), 1);
  });

  it("skips eviction for sessions with in-flight runs", () => {
    const pool = new AgentSessionPool(1_000);
    const staleAt = Date.now() - DEFAULT_IDLE_EVICT_MS - 1;
    pool.seedIdleSessionForTests("running", staleAt, { activeRuns: 1 });
    pool.seedIdleSessionForTests("idle", staleAt);

    const evicted = pool.evictIdleSessions();
    assert.equal(evicted, 1);
    assert.equal(pool.getPoolSize(), 1);
  });
});

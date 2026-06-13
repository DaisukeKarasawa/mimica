import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueuedAgentSubmit } from "./messageQueue";
import { dequeueMessage, enqueueMessage, peekMessage, queueSize } from "./messageQueue";

const sample = (content: string): QueuedAgentSubmit => ({
  content,
  agentMode: "agent",
  workspacePath: "/tmp/project",
});

describe("messageQueue", () => {
  it("enqueue appends FIFO", () => {
    const q = enqueueMessage([], sample("first"));
    const q2 = enqueueMessage(q, sample("second"));
    assert.equal(queueSize(q2), 2);
    assert.equal(q2[0]?.content, "first");
    assert.equal(q2[1]?.content, "second");
  });

  it("dequeue returns head and shortens queue", () => {
    const q = enqueueMessage(enqueueMessage([], sample("a")), sample("b"));
    const first = dequeueMessage(q);
    assert.equal(first.head?.content, "a");
    assert.equal(queueSize(first.rest), 1);
    const second = dequeueMessage(first.rest);
    assert.equal(second.head?.content, "b");
    assert.equal(queueSize(second.rest), 0);
    const empty = dequeueMessage(second.rest);
    assert.equal(empty.head, null);
  });

  it("peek returns head without mutating queue", () => {
    const q = enqueueMessage([], sample("only"));
    assert.equal(peekMessage(q)?.content, "only");
    assert.equal(queueSize(q), 1);
  });
});

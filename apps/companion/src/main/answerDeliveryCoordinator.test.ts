import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { AnswerDeliveryCoordinator } from "./answerDeliveryCoordinator.js";

function mockWebContents(events: unknown[]) {
  return {
    send: (_channel: string, event: unknown) => {
      events.push(event);
    },
  } as never;
}

describe("AnswerDeliveryCoordinator", () => {
  it("delivers immediately when voice readout is disabled", () => {
    const previous = process.env.MIMICA_VOICE_READOUT_ENABLED;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "0";
    const events: unknown[] = [];
    const wc = mockWebContents(events);
    try {
      const coordinator = new AnswerDeliveryCoordinator();
      coordinator.deliver({
        wc,
        sessionId: "s1",
        runId: "r1",
        content: "hello",
        workspacePath: "/tmp/ws",
        getRunner: async () => {
          throw new Error("runner should not be used");
        },
      });
      assert.equal(coordinator.hasPending("s1"), false);
      assert.deepEqual(events, [
        {
          type: "agent_complete",
          sessionId: "s1",
          runId: "r1",
          content: "hello",
        },
      ]);
    } finally {
      if (previous === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previous;
    }
    assert.equal(DEFAULT_SETTINGS.voiceReadoutEnabled, true);
  });

  it("flushes superseded pending delivery before starting a new readout", () => {
    const previousVoice = process.env.MIMICA_VOICE_READOUT_ENABLED;
    const previousSummary = process.env.MIMICA_READOUT_LLM_SUMMARY;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "1";
    process.env.MIMICA_READOUT_LLM_SUMMARY = "0";
    const events: unknown[] = [];
    const wc = mockWebContents(events);
    const coordinator = new AnswerDeliveryCoordinator();
    const deliverInput = (runId: string, content: string) => ({
      wc,
      sessionId: "s1",
      runId,
      content,
      workspacePath: "/tmp/ws",
      getRunner: async () => ({}) as never,
    });

    try {
      coordinator.deliver(deliverInput("r1", "first answer"));
      assert.equal(coordinator.hasPending("s1"), true);

      coordinator.deliver(deliverInput("r2", "second answer"));

      const firstComplete = events.find(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          event.type === "agent_complete" &&
          "runId" in event &&
          event.runId === "r1",
      );
      assert.ok(firstComplete);
      assert.equal(
        (firstComplete as { content: string }).content,
        "first answer",
      );
      assert.equal(coordinator.hasPending("s1"), true);
    } finally {
      if (previousVoice === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previousVoice;
      if (previousSummary === undefined) delete process.env.MIMICA_READOUT_LLM_SUMMARY;
      else process.env.MIMICA_READOUT_LLM_SUMMARY = previousSummary;
    }
  });
});

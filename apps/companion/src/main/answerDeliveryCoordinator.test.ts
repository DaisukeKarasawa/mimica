import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { AnswerDeliveryCoordinator } from "./answerDeliveryCoordinator.js";

function withVoiceReadoutEnabled(run: () => void): void {
  const previous = process.env.MIMICA_VOICE_READOUT_ENABLED;
  process.env.MIMICA_VOICE_READOUT_ENABLED = "1";
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
    else process.env.MIMICA_VOICE_READOUT_ENABLED = previous;
  }
}

describe("AnswerDeliveryCoordinator", () => {
  it("delivers immediately when voice readout is disabled", () => {
    const previous = process.env.MIMICA_VOICE_READOUT_ENABLED;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "0";
    const events: unknown[] = [];
    const wc = {
      send: (_channel: string, event: unknown) => {
        events.push(event);
      },
    } as never;
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

  it("flushes a pending answer before starting readout for a newer run", () => {
    withVoiceReadoutEnabled(() => {
      const events: unknown[] = [];
      const wc = {
        send: (_channel: string, event: unknown) => {
          events.push(event);
        },
      } as never;
      const coordinator = new AnswerDeliveryCoordinator();
      const base = {
        wc,
        sessionId: "s1",
        workspacePath: "/tmp/ws",
        getRunner: async () => {
          throw new Error("runner should not be used");
        },
      };

      coordinator.deliver({ ...base, runId: "r1", content: "first" });
      assert.equal(coordinator.hasPending("s1"), true);

      coordinator.deliver({ ...base, runId: "r2", content: "second" });
      assert.equal(coordinator.hasPending("s1"), true);

      const completes = events.filter(
        (event) => (event as { type?: string }).type === "agent_complete",
      );
      assert.deepEqual(completes, [
        {
          type: "agent_complete",
          sessionId: "s1",
          runId: "r1",
          content: "first",
        },
      ]);
    });
  });
});

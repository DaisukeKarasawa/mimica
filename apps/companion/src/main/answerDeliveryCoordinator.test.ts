import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { AnswerDeliveryCoordinator } from "./answerDeliveryCoordinator.js";
import type { SpeakReadoutInput } from "./tuttiVoiceService.js";

function mockWebContents(events: unknown[]) {
  return {
    send: (_channel: string, event: unknown) => {
      events.push(event);
    },
  } as never;
}

function mockVoiceService() {
  const speakCalls: SpeakReadoutInput[] = [];
  return {
    speakCalls,
    service: {
      speakReadout(input: SpeakReadoutInput) {
        speakCalls.push(input);
      },
      cancelForSession() {},
    },
  };
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

  it("invokes onDelivered when voice readout is disabled", () => {
    const previous = process.env.MIMICA_VOICE_READOUT_ENABLED;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "0";
    const events: unknown[] = [];
    const wc = mockWebContents(events);
    let delivered = false;
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
        onDelivered: () => {
          delivered = true;
        },
      });
      assert.equal(delivered, true);
      assert.equal(coordinator.hasPending("s1"), false);
    } finally {
      if (previous === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previous;
    }
  });

  it("invokes onDelivered when pending readout is cancelled", () => {
    const previousVoice = process.env.MIMICA_VOICE_READOUT_ENABLED;
    const previousSummary = process.env.MIMICA_READOUT_LLM_SUMMARY;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "1";
    process.env.MIMICA_READOUT_LLM_SUMMARY = "0";
    const events: unknown[] = [];
    const wc = mockWebContents(events);
    let delivered = false;
    try {
      const coordinator = new AnswerDeliveryCoordinator();
      coordinator.deliver({
        wc,
        sessionId: "s1",
        runId: "r1",
        content: "hello",
        workspacePath: "/tmp/ws",
        getRunner: async () => ({}) as never,
        onDelivered: () => {
          delivered = true;
        },
      });
      assert.equal(delivered, false);
      coordinator.cancelSession("s1");
      assert.equal(delivered, true);
      assert.equal(coordinator.hasPending("s1"), false);
    } finally {
      if (previousVoice === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previousVoice;
      if (previousSummary === undefined) delete process.env.MIMICA_READOUT_LLM_SUMMARY;
      else process.env.MIMICA_READOUT_LLM_SUMMARY = previousSummary;
    }
  });

  it("flushes superseded pending delivery before starting a new readout", () => {
    const previousVoice = process.env.MIMICA_VOICE_READOUT_ENABLED;
    const previousSummary = process.env.MIMICA_READOUT_LLM_SUMMARY;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "1";
    process.env.MIMICA_READOUT_LLM_SUMMARY = "0";
    const events: unknown[] = [];
    const wc = mockWebContents(events);
    const { service, speakCalls } = mockVoiceService();
    const coordinator = new AnswerDeliveryCoordinator(service);
    const deliveredRuns: string[] = [];
    const deliverInput = (runId: string, content: string) => ({
      wc,
      sessionId: "s1",
      runId,
      content,
      workspacePath: "/tmp/ws",
      getRunner: async () => ({}) as never,
      onDelivered: () => {
        deliveredRuns.push(runId);
      },
    });

    try {
      coordinator.deliver(deliverInput("r1", "first answer"));

      const preparing = events.find(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          event.type === "agent_readout" &&
          "phase" in event &&
          event.phase === "preparing",
      );
      assert.ok(preparing);

      assert.equal(coordinator.hasPending("s1"), true);
      assert.equal(speakCalls.length, 1);
      assert.equal(speakCalls[0]?.text, "first answer");
      assert.equal(speakCalls[0]?.runId, "r1");
      assert.equal(speakCalls[0]?.workspacePath, "/tmp/ws");

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
      assert.equal((firstComplete as { content: string }).content, "first answer");
      assert.deepEqual(deliveredRuns, ["r1"]);
      assert.equal(coordinator.hasPending("s1"), true);
      assert.equal(speakCalls.length, 2);
      assert.equal(speakCalls[1]?.text, "second answer");
      assert.equal(speakCalls[1]?.runId, "r2");
    } finally {
      if (previousVoice === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previousVoice;
      if (previousSummary === undefined) delete process.env.MIMICA_READOUT_LLM_SUMMARY;
      else process.env.MIMICA_READOUT_LLM_SUMMARY = previousSummary;
    }
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import { generateReadoutSummary } from "./readoutSummary.js";

const previous = process.env.MIMICA_READOUT_LLM_SUMMARY;

afterEach(() => {
  if (previous === undefined) {
    delete process.env.MIMICA_READOUT_LLM_SUMMARY;
  } else {
    process.env.MIMICA_READOUT_LLM_SUMMARY = previous;
  }
});

describe("generateReadoutSummary", () => {
  it("uses mechanical excerpt when LLM summary is disabled", async () => {
    process.env.MIMICA_READOUT_LLM_SUMMARY = "0";
    const runner = {
      runChat: () => {
        throw new Error("runChat should not be called");
      },
    } as unknown as AgentRunner;

    const text = await generateReadoutSummary({
      runner,
      workspacePath: "/tmp/ws",
      sessionId: "s1",
      runId: "r1",
      answerMarkdown: "先生、**結論**として問題ありません。",
      speaker: "rio",
    });

    assert.equal(text, "先生、結論として問題ありません。");
  });
});

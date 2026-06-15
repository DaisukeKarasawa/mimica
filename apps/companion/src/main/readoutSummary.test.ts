import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import { generateReadoutSummary } from "./readoutSummary.js";
import { summarizeForReadout } from "./readoutText.js";

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

  it("truncates long LLM readout via summarizeForReadout at sentence boundaries", async () => {
    process.env.MIMICA_READOUT_LLM_SUMMARY = "1";
    const llmOutput = "結論として問題ありません。" + "追加の詳細説明です。".repeat(25);
    let capturedParams: { skipWorkspaceReadOnlyHooks?: boolean; mode?: string } | undefined;
    const runner = {
      runChat: (params: {
        mode: string;
        skipWorkspaceReadOnlyHooks?: boolean;
        callbacks: { onComplete: (content: string) => void };
      }) => {
        capturedParams = params;
        params.callbacks.onComplete(llmOutput);
        return Promise.resolve();
      },
      closeSession: async () => {},
    } as unknown as AgentRunner;

    const text = await generateReadoutSummary({
      runner,
      workspacePath: "/tmp/ws",
      sessionId: "s1",
      runId: "r1",
      answerMarkdown: "fallback markdown",
      speaker: "rio",
    });

    assert.equal(capturedParams?.mode, "ask");
    assert.equal(capturedParams?.skipWorkspaceReadOnlyHooks, true);
    assert.equal(text, summarizeForReadout(llmOutput));
    assert.ok(text.length <= 220);
    assert.match(text, /。$/);
  });
});

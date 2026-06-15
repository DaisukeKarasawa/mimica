import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReadoutSummaryPrompt } from "./readoutSummaryPrompt.js";

describe("buildReadoutSummaryPrompt", () => {
  it("includes speaker voice guide and answer context", () => {
    const prompt = buildReadoutSummaryPrompt("結論: 問題ありません。", "rio");
    assert.match(prompt, /調月リオ/);
    assert.match(prompt, /plain Japanese/);
    assert.match(prompt, /結論: 問題ありません/);
    assert.doesNotMatch(prompt, /```/);
  });

  it("falls back to rio guide for unknown speakers", () => {
    const prompt = buildReadoutSummaryPrompt("hello", "unknown");
    assert.match(prompt, /調月リオ/);
  });
});

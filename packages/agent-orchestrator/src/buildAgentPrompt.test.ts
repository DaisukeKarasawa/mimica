import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentFullPrompt } from "./buildAgentPrompt.js";

describe("buildAgentFullPrompt", () => {
  const personaPrompt = "---\nname: mimica-persona-rio\n# Three-layer persona rules";

  it("includes personaSystemPrompt on follow-up turns", () => {
    const prompt = buildAgentFullPrompt(
      {
        prompt: "続けて",
        mode: "agent",
        personaSystemPrompt: personaPrompt,
      },
      true,
    );

    assert.match(prompt, /Persona reminder \(調月リオ\)/);
    assert.match(prompt, /Three-layer persona rules/);
    assert.match(prompt, /## User message\n続けて/);
  });

  it("includes personaSystemPrompt on cold start", () => {
    const prompt = buildAgentFullPrompt(
      {
        prompt: "hello",
        mode: "agent",
        personaSystemPrompt: personaPrompt,
      },
      false,
    );

    assert.match(prompt, /Agent mode/);
    assert.match(prompt, /Three-layer persona rules/);
  });
});

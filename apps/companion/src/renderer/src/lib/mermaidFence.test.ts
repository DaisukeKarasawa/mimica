import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countMermaidBlocks, isMermaidBlockComplete } from "./mermaidFence";

describe("isMermaidBlockComplete", () => {
  it("returns true when the first mermaid fence is closed", () => {
    const content = ["```mermaid", "graph TD", "A-->B", "```"].join("\n");
    assert.equal(isMermaidBlockComplete(content, 0), true);
  });

  it("returns false when the mermaid fence is still open", () => {
    const content = ["```mermaid", "graph TD", "A-->B"].join("\n");
    assert.equal(isMermaidBlockComplete(content, 0), false);
  });

  it("tracks multiple mermaid blocks independently", () => {
    const content = [
      "```mermaid",
      "graph LR",
      "A-->B",
      "```",
      "",
      "```mermaid",
      "sequenceDiagram",
      "Alice->>Bob: hi",
    ].join("\n");
    assert.equal(isMermaidBlockComplete(content, 0), true);
    assert.equal(isMermaidBlockComplete(content, 1), false);
  });

  it("ignores mermaid-like text inside other fenced blocks", () => {
    const content = ["```ts", 'const x = "```mermaid";', "```"].join("\n");
    assert.equal(countMermaidBlocks(content), 0);
    assert.equal(isMermaidBlockComplete(content, 0), false);
  });

  it("returns false for out-of-range block index", () => {
    const content = "```mermaid\ngraph TD\nA-->B\n```";
    assert.equal(isMermaidBlockComplete(content, 1), false);
    assert.equal(isMermaidBlockComplete(content, -1), false);
  });
});

describe("countMermaidBlocks", () => {
  it("counts only mermaid opening fences", () => {
    const content = [
      "```mermaid",
      "graph TD",
      "A-->B",
      "```",
      "",
      "```ts",
      "console.log(1)",
      "```",
      "",
      "```mermaid",
      "graph LR",
      "C-->D",
      "```",
    ].join("\n");
    assert.equal(countMermaidBlocks(content), 2);
  });

  it("ignores literal ```mermaid lines inside a mermaid block body", () => {
    const content = [
      "```mermaid",
      'note["```mermaid"]',
      "graph TD",
      "A-->B",
      "```",
      "",
      "```mermaid",
      "graph LR",
      "C-->D",
      "```",
    ].join("\n");
    assert.equal(countMermaidBlocks(content), 2);
    assert.equal(isMermaidBlockComplete(content, 0), true);
    assert.equal(isMermaidBlockComplete(content, 1), true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCodeSnippet } from "./codeSymbols.js";

describe("extractCodeSnippet", () => {
  it("extracts lines around a symbol", () => {
    const content = ["line1", "export function foo() {", "  return 1;", "}"].join("\n");
    const result = extractCodeSnippet(content, "foo", 2);
    assert.match(result.snippet, /export function foo/);
    assert.equal(result.startLine, 1);
  });
});

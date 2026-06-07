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

  it("handles regex metacharacters in symbol names literally", () => {
    const content = ["line1", "export function foo.bar*+?[]() {", "  return 1;", "}"].join("\n");
    const result = extractCodeSnippet(content, "foo.bar*+?[]()");
    assert.match(result.snippet, /foo\.bar\*\+\?\[\]\(\)/);
    assert.ok(result.startLine >= 1);
    assert.ok(result.endLine >= result.startLine);
  });

  it("clamps hintLine beyond file length", () => {
    const content = ["line1", "line2", "line3", "line4"].join("\n");
    const result = extractCodeSnippet(content, "missing", 999);
    assert.ok(result.startLine <= result.endLine);
    assert.ok(result.snippet.length > 0);
    assert.equal(result.endLine, 4);
  });
});

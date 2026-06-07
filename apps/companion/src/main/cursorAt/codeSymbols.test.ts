import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { expandCodeMention, extractCodeSnippet, MAX_CODE_MENTION_BYTES } from "./codeSymbols.js";

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

describe("expandCodeMention", () => {
  const workspacePath = mkdtempSync(join(tmpdir(), "mimica-code-symbol-test-"));

  after(() => {
    rmSync(workspacePath, { recursive: true, force: true });
  });

  it("expands a normal-sized file", async () => {
    const relPath = "src/foo.ts";
    mkdirSync(join(workspacePath, "src"), { recursive: true });
    writeFileSync(
      join(workspacePath, relPath),
      ["export function foo() {", "  return 1;", "}"].join("\n"),
    );

    const result = await expandCodeMention(workspacePath, relPath, "foo");
    assert.match(result.text, /Referenced code symbol/);
    assert.match(result.text, /export function foo/);
    assert.equal(result.warning, undefined);
  });

  it("returns a warning without reading oversized files", async () => {
    const relPath = "src/large.ts";
    mkdirSync(join(workspacePath, "src"), { recursive: true });
    writeFileSync(join(workspacePath, relPath), "x".repeat(MAX_CODE_MENTION_BYTES + 1));

    const result = await expandCodeMention(workspacePath, relPath, "foo");
    assert.equal(result.text, `@Code:${relPath}:foo`);
    assert.match(result.warning ?? "", /サイズ上限/);
  });
});

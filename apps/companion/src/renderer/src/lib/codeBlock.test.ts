import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCodeBlockText, parseLanguageFromCodeClass } from "./codeBlock.ts";

describe("parseLanguageFromCodeClass", () => {
  it("extracts language id from highlight.js class", () => {
    assert.equal(parseLanguageFromCodeClass("language-typescript"), "typescript");
    assert.equal(parseLanguageFromCodeClass("hljs language-ts"), "ts");
  });

  it("returns null when no language class is present", () => {
    assert.equal(parseLanguageFromCodeClass(undefined), null);
    assert.equal(parseLanguageFromCodeClass("hljs"), null);
  });
});

describe("extractCodeBlockText", () => {
  it("reads plain string children", () => {
    assert.equal(extractCodeBlockText("pnpm dev:ui-lab\n"), "pnpm dev:ui-lab\n");
  });

  it("reads nested react-markdown code element shape", () => {
    const code = {
      props: {
        children: ["line one\n", "line two"],
      },
    };
    assert.equal(extractCodeBlockText(code), "line one\nline two");
  });

  it("returns empty string for missing children", () => {
    assert.equal(extractCodeBlockText(null), "");
    assert.equal(extractCodeBlockText({ props: {} }), "");
  });
});

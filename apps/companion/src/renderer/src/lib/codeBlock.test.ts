import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeBlockElement } from "./codeBlock.ts";
import { extractCodeBlockText, isPreCodeChild, parseLanguageFromCodeClass } from "./codeBlock.ts";

function codeElement(children: unknown, className?: string): CodeBlockElement {
  return { type: "code", props: { children, className } } as CodeBlockElement;
}

function customCodeComponent(children: unknown, className?: string): CodeBlockElement {
  function MarkdownCode() {
    return null;
  }
  return { type: MarkdownCode, props: { children, className } } as CodeBlockElement;
}

describe("parseLanguageFromCodeClass", () => {
  it("extracts language id from highlight.js class", () => {
    assert.equal(parseLanguageFromCodeClass("language-typescript"), "typescript");
    assert.equal(parseLanguageFromCodeClass("hljs language-ts"), "ts");
    assert.equal(parseLanguageFromCodeClass("language-c++"), "c++");
    assert.equal(parseLanguageFromCodeClass("hljs language-c++"), "c++");
    assert.equal(parseLanguageFromCodeClass("language-objective-c"), "objective-c");
  });

  it("returns null when no language class is present", () => {
    assert.equal(parseLanguageFromCodeClass(undefined), null);
    assert.equal(parseLanguageFromCodeClass("hljs"), null);
  });
});

describe("extractCodeBlockText", () => {
  it("reads plain string children", () => {
    assert.equal(extractCodeBlockText(codeElement("pnpm dev:ui-lab\n")), "pnpm dev:ui-lab\n");
  });

  it("reads string arrays from react-markdown code children", () => {
    assert.equal(
      extractCodeBlockText(codeElement(["line one\n", "line two"])),
      "line one\nline two",
    );
  });

  it("returns empty string for missing code element or children", () => {
    assert.equal(extractCodeBlockText(null), "");
    assert.equal(extractCodeBlockText(undefined), "");
    assert.equal(extractCodeBlockText(codeElement(undefined)), "");
  });
});

describe("isPreCodeChild", () => {
  it("accepts native code elements", () => {
    assert.equal(isPreCodeChild(codeElement("hello")), true);
  });

  it("accepts react-markdown custom code components", () => {
    assert.equal(isPreCodeChild(customCodeComponent("pnpm dev:ui-lab", "language-ts")), true);
  });

  it("rejects non-elements", () => {
    assert.equal(isPreCodeChild(null), false);
    assert.equal(isPreCodeChild("text"), false);
  });
});

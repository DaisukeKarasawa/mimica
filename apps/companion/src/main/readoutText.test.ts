import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareReadoutText, summarizeForReadout } from "./readoutText.js";

describe("prepareReadoutText", () => {
  it("strips fenced code blocks", () => {
    const text = prepareReadoutText("Hello\n```ts\nconst x = 1;\n```\nWorld");
    assert.equal(text, "Hello World");
  });

  it("unwraps links", () => {
    const text = prepareReadoutText("See [docs](https://example.com) now.");
    assert.equal(text, "See docs now.");
  });

  it("returns empty for whitespace-only markdown", () => {
    assert.equal(prepareReadoutText("```\n```"), "");
  });
});

describe("summarizeForReadout", () => {
  it("keeps short answers intact", () => {
    const text = summarizeForReadout("先生、お疲れ様です。");
    assert.equal(text, "先生、お疲れ様です。");
  });

  it("takes leading sentences and drops code-heavy tail", () => {
    const long =
      "結論として、この変更は問題ありません。" +
      "次に、実装の詳細を説明します。".repeat(20) +
      "```python\nprint('noise')\n```";
    const text = summarizeForReadout(long);
    assert.ok(text.length <= 220);
    assert.match(text, /結論として/);
    assert.doesNotMatch(text, /print/);
  });

  it("splits on ellipsis and compound punctuation", () => {
    const tail = "長い続き。".repeat(40);
    const text = summarizeForReadout(`待って…本当にそうなの？！${tail}`, 17);
    assert.match(text, /待って…/);
    assert.match(text, /本当にそうなの？！/);
    assert.doesNotMatch(text, /長い続き/);
  });

  it("does not split decimal numbers on periods", () => {
    const text = summarizeForReadout("Version 3.14 is stable. Next topic follows here.");
    assert.match(text, /3\.14/);
  });
});

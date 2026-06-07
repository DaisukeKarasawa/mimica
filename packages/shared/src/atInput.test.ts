import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AtMenuItem } from "./atMenu.ts";
import {
  atMenuFilterQuery,
  extractAtPathTokens,
  extractCodeTokens,
  extractPastChatTokens,
  isAtMenuOpen,
  parseAtMenuScope,
  replaceAtMenuSelection,
} from "./atInput.ts";

describe("at menu open helpers", () => {
  it("detects trailing @ mention input", () => {
    assert.equal(isAtMenuOpen("@packages"), true);
    assert.equal(isAtMenuOpen("hello @packages/sh"), true);
    assert.equal(isAtMenuOpen("hello@world"), false);
    assert.equal(isAtMenuOpen("/commit"), false);
  });

  it("extracts filter query", () => {
    assert.equal(atMenuFilterQuery("@packages/sh"), "packages/sh");
    assert.equal(atMenuFilterQuery("note @"), "");
  });

  it("parses folder browse scope", () => {
    assert.deepEqual(parseAtMenuScope("packages/shared/"), {
      parentDir: "packages/shared",
      filter: "",
      browseChildren: true,
    });
  });

  it("parses partial path filter", () => {
    assert.deepEqual(parseAtMenuScope("packages/sh"), {
      parentDir: "packages",
      filter: "sh",
      browseChildren: false,
    });
    assert.deepEqual(parseAtMenuScope("packages/shared/ch"), {
      parentDir: "packages/shared",
      filter: "ch",
      browseChildren: false,
    });
  });
});

describe("replaceAtMenuSelection", () => {
  it("inserts folder path with trailing slash", () => {
    const item: AtMenuItem = { kind: "folder", path: "packages/shared", name: "shared" };
    assert.equal(replaceAtMenuSelection("@packages", item), "@packages/shared/");
  });

  it("inserts file path with trailing space", () => {
    const item: AtMenuItem = {
      kind: "file",
      path: "packages/shared/src/chat.ts",
      name: "chat.ts",
    };
    assert.equal(
      replaceAtMenuSelection("see @packages/sh", item),
      "see @packages/shared/src/chat.ts ",
    );
  });

  it("inserts past chat token with session id", () => {
    const item: AtMenuItem = {
      kind: "past-chat",
      path: "11111111-1111-4111-8111-111111111111",
      name: "Notes",
    };
    assert.equal(
      replaceAtMenuSelection("@Past", item),
      "@Past Chat: 11111111-1111-4111-8111-111111111111 ",
    );
  });
});

describe("extractAtPathTokens", () => {
  it("collects unique @ paths and skips special tokens", () => {
    assert.deepEqual(extractAtPathTokens("read @a/x.ts and @a/x.ts"), [
      { raw: "@a/x.ts", path: "a/x.ts" },
    ]);
    assert.deepEqual(extractAtPathTokens("@Past Chat: abc"), []);
    assert.deepEqual(extractAtPathTokens("@Code:src/a.ts:foo"), []);
  });

  it("does not skip legitimate paths that share special-token prefixes", () => {
    assert.deepEqual(extractAtPathTokens("see @packages/Past/foo.ts"), [
      { raw: "@packages/Past/foo.ts", path: "packages/Past/foo.ts" },
    ]);
  });

  it("requires a token boundary before @ path mentions", () => {
    assert.deepEqual(extractAtPathTokens("contact foo@package.json"), []);
    assert.deepEqual(extractAtPathTokens("email user@host then @src/a.ts"), [
      { raw: "@src/a.ts", path: "src/a.ts" },
    ]);
  });
});

describe("special @ tokens", () => {
  it("extracts past chat session ids", () => {
    assert.deepEqual(
      extractPastChatTokens("ref @Past Chat: 11111111-1111-4111-8111-111111111111 please"),
      [
        {
          raw: "@Past Chat: 11111111-1111-4111-8111-111111111111",
          sessionId: "11111111-1111-4111-8111-111111111111",
        },
      ],
    );
  });

  it("extracts code tokens", () => {
    assert.deepEqual(
      extractCodeTokens("@Code:packages/shared/src/chat.ts:resolveCharacterShortName"),
      [
        {
          raw: "@Code:packages/shared/src/chat.ts:resolveCharacterShortName",
          filePath: "packages/shared/src/chat.ts",
          symbolName: "resolveCharacterShortName",
        },
      ],
    );
  });
});

describe("matchesAtPathQuery", () => {
  it("matches basename and path substrings", async () => {
    const { matchesAtPathQuery } = await import("./atInput.ts");
    assert.equal(matchesAtPathQuery("packages/shared/src/chat.ts", "chat.ts", "chat"), true);
    assert.equal(matchesAtPathQuery("apps/companion/src/main/index.ts", "index.ts", "comp"), true);
  });
});

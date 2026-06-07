import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSlashMenuOpen,
  parseSlashInput,
  slashMenuFilterQuery,
  SLASH_INPUT_PATTERN,
} from "./slashInput.ts";

describe("parseSlashInput", () => {
  it("parses token and remainder", () => {
    assert.deepEqual(parseSlashInput("/commit fix things"), {
      token: "commit",
      remainder: "fix things",
    });
  });

  it("parses token without remainder", () => {
    assert.deepEqual(parseSlashInput("/explore"), { token: "explore", remainder: undefined });
  });

  it("returns null for non-slash input", () => {
    assert.equal(parseSlashInput("hello"), null);
    assert.equal(parseSlashInput("/"), null);
  });

  it("rejects tokens that do not start with alphanumeric", () => {
    assert.equal(parseSlashInput("/-bad"), null);
    assert.equal(SLASH_INPUT_PATTERN.test("/-bad"), false);
  });
});

describe("slash menu open helpers", () => {
  it("detects partial slash menu input", () => {
    assert.equal(isSlashMenuOpen("/com"), true);
    assert.equal(isSlashMenuOpen("/commit extra"), false);
    assert.equal(isSlashMenuOpen("text"), false);
  });

  it("extracts filter query", () => {
    assert.equal(slashMenuFilterQuery("/com"), "com");
    assert.equal(slashMenuFilterQuery("/"), "");
  });
});

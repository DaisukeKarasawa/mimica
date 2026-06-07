import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractGitBranchTokens } from "@mimica/shared";
import { isSafeGitRef } from "./gitContext.js";

describe("isSafeGitRef", () => {
  it("accepts common branch names", () => {
    assert.equal(isSafeGitRef("main"), true);
    assert.equal(isSafeGitRef("feature/auth"), true);
  });

  it("rejects unsafe refs", () => {
    assert.equal(isSafeGitRef(""), false);
    assert.equal(isSafeGitRef("--output"), false);
    assert.equal(isSafeGitRef("foo..bar"), false);
  });
});

describe("extractGitBranchTokens", () => {
  it("parses custom base branches from tokens", () => {
    assert.deepEqual(extractGitBranchTokens("@Branch (Diff with develop)"), [
      { raw: "@Branch (Diff with develop)", baseBranch: "develop" },
    ]);
    assert.deepEqual(extractGitBranchTokens("@Branch (Diff with feature/auth)"), [
      { raw: "@Branch (Diff with feature/auth)", baseBranch: "feature/auth" },
    ]);
  });
});

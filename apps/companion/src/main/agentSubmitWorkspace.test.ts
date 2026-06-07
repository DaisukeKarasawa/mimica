import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AT_GIT_COMMIT_LABEL } from "@mimica/shared";
import {
  resolveAgentSubmitWorkspace,
  shouldWarnUnlinkedAtExpansion,
} from "./agentSubmitWorkspace.js";

describe("resolveAgentSubmitWorkspace", () => {
  const resolveWorkspacePath = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "/disallowed") {
      throw new Error("Workspace not allowed");
    }
    return trimmed;
  };

  it("returns empty cwd and skips @ expansion when workspace is unlinked", () => {
    const result = resolveAgentSubmitWorkspace("", resolveWorkspacePath);
    assert.equal(result.slashWorkspace, null);
    assert.equal(result.cwd, "");
    assert.equal(result.canExpandAt, false);
  });

  it("uses resolved workspace when linked", () => {
    const result = resolveAgentSubmitWorkspace("/tmp/project", resolveWorkspacePath);
    assert.equal(result.slashWorkspace, "/tmp/project");
    assert.equal(result.cwd, "/tmp/project");
    assert.equal(result.canExpandAt, true);
  });

  it("does not throw when workspace path is invalid", () => {
    const result = resolveAgentSubmitWorkspace("/disallowed", resolveWorkspacePath);
    assert.equal(result.slashWorkspace, null);
    assert.equal(result.cwd, "");
    assert.equal(result.canExpandAt, false);
  });
});

describe("shouldWarnUnlinkedAtExpansion", () => {
  it("warns for special @ tokens when workspace is unlinked", () => {
    assert.equal(
      shouldWarnUnlinkedAtExpansion(false, "ref @Past Chat: 11111111-1111-4111-8111-111111111111"),
      true,
    );
    assert.equal(shouldWarnUnlinkedAtExpansion(false, `see @${AT_GIT_COMMIT_LABEL}`), true);
    assert.equal(shouldWarnUnlinkedAtExpansion(false, "@Branch (Diff with main)"), true);
    assert.equal(shouldWarnUnlinkedAtExpansion(false, "@Code:src/a.ts:foo"), true);
    assert.equal(shouldWarnUnlinkedAtExpansion(false, "read @src/a.ts"), true);
  });

  it("does not warn when workspace is linked or input has no @ tokens", () => {
    assert.equal(shouldWarnUnlinkedAtExpansion(true, "read @src/a.ts"), false);
    assert.equal(shouldWarnUnlinkedAtExpansion(false, "plain message"), false);
  });
});

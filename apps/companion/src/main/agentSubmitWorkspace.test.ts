import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAgentSubmitWorkspace } from "./agentSubmitWorkspace.js";

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

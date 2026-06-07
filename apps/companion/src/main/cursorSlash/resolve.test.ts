import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resolveSlashInput } from "./index.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-slash-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("resolveSlashInput", () => {
  it("prefers project commands over skills with the same token", () => {
    const commandsDir = join(workspacePath, ".cursor", "commands");
    const skillsDir = join(workspacePath, ".cursor", "skills", "review");
    mkdirSync(commandsDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(commandsDir, "review.md"), "# Review\n\nRun review.");
    writeFileSync(join(skillsDir, "SKILL.md"), "---\nname: review\n---\n# Skill");

    const result = resolveSlashInput(workspacePath, "/review", "agent");
    assert.equal(result.kind, "command");
    assert.equal(result.name, "review");
    assert.match(result.expanded, /Run review/);
  });

  it("resolves skills when no command matches", () => {
    const skillsDir = join(workspacePath, ".cursor", "skills", "deploy");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, "SKILL.md"),
      "---\nname: deploy\ndescription: Deploy app\n---\n# Deploy",
    );

    const result = resolveSlashInput(workspacePath, "/deploy ship it", "agent");
    assert.equal(result.kind, "skill");
    assert.equal(result.name, "deploy");
    assert.match(result.expanded, /Skill: deploy/);
    assert.match(result.expanded, /ship it/);
  });

  it("hides subagents in ask mode", () => {
    const result = resolveSlashInput(workspacePath, "/explore", "ask");
    assert.equal(result.kind, undefined);
    assert.equal(result.expanded, "/explore");
  });

  it("resolves subagents in agent mode", () => {
    const result = resolveSlashInput(workspacePath, "/explore scan auth", "agent");
    assert.equal(result.kind, "subagent");
    assert.equal(result.name, "explore");
    assert.match(result.expanded, /subagent_type: "explore"/);
    assert.match(result.expanded, /scan auth/);
  });
});

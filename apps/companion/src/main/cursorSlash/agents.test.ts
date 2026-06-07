import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resetSlashCatalogCachesForTests } from "./catalog.js";
import { listSlashSubagents, resolveSlashSubagent } from "./agents.js";
import { resolveSlashInput } from "./index.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-agents-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("custom slash subagents", () => {
  it("lists project custom agents and prefers them over user agents", () => {
    resetSlashCatalogCachesForTests();
    const projectDir = join(workspacePath, ".cursor", "agents");
    const userDir = join(tmpdir(), "mimica-agents-user-skip");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "reviewer.md"),
      "---\nname: reviewer\ndescription: Project reviewer\n---\nYou review project code.",
    );

    const agents = listSlashSubagents(workspacePath);
    const found = agents.find((item) => item.name === "reviewer");
    assert.ok(found);
    assert.equal(found?.source, "project");
    void userDir;
  });

  it("expands custom subagent body into the resolved prompt", () => {
    resetSlashCatalogCachesForTests();
    const projectDir = join(workspacePath, ".cursor", "agents");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "reviewer.md"),
      "---\nname: reviewer\ndescription: Project reviewer\n---\nYou review project code carefully.",
    );

    const result = resolveSlashInput(workspacePath, "/reviewer do X", "agent");
    assert.equal(result.kind, "subagent");
    assert.equal(result.name, "reviewer");
    assert.match(result.expanded, /You review project code carefully/);
    assert.match(result.expanded, /do X/);
  });

  it("keeps built-in subagents when no custom file exists", () => {
    resetSlashCatalogCachesForTests();
    const agents = listSlashSubagents(workspacePath);
    assert.ok(agents.some((item) => item.name === "explore" && item.source === "builtin"));
  });

  it("resolves built-in subagents via Task dispatch", () => {
    resetSlashCatalogCachesForTests();
    const result = resolveSlashSubagent(workspacePath, "explore", "scan auth");
    assert.ok(result);
    assert.match(result.expanded, /subagent_type: "explore"/);
    assert.match(result.expanded, /scan auth/);
  });

  it("hides subagents in ask mode via resolveSlashInput", () => {
    resetSlashCatalogCachesForTests();
    const result = resolveSlashInput(workspacePath, "/explore", "ask");
    assert.equal(result.kind, undefined);
    assert.equal(result.expanded, "/explore");
  });
});

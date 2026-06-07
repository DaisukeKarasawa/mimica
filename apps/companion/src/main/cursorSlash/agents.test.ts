import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resetSlashCatalogCachesForTests } from "./catalog.js";
import { listSlashSubagents, resolveSlashSubagent } from "./agents.js";
import { userAgentsDir } from "./discovery.js";
import { resolveSlashInput } from "./index.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-agents-test-"));
const fakeHome = mkdtempSync(join(tmpdir(), "mimica-agents-test-home-"));
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

function withFakeHome<T>(fn: () => T): T {
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  resetSlashCatalogCachesForTests();
  return fn();
}

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
});

describe("custom slash subagents", () => {
  it("lists project custom agents and prefers them over user agents", () => {
    withFakeHome(() => {
      const projectDir = join(workspacePath, ".cursor", "agents");
      const userDir = userAgentsDir();
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(userDir, { recursive: true });
      writeFileSync(
        join(userDir, "reviewer.md"),
        "---\nname: reviewer\ndescription: User reviewer\n---\nUser agent body.",
      );
      writeFileSync(
        join(projectDir, "reviewer.md"),
        "---\nname: reviewer\ndescription: Project reviewer\n---\nYou review project code.",
      );

      const agents = listSlashSubagents(workspacePath);
      const found = agents.find((item) => item.name === "reviewer");
      assert.ok(found);
      assert.equal(found?.source, "project");
    });
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

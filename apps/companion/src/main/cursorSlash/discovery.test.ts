import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resetSlashCatalogCachesForTests } from "./catalog.js";
import { listSlashCommands, resolveSlashCommand } from "./commands.js";
import {
  bundledSkillsRoot,
  pluginSkillsCacheRoot,
  resolveSlashWorkspaceOrNull,
  userAgentsSkillsRoot,
  userCommandsDir,
  userSkillsRoot,
  walkCommandFiles,
} from "./discovery.js";
import { resolveSlashInput } from "./index.js";
import { listSlashSkills, resolveSlashSkill } from "./skills.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-discovery-test-ws-"));
const fakeHome = mkdtempSync(join(tmpdir(), "mimica-discovery-test-home-"));
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

function skillFile(dir: string, body: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), body);
}

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

describe("extended slash discovery", () => {
  it("lists nested project skills from monorepo packages", () => {
    resetSlashCatalogCachesForTests();
    const nestedSkillDir = join(
      workspacePath,
      "packages",
      "foo",
      ".cursor",
      "skills",
      "nested-bar",
    );
    skillFile(
      nestedSkillDir,
      "---\nname: nested-bar\ndescription: Nested package skill\n---\n# Nested",
    );

    const skills = listSlashSkills(workspacePath);
    const found = skills.find((item) => item.name === "nested-bar");
    assert.ok(found);
    assert.equal(found?.source, "project");
    assert.equal(found?.description, "Nested package skill");
  });

  it("prefers project skills over user, bundled, and plugin with the same name", () => {
    withFakeHome(() => {
      skillFile(
        join(pluginSkillsCacheRoot(), "demo-plugin", "skills", "shared-skill"),
        "---\nname: shared-skill\ndescription: plugin\n---\n# Plugin",
      );
      skillFile(
        join(bundledSkillsRoot(), "shared-skill"),
        "---\nname: shared-skill\ndescription: bundled\n---\n# Bundled",
      );
      skillFile(
        join(userSkillsRoot(), "shared-skill"),
        "---\nname: shared-skill\ndescription: user\n---\n# User",
      );

      const projectSkillDir = join(workspacePath, ".cursor", "skills", "shared-skill");
      skillFile(projectSkillDir, "---\nname: shared-skill\ndescription: project\n---\n# Project");

      const skills = listSlashSkills(workspacePath);
      const found = skills.find((item) => item.name === "shared-skill");
      assert.ok(found);
      assert.equal(found?.source, "project");
      assert.equal(found?.description, "project");

      const resolved = resolveSlashSkill(workspacePath, "shared-skill");
      assert.ok(resolved && !("warning" in resolved));
      assert.match(resolved.expanded, /Skill: shared-skill/);
    });
  });

  it("lists bundled and plugin skills with correct source metadata", () => {
    withFakeHome(() => {
      skillFile(
        join(bundledSkillsRoot(), "migrate-to-skills"),
        "---\nname: migrate-to-skills\ndescription: Migrate commands\n---\n# Migrate",
      );
      skillFile(
        join(pluginSkillsCacheRoot(), "cursor-public", "demo-kit", "skills", "team-skill"),
        "---\nname: team-skill\ndescription: Plugin skill\n---\n# Plugin skill",
      );

      const skills = listSlashSkills(null);
      const bundled = skills.find((item) => item.name === "migrate-to-skills");
      const plugin = skills.find((item) => item.name === "team-skill");
      assert.ok(bundled);
      assert.equal(bundled?.source, "bundled");
      assert.ok(plugin);
      assert.equal(plugin?.source, "plugin");
    });
  });

  it("lists user commands when workspace is not linked", () => {
    withFakeHome(() => {
      mkdirSync(userCommandsDir(), { recursive: true });
      writeFileSync(
        join(userCommandsDir(), "global-commit.md"),
        "# Global commit\n\nCommit all repos.",
      );

      const commands = listSlashCommands(null);
      const found = commands.find((item) => item.name === "global-commit");
      assert.ok(found);
      assert.equal(found?.source, "user");

      const resolved = resolveSlashCommand(null, "global-commit");
      assert.ok(resolved);
      assert.match(resolved?.expanded ?? "", /Commit all repos/);
    });
  });

  it("lists nested user commands from subdirectories", () => {
    withFakeHome(() => {
      const nestedDir = join(userCommandsDir(), "git-actions");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "setup-git.md"), "# Setup Git\n\nCreate branch and commit.");

      const commands = listSlashCommands(null);
      const found = commands.find((item) => item.name === "git-actions/setup-git");
      assert.ok(found);
      assert.equal(found?.source, "user");

      const result = resolveSlashInput(null, "/git-actions/setup-git on main", "agent");
      assert.equal(result.kind, "command");
      assert.equal(result.name, "git-actions/setup-git");
      assert.match(result.expanded, /Create branch and commit/);
      assert.match(result.expanded, /on main/);
    });
  });

  it("does not resolve project-only commands without a workspace", () => {
    resetSlashCatalogCachesForTests();
    const commandsDir = join(workspacePath, ".cursor", "commands");
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, "project-only.md"), "# Project only\n\nWorkspace command.");

    assert.equal(resolveSlashCommand(null, "project-only"), null);

    const result = resolveSlashInput(null, "/project-only", "agent");
    assert.equal(result.kind, undefined);
    assert.equal(result.expanded, "/project-only");
  });

  it("discovers user agents skills path", () => {
    withFakeHome(() => {
      skillFile(
        join(userAgentsSkillsRoot(), "agents-skill"),
        "---\nname: agents-skill\ndescription: From ~/.agents/skills\n---\n# Agents",
      );

      const skills = listSlashSkills(null);
      const found = skills.find((item) => item.name === "agents-skill");
      assert.ok(found);
      assert.equal(found?.source, "user");
    });
  });

  it("skips symlinked project commands roots", () => {
    resetSlashCatalogCachesForTests();
    const isolatedWorkspace = mkdtempSync(join(tmpdir(), "mimica-discovery-symlink-ws-"));
    const outsideDir = mkdtempSync(join(tmpdir(), "mimica-discovery-outside-cmds-"));
    writeFileSync(join(outsideDir, "leaked.md"), "# Leaked\n\nSecret command body.");

    const commandsLink = join(isolatedWorkspace, ".cursor", "commands");
    mkdirSync(join(isolatedWorkspace, ".cursor"), { recursive: true });
    symlinkSync(outsideDir, commandsLink);

    assert.deepEqual(walkCommandFiles(commandsLink), []);
    assert.equal(resolveSlashCommand(isolatedWorkspace, "leaked"), null);

    rmSync(outsideDir, { recursive: true, force: true });
    rmSync(isolatedWorkspace, { recursive: true, force: true });
  });

  it("resolveSlashWorkspaceOrNull returns null for missing or invalid paths", () => {
    assert.equal(
      resolveSlashWorkspaceOrNull("", (p) => p),
      null,
    );
    assert.equal(
      resolveSlashWorkspaceOrNull("   ", (p) => p),
      null,
    );
    assert.equal(
      resolveSlashWorkspaceOrNull("ok", () => {
        throw new Error("bad");
      }),
      null,
    );
    assert.equal(
      resolveSlashWorkspaceOrNull("ok", () => "/resolved"),
      "/resolved",
    );
  });
});

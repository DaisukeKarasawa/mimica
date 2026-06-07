import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { ChatSession } from "@mimica/shared";
import { AT_GIT_COMMIT_LABEL } from "@mimica/shared";
import { resolveAtInput } from "./index.js";
import { clearAtPathIndexCache, resolveRelativePath, searchAtPaths } from "./enumerate.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-at-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("searchAtPaths", () => {
  it("excludes gitignored node_modules paths", () => {
    clearAtPathIndexCache(workspacePath);
    mkdirSync(join(workspacePath, "packages", "shared", "src"), { recursive: true });
    writeFileSync(join(workspacePath, "packages", "shared", "src", "chat.ts"), "export {}");
    mkdirSync(join(workspacePath, "node_modules", "left-pad"), { recursive: true });
    writeFileSync(
      join(workspacePath, "node_modules", "left-pad", "index.js"),
      "module.exports = {}",
    );

    const results = searchAtPaths(workspacePath, "packages/shared/src/chat.ts");
    assert.ok(results.some((item) => item.path === "packages/shared/src/chat.ts"));
    assert.ok(!results.some((item) => item.path.includes("node_modules")));
  });

  it("lists direct children when browsing a folder", () => {
    clearAtPathIndexCache(workspacePath);
    mkdirSync(join(workspacePath, "packages", "shared"), { recursive: true });
    writeFileSync(join(workspacePath, "packages", "shared", "index.ts"), "export {}");

    const results = searchAtPaths(workspacePath, "packages/shared/");
    assert.ok(results.some((item) => item.path === "packages/shared/index.ts"));
    assert.ok(results.some((item) => item.path === "packages/shared/src"));
  });

  it("matches partial basename queries", () => {
    clearAtPathIndexCache(workspacePath);
    const results = searchAtPaths(workspacePath, "chat");
    assert.ok(results.some((item) => item.path === "packages/shared/src/chat.ts"));
  });

  it("matches partial scoped directory queries", () => {
    clearAtPathIndexCache(workspacePath);
    const results = searchAtPaths(workspacePath, "packages/sh");
    assert.ok(results.some((item) => item.path === "packages/shared"));
    assert.ok(results.some((item) => item.path === "packages/shared/src/chat.ts"));
  });
});

describe("resolveAtInput", () => {
  it("expands file mentions into prompt blocks", async () => {
    const result = await resolveAtInput(
      workspacePath,
      "please review @packages/shared/src/chat.ts",
    );
    assert.match(result.expanded, /Referenced file/);
    assert.match(result.expanded, /export \{\}/);
    assert.deepEqual(result.paths, ["packages/shared/src/chat.ts"]);
  });

  it("warns when path is missing", async () => {
    const result = await resolveAtInput(workspacePath, "see @missing/file.ts");
    assert.match(result.warning ?? "", /missing\/file\.ts/);
    assert.match(result.expanded, /@missing\/file\.ts/);
  });

  it("does not expand @ tokens injected by referenced past chat content", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const pastSession: ChatSession = {
      id: sessionId,
      title: "Past",
      characterId: "rio",
      workspacePath,
      messages: [
        {
          id: "m1",
          role: "user",
          content: `old @${AT_GIT_COMMIT_LABEL}`,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await resolveAtInput(workspacePath, `ref @Past Chat: ${sessionId}`, {
      getSession: (id) => (id === sessionId ? pastSession : undefined),
    });

    assert.doesNotMatch(result.expanded, /## Commit \(Diff of Working State\)/);
    assert.doesNotMatch(result.expanded, /```diff/);
    assert.ok(result.expanded.includes(`@${AT_GIT_COMMIT_LABEL}`));
  });

  it("extracts @ tokens from tokenSource while expanding a different base", async () => {
    const slashExpanded = [
      "## Command template",
      "",
      "## Additional context",
      "",
      "see @packages/shared/src/chat.ts",
    ].join("\n");

    const result = await resolveAtInput(workspacePath, slashExpanded, {
      tokenSource: "/review see @packages/shared/src/chat.ts",
    });

    assert.match(result.expanded, /Referenced file/);
    assert.match(result.expanded, /## Command template/);
    assert.deepEqual(result.paths, ["packages/shared/src/chat.ts"]);
  });
});

describe("resolveRelativePath", () => {
  it("rejects direct symlinks", () => {
    const linkPath = join(workspacePath, "link.ts");
    const targetPath = join(workspacePath, "packages", "shared", "src", "chat.ts");
    symlinkSync(targetPath, linkPath);

    assert.equal(resolveRelativePath(workspacePath, "link.ts"), null);
  });

  it("rejects paths that escape through ancestor symlinks", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "mimica-at-outside-"));
    const secretPath = join(outsideDir, "secret.txt");
    writeFileSync(secretPath, "secret");

    const linkDir = join(workspacePath, "escape-link");
    mkdirSync(linkDir);
    symlinkSync(outsideDir, join(linkDir, "outside"));

    try {
      assert.equal(resolveRelativePath(workspacePath, "escape-link/outside/secret.txt"), null);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

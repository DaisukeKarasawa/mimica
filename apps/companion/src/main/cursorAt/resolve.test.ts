import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resolveAtInput } from "./index.js";
import { searchAtPaths } from "./enumerate.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-at-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("searchAtPaths", () => {
  it("excludes gitignored node_modules paths", () => {
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
    mkdirSync(join(workspacePath, "packages", "shared"), { recursive: true });
    writeFileSync(join(workspacePath, "packages", "shared", "index.ts"), "export {}");

    const results = searchAtPaths(workspacePath, "packages/shared/");
    assert.ok(results.some((item) => item.path === "packages/shared/index.ts"));
    assert.ok(results.some((item) => item.path === "packages/shared/src"));
  });

  it("matches partial basename queries", () => {
    const results = searchAtPaths(workspacePath, "chat");
    assert.ok(results.some((item) => item.path === "packages/shared/src/chat.ts"));
  });

  it("matches partial scoped directory queries", () => {
    const results = searchAtPaths(workspacePath, "packages/sh");
    assert.ok(results.some((item) => item.path === "packages/shared"));
    assert.ok(results.some((item) => item.path === "packages/shared/src/chat.ts"));
  });
});

describe("resolveAtInput", () => {
  it("expands file mentions into prompt blocks", () => {
    const result = resolveAtInput(workspacePath, "please review @packages/shared/src/chat.ts");
    assert.match(result.expanded, /Referenced file/);
    assert.match(result.expanded, /export \{\}/);
    assert.deepEqual(result.paths, ["packages/shared/src/chat.ts"]);
  });

  it("warns when path is missing", () => {
    const result = resolveAtInput(workspacePath, "see @missing/file.ts");
    assert.match(result.warning ?? "", /missing\/file\.ts/);
    assert.match(result.expanded, /@missing\/file\.ts/);
  });
});

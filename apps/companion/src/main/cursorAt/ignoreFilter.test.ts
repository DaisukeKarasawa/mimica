import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, describe, it } from "node:test";
import { WorkspaceIgnoreFilter } from "./ignoreFilter.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-ignore-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("WorkspaceIgnoreFilter", () => {
  it("matches unanchored patterns at any directory depth", () => {
    const dir = join(workspacePath, "nested-glob");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".gitignore"), "*.log\n");

    const filter = new WorkspaceIgnoreFilter(dir);
    assert.equal(filter.isIgnored("error.log"), true);
    assert.equal(filter.isIgnored("a/b/error.log"), true);
    assert.equal(filter.isIgnored("a/b/notes.txt"), false);
  });

  it("applies negated rules after directory ignores", () => {
    const dir = join(workspacePath, "negated");
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, ".gitignore"), "dist/\n!dist/keep.txt\n");
    writeFileSync(join(dir, "dist", "keep.txt"), "keep");
    writeFileSync(join(dir, "dist", "bundle.js"), "bundle");

    const filter = new WorkspaceIgnoreFilter(dir);
    assert.equal(filter.isIgnored("dist/keep.txt"), false);
    assert.equal(filter.isIgnored("dist/bundle.js"), true);
  });

  it("ignores nested paths under simple directory rules", () => {
    const dir = join(workspacePath, "nested-dir");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".gitignore"), "dist\n");

    const filter = new WorkspaceIgnoreFilter(dir);
    assert.equal(filter.isIgnored("dist/a.js"), true);
    assert.equal(filter.isIgnored("dist/nested/a.js"), true);
  });
});

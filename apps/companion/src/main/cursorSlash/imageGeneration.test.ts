import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { resolveSlashInput } from "./index.js";
import { defaultGeneratedImageDir, resolveSlashImageGeneration } from "./imageGeneration.js";

const workspacePath = mkdtempSync(join(tmpdir(), "mimica-image-gen-test-"));

after(() => {
  rmSync(workspacePath, { recursive: true, force: true });
});

describe("slash image generation", () => {
  it("warns when workspace is not linked", () => {
    const result = resolveSlashImageGeneration(null, "flat icon");
    assert.ok(result);
    assert.match(result.warning ?? "", /ワークスペース/);
    assert.equal(result.expanded, "/image");
  });

  it("expands generation prompt with assets path", () => {
    const result = resolveSlashImageGeneration(workspacePath, "simple app icon");
    assert.ok(result);
    assert.match(result.expanded, /GenerateImage/);
    assert.match(result.expanded, /simple app icon/);
    assert.ok(result.expanded.includes(defaultGeneratedImageDir(workspacePath)));
  });

  it("resolves /image before other slash kinds", () => {
    const result = resolveSlashInput(workspacePath, "/image flat vector logo", "agent");
    assert.equal(result.kind, "image");
    assert.equal(result.name, "image");
    assert.match(result.expanded, /flat vector logo/);
  });
});

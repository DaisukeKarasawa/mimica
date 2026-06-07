import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("warns when assets path exists as a file instead of a directory", () => {
    const ws = mkdtempSync(join(tmpdir(), "mimica-image-gen-file-assets-"));
    try {
      writeFileSync(defaultGeneratedImageDir(ws), "not a directory");
      const result = resolveSlashImageGeneration(ws, "simple app icon");
      assert.ok(result);
      assert.ok(result.warning);
      assert.match(result.warning ?? "", /Could not create assets directory/);
      assert.doesNotMatch(result.expanded, /Save generated images under/);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it("resolves /image before other slash kinds", () => {
    const result = resolveSlashInput(workspacePath, "/image flat vector logo", "agent");
    assert.equal(result.kind, "image");
    assert.equal(result.name, "image");
    assert.match(result.expanded, /flat vector logo/);
  });
});

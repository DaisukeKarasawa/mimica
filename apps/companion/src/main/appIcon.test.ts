import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveAppIconPath, resolveCompanionPackageRoot } from "./appIcon.js";

describe("appIcon", () => {
  it("resolves companion package root (not out/)", () => {
    const root = resolveCompanionPackageRoot();
    assert.ok(existsSync(join(root, "package.json")));
    assert.ok(existsSync(join(root, "build")));
    assert.notEqual(root.endsWith("/out"), true);
    assert.notEqual(root.endsWith("\\out"), true);
  });

  it("finds build/icon when present", () => {
    const root = resolveCompanionPackageRoot();
    const resolved = resolveAppIconPath();
    const hasIcon = ICON_CANDIDATES.some((name) => existsSync(join(root, "build", name)));
    if (hasIcon) {
      assert.ok(resolved?.startsWith(join(root, "build")));
    } else {
      assert.equal(resolved, undefined);
    }
  });
});

const ICON_CANDIDATES = [
  "icon-dock.png",
  "icon.icns",
  "icon.png",
  "icon.jpg",
  "icon.jpeg",
] as const;

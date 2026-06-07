import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  PERSONA_PACK_VERSION,
  resetPersonaSetupCachesForTests,
  syncPersonaPackFromTemplate,
} from "./personaSetup.js";

const templateDir = mkdtempSync(join(tmpdir(), "mimica-persona-template-"));
const targetDir = mkdtempSync(join(tmpdir(), "mimica-persona-target-"));

function writeTemplate(name: string, body: string): void {
  writeFileSync(join(templateDir, name), body, "utf8");
}

after(() => {
  rmSync(templateDir, { recursive: true, force: true });
  rmSync(targetDir, { recursive: true, force: true });
  resetPersonaSetupCachesForTests();
});

describe("syncPersonaPackFromTemplate", () => {
  it("seeds missing persona files on first install", () => {
    writeTemplate("SKILL.md", "three-layer persona");
    writeTemplate("style.md", "style rules");
    writeTemplate("examples.md", "examples");
    writeTemplate("lines.json.example", "{}");

    const changed = syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.equal(changed, true);
    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /three-layer persona/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("overwrites stale seeded packs when pack version is older", () => {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "SKILL.md"), "legacy short-reaction-only persona", "utf8");
    writeFileSync(join(targetDir, ".pack-version"), "1\n", "utf8");
    writeTemplate("SKILL.md", "three-layer persona v2");

    const changed = syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.equal(changed, true);
    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /three-layer persona v2/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("does not bump pack version when upgrade copies fail", () => {
    const isolatedTarget = mkdtempSync(join(tmpdir(), "mimica-persona-fail-target-"));
    writeTemplate("SKILL.md", "three-layer persona v2");
    writeTemplate("style.md", "style rules");
    writeTemplate("examples.md", "examples");
    writeTemplate("lines.json.example", "{}");
    writeFileSync(join(isolatedTarget, "SKILL.md"), "legacy persona", "utf8");
    writeFileSync(join(isolatedTarget, ".pack-version"), "1\n", "utf8");
    writeFileSync(join(isolatedTarget, "style.md"), "", { mode: 0o444 });

    const changed = syncPersonaPackFromTemplate(templateDir, isolatedTarget);

    assert.equal(changed, true);
    assert.equal(
      Number.parseInt(readFileSync(join(isolatedTarget, ".pack-version"), "utf8").trim(), 10),
      1,
    );
    rmSync(isolatedTarget, { recursive: true, force: true });
  });

  it("does not overwrite user files once pack version is current", () => {
    writeTemplate("SKILL.md", "bundled template");
    writeFileSync(join(targetDir, "SKILL.md"), "user customized persona", "utf8");
    writeFileSync(join(targetDir, ".pack-version"), `${PERSONA_PACK_VERSION}\n`, "utf8");

    const changed = syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.equal(changed, false);
    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /user customized persona/);
  });
});

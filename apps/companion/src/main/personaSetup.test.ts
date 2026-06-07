import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  PERSONA_PACK_VERSION,
  resetPersonaSetupCachesForTests,
  syncPersonaPackFromTemplate,
} from "./personaSetup.js";

let templateDir: string;
let targetDir: string;

function writeTemplate(name: string, body: string): void {
  writeFileSync(join(templateDir, name), body, "utf8");
}

function seedAllTemplates(skillContent = "three-layer persona"): void {
  writeTemplate("SKILL.md", skillContent);
  writeTemplate("style.md", "style rules");
  writeTemplate("examples.md", "examples");
  writeTemplate("lines.json.example", "{}");
}

function readV1Template(name: string): string {
  return execSync(`git show master:templates/persona/${name}`, { encoding: "utf8" });
}

beforeEach(() => {
  resetPersonaSetupCachesForTests();
  templateDir = mkdtempSync(join(tmpdir(), "mimica-persona-template-"));
  targetDir = mkdtempSync(join(tmpdir(), "mimica-persona-target-"));
});

afterEach(() => {
  rmSync(templateDir, { recursive: true, force: true });
  rmSync(targetDir, { recursive: true, force: true });
  resetPersonaSetupCachesForTests();
});

describe("syncPersonaPackFromTemplate", () => {
  it("seeds missing persona files on first install", () => {
    seedAllTemplates();

    const changed = syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.equal(changed, true);
    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /three-layer persona/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("overwrites unchanged v1 seeded packs when pack version is older", () => {
    writeFileSync(join(targetDir, "SKILL.md"), readV1Template("SKILL.md"), "utf8");
    writeFileSync(join(targetDir, ".pack-version"), "1\n", "utf8");
    seedAllTemplates("three-layer persona v2");

    const changed = syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.equal(changed, true);
    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /three-layer persona v2/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("preserves customized persona files during v1 upgrade", () => {
    writeFileSync(join(targetDir, "SKILL.md"), "user customized persona", "utf8");
    writeFileSync(join(targetDir, "lines.json"), '{"curated": true}', "utf8");
    writeFileSync(join(targetDir, ".pack-version"), "1\n", "utf8");
    seedAllTemplates("three-layer persona v2");

    syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.match(readFileSync(join(targetDir, "SKILL.md"), "utf8"), /user customized persona/);
    assert.match(readFileSync(join(targetDir, "lines.json"), "utf8"), /curated/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("preserves existing files on legacy installs without pack version", () => {
    writeFileSync(join(targetDir, "SKILL.md"), "legacy persona before versioning", "utf8");
    writeFileSync(join(targetDir, "lines.json"), '{"curated": true}', "utf8");
    seedAllTemplates("three-layer persona v2");

    syncPersonaPackFromTemplate(templateDir, targetDir);

    assert.match(
      readFileSync(join(targetDir, "SKILL.md"), "utf8"),
      /legacy persona before versioning/,
    );
    assert.match(readFileSync(join(targetDir, "lines.json"), "utf8"), /curated/);
    assert.match(readFileSync(join(targetDir, "style.md"), "utf8"), /style rules/);
    assert.equal(
      Number.parseInt(readFileSync(join(targetDir, ".pack-version"), "utf8").trim(), 10),
      PERSONA_PACK_VERSION,
    );
  });

  it("does not bump pack version when upgrade copies fail", () => {
    const isolatedTarget = mkdtempSync(join(tmpdir(), "mimica-persona-fail-target-"));
    seedAllTemplates("three-layer persona v2");
    writeFileSync(join(isolatedTarget, "SKILL.md"), "legacy persona", "utf8");
    writeFileSync(join(isolatedTarget, ".pack-version"), "1\n", "utf8");
    writeFileSync(join(isolatedTarget, "style.md"), readV1Template("style.md"), { mode: 0o444 });

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

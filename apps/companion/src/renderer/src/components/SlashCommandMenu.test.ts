import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SlashMenuItem, SlashMenuSection } from "@mimica/shared";
import { sectionVisibleItems } from "@mimica/shared";
import { filterSlashMenuSections } from "./SlashCommandMenu.tsx";

const skill = (name: string): SlashMenuItem => ({
  kind: "skill",
  name,
  description: name,
});

const sections: SlashMenuSection[] = [
  {
    category: "command",
    label: "Commands",
    items: [
      {
        kind: "command",
        name: "git-actions/setup-git",
        description: "Create branch and commit",
      },
      { kind: "command", name: "commit", description: "Commit staged changes" },
    ],
  },
];

describe("filterSlashMenuSections", () => {
  it("returns all sections when query is empty", () => {
    assert.deepEqual(filterSlashMenuSections(sections, ""), sections);
  });

  it("matches command names by partial substring", () => {
    const filtered = filterSlashMenuSections(sections, "setup");
    assert.equal(filtered[0]?.items.length, 1);
    assert.equal(filtered[0]?.items[0]?.name, "git-actions/setup-git");
  });

  it("matches descriptions by partial substring", () => {
    const filtered = filterSlashMenuSections(sections, "staged");
    assert.equal(filtered[0]?.items.length, 1);
    assert.equal(filtered[0]?.items[0]?.name, "commit");
  });

  it("does not require prefix match on nested command paths", () => {
    const filtered = filterSlashMenuSections(sections, "git");
    assert.equal(filtered[0]?.items.length, 1);
    assert.equal(filtered[0]?.items[0]?.name, "git-actions/setup-git");
  });
});

describe("slash menu section truncation", () => {
  it("keeps only three visible items per section until expanded", () => {
    const items = Array.from({ length: 5 }, (_, index) => skill(`skill-${index}`));
    const collapsed = sectionVisibleItems(items, "skill", new Set(), "");
    assert.equal(collapsed.visible.length, 3);
    assert.equal(collapsed.hiddenCount, 2);

    const expanded = sectionVisibleItems(items, "skill", new Set(["skill"]), "");
    assert.equal(expanded.visible.length, 5);
    assert.equal(expanded.hiddenCount, 0);

    const filtered = sectionVisibleItems(items, "skill", new Set(), "skill-4");
    assert.equal(filtered.visible.length, 5);
    assert.equal(filtered.hiddenCount, 0);
  });
});

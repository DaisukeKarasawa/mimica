import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SlashMenuSection } from "@mimica/shared";
import { filterSlashMenuSections } from "./SlashCommandMenu.tsx";

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

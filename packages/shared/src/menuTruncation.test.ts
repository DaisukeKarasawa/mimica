import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MENU_SECTION_COLLAPSED_LIMIT,
  menuShowMoreLabel,
  sectionVisibleItems,
} from "./menuTruncation.ts";

describe("sectionVisibleItems", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("returns all items when a filter query is present", () => {
    const result = sectionVisibleItems(items, "skills", new Set(), "sk");
    assert.deepEqual(result, { visible: items, hiddenCount: 0 });
  });

  it("returns all items when the section is expanded", () => {
    const result = sectionVisibleItems(items, "skills", new Set(["skills"]), "");
    assert.deepEqual(result, { visible: items, hiddenCount: 0 });
  });

  it("truncates to the collapsed limit when unfiltered and collapsed", () => {
    const result = sectionVisibleItems(items, "skills", new Set(), "");
    assert.deepEqual(result.visible, ["a", "b", "c"]);
    assert.equal(result.hiddenCount, 2);
    assert.equal(MENU_SECTION_COLLAPSED_LIMIT, 3);
  });

  it("does not truncate sections at or below the limit", () => {
    const result = sectionVisibleItems(["a", "b", "c"], "commands", new Set(), "");
    assert.deepEqual(result, { visible: ["a", "b", "c"], hiddenCount: 0 });
  });
});

describe("menuShowMoreLabel", () => {
  it("formats the Cursor-style show-more label", () => {
    assert.equal(menuShowMoreLabel(70), "Show 70 more");
  });
});

/** Per-section visible item cap when a composer menu opens without a filter query (Cursor-aligned). */
export const MENU_SECTION_COLLAPSED_LIMIT = 3;

export type MenuShowMoreEntry = {
  type: "showMore";
  sectionKey: string;
  hiddenCount: number;
};

export function sectionVisibleItems<T>(
  items: T[],
  sectionKey: string,
  expandedSectionKeys: ReadonlySet<string>,
  filterQuery: string,
  limit = MENU_SECTION_COLLAPSED_LIMIT,
): { visible: T[]; hiddenCount: number } {
  if (filterQuery || expandedSectionKeys.has(sectionKey)) {
    return { visible: items, hiddenCount: 0 };
  }
  if (items.length <= limit) {
    return { visible: items, hiddenCount: 0 };
  }
  return {
    visible: items.slice(0, limit),
    hiddenCount: items.length - limit,
  };
}

export function menuShowMoreLabel(hiddenCount: number): string {
  return `Show ${hiddenCount} more`;
}

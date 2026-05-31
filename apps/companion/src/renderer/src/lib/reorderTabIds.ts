export function reorderTabIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return ids;
  }
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

/** Live target index from pointer X across tab midpoints (Chrome-style). */
export function computeTabTargetIndex(
  ids: string[],
  draggedId: string,
  pointerX: number,
  getTabRect: (id: string) => DOMRect | undefined,
): number | null {
  const fromIndex = ids.indexOf(draggedId);
  if (fromIndex === -1) return null;

  let targetIndex = ids.length - 1;
  for (let i = 0; i < ids.length; i++) {
    const rect = getTabRect(ids[i]!);
    if (!rect) continue;
    if (pointerX < rect.left + rect.width / 2) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === fromIndex) return null;
  return targetIndex;
}

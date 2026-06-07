import type { KeyboardEvent } from "react";

export interface ComposerMenuKeyboardTarget<T> {
  open: boolean;
  filteredItems: T[];
  highlightedIndex: number;
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
  onSelect: (item: T) => void | Promise<void>;
  onEscape: () => void;
}

/** Returns true when the key event was handled by an open composer menu. */
export function handleComposerMenuKeyDown<T>(
  event: KeyboardEvent,
  menu: ComposerMenuKeyboardTarget<T> | null | undefined,
): boolean {
  if (!menu?.open || menu.filteredItems.length === 0) return false;

  const { filteredItems, highlightedIndex, setHighlightedIndex, onSelect, onEscape } = menu;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setHighlightedIndex((index) => (index + 1) % filteredItems.length);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    setHighlightedIndex((index) => (index - 1 + filteredItems.length) % filteredItems.length);
    return true;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const selected = filteredItems[highlightedIndex];
    if (selected) void onSelect(selected);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    onEscape();
    return true;
  }

  return false;
}

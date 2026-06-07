import type { KeyboardEvent } from "react";

export interface ComposerMenuKeyboardTarget<T> {
  open: boolean;
  filteredItems: T[];
  highlightedIndex: number;
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
  onSelect: (item: T) => void | Promise<void>;
  onEscape: () => void;
}

function isImeComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/** Returns true when the key event was handled by an open composer menu. */
export function handleComposerMenuKeyDown<T>(
  event: KeyboardEvent,
  menu: ComposerMenuKeyboardTarget<T> | null | undefined,
): boolean {
  if (!menu?.open) return false;
  if (isImeComposing(event)) return false;

  const { filteredItems, highlightedIndex, setHighlightedIndex, onSelect, onEscape } = menu;

  if (event.key === "Escape") {
    event.preventDefault();
    onEscape();
    return true;
  }

  if (filteredItems.length === 0) return false;

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

  return false;
}

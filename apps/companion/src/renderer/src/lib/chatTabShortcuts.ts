/** ブラウザ系タブ操作（Chrome 相当） */
export type ChatTabShortcutAction = "new" | "close" | "next" | "prev" | "history" | "tabsBar";

export function matchChatTabShortcut(event: KeyboardEvent): ChatTabShortcutAction | null {
  if (event.repeat) return null;

  const { key } = event;

  // Ctrl+Tab / Ctrl+Shift+Tab（macOS でも Chrome は Ctrl+Tab）
  if (event.ctrlKey && key === "Tab" && !event.metaKey && !event.altKey) {
    return event.shiftKey ? "prev" : "next";
  }

  // macOS Chrome: ⌘⌥→ / ⌘⌥←
  if (event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey) {
    if (key === "ArrowRight") return "next";
    if (key === "ArrowLeft") return "prev";
  }

  const mod = event.metaKey || event.ctrlKey;
  if (!mod || event.altKey) return null;

  const k = key.toLowerCase();
  if (k === "t" && !event.shiftKey) return "new";
  if (k === "w" && !event.shiftKey) return "close";
  if (k === "y" && !event.shiftKey) return "history";
  if (k === "b" && !event.shiftKey) return "tabsBar";

  return null;
}

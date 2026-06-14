/** Chrome-style chat tab shortcuts shared by main, preload, and renderer. */

export const CHAT_TAB_SHORTCUT_ACTIONS = [
  "new",
  "close",
  "next",
  "prev",
  "history",
  "log",
  "tabsBar",
] as const;

export type ChatTabShortcutAction =
  | (typeof CHAT_TAB_SHORTCUT_ACTIONS)[number]
  | { type: "selectTab"; index: number };

/** Chrome: ⌘/Ctrl+1..8 → tab by position; ⌘/Ctrl+9 → last tab. */
export function parseModDigitTabIndex(input: {
  key?: string;
  code?: string;
  meta?: boolean;
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
}): number | null {
  if (input.shift || input.alt) return null;
  const mod = input.meta || input.control;
  if (!mod) return null;

  const digit = parseDigitKey(input.key) ?? parseDigitCode(input.code);
  if (digit === null || digit < 1 || digit > 9) return null;
  return digit;
}

function parseDigitKey(key: string | undefined): number | null {
  if (!key || key.length !== 1) return null;
  const n = Number(key);
  return n >= 1 && n <= 9 ? n : null;
}

function parseDigitCode(code: string | undefined): number | null {
  if (!code) return null;
  const match = /^Digit([1-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}

export interface ModKeyChatShortcut {
  key: string;
  action: ChatTabShortcutAction;
  /**
   * Electron `preventDefault` on these keys in main blocks renderer keydown.
   * Main must forward them via IPC; renderer still matches them in UI Lab.
   */
  forwardFromMain: boolean;
}

/** Mod+letter shortcuts (⌘ on macOS, Ctrl elsewhere). */
export const MOD_KEY_CHAT_SHORTCUTS: readonly ModKeyChatShortcut[] = [
  { key: "t", action: "new", forwardFromMain: false },
  { key: "w", action: "close", forwardFromMain: true },
  { key: "y", action: "history", forwardFromMain: true },
  { key: "j", action: "log", forwardFromMain: true },
  { key: "b", action: "tabsBar", forwardFromMain: true },
];

export interface ElectronShortcutInput {
  type: string;
  key?: string;
  meta?: boolean;
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/** Match shortcuts that main must forward because renderer keydown is blocked. */
export function matchForwardedChatTabShortcut(
  input: ElectronShortcutInput,
  platform: NodeJS.Platform,
): ChatTabShortcutAction | null {
  if (input.type !== "keyDown") return null;
  const mod = platform === "darwin" ? input.meta : input.control;
  if (!mod || input.alt || input.shift) return null;

  const key = input.key?.toLowerCase();
  if (!key) return null;

  const entry = MOD_KEY_CHAT_SHORTCUTS.find((s) => s.forwardFromMain && s.key === key);
  return entry?.action ?? null;
}

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

  const digitIndex = parseModDigitTabIndex({
    key,
    code: event.code,
    meta: event.metaKey,
    control: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  });
  if (digitIndex !== null) {
    return { type: "selectTab", index: digitIndex };
  }

  const mod = event.metaKey || event.ctrlKey;
  if (!mod || event.altKey) return null;

  const k = key.toLowerCase();
  const entry = MOD_KEY_CHAT_SHORTCUTS.find((s) => s.key === k && !event.shiftKey);
  return entry?.action ?? null;
}

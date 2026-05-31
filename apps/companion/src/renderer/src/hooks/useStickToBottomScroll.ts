import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const SCROLL_NEAR_BOTTOM_THRESHOLD_PX = 48;

export function isNearScrollBottom(
  element: HTMLElement,
  thresholdPx = SCROLL_NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= thresholdPx;
}

interface UseStickToBottomScrollOptions {
  enabled?: boolean;
  /** Changes when the message list height may grow (messages, streaming indicator, etc.). */
  contentVersion: unknown;
  /** When this changes, jump to the bottom (e.g. active session id). */
  resetKey?: unknown;
}

export function useStickToBottomScroll({
  enabled = true,
  contentVersion,
  resetKey,
}: UseStickToBottomScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((options?: { force?: boolean }) => {
    const el = containerRef.current;
    if (!el) return;
    if (options?.force) {
      stickToBottomRef.current = true;
    }
    el.scrollTop = el.scrollHeight;
  }, []);

  const followIfStuck = useCallback(() => {
    if (!enabled || !stickToBottomRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onScroll = () => {
      stickToBottomRef.current = isNearScrollBottom(el);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;
    stickToBottomRef.current = true;
    scrollToBottom({ force: true });
  }, [resetKey, enabled, scrollToBottom]);

  useLayoutEffect(() => {
    followIfStuck();
  }, [contentVersion, enabled, followIfStuck]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      followIfStuck();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, followIfStuck]);

  return { containerRef, scrollToBottom };
}

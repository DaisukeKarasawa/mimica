import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  clampChatPanelWidth,
  defaultChatPanelWidth,
  loadChatPanelWidth,
  persistChatPanelWidth,
} from "../lib/chatPanelWidth";

export function useChatPanelWidth(mainRef: RefObject<HTMLElement | null>) {
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const chatWidthRef = useRef<number | null>(null);

  useEffect(() => {
    chatWidthRef.current = chatWidth;
  }, [chatWidth]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const sync = () => {
      const containerWidth = el.clientWidth;
      setChatWidth((prev) => {
        if (prev === null) {
          return clampChatPanelWidth(
            loadChatPanelWidth(defaultChatPanelWidth(containerWidth)),
            containerWidth,
          );
        }
        return clampChatPanelWidth(prev, containerWidth);
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mainRef]);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const startWidth = chatWidthRef.current;
      const el = mainRef.current;
      if (startWidth === null || !el) return;

      event.preventDefault();
      const startX = event.clientX;
      const handle = event.currentTarget;

      const onMove = (moveEvent: PointerEvent) => {
        const containerWidth = el.clientWidth;
        const next = clampChatPanelWidth(
          startWidth - (moveEvent.clientX - startX),
          containerWidth,
        );
        setChatWidth(next);
      };

      const onUp = (upEvent: PointerEvent) => {
        document.body.classList.remove("is-split-dragging");
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        const containerWidth = el.clientWidth;
        const final = clampChatPanelWidth(
          startWidth - (upEvent.clientX - startX),
          containerWidth,
        );
        setChatWidth(final);
        persistChatPanelWidth(final);
      };

      document.body.classList.add("is-split-dragging");
      handle.setPointerCapture(event.pointerId);
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [mainRef],
  );

  return {
    chatWidth,
    onHandlePointerDown,
    isReady: chatWidth !== null,
  };
}

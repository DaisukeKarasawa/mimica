import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { computeTabTargetIndex } from "../lib/reorderTabIds";

const DRAG_THRESHOLD_PX = 24;

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

interface UseTabPointerReorderOptions {
  tabIds: string[];
  enabled: boolean;
  onReorderTab: (draggedId: string, toIndex: number) => void;
}

export function useTabPointerReorder({
  tabIds,
  enabled,
  onReorderTab,
}: UseTabPointerReorderOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  const dragState = useRef<DragState | null>(null);
  const pendingTargetIndexRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const registerTabRef = useCallback((id: string) => {
    return (element: HTMLDivElement | null) => {
      if (element) tabRefs.current.set(id, element);
      else tabRefs.current.delete(id);
    };
  }, []);

  const getTabRect = useCallback(
    (id: string) => tabRefs.current.get(id)?.getBoundingClientRect(),
    [],
  );

  const clearDropTarget = useCallback(() => {
    pendingTargetIndexRef.current = null;
    setDropTargetIndex(null);
  }, []);

  const finishDrag = useCallback(
    (target: EventTarget & { releasePointerCapture?: (id: number) => void }) => {
      const state = dragState.current;
      if (state?.active) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        const targetIndex = pendingTargetIndexRef.current;
        if (targetIndex !== null) onReorderTab(state.id, targetIndex);
      }
      if (state && target.releasePointerCapture) {
        try {
          target.releasePointerCapture(state.pointerId);
        } catch {
          // capture may already be released
        }
      }
      dragState.current = null;
      setDraggingId(null);
      clearDropTarget();
    },
    [clearDropTarget, onReorderTab],
  );

  const previewDropTarget = useCallback(
    (pointerX: number, draggedId: string) => {
      const targetIndex = computeTabTargetIndex(tabIds, draggedId, pointerX, getTabRect);
      pendingTargetIndexRef.current = targetIndex;
      setDropTargetIndex((prev) => (prev === targetIndex ? prev : targetIndex));
    },
    [getTabRect, tabIds],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, tabId: string) => {
      if (!enabled || event.button !== 0) return;
      clearDropTarget();
      dragState.current = {
        id: tabId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clearDropTarget, enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      if (!state.active) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
        state.active = true;
        setDraggingId(state.id);
      }

      event.preventDefault();
      previewDropTarget(event.clientX, state.id);
    },
    [previewDropTarget],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragState.current || event.pointerId !== dragState.current.pointerId) return;
      finishDrag(event.currentTarget);
    },
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragState.current || event.pointerId !== dragState.current.pointerId) return;
      finishDrag(event.currentTarget);
    },
    [finishDrag],
  );

  const handleTabClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, tabId: string, onSelect: (id: string) => void) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        suppressClickRef.current = false;
        return;
      }
      onSelect(tabId);
    },
    [],
  );

  return {
    draggingId,
    dropTargetIndex,
    registerTabRef,
    tabPointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    handleTabClick,
  };
}

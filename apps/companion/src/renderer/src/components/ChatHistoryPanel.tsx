import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatSession } from "@mimica/shared";
import { groupSessionsByDate } from "../lib/sessionGroups";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChatHistoryPanel({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}: ChatHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(() => groupSessionsByDate(filtered), [filtered]);
  const flatSessions = useMemo(() => groups.flatMap((group) => group.sessions), [groups]);

  useEffect(() => {
    if (flatSessions.length === 0) {
      setHighlightedId(null);
      return;
    }
    setHighlightedId((prev) => {
      if (prev && flatSessions.some((session) => session.id === prev)) return prev;
      if (activeSessionId && flatSessions.some((session) => session.id === activeSessionId)) {
        return activeSessionId;
      }
      return flatSessions[0]!.id;
    });
  }, [flatSessions, activeSessionId]);

  useEffect(() => {
    if (!highlightedId) return;
    itemRefs.current.get(highlightedId)?.scrollIntoView({ block: "nearest" });
  }, [highlightedId]);

  const moveHighlight = useCallback(
    (delta: -1 | 1) => {
      if (flatSessions.length === 0) return;
      setHighlightedId((prev) => {
        const currentIndex = prev ? flatSessions.findIndex((session) => session.id === prev) : -1;
        const startIndex = currentIndex < 0 ? (delta === 1 ? -1 : flatSessions.length) : currentIndex;
        const nextIndex = Math.min(flatSessions.length - 1, Math.max(0, startIndex + delta));
        return flatSessions[nextIndex]!.id;
      });
    },
    [flatSessions],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (mod || event.altKey) return;
      if (flatSessions.length === 0) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlight(event.key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (event.key === "Enter" && highlightedId) {
        event.preventDefault();
        onSelect(highlightedId);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [flatSessions.length, highlightedId, moveHighlight, onSelect]);

  const registerItemRef = useCallback((sessionId: string, node: HTMLButtonElement | null) => {
    if (node) {
      itemRefs.current.set(sessionId, node);
      return;
    }
    itemRefs.current.delete(sessionId);
  }, []);

  return (
    <div ref={panelRef} className="history-panel" aria-label="チャット履歴">
      <div className="history-search">
        <input
          ref={searchRef}
          type="search"
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="履歴検索"
        />
      </div>
      {groups.length === 0 ? (
        <p className="history-empty">No history</p>
      ) : (
        <ul className="history-groups">
          {groups.map((group) => (
            <li key={group.label} className="history-group">
              <div className="history-group-label">{group.label}</div>
              <ul>
                {group.sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      ref={(node) => registerItemRef(session.id, node)}
                      className={[
                        "history-item",
                        session.id === activeSessionId ? "active" : "",
                        session.id === highlightedId ? "is-highlighted" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setHighlightedId(session.id)}
                      onClick={() => onSelect(session.id)}
                    >
                      <span className="history-item-title">{session.title}</span>
                    </button>
                    <button
                      type="button"
                      className="history-item-delete"
                      title="履歴から削除"
                      aria-label={`${session.title} を削除`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

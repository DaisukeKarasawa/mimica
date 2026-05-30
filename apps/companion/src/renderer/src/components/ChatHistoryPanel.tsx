import { useMemo, useState } from "react";
import type { ChatSession } from "@mimica/shared";
import { groupSessionsByDate } from "../lib/sessionGroups";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(() => groupSessionsByDate(filtered), [filtered]);

  return (
    <div className="history-panel" aria-label="チャット履歴">
      <div className="history-search">
        <input
          type="search"
          placeholder="セッションを検索…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="履歴検索"
        />
      </div>
      {groups.length === 0 ? (
        <p className="history-empty">履歴がありません</p>
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
                      className={`history-item ${session.id === activeSessionId ? "active" : ""}`}
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

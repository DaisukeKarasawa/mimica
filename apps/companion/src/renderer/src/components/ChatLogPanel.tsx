import { useEffect, useRef, useState } from "react";
import type { EditedFileEntry, RunLogEntry } from "../lib/runLog";
import { useStickToBottomScroll } from "../hooks/useStickToBottomScroll";

interface ChatLogPanelProps {
  entries: RunLogEntry[];
  editedFiles: EditedFileEntry[];
  activeSessionId: string | null;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatLogPanel({ entries, editedFiles, activeSessionId }: ChatLogPanelProps) {
  const [filesOpen, setFilesOpen] = useState(false);
  const { containerRef, scrollToBottom } = useStickToBottomScroll({
    enabled: true,
    resetKey: activeSessionId,
    contentVersion: {
      messageCount: entries.length,
      trailingContentLength: entries.at(-1)?.detail?.length ?? 0,
      showThinkingIndicator: false,
      isStreaming: false,
    },
  });
  const prevLengthRef = useRef(entries.length);

  useEffect(() => {
    setFilesOpen(false);
  }, [activeSessionId]);

  useEffect(() => {
    if (entries.length !== prevLengthRef.current) {
      prevLengthRef.current = entries.length;
      scrollToBottom();
    }
  }, [entries, scrollToBottom]);

  return (
    <div className="log-view" aria-label="Activity log">
      <div ref={containerRef} className="log-scroll">
        {!activeSessionId ? (
          <p className="log-empty">Open a session to see the activity log here.</p>
        ) : entries.length === 0 ? (
          <p className="log-empty">No log entries yet.</p>
        ) : (
          <ul className="log-list">
            {entries.map((entry) => (
              <li key={entry.id} className="log-line">
                <div className="log-line-meta">
                  <span className="log-line-time">{formatTime(entry.at)}</span>
                  <span className="log-line-label">{entry.label}</span>
                </div>
                {entry.detail ? <div className="log-line-detail">{entry.detail}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editedFiles.length > 0 ? (
        <div className="log-files">
          <button
            type="button"
            className="log-files-toggle"
            aria-expanded={filesOpen}
            onClick={() => setFilesOpen((open) => !open)}
          >
            <span className="log-files-chevron" aria-hidden="true">
              {filesOpen ? "▾" : "▸"}
            </span>
            Changed files ({editedFiles.length})
          </button>
          {filesOpen ? (
            <ul className="log-files-list">
              {editedFiles.map((file) => (
                <li key={file.path} title={file.toolName}>
                  {file.path}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

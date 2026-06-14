import { useEffect, useId, useState } from "react";
import type { QueuedAgentSubmit } from "../lib/messageQueue";

function formatQueuedItemLabel(item: QueuedAgentSubmit): string {
  const text = item.content.trim();
  if (text) return text;
  if (item.attachments?.length) {
    const count = item.attachments.length;
    return count === 1 ? "画像添付1件" : `画像添付${count}件`;
  }
  return "空のメッセージ";
}

interface ComposerQueueProps {
  items: QueuedAgentSubmit[];
}

export function ComposerQueue({ items }: ComposerQueueProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (items.length === 0) {
      setExpanded(false);
    }
  }, [items.length]);

  if (items.length === 0) return null;

  const countLabel = `キュー ${items.length} 件`;

  return (
    <div className="composer-queue" aria-live="polite">
      <button
        type="button"
        className="composer-queue-toggle"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span
          className={`composer-queue-chevron${expanded ? " is-expanded" : ""}`}
          aria-hidden="true"
        />
        <span className="composer-queue-label">{countLabel}</span>
      </button>
      {expanded ? (
        <ul id={listId} className="composer-queue-list">
          {items.map((item, index) => (
            <li key={index} className="composer-queue-item">
              <span className="composer-queue-item-text" title={formatQueuedItemLabel(item)}>
                {formatQueuedItemLabel(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

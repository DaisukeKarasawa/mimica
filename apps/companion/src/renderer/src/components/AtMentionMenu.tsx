import { useEffect, useMemo, useRef, useState } from "react";
import type { AtMenuItem, AtMenuSection } from "@mimica/shared";
import {
  atMenuFilterQuery,
  atMenuItemDisplayLabel,
  isAtMenuOpen,
  isSlashMenuOpen,
  replaceAtMenuSelection,
} from "@mimica/shared";

const SEARCH_DEBOUNCE_MS = 200;

type AtMenuRow =
  | { type: "header"; label: string; key: string }
  | { type: "item"; item: AtMenuItem; flatIndex: number; key: string };

function flattenAtMenuSections(sections: AtMenuSection[]): {
  rows: AtMenuRow[];
  items: AtMenuItem[];
} {
  const rows: AtMenuRow[] = [];
  const items: AtMenuItem[] = [];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    rows.push({ type: "header", label: section.label, key: `header-${section.category}` });
    for (const item of section.items) {
      const flatIndex = items.length;
      items.push(item);
      rows.push({
        type: "item",
        item,
        flatIndex,
        key: `${item.kind}-${item.path}-${item.name}`,
      });
    }
  }
  return { rows, items };
}

function atMenuItemDescription(item: AtMenuItem): string {
  if (item.description) return item.description;
  if (item.kind === "folder") return "folder";
  if (item.kind === "file") return item.name;
  return item.kind;
}

export function useAtMenuSections(
  workspacePath: string | null,
  sessionId: string | null,
  query: string,
  enabled: boolean,
) {
  const [sections, setSections] = useState<AtMenuSection[]>([]);

  useEffect(() => {
    if (!enabled || !workspacePath) {
      setSections([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void window.mimica.searchAtMenu(workspacePath, query, sessionId).then((results) => {
        if (!cancelled) setSections(results);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, query, sessionId, workspacePath]);

  return sections;
}

export function useAtMenuState(
  value: string,
  workspacePath: string | null,
  sessionId: string | null,
  disabled?: boolean,
  slashMenuOpen?: boolean,
) {
  const slashActive = slashMenuOpen || isSlashMenuOpen(value);
  const open = !disabled && !slashActive && isAtMenuOpen(value);
  const query = atMenuFilterQuery(value);
  const sections = useAtMenuSections(workspacePath, sessionId, query, open && !!workspacePath);
  const filteredItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (open) setHighlightedIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open || filteredItems.length === 0) return;
    if (highlightedIndex >= filteredItems.length) {
      setHighlightedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [open, highlightedIndex, filteredItems.length]);

  return {
    open,
    query,
    sections,
    filteredItems,
    highlightedIndex,
    setHighlightedIndex,
    workspaceLinked: !!workspacePath,
  };
}

interface AtMentionMenuProps {
  open: boolean;
  workspaceLinked: boolean;
  sections: AtMenuSection[];
  filteredItems: AtMenuItem[];
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelect: (item: AtMenuItem) => void;
}

export function AtMentionMenu({
  open,
  workspaceLinked,
  sections,
  filteredItems,
  highlightedIndex,
  onHighlightChange,
  onSelect,
}: AtMentionMenuProps) {
  const { rows, items } = useMemo(() => flattenAtMenuSections(sections), [sections]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, items.length, open]);

  if (!open) return null;

  itemRefs.current.length = items.length;

  return (
    <div className="slash-menu at-menu" role="listbox" aria-label="At mention menu">
      {!workspaceLinked ? (
        <p className="slash-menu-empty">workspace をリンクすると @ でファイルを参照できます</p>
      ) : filteredItems.length === 0 ? (
        <p className="slash-menu-empty">一致する項目がありません</p>
      ) : (
        <div className="slash-menu-list">
          {rows.map((row) => {
            if (row.type === "header") {
              return (
                <div key={row.key} className="slash-menu-section-label">
                  {row.label}
                </div>
              );
            }
            const { item, flatIndex } = row;
            return (
              <button
                key={row.key}
                ref={(node) => {
                  itemRefs.current[flatIndex] = node;
                }}
                type="button"
                role="option"
                aria-selected={flatIndex === highlightedIndex}
                className={`slash-menu-item ${flatIndex === highlightedIndex ? "is-highlighted" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
                }}
                onMouseEnter={() => onHighlightChange(flatIndex)}
              >
                <span className={`slash-menu-name kind-${item.kind}`}>
                  {atMenuItemDisplayLabel(item)}
                </span>
                <span className="slash-menu-desc">{atMenuItemDescription(item)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { replaceAtMenuSelection };

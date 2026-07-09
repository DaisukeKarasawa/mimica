import { useEffect, useMemo, useRef, useState } from "react";
import type { AtMenuItem, AtMenuSection } from "@mimica/shared";
import {
  atMenuFilterQuery,
  atMenuItemDisplayLabel,
  isAtMenuOpen,
  isSlashMenuOpen,
  menuShowMoreLabel,
  replaceAtMenuSelection,
  sectionVisibleItems,
} from "@mimica/shared";

const SEARCH_DEBOUNCE_MS = 200;

type AtMenuRow =
  | { type: "header"; label: string; key: string }
  | { type: "item"; item: AtMenuItem; flatIndex: number; key: string }
  | { type: "showMore"; sectionKey: string; hiddenCount: number; flatIndex: number; key: string };

export type AtMenuNavEntry =
  | { type: "item"; item: AtMenuItem }
  | { type: "showMore"; sectionKey: string; hiddenCount: number };

function buildAtMenuRows(
  sections: AtMenuSection[],
  expandedSections: ReadonlySet<string>,
  filterQuery: string,
): { rows: AtMenuRow[]; navigableEntries: AtMenuNavEntry[] } {
  const rows: AtMenuRow[] = [];
  const navigableEntries: AtMenuNavEntry[] = [];

  for (const section of sections) {
    if (section.items.length === 0) continue;

    const { visible, hiddenCount } = sectionVisibleItems(
      section.items,
      section.category,
      expandedSections,
      filterQuery,
    );

    rows.push({ type: "header", label: section.label, key: `header-${section.category}` });

    for (const item of visible) {
      const flatIndex = navigableEntries.length;
      navigableEntries.push({ type: "item", item });
      rows.push({
        type: "item",
        item,
        flatIndex,
        key: `${item.kind}-${item.path}-${item.name}`,
      });
    }

    if (hiddenCount > 0) {
      const flatIndex = navigableEntries.length;
      navigableEntries.push({
        type: "showMore",
        sectionKey: section.category,
        hiddenCount,
      });
      rows.push({
        type: "showMore",
        sectionKey: section.category,
        hiddenCount,
        flatIndex,
        key: `show-more-${section.category}`,
      });
    }
  }

  return { rows, navigableEntries };
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
      void window.mimica
        .searchAtMenu(workspacePath, query, sessionId)
        .then((results) => {
          if (!cancelled) setSections(results);
        })
        .catch(() => {
          if (!cancelled) setSections([]);
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setExpandedSections(new Set());
    }
  }, [open, query]);

  const { rows, navigableEntries } = useMemo(
    () => buildAtMenuRows(sections, expandedSections, query),
    [expandedSections, query, sections],
  );

  useEffect(() => {
    if (!open || navigableEntries.length === 0) return;
    if (highlightedIndex >= navigableEntries.length) {
      setHighlightedIndex(Math.max(0, navigableEntries.length - 1));
    }
  }, [open, highlightedIndex, navigableEntries.length]);

  const expandSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      if (prev.has(sectionKey)) return prev;
      const next = new Set(prev);
      next.add(sectionKey);
      return next;
    });
  };

  return {
    open,
    query,
    rows,
    navigableEntries,
    highlightedIndex,
    setHighlightedIndex,
    expandSection,
    workspaceLinked: !!workspacePath,
  };
}

interface AtMentionMenuProps {
  open: boolean;
  workspaceLinked: boolean;
  rows: AtMenuRow[];
  navigableEntries: AtMenuNavEntry[];
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelectItem: (item: AtMenuItem) => void;
  onExpandSection: (sectionKey: string) => void;
}

export function AtMentionMenu({
  open,
  workspaceLinked,
  rows,
  navigableEntries,
  highlightedIndex,
  onHighlightChange,
  onSelectItem,
  onExpandSection,
}: AtMentionMenuProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open || navigableEntries.length === 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, navigableEntries.length, open]);

  if (!open) return null;

  itemRefs.current.length = navigableEntries.length;

  return (
    <div className="slash-menu at-menu" role="listbox" aria-label="@メンションメニュー">
      {!workspaceLinked ? (
        <p className="slash-menu-empty">workspace をリンクすると @ でファイルを参照できます</p>
      ) : navigableEntries.length === 0 ? (
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

            if (row.type === "showMore") {
              return (
                <button
                  key={row.key}
                  ref={(node) => {
                    itemRefs.current[row.flatIndex] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={row.flatIndex === highlightedIndex}
                  className={`slash-menu-item slash-menu-show-more ${row.flatIndex === highlightedIndex ? "is-highlighted" : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onExpandSection(row.sectionKey);
                  }}
                  onMouseEnter={() => onHighlightChange(row.flatIndex)}
                >
                  <span className="slash-menu-show-more-label">
                    {menuShowMoreLabel(row.hiddenCount)}
                  </span>
                </button>
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
                  onSelectItem(item);
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

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMode, SlashMenuItem, SlashMenuSection } from "@mimica/shared";
import {
  isSlashMenuOpen,
  menuShowMoreLabel,
  sectionVisibleItems,
  slashMenuFilterQuery,
} from "@mimica/shared";

type SlashMenuRow =
  | { type: "header"; label: string; key: string }
  | { type: "item"; item: SlashMenuItem; flatIndex: number; key: string }
  | { type: "showMore"; sectionKey: string; hiddenCount: number; flatIndex: number; key: string };

export type SlashMenuNavEntry =
  | { type: "item"; item: SlashMenuItem }
  | { type: "showMore"; sectionKey: string; hiddenCount: number };

export function filterSlashMenuSections(
  sections: SlashMenuSection[],
  query: string,
): SlashMenuSection[] {
  if (!query) return sections;
  const lower = query.toLowerCase();
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const name = item.name.toLowerCase();
        const description = item.description.toLowerCase();
        return name.includes(lower) || description.includes(lower);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function flattenSlashMenuItems(sections: SlashMenuSection[]): SlashMenuItem[] {
  return sections.flatMap((section) => section.items);
}

function buildSlashMenuRows(
  sections: SlashMenuSection[],
  expandedSections: ReadonlySet<string>,
  filterQuery: string,
): { rows: SlashMenuRow[]; navigableEntries: SlashMenuNavEntry[] } {
  const rows: SlashMenuRow[] = [];
  const navigableEntries: SlashMenuNavEntry[] = [];

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
        key: `${item.kind}-${item.name}`,
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

export function useSlashMenuSections(
  workspacePath: string | null,
  agentMode: AgentMode,
): SlashMenuSection[] {
  const [sections, setSections] = useState<SlashMenuSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.mimica.listSlashMenu(workspacePath ?? "", agentMode).then((list) => {
      if (!cancelled) setSections(list);
    });

    return () => {
      cancelled = true;
    };
  }, [workspacePath, agentMode]);

  return sections;
}

export function useSlashMenuState(value: string, sections: SlashMenuSection[], disabled?: boolean) {
  const open = !disabled && isSlashMenuOpen(value);
  const query = slashMenuFilterQuery(value);
  const filteredSections = useMemo(
    () => filterSlashMenuSections(sections, query),
    [sections, query],
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setExpandedSections(new Set());
    }
  }, [open, query]);

  const { rows, navigableEntries } = useMemo(
    () => buildSlashMenuRows(filteredSections, expandedSections, query),
    [expandedSections, filteredSections, query],
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
    filteredSections,
    rows,
    navigableEntries,
    highlightedIndex,
    setHighlightedIndex,
    expandSection,
  };
}

function itemLabel(item: SlashMenuItem): string {
  if (item.kind === "skill") return item.name;
  if (item.kind === "image" && item.name === "attach") return "attach";
  return `/${item.name}`;
}

interface SlashCommandMenuProps {
  open: boolean;
  rows: SlashMenuRow[];
  navigableEntries: SlashMenuNavEntry[];
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelectItem: (item: SlashMenuItem) => void;
  onExpandSection: (sectionKey: string) => void;
}

export function SlashCommandMenu({
  open,
  rows,
  navigableEntries,
  highlightedIndex,
  onHighlightChange,
  onSelectItem,
  onExpandSection,
}: SlashCommandMenuProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open || navigableEntries.length === 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, navigableEntries.length, open]);

  if (!open) return null;

  itemRefs.current.length = navigableEntries.length;

  return (
    <div className="slash-menu" role="listbox" aria-label="Slash menu">
      {navigableEntries.length === 0 ? (
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
                <span className={`slash-menu-name kind-${item.kind}`}>{itemLabel(item)}</span>
                <span className="slash-menu-desc">{item.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

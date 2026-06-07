import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMode, SlashMenuItem, SlashMenuSection } from "@mimica/shared";

const SLASH_MENU_PATTERN = /^\/([A-Za-z0-9_-]*)$/;

type SlashMenuRow =
  | { type: "header"; label: string; key: string }
  | { type: "item"; item: SlashMenuItem; flatIndex: number; key: string };

interface SlashCommandMenuProps {
  value: string;
  sections: SlashMenuSection[];
  disabled?: boolean;
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelect: (item: SlashMenuItem) => void;
}

export function isSlashMenuOpen(value: string): boolean {
  return SLASH_MENU_PATTERN.test(value);
}

export function slashMenuFilterQuery(value: string): string {
  const match = value.match(SLASH_MENU_PATTERN);
  return match?.[1] ?? "";
}

export function useSlashMenuSections(
  workspacePath: string | null,
  agentMode: AgentMode,
): SlashMenuSection[] {
  const [sections, setSections] = useState<SlashMenuSection[]>([]);

  useEffect(() => {
    if (!workspacePath) {
      setSections([]);
      return;
    }

    let cancelled = false;
    void window.mimica.listSlashMenu(workspacePath, agentMode).then((list) => {
      if (!cancelled) setSections(list);
    });

    return () => {
      cancelled = true;
    };
  }, [workspacePath, agentMode]);

  return sections;
}

export function filterSlashMenuSections(
  sections: SlashMenuSection[],
  query: string,
): SlashMenuSection[] {
  if (!query) return sections;
  const lower = query.toLowerCase();
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.name.toLowerCase().startsWith(lower)),
    }))
    .filter((section) => section.items.length > 0);
}

function buildMenuRows(sections: SlashMenuSection[]): {
  rows: SlashMenuRow[];
  items: SlashMenuItem[];
} {
  const rows: SlashMenuRow[] = [];
  const items: SlashMenuItem[] = [];
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
        key: `${item.kind}-${item.name}`,
      });
    }
  }
  return { rows, items };
}

function itemLabel(item: SlashMenuItem): string {
  if (item.kind === "skill") return item.name;
  return `/${item.name}`;
}

export function SlashCommandMenu({
  value,
  sections,
  disabled,
  highlightedIndex,
  onHighlightChange,
  onSelect,
}: SlashCommandMenuProps) {
  const open = !disabled && isSlashMenuOpen(value);
  const query = slashMenuFilterQuery(value);
  const filteredSections = useMemo(
    () => filterSlashMenuSections(sections, query),
    [sections, query],
  );
  const { rows, items } = useMemo(() => buildMenuRows(filteredSections), [filteredSections]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    if (highlightedIndex >= items.length) {
      onHighlightChange(Math.max(0, items.length - 1));
    }
  }, [highlightedIndex, items.length, onHighlightChange, open]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, items.length, open]);

  if (!open) return null;

  itemRefs.current.length = items.length;

  return (
    <div className="slash-menu" role="listbox" aria-label="Slash menu">
      {items.length === 0 ? (
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

export function flattenSlashMenuItems(sections: SlashMenuSection[]): SlashMenuItem[] {
  return sections.flatMap((section) => section.items);
}

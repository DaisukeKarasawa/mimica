import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMode, SlashMenuItem, SlashMenuSection } from "@mimica/shared";
import { isSlashMenuOpen, slashMenuFilterQuery } from "@mimica/shared";

type SlashMenuRow =
  | { type: "header"; label: string; key: string }
  | { type: "item"; item: SlashMenuItem; flatIndex: number; key: string };

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
  const filteredItems = useMemo(() => flattenSlashMenuItems(filteredSections), [filteredSections]);
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
    filteredSections,
    filteredItems,
    highlightedIndex,
    setHighlightedIndex,
  };
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
  if (item.kind === "image" && item.name === "attach") return "attach";
  return `/${item.name}`;
}

interface SlashCommandMenuProps {
  open: boolean;
  filteredSections: SlashMenuSection[];
  filteredItems: SlashMenuItem[];
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelect: (item: SlashMenuItem) => void;
}

export function SlashCommandMenu({
  open,
  filteredSections,
  filteredItems,
  highlightedIndex,
  onHighlightChange,
  onSelect,
}: SlashCommandMenuProps) {
  const { rows, items } = useMemo(() => buildMenuRows(filteredSections), [filteredSections]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, items.length, open]);

  if (!open) return null;

  itemRefs.current.length = items.length;

  return (
    <div className="slash-menu" role="listbox" aria-label="Slash menu">
      {filteredItems.length === 0 ? (
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

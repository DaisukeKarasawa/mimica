import type { SlashCommandSource } from "./slashCommands.js";

export type SlashMenuCategory = "command" | "skill" | "subagent" | "image";

export interface SlashMenuItem {
  kind: SlashMenuCategory;
  name: string;
  description: string;
  source?: SlashCommandSource;
}

export interface SlashMenuSection {
  category: SlashMenuCategory;
  label: string;
  items: SlashMenuItem[];
}

export interface ResolveSlashInputResult {
  expanded: string;
  kind?: SlashMenuCategory;
  name?: string;
  warning?: string;
}

export const SLASH_MENU_SECTION_LABELS: Record<SlashMenuCategory, string> = {
  command: "Commands",
  skill: "Skills",
  subagent: "Subagents",
  image: "Images",
};

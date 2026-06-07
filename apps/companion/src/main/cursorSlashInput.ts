import type {
  AgentMode,
  ResolveSlashInputResult,
  SlashMenuCategory,
  SlashMenuItem,
  SlashMenuSection,
} from "@mimica/shared";
import { SLASH_MENU_SECTION_LABELS } from "@mimica/shared";
import { listSlashCommands, resolveSlashCommand } from "./cursorSlashCommands.js";
import { listSlashSkills, resolveSlashSkill } from "./cursorSlashSkills.js";
import { listSlashSubagents, resolveSlashSubagent } from "./cursorSlashSubagents.js";

const SLASH_INPUT_PATTERN = /^\/([A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/;

const IMAGE_MENU_ITEM: SlashMenuItem = {
  kind: "image",
  name: "image",
  description: "画像を添付（PNG / JPEG / WebP / GIF）",
};

export function listSlashMenuSections(workspacePath: string, mode: AgentMode): SlashMenuSection[] {
  const commands = listSlashCommands(workspacePath).map(
    (command): SlashMenuItem => ({
      kind: "command",
      name: command.name,
      description: command.description,
      source: command.source,
    }),
  );
  const skills = listSlashSkills(workspacePath);
  const subagents = listSlashSubagents(mode);

  const sections: SlashMenuSection[] = [];
  if (commands.length > 0) {
    sections.push({
      category: "command",
      label: SLASH_MENU_SECTION_LABELS.command,
      items: commands,
    });
  }
  if (skills.length > 0) {
    sections.push({
      category: "skill",
      label: SLASH_MENU_SECTION_LABELS.skill,
      items: skills,
    });
  }
  if (subagents.length > 0) {
    sections.push({
      category: "subagent",
      label: SLASH_MENU_SECTION_LABELS.subagent,
      items: subagents,
    });
  }
  sections.push({
    category: "image",
    label: SLASH_MENU_SECTION_LABELS.image,
    items: [IMAGE_MENU_ITEM],
  });
  return sections;
}

export function flattenSlashMenuSections(sections: SlashMenuSection[]): SlashMenuItem[] {
  return sections.flatMap((section) => section.items);
}

export function resolveSlashInput(
  workspacePath: string,
  input: string,
  mode: AgentMode,
): ResolveSlashInputResult {
  const trimmed = input.trim();
  const match = trimmed.match(SLASH_INPUT_PATTERN);
  if (!match) {
    return { expanded: input };
  }

  const [, token, remainder] = match;

  const commandResult = resolveSlashCommand(workspacePath, trimmed);
  if (commandResult.commandName) {
    return {
      expanded: commandResult.expanded,
      kind: "command",
      name: commandResult.commandName,
      warning: commandResult.warning,
    };
  }

  const skillResult = resolveSlashSkill(workspacePath, token, remainder);
  if (skillResult) {
    if ("warning" in skillResult) {
      return {
        expanded: input,
        kind: "skill",
        name: skillResult.skillName,
        warning: skillResult.warning,
      };
    }
    return {
      expanded: skillResult.expanded,
      kind: "skill",
      name: skillResult.skillName,
    };
  }

  if (mode !== "ask") {
    const subagentResult = resolveSlashSubagent(token, remainder);
    if (subagentResult) {
      return {
        expanded: subagentResult.expanded,
        kind: "subagent",
        name: subagentResult.subagentId,
      };
    }
  }

  return { expanded: input };
}

export function debugLogSlashResolution(
  kind: SlashMenuCategory,
  name: string,
  expandedChars: number,
): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[slash-${kind}] resolved /${name} (${expandedChars} chars)`);
  }
}

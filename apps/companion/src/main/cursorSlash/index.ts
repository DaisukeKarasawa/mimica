import type {
  AgentMode,
  ResolveSlashInputResult,
  SlashMenuCategory,
  SlashMenuItem,
  SlashMenuSection,
} from "@mimica/shared";
import { parseSlashInput, SLASH_MENU_SECTION_LABELS } from "@mimica/shared";
import { listSlashSubagents, resolveSlashSubagent } from "./agents.js";
import { listSlashCommands, resolveSlashCommand } from "./commands.js";
import {
  IMAGE_ATTACH_MENU_ITEM,
  IMAGE_GENERATE_MENU_ITEM,
  resolveSlashImageGeneration,
} from "./imageGeneration.js";
import { listSlashSkills, resolveSlashSkill } from "./skills.js";

export function listSlashMenuSections(
  workspacePath: string | null,
  mode: AgentMode,
): SlashMenuSection[] {
  const commands = listSlashCommands(workspacePath).map(
    (command): SlashMenuItem => ({
      kind: "command",
      name: command.name,
      description: command.description,
      source: command.source,
    }),
  );
  const skills = listSlashSkills(workspacePath);
  const subagents = mode === "ask" ? [] : listSlashSubagents(workspacePath);

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
    items: [IMAGE_GENERATE_MENU_ITEM, IMAGE_ATTACH_MENU_ITEM],
  });
  return sections;
}

export function resolveSlashInput(
  workspacePath: string | null,
  input: string,
  mode: AgentMode,
): ResolveSlashInputResult {
  const parsed = parseSlashInput(input);
  if (!parsed) {
    return { expanded: input };
  }

  const { token, remainder } = parsed;

  if (token === "image") {
    const imageResult = resolveSlashImageGeneration(workspacePath, remainder);
    if (imageResult) {
      return {
        expanded: imageResult.expanded,
        kind: "image",
        name: "image",
        warning: imageResult.warning,
      };
    }
  }

  const commandResult = resolveSlashCommand(workspacePath, token, remainder);
  if (commandResult) {
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
    const subagentResult = resolveSlashSubagent(workspacePath, token, remainder);
    if (subagentResult) {
      return {
        expanded: subagentResult.expanded,
        kind: "subagent",
        name: subagentResult.subagentId,
        warning: subagentResult.warning,
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

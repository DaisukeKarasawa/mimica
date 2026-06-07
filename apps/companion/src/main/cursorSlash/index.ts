import type {
  AgentMode,
  ResolveSlashInputResult,
  SlashMenuCategory,
  SlashMenuItem,
  SlashMenuSection,
} from "@mimica/shared";
import { parseSlashInput, SLASH_MENU_SECTION_LABELS, slashSubagentsForMode } from "@mimica/shared";
import { listSlashCommands, resolveSlashCommand } from "./commands.js";
import { listSlashSkills, resolveSlashSkill } from "./skills.js";

const IMAGE_MENU_ITEM: SlashMenuItem = {
  kind: "image",
  name: "image",
  description: "画像を添付（PNG / JPEG / WebP / GIF）",
};

function listSlashSubagents(mode: AgentMode): SlashMenuItem[] {
  return slashSubagentsForMode(mode).map((subagent) => ({
    kind: "subagent" as const,
    name: subagent.id,
    description: subagent.description,
  }));
}

function resolveSlashSubagent(
  subagentId: string,
  remainder?: string,
): { expanded: string; subagentId: string } | null {
  const known = slashSubagentsForMode("agent").some((item) => item.id === subagentId);
  if (!known) return null;

  const prompt = remainder?.trim() || "Handle the user request.";
  const expanded = [
    "## Subagent dispatch",
    "",
    `Use the Task tool with \`subagent_type: "${subagentId}"\` to handle the following request.`,
    "",
    "Pass this as the subagent prompt:",
    prompt,
  ].join("\n");

  return { expanded, subagentId };
}

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

export function resolveSlashInput(
  workspacePath: string,
  input: string,
  mode: AgentMode,
): ResolveSlashInputResult {
  const parsed = parseSlashInput(input);
  if (!parsed) {
    return { expanded: input };
  }

  const { token, remainder } = parsed;

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

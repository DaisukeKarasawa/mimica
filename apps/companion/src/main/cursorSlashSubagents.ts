import type { AgentMode, SlashMenuItem } from "@mimica/shared";
import { slashSubagentsForMode } from "@mimica/shared";

export function listSlashSubagents(mode: AgentMode): SlashMenuItem[] {
  return slashSubagentsForMode(mode).map((subagent) => ({
    kind: "subagent" as const,
    name: subagent.id,
    description: subagent.description,
  }));
}

export function resolveSlashSubagent(
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

export function subagentExists(subagentId: string): boolean {
  return slashSubagentsForMode("agent").some((item) => item.id === subagentId);
}

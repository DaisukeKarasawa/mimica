export type SlashCommandSource = "project" | "user" | "bundled" | "plugin" | "builtin";

export interface SlashCommandSummary {
  name: string;
  description: string;
  source: SlashCommandSource;
}

export interface ResolveSlashCommandResult {
  /** Prompt text sent to the agent (expanded or original input). */
  expanded: string;
  /** Set when a slash command was recognized and expanded. */
  commandName?: string;
  /** User-visible warning when expansion failed. */
  warning?: string;
}

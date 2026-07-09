export interface SlashSubagentDefinition {
  id: string;
  label: string;
  description: string;
  /** When true, hidden in Ask mode (Task is denied there). */
  hiddenInAsk: boolean;
}

/**
 * Built-in catalog aligned with Cursor Task `subagent_type` values.
 * Source: @cursor/sdk Task tool enum (Cursor IDE 2026-03) + cursor-team-kit plugin docs.
 */
export const SLASH_SUBAGENT_CATALOG: readonly SlashSubagentDefinition[] = [
  {
    id: "explore",
    label: "explore",
    description: "Quick read-only codebase exploration",
    hiddenInAsk: true,
  },
  {
    id: "generalPurpose",
    label: "generalPurpose",
    description: "Complex research and multi-step work",
    hiddenInAsk: true,
  },
  {
    id: "shell",
    label: "shell",
    description: "Run shell commands and terminal operations",
    hiddenInAsk: true,
  },
  {
    id: "code-reviewer",
    label: "code-reviewer",
    description: "Review changed code for quality and security",
    hiddenInAsk: true,
  },
  {
    id: "debugger",
    label: "debugger",
    description: "Investigate errors, test failures, and unexpected behavior",
    hiddenInAsk: true,
  },
  {
    id: "ci-investigator",
    label: "ci-investigator",
    description: "Investigate failing CI checks on a PR",
    hiddenInAsk: true,
  },
  {
    id: "cursor-guide",
    label: "cursor-guide",
    description: "Cursor product documentation and how-tos",
    hiddenInAsk: true,
  },
  {
    id: "ci-watcher",
    label: "ci-watcher",
    description: "Monitor CI results for a branch",
    hiddenInAsk: true,
  },
  {
    id: "best-of-n-runner",
    label: "best-of-n-runner",
    description: "Run best-of-N parallel experiments in isolated worktrees",
    hiddenInAsk: true,
  },
  {
    id: "agents-memory-updater",
    label: "agents-memory-updater",
    description: "Update AGENTS.md from chat history",
    hiddenInAsk: true,
  },
  {
    id: "thermo-nuclear-code-quality-review",
    label: "thermo-nuclear-code-quality-review",
    description: "Thorough code quality audit for a diff",
    hiddenInAsk: true,
  },
  {
    id: "dq-alternatives-reviewer",
    label: "dq-alternatives-reviewer",
    description: "Review design decisions for alternatives and overengineering",
    hiddenInAsk: true,
  },
  {
    id: "dq-feasibility-reviewer",
    label: "dq-feasibility-reviewer",
    description: "Review design decisions for feasibility",
    hiddenInAsk: true,
  },
  {
    id: "dq-frame-values-reviewer",
    label: "dq-frame-values-reviewer",
    description: "Review design decisions for framing and value alignment",
    hiddenInAsk: true,
  },
  {
    id: "dq-quality-consistency-reviewer",
    label: "dq-quality-consistency-reviewer",
    description: "Review design decisions for quality and consistency",
    hiddenInAsk: true,
  },
  {
    id: "dq-verification-commitment-reviewer",
    label: "dq-verification-commitment-reviewer",
    description: "Review design decisions for verification and commitment",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-domain-alignment-reviewer",
    label: "ward-debt-domain-alignment-reviewer",
    description: "Review technical debt for domain alignment",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-learning-slice-reviewer",
    label: "ward-debt-learning-slice-reviewer",
    description: "Review learning-slice debt risk",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-mindset",
    label: "ward-debt-mindset",
    description: "Apply Ward Cunningham's debt metaphor",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-repayment-scope-reviewer",
    label: "ward-debt-repayment-scope-reviewer",
    description: "Review whether a refactor is real debt repayment",
    hiddenInAsk: true,
  },
] as const;

export function slashSubagentsForMode(mode: "ask" | "agent" | "plan"): SlashSubagentDefinition[] {
  if (mode === "ask") return [];
  return [...SLASH_SUBAGENT_CATALOG];
}

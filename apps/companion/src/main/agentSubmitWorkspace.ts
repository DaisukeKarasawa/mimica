import { hasResolvableAtTokens } from "@mimica/shared";
import { resolveSlashWorkspaceOrNull } from "./cursorSlash/discovery.js";

export const UNLINKED_AT_EXPANSION_WARNING =
  "ワークスペースがリンクされていないため、@ メンションは展開されません。";

export interface AgentSubmitWorkspaceResolution {
  slashWorkspace: string | null;
  cwd: string;
  canExpandAt: boolean;
}

/** Resolve cwd and @-expansion eligibility without throwing on unlinked/invalid workspace. */
export function resolveAgentSubmitWorkspace(
  rawWorkspace: string,
  resolveWorkspacePath: (workspacePath: string) => string,
): AgentSubmitWorkspaceResolution {
  const slashWorkspace = resolveSlashWorkspaceOrNull(rawWorkspace, resolveWorkspacePath);
  if (slashWorkspace) {
    return { slashWorkspace, cwd: slashWorkspace, canExpandAt: true };
  }

  return { slashWorkspace: null, cwd: "", canExpandAt: false };
}

export function shouldWarnUnlinkedAtExpansion(canExpandAt: boolean, content: string): boolean {
  return !canExpandAt && hasResolvableAtTokens(content);
}

export type AtMenuEntryKind =
  | "file"
  | "folder"
  | "past-chat"
  | "git-commit"
  | "git-branch"
  | "code";

export type AtMenuSectionCategory = "past-chats" | "git" | "code" | "files";

export interface AtMenuItem {
  kind: AtMenuEntryKind;
  /** File path, session id, git key, or code file path depending on kind. */
  path: string;
  /** Primary label (basename, session title, symbol name, branch name). */
  name: string;
  description?: string;
  /** 1-based start line for code symbols. */
  line?: number;
  endLine?: number;
}

export interface AtMenuSection {
  category: AtMenuSectionCategory;
  label: string;
  items: AtMenuItem[];
}

export interface ResolveAtInputResult {
  expanded: string;
  /** Resolved workspace-relative paths injected into the prompt. */
  paths?: string[];
  warning?: string;
}

export const AT_MENU_MAX_RESULTS = 50;

export const AT_MENU_SECTION_LABELS: Record<AtMenuSectionCategory, string> = {
  "past-chats": "Past Chats",
  git: "Git",
  code: "Code",
  files: "Files & Folders",
};

export const AT_GIT_COMMIT_LABEL = "Commit (Diff of Working State)";

export function atGitBranchLabel(baseBranch: string): string {
  return `Branch (Diff with ${baseBranch})`;
}

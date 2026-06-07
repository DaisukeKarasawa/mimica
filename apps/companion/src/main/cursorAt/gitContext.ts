import { spawn, spawnSync } from "node:child_process";
import type { AtMenuItem } from "@mimica/shared";
import { AT_GIT_COMMIT_LABEL, atGitBranchLabel } from "@mimica/shared";

export const GIT_TIMEOUT_MS = 30_000;
export const MAX_GIT_DIFF_BYTES = 256 * 1024;
export const MAX_GIT_BRANCH_MENU_ITEMS = 10;

export interface GitDiffResult {
  diff: string;
  truncated: boolean;
  empty: boolean;
  baseBranch?: string;
  warning?: string;
}

function runGit(
  workspacePath: string,
  args: string[],
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", ["--no-pager", ...args], {
    cwd: workspacePath,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function appendStdoutUpToBytes(
  current: string,
  chunk: string,
  maxBytes: number,
): { text: string; bytes: number; truncated: boolean } {
  const currentBytes = Buffer.byteLength(current, "utf8");
  if (currentBytes >= maxBytes) {
    return { text: current, bytes: currentBytes, truncated: true };
  }

  const remaining = maxBytes - currentBytes;
  const chunkBuf = Buffer.from(chunk, "utf8");
  if (chunkBuf.length <= remaining) {
    return {
      text: current + chunk,
      bytes: currentBytes + chunkBuf.length,
      truncated: false,
    };
  }

  let cut = remaining;
  while (cut > 0 && (chunkBuf[cut] & 0xc0) === 0x80) cut -= 1;
  const partial = cut > 0 ? chunkBuf.subarray(0, cut).toString("utf8") : "";
  return {
    text: current + partial,
    bytes: currentBytes + Buffer.byteLength(partial, "utf8"),
    truncated: true,
  };
}

function runGitAsync(
  workspacePath: string,
  args: string[],
  options?: { maxStdoutBytes?: number },
): Promise<{ ok: boolean; stdout: string; stderr: string; truncated: boolean }> {
  const maxStdoutBytes = options?.maxStdoutBytes;
  return new Promise((resolve) => {
    const child = spawn("git", ["--no-pager", ...args], {
      cwd: workspacePath,
    });

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let truncated = false;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout: "", stderr: "git command timed out", truncated: false });
    }, GIT_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (truncated) return;
      if (!maxStdoutBytes) {
        stdout += chunk;
        stdoutBytes = Buffer.byteLength(stdout, "utf8");
        return;
      }
      const next = appendStdoutUpToBytes(stdout, chunk, maxStdoutBytes);
      stdout = next.text;
      stdoutBytes = next.bytes;
      if (next.truncated) {
        truncated = true;
        child.kill();
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout: "",
        stderr: error.message,
        truncated: false,
      });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 || truncated, stdout, stderr, truncated });
    });
  });
}

export function isGitRepository(workspacePath: string): boolean {
  const result = runGit(workspacePath, ["rev-parse", "--is-inside-work-tree"]);
  return result.ok && result.stdout.trim() === "true";
}

export function detectDefaultBaseBranch(workspacePath: string): string {
  for (const candidate of ["main", "master"]) {
    const result = runGit(workspacePath, ["rev-parse", "--verify", candidate]);
    if (result.ok) return candidate;
  }

  const originHead = runGit(workspacePath, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (originHead.ok) {
    const ref = originHead.stdout.trim().replace(/^origin\//, "");
    if (ref) return ref;
  }

  return "main";
}

export function isSafeGitRef(ref: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith("-")) return false;
  if (trimmed.includes("..")) return false;
  return /^[\w./-]+$/.test(trimmed);
}

export function listLocalBranchNames(workspacePath: string): string[] {
  if (!isGitRepository(workspacePath)) return [];

  const result = runGit(workspacePath, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/",
  ]);
  if (!result.ok) return [];

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((name) => isSafeGitRef(name));
}

function matchesBranchQuery(branch: string, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const lowerBranch = branch.toLowerCase();
  if (lowerBranch.includes(lowerQuery)) return true;
  return atGitBranchLabel(branch).toLowerCase().includes(lowerQuery);
}

function listMatchingBranches(workspacePath: string, query: string, limit: number): string[] {
  const branches = listLocalBranchNames(workspacePath);
  const matches = branches.filter((branch) => matchesBranchQuery(branch, query));
  const defaultBranch = detectDefaultBaseBranch(workspacePath);

  matches.sort((a, b) => {
    if (a === defaultBranch) return -1;
    if (b === defaultBranch) return 1;
    return a.localeCompare(b);
  });

  return matches.slice(0, limit);
}

function truncateDiff(diff: string): { body: string; truncated: boolean } {
  if (Buffer.byteLength(diff, "utf8") <= MAX_GIT_DIFF_BYTES) {
    return { body: diff, truncated: false };
  }
  let body = diff.slice(0, MAX_GIT_DIFF_BYTES);
  const lastNewline = body.lastIndexOf("\n");
  if (lastNewline > 0) body = body.slice(0, lastNewline);
  return { body, truncated: true };
}

function finalizeDiff(
  stdout: string,
  truncatedDuringRead: boolean,
): { body: string; truncated: boolean } {
  if (!truncatedDuringRead && Buffer.byteLength(stdout, "utf8") <= MAX_GIT_DIFF_BYTES) {
    return { body: stdout, truncated: false };
  }
  const { body, truncated } = truncateDiff(stdout);
  return { body, truncated: truncated || truncatedDuringRead };
}

export async function getWorkingTreeDiff(workspacePath: string): Promise<GitDiffResult> {
  if (!isGitRepository(workspacePath)) {
    return { diff: "", truncated: false, empty: true, warning: "Git リポジトリではありません" };
  }

  const result = await runGitAsync(workspacePath, ["diff", "HEAD"], {
    maxStdoutBytes: MAX_GIT_DIFF_BYTES,
  });
  if (!result.ok) {
    return {
      diff: "",
      truncated: false,
      empty: true,
      warning: `git diff に失敗しました: ${result.stderr.trim() || "unknown error"}`,
    };
  }

  const diff = result.stdout;
  if (!diff.trim()) {
    return { diff: "", truncated: false, empty: true };
  }

  const { body, truncated } = finalizeDiff(diff, result.truncated);
  return {
    diff: body,
    truncated,
    empty: false,
    warning: truncated
      ? `@${AT_GIT_COMMIT_LABEL} の diff が大きすぎるため先頭部分のみ注入しました`
      : undefined,
  };
}

export async function getBranchDiff(
  workspacePath: string,
  baseBranch?: string,
): Promise<GitDiffResult> {
  if (!isGitRepository(workspacePath)) {
    return { diff: "", truncated: false, empty: true, warning: "Git リポジトリではありません" };
  }

  const base = baseBranch ?? detectDefaultBaseBranch(workspacePath);
  if (!isSafeGitRef(base)) {
    return {
      diff: "",
      truncated: false,
      empty: true,
      baseBranch: base,
      warning: `無効なブランチ名です: ${base}`,
    };
  }
  const verify = await runGitAsync(workspacePath, ["rev-parse", "--verify", base]);
  if (!verify.ok) {
    return {
      diff: "",
      truncated: false,
      empty: true,
      baseBranch: base,
      warning: `ベースブランチ ${base} が見つかりません`,
    };
  }

  const result = await runGitAsync(workspacePath, ["diff", `${base}...HEAD`], {
    maxStdoutBytes: MAX_GIT_DIFF_BYTES,
  });
  if (!result.ok) {
    return {
      diff: "",
      truncated: false,
      empty: true,
      baseBranch: base,
      warning: `git diff ${base}...HEAD に失敗しました: ${result.stderr.trim() || "unknown error"}`,
    };
  }

  const diff = result.stdout;
  if (!diff.trim()) {
    return { diff: "", truncated: false, empty: true, baseBranch: base };
  }

  const { body, truncated } = finalizeDiff(diff, result.truncated);
  return {
    diff: body,
    truncated,
    empty: false,
    baseBranch: base,
    warning: truncated
      ? `@${atGitBranchLabel(base)} の diff が大きすぎるため先頭部分のみ注入しました`
      : undefined,
  };
}

export function formatGitDiffBlock(title: string, diff: string, empty: boolean): string {
  if (empty) {
    return [`## ${title}`, "", "No changes detected.", ""].join("\n");
  }
  return ["## " + title, "", "```diff", diff, "```", ""].join("\n");
}

function matchesGitQuery(label: string, query: string): boolean {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

export function listGitMenuItems(workspacePath: string, query: string): AtMenuItem[] {
  if (!isGitRepository(workspacePath)) return [];

  const items: AtMenuItem[] = [];

  if (matchesGitQuery(AT_GIT_COMMIT_LABEL, query)) {
    items.push({
      kind: "git-commit",
      path: "commit",
      name: AT_GIT_COMMIT_LABEL,
      description: "Working tree vs HEAD",
    });
  }

  const branches = listMatchingBranches(workspacePath, query, MAX_GIT_BRANCH_MENU_ITEMS);
  for (const branch of branches) {
    items.push({
      kind: "git-branch",
      path: branch,
      name: branch,
      description: atGitBranchLabel(branch),
    });
  }

  return items;
}

# `/commit` — Create commits with sensible granularity (run to completion)

## Overview

Invoke this command from chat as **`/commit`**.

The agent **must finish in the same response**: keep going until **`git commit` succeeds** for every intended commit. Do **not** stop after only proposing a split plan or message drafts.

Granularity follows **`~/.cursor/rules/commit-granularity-guide.mdc`** (if an equivalent file exists in the workspace, prefer that). Commit message rules follow `@.cursor/skills/conventional-commits/SKILL.md`.

---

## Detect changes (required)

**Do not treat `git diff` as the only source of truth.**

- Use `git status` (recommended: `git status --porcelain=v1 -b`) to capture **staged, unstaged, and untracked** paths.
- Untracked files do not appear in `git diff`; **`??` entries must be considered commit candidates** unless you intentionally exclude them—then state the reason briefly in chat.

```bash
git status --porcelain=v1 -b
git --no-pager diff --unified=0
git --no-pager diff --cached --unified=0
```

If there is nothing to commit, print **“No changes”** and stop. If this is not a Git repository, print an error and stop.

---

## Execution policy (default: execute)

1. Post a concise plan in chat: split proposal, staging targets (paths and, if needed, patch/hunk intent), and each commit’s **message draft**.
2. **Immediately** stage and **`git commit`** until all planned commits succeed.
3. **Do not require** a “Proceed?” confirmation by default. The default is **show the plan, then execute**.

### Narrow exceptions where you may stop before committing

Only in these cases may you pause execution; explain why and what the user should do next.

- You **cannot safely split** changes without interactive staging (e.g. `git add -p`) and the environment cannot run it non-interactively.
- There is a **high risk of committing secrets** and an automated commit would be unsafe.
- **Permissions/environment** prevent writes or hooks fail in a way you cannot fix from the agent.

Otherwise, aim to **complete commits in the same turn**.

---

## Granularity

Apply the ideas from `commit-granularity-guide.mdc`, classifying/splitting by:

- Feature vs purpose (feat/fix/refactor boundaries, etc.)
- Rollback-friendly boundaries
- “Known-good” units (build/tests as required by the project)

For each commit candidate, briefly document **scope, intent, and why this split**.

---

## Message drafting

```bash
git --no-pager log --no-merges --decorate=short --pretty=format:'%h%x09%s%x09%b' -n 50
```

Before drafting any commit message, read and follow `@.cursor/skills/conventional-commits/SKILL.md`.

Use recent history only to infer repository-specific language, scope naming, and level of detail when those conventions do not conflict with the skill.

---

## Stage and commit

- Use `git reset`, `git add <paths>`, and `git add -p` (when the environment supports it) to stage per commit candidate.
- For each commit, **actually run `git commit`**, verify success, then continue.
- **Signing / non-interactive environments**
  - Your repo may use **SSH commit signing** (`gpg.format=ssh` with `user.signingkey` pointing at an SSH key). The flag name **`--no-gpg-sign` is historical**; it means **“do not attach a commit signature”**, including **SSH** signatures.
  - If signing would hang (missing `SSH_AUTH_SOCK` / agent, passphrase prompts, sandbox limits), you may use **`git commit --no-gpg-sign`** to complete the work, then follow **Post-commit signing instructions** below so the user can attach signatures locally.
  - If the goal is signed commits from automation, prefer fixing the environment (e.g. `ssh-agent` + `ssh-add`, visible `SSH_AUTH_SOCK`) over repeatedly bypassing signatures.

---

## Post-commit signing instructions (required in chat)

After **`git commit` succeeds** for the intended commit(s)—whether or not **`--no-gpg-sign`** was used—the agent **must** end the task message with a short block that tells the user **how to add or replace commit signatures afterward**.

**Signing command must cover every commit created in this `/commit` task:**

- Track **how many commits** this run actually created (same count as post-flight `git log --oneline -n "<number>"`).
- If **one** commit was created, give only the **latest-commit amend** command below.
- If **multiple** commits were created, give the **rebase --exec** command with **`N` set to that exact count** so signatures apply to **all** commits from this task—not a generic placeholder and not a smaller subset unless you explicitly explain why (e.g. user asked to sign only part).
- Optional: name the oldest newly created commit hash from `git log` so the user can verify the range; the rewrite target remains **`HEAD~N`** where **`N`** equals the number of commits created this task.

`-S` is **`--gpg-sign`**; with **`gpg.format=ssh`** it attaches an **SSH** signature, not only OpenPGP.

### Sign (or re-sign) only the latest commit

Use when this `/commit` run created **exactly one** commit. Rewrites the tip commit with the same tree and message, adding a signature:

```bash
git commit --amend -S --no-edit
```

If the tip already had a signature and you want to replace it after changing signing key or config, the same command applies.

### Sign (or re-sign) several commits from this task

Use when this `/commit` run created **`N`** commits (`N` ≥ 2). In the chat response, **substitute the concrete integer** for **`N`** (the full count from this task—same **`N`** as in post-flight `git log -n N`):

```bash
git rebase --exec 'git commit --amend --no-edit -S' HEAD~N
```

Example: if this task created **3** commits, the agent must tell the user to run:

```bash
git rebase --exec 'git commit --amend --no-edit -S' HEAD~3
```

Notes:

- This **rewrites history**; do not use on commits already pushed unless you intend to **force-push** and your team allows it.
- To sign from an ancestor ref instead of **`HEAD~N`**, use that ref as the rebase onto target (same **`--exec`** pattern), but still ensure the range covers **all** commits created in this task.

### Verify

After signing one commit:

```bash
git log --show-signature -1
```

After signing **`N`** commits, verify each (repeat or use a range as preferred):

```bash
git log --show-signature -n N
```

(Replace **`N`** in the verify command with the same count used for the rebase.)

---

## Post-flight checks

```bash
git log --oneline -n "<number of commits created>"
git status --porcelain=v1 -b
```

Confirm there are no unexpected leftovers.

---

## Hard rules

- **Never** end with only a plan: you must run **`git commit`** for each intended commit unless a narrow exception applies.
- **Do not** treat “always ask the user to proceed” as a default gate.
- **Do not** ignore untracked files surfaced by `git status`.
- **Always** include **Post-commit signing instructions** in the chat response after commits complete (copy or summarize the commands from that section so the user can run them locally). When multiple commits were created, the batch-sign command **must** use **`HEAD~N`** with **`N` equal to that task’s commit count** so every commit from the run is covered.

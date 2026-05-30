---
name: create-clean-pr
description: >-
  Pushes local commits and opens a reviewable GitHub PR with a Japanese
  imperative title and structured body via gh. Uses AskQuestion for any required
  PR content not derivable from the diff; does not infer missing Why or
  verification. Use when the user asks to create, open, or submit a pull request,
  push and PR, or write PR title and description.
disable-model-invocation: true
---

# Create clean PR

## Goal

Push local commits and open a single GitHub pull request with a Japanese,
imperative title and a structured body that reviewers can understand without
guessing. Required PR content that is not derivable from the diff must be
resolved through `AskQuestion` before `gh pr create` runs.

## Language boundary

- This skill asset stays in English.
- PR title and body must be in Japanese unless the user explicitly requests
  another language for this run.

## Use when

- The user asks to create, open, or submit a pull request.
- Local commits exist (or will exist after an agreed push) and need a PR title
  and description.
- The task is limited to push plus `gh pr create`, not implementation or review
  response.

## Do not use when

- Code still needs to be written, fixed, or verified before sharing. Route to
  `small-slice-verified-implementation` or `failure-reproduce-isolate-verify`.
- Broad scope or acceptance criteria are still unclear before any PR text is
  meaningful. Route to `decision-scope-clarification`.
- The user wants to split work across multiple PRs. Route to `split-to-prs`.
- The user only wants a code review of existing changes without opening a PR.
  Route to `findings-first-change-review`.
- `gh` is unavailable and the user has not asked for a draft-only title and body.

## Differences from nearby skills

| Skill / asset | Relationship |
| --- | --- |
| `decision-scope-clarification` | Clarifies execution paths before work. This skill collects PR-specific Why, verification, and review expectations. |
| `split-to-prs` | Splits one pile of work into multiple PRs. This skill opens one PR. |
| `small-slice-verified-implementation` | Implements and verifies code. This skill only pushes and opens the PR. |
| `commands/git-actions/setup-pr.md` | Reference for extra `gh` flags and examples. Do not edit that file from this workflow. |

## Hard rules

1. **No inference for required PR content.** If a required section is unknown,
   use `AskQuestion` and do not call `gh pr create` until it is resolved.
2. **Do not fill gaps with plausible text.** Omit unknown sections entirely during
   clarification; never use placeholders like "TBD" in the final PR body.
3. **`gh` is required.** If `gh` is missing or `gh auth status` fails, explain
   how to install or authenticate, then stop.
4. **Ask Draft vs Open every run.** Do not default silently.
5. **Scope ends at PR creation.** Do not merge, respond to review threads, fix
   CI, or split PRs unless the user starts a new task.

## Required and conditional PR sections

### Always required (ask if unclear)

| Section | Content |
| --- | --- |
| 概要 | What changed, in plain Japanese |
| 背景・目的 | Why the change exists; link issues when provided |
| 実装内容 | Bullet list of main changes |
| 確認手順 | Steps for reviewers to verify; include results only if the user confirmed them |
| レビュー観点 | What kind of feedback is wanted (quick scan, design, security, etc.) |

### Conditionally required (ask whether it applies, then ask for content if yes)

| Section | When |
| --- | --- |
| 原因と対処 | Bug fix |
| 変更結果 | UI, UX, or API behavior change |
| スコープ外 | Intentional exclusions from this PR |
| 関連 | Linked issues; use `Closes #n` when the user confirms auto-close |
| 注意事項 | Post-merge commands or operational follow-up |

### Optional (include only when the user mentions them)

- Schedule, reference links, long supplementary context

## PR body template

Use this structure for the final Japanese body. Remove sections that do not apply.

```markdown
## 概要

## 背景・目的

## 実装内容
-

## 確認手順

## レビュー観点

<!-- Include only when applicable -->

## 原因と対処

## 変更結果

## スコープ外

## 関連

## 注意事項
```

## Title rules

- Write in Japanese as a short imperative sentence.
- Example: `ログイン失敗時にエラーメッセージを表示する`
- Do not use Conventional Commits prefixes unless the user overrides for this run.
- Add `[WIP]` only when the user chose Draft via `AskQuestion`.

## AskQuestion gating

Ask only when a required or conditionally required section is still unknown after
repo inspection.

- Prefer **1-3 questions per round**. Use 4 only for independent, high-risk gaps.
- Offer concrete options (Draft/Open, review depth, base branch).
- Do not ask for facts recoverable from `git log`, `git diff`, branch names, or
  `gh issue view`.
- Repeat rounds until every required section is **confirmed**, not guessed.
- **Do not run Phase 7 (`gh pr create`) while any required section is unknown.**

### Typical Ask topics

| Topic | Why |
| --- | --- |
| 背景・目的 | Not derivable from diff alone |
| 関連 Issue | Often absent from commits |
| レビューの種類・深さ | GitHub review best practice |
| 動作確認の実施と結果 | Needed for 確認手順 |
| Draft か Open か | Required every run |
| ベースブランチ | When not the repo default |
| 原因と対処 | Bug-fix PRs |
| 変更結果の証跡 | UI/API changes (screenshots, sample responses) |
| レビュワー | When team process requires explicit assignment |

### Do not Ask (gather first)

- Changed files and diff summary
- Commit messages on the branch
- Default branch from `git remote show origin` or `gh repo view`
- Whether commits are already pushed (from `git status`)

## Steps

### Phase 0: Prerequisites

1. Run `gh auth status`. On failure, stop with install/auth guidance.
2. Confirm the current branch and that there are commits to publish (or staged
   work the user explicitly wants pushed).

### Phase 1: Gather facts (no inference)

```bash
git status
git fetch origin
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || git remote show origin | sed -n 's/.*HEAD branch: //p'
git log <base>..HEAD --oneline
git diff <base>...HEAD --stat
git diff <base>...HEAD
```

- Resolve `<base>` from the remote default branch (often `main`).
- If the user or repo uses another base, confirm via `AskQuestion`.
- Optionally run `gh issue view <n>` when an issue number appears in branch or
  commit messages.

Build a short **facts-only** summary: files touched, behavioral surface (UI,
API, config, docs), and whether the change looks like a bug fix. Label anything
not proven as unknown.

### Phase 2: Gap analysis

For each required and conditionally required section, mark **confirmed** or
**unknown**. Conditional sections need both "does this apply?" and "what is the
content?" when applicable.

### Phase 3: AskQuestion loop

1. Batch the highest-leverage unknowns (include Draft vs Open every run).
2. Record answers verbatim for the PR body.
3. Re-run gap analysis. Return to this phase until no required section is unknown.

### Phase 4: Pre-push self-check

Before push:

- Merge or rebase conflicts with `<base>` are resolved.
- Scan the diff for accidental debug output, commented-out code, or unrelated edits.
- Do not claim tests or manual checks in the PR body unless the user confirmed
  they ran them.

### Phase 5: Push

```bash
git push -u origin HEAD
```

If push fails, stop and report; do not open a PR.

### Phase 6: Compose title and body

1. Write the Japanese imperative title.
2. Fill the PR body template only with confirmed content.
3. Show the user a brief preview when useful before creation.

### Phase 7: Create PR

```bash
gh pr create \
  --title "<Japanese imperative title>" \
  --body "$(cat <<'EOF'
<filled template>
EOF
)" \
  --base <base>
```

- Add `--draft` when the user chose Draft.
- Add `--reviewer`, `--assignee`, or `--label` only when the user provided them.
- For long bodies, write `pr-body.md` and use `--body-file pr-body.md`, then
  delete the temp file if the user does not need it kept.

### Phase 8: Report

Return:

- PR URL
- Base branch and head branch
- Draft or Open state
- Anything still unverified that the user chose not to document

## Pre-push checklist

Copy and track when helpful:

```
- [ ] gh auth OK
- [ ] Base branch confirmed
- [ ] Required PR sections confirmed (no inference)
- [ ] Draft vs Open confirmed
- [ ] Conflicts resolved with base
- [ ] Diff scanned for accidental noise
- [ ] Verification claims match user-confirmed facts only
- [ ] Push succeeded
```

## Compact examples

### Good title

`ログイン失敗時にエラーメッセージを表示する`

### Bad title

`fix login` — too vague, not Japanese, no reviewer context

### Good body excerpt (bug fix)

```markdown
## 概要
ログイン失敗時にユーザー向けエラーメッセージが表示されない問題を修正する。

## 背景・目的
#456 で報告された UX 不具合に対応する。

## 原因と対処
**原因**: 認証失敗時に例外が握りつぶされ、UI へメッセージが渡っていなかった。
**対処**: 失敗理由を UI 層へ返すようハンドリングを整理した。

## 確認手順
1. 誤パスワードでログインする
2. 「パスワードが正しくありません」が表示されることを確認した
```

### Bad body pattern

```markdown
## 背景・目的
おそらくログイン周りの改善のため。
```

Do not publish this — Why is inferred, not confirmed.

## Stop conditions

| Condition | Action |
| --- | --- |
| `gh` missing or auth failed | Guide setup, stop |
| No commits to publish | Stop, ask user to commit or clarify branch |
| Required section unknown | `AskQuestion`, do not create PR |
| Push failed | Stop, fix push first |
| User cancels or defers PR | Stop without `gh pr create` |

## References

- [Helping others review your changes](https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes)
- [How to write the perfect pull request](https://github.blog/developer-skills/github/how-to-write-the-perfect-pull-request/)
- [Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)
- [レビューしてもらいやすいPRの書き方](https://hydrakecat.net/2017/10/05/writing-pr-easy-to-review.html)
- [Pull Requestは書き方が9割](https://qiita.com/miu-P/items/987ba8ff72704ea86d4d)
- Repo command reference: [commands/git-actions/setup-pr.md](../../commands/git-actions/setup-pr.md)

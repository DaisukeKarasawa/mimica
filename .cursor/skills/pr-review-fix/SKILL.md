---
name: pr-review-fix
description: Fetches unresolved review threads on a specified GitHub pull request, triages each comment for validity, plans and applies only justified fixes, commits fixes via /commit, replies on each thread, and resolves threads without pushing. Use when the user asks to address PR review comments, fix review feedback on a PR, triage and resolve review threads, or run pr-review-fix.
disable-model-invocation: true
---

# PR Review Fix

End-to-end workflow: fetch unresolved PR review threads → triage → plan → fix → quality review → `/commit` → reply and resolve every thread. **Never push**—the human pushes.

## Required input

The user must specify the pull request in the same message, as one of:

- PR URL (`https://github.com/owner/repo/pull/123`)
- `owner/repo#123` or `owner/repo/pull/123`
- PR number when the current branch’s PR is intended (`123` or `#123`)

If the PR is ambiguous or missing, ask once and stop. Do not guess.

## Prerequisites

- `gh` authenticated with permission to read the PR and write review comments.
- Local checkout on the PR head branch (or fetch/checkout it before editing).
- Read [reference.md](reference.md) for GraphQL/REST commands; do not invent GitHub APIs.

Optional: `jq` for filtering GraphQL JSON.

## Related skills and commands

| When                                                    | Read / use                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Pasted review text (no PR fetch)                        | `.cursor/commands/review-fix.md`                                                |
| Evaluate before implementing each point                 | `receiving-code-review` (superpowers) — verify, no performative agreement       |
| Architecture, dependency, boundary, compatibility fixes | `.cursor/skills/design-decision-review/SKILL.md`                                |
| MVP shortcuts, phased delivery, debt in the fix         | `.cursor/skills/ward-debt-planning/SKILL.md`                                    |
| After code changes                                      | `thermo-nuclear-code-quality-review` via Task (see below)                       |
| Record fixes locally                                    | `.cursor/commands/commit.md` (`/commit`) — required when there are code changes |

**Push policy:** Never run `git push`. The human always pushes. Thread replies and resolve happen on GitHub without requiring a push.

## Workflow

Copy and track:

```markdown
PR review fix:

- [ ] 1. Resolve PR and checkout head branch
- [ ] 2. Fetch unresolved review threads only
- [ ] 3. Triage each thread (fix / skip / ask)
- [ ] 4. Build fix plan for "fix" threads only
- [ ] 5. Implement fixes
- [ ] 6. Run verification
- [ ] 7. Thermo-nuclear review on the fix diff
- [ ] 8. `/commit` (if there are code changes)
- [ ] 9. Reply and resolve every thread
- [ ] 10. Report summary to user (remind: push is human-owned)
```

### 1. Resolve PR and branch

1. Parse owner, repo, and PR number from input (see [reference.md](reference.md)).
2. `gh pr view <n> -R owner/repo --json headRefName,baseRefName,url,title`.
3. Ensure the working tree is on `headRefName` (checkout or fetch if needed).
4. Record `baseRefName` for later diff review.

### 2. Fetch unresolved threads

1. Run the GraphQL query in [reference.md](reference.md) for `reviewThreads`.
2. **Only process threads where `isResolved` is false.**
3. For each thread, keep: `threadId` (`PRRT_…`), `path`, `line`, first/last comment bodies, comment `databaseId`s, author logins, and thread URL if present.
4. Do not load full raw API payloads into context—extract fields needed to act.

If there are zero unresolved threads, report that and stop.

### 3. Triage (validity)

For **each unresolved thread**, in order:

1. Read the review claim and the referenced code (file + line; expand context as needed).
2. Classify:
   - **Fix**: technically correct for this codebase and worth changing now.
   - **Skip**: wrong premise, out of scope, conflicts with documented requirements, YAGNI, or fix would be worse than status quo.
   - **Ask**: missing product/requirement input; cannot choose a safe fix.
3. Record brief evidence (file/symbol/test), not praise.

**Subagents (use when helpful):**

| Condition                                            | Delegate                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4+ unrelated threads                                 | Parallel `Task` (`explore` or `generalPurpose`): one thread group per task; return verdict + evidence only |
| Security, Electron boundary, rights-sensitive assets | Dedicated `Task` with explicit security checklist from `AGENTS.md`                                         |
| Single thread but large blast radius                 | `design-decision-review` conductor flow before planning                                                    |

Do not implement until all threads are triaged. If any **Ask** remains, stop and question the user before step 5.

### 4. Fix plan (fix threads only)

Produce a short plan listing only **Fix** threads. For each item:

- Thread id and one-line intent
- Files to touch
- Smallest coherent change

**Planning lenses (apply when the fix type matches):**

- **design-decision-review**: material architecture, dependencies, abstractions, compatibility, security-sensitive behavior, or unclear acceptance criteria. Use lightweight conductor-only review unless the change is broad or hard to reverse; then use specialist subagents per that skill’s `subagent-prompts.md`.
- **ward-debt-planning**: when the fix encodes uncertain domain understanding, temporary shape, or a learning slice. Use the compact **Learnable Slice** block from that skill only when it changes the plan.

Skip threads classified **Skip** in the plan (they get replies in step 8 only).

### 5. Implement

- Apply the plan with the smallest change that satisfies valid feedback and matches project patterns.
- One coherent slice; avoid drive-by refactors unless thermo-nuclear review (step 7) requires them for regressions introduced by the fix.
- Do not implement **Skip** items to “be nice.”

### 6. Verification

Run the smallest meaningful checks for touched surfaces (targeted tests, typecheck, lint, build). Treat green commands as signals—confirm they address the reviewed issue.

### 7. Thermo-nuclear review (required after fixes)

Delegate to subagent:

```python
Task(subagent_type="thermo-nuclear-code-quality-review", prompt="...")
```

Prompt must include:

- PR title and number
- Base branch name
- Summary of triage (what was fixed vs skipped)
- `git diff <base>...HEAD` or equivalent patch (or instruct the subagent to run it)

If the subagent reports **presumptive blockers** on the fix diff, address them or document why not in the thread reply before resolving.

### 8. Commit fixes (`/commit`)

When step 5 changed any tracked files:

1. Follow **`.cursor/commands/commit.md`** to completion: plan split, stage, and run **`git commit`** for every intended commit in the same turn.
2. Use **`.cursor/skills/conventional-commits/SKILL.md`** for messages.
3. Include **post-commit signing instructions** from the commit command in the user report.
4. **Do not run `git push`.**

If there were no code changes (only **Skip** threads), skip this step.

### 9. Reply and resolve **every** unresolved thread

For each thread processed in step 3 (including **Skip**):

1. Post a **thread reply** (GraphQL `addPullRequestReviewThreadReply` preferred; see [reference.md](reference.md)).
2. Run `resolveReviewThread` for that `threadId`.
3. Confirm `isResolved` is true.

**Reply content rules**

| Verdict                                        | Reply                                                                                                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fix**                                        | What changed (files/behavior), how verified, commit subject or hash if helpful. Note that the fix is committed locally and awaits human push—do not imply it is already on the remote branch. No thanks, no performative praise. |
| **Skip**                                       | Technical reason with evidence (test, doc, invariant). Offer follow-up only if a real open decision remains.                                                                                                                     |
| **Ask** (if user answered and you fixed later) | Decision taken + change summary.                                                                                                                                                                                                 |

Do not resolve a thread without a reply. Do not leave unresolved threads open after finishing.

### 10. User report

Summarize:

- PR link
- Counts: fixed / skipped / asked
- Commits created (subjects or hashes) when step 8 ran
- Validation run
- Thermo-nuclear outcome (blockers addressed or waived with reason)
- **Push:** remind the user they must push when ready (agent does not push)
- Remaining risks or explicit user decisions

## Stop rules

Stop and ask the user before implementing when:

- A fix needs a product/requirement decision not in the PR or repo docs.
- The fix is destructive, security-sensitive, or changes a broad architecture boundary without approval.
- `gh` auth or permissions block replies/resolution.

Stop without implementing when:

- No unresolved threads exist.
- Any thread remains **Ask** and the user has not answered.

## Anti-patterns

- Implementing all review comments without triage
- Resolving threads without a reply
- Top-level PR comments instead of **thread** replies
- Reading entire `gh api` JSON blobs into context
- Running `git push` (human-only)
- Skipping `/commit` when there are code changes from fixes
- Thank-you or “great catch” replies

## Additional resources

- GitHub commands and GraphQL: [reference.md](reference.md)

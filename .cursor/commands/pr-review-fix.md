# `/pr-review-fix` — Triage, fix, and resolve PR review threads

## Overview

Invoke from chat as **`/pr-review-fix <pr>`**.

Examples:

- `/pr-review-fix https://github.com/owner/repo/pull/42`
- `/pr-review-fix owner/repo#42`
- `/pr-review-fix 42` (current repo, PR for current branch if unambiguous)

The agent must follow **`.cursor/skills/pr-review-fix/SKILL.md`** end to end: fetch unresolved threads, triage, plan, fix, thermo-nuclear review on the diff, **`/commit`** when there are code changes, reply on each thread, and resolve every thread.

Do not stop after triage or a plan only—complete through thread resolution unless a stop rule in the skill applies.

## Required input

PR identifier in the same message as the command. If missing, ask once and stop.

## Execution policy

- Use `gh` for GitHub (see skill `reference.md`).
- After fixes, run **`/commit`** per `.cursor/commands/commit.md` when there are code changes.
- **Never `git push`.** The human pushes; thread reply and resolve do not require push.
- Finish with the user report defined in the skill.

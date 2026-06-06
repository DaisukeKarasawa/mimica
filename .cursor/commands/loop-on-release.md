# `/loop-on-release` — Publish VSIX + DMG via semver tag loop

## Overview

Invoke this command from chat as **`/loop-on-release`**.

The agent **must finish in the same response** when possible: keep looping until
the Release workflow succeeds and artifacts are downloaded, or a stop condition
in the skill is met.

## Required skill

Read and follow **`.cursor/skills/loop-on-release/SKILL.md`** for the full
workflow. Do not improvise a different release loop.

## Input

**No tag or bump level from the user.** The agent must:

1. Find the latest `v*` tag on the remote.
2. Inspect commits on the default branch **since that tag**.
3. Derive `NEXT_TAG` from Conventional Commits semver rules (see skill).
4. Stop with “nothing to release” when `HEAD` is already at the latest tag.

Optional only:

- **Download directory** (default `/tmp/mimica-release`)

## Execution policy

1. Post **release plan**: `LATEST_TAG`, commit summary since tag, semver
   rationale, computed `NEXT_TAG`.
2. Execute the loop: **bump versions → `/commit` if needed → tag push → watch workflow → (fix → `/commit` → branch push → re-derive tag)\* → download**.
3. After each failure, report the failing step and hypothesis before fixing.
4. After success, report release URL, artifact paths, and `docs/consumer-setup.md`.

## Hard rules

- **Never** take an explicit tag or bump override from the user
- **Semver tags only**: `vMAJOR.MINOR.PATCH`, derived from changes since latest tag
- **Annotated tags**: `git tag -a … -m …` (or `-s -a` when signing is required)
- **Never reuse** a remote tag
- **`/commit`** for fix commits (signed by default); **push default branch** before next tag
- No `--no-verify` unless `/commit` narrow fallback applies
- Do not delete remote tags unless the user explicitly asks

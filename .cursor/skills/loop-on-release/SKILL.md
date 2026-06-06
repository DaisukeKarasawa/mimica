---
name: loop-on-release
description: >-
  Loop on GitHub Release until VSIX and DMG publish successfully. Infer the next
  semver tag from changes since the latest tag (Conventional Commits), cut an
  annotated tag, push, watch the Release workflow, fix failures via /commit and
  default-branch push, retag, then download artifacts. Use when the user asks to
  release, cut a tag, loop on release CI, publish mimica consumer artifacts, or
  run /loop-on-release.
disable-model-invocation: true
---

# Loop on Release

## Trigger

Need to publish **VSIX + Companion DMG** from a semver tag and iterate until the
Release workflow succeeds.

Use `gh run list --workflow=release.yml` and `gh release view` as the source of
truth. A pushed tag with a **failed** workflow does **not** create a GitHub
Release.

**Do not accept an explicit tag from the user.** Always derive `NEXT_TAG` from
the latest existing tag and commits since that tag.

## Core loop (verbatim)

> リリース（タグ切り）から push → Release workflow 待ち → （エラーなら）修正 →
> `/commit` でコミット & default branch push → リリース（タグ切り）から push →
> Release workflow 待ち → （成功したら）成果物ダウンロード

## Prerequisites

- `gh` authenticated with `contents: write` on `mimica`.
- Default branch pushed and green enough to release (no known blockers).
- `MIMICA_ASSETS_TOKEN` repo secret set; `mimica-assets` has `packs/rio`.
- Read [reference.md](reference.md) for commands, semver rules, and failure modes.

## Related skills and commands

| When                                         | Read / use                                     |
| -------------------------------------------- | ---------------------------------------------- |
| Commit fixes after a failed release          | `.cursor/commands/commit.md` (`/commit`)       |
| Commit message format / semver signals       | `.cursor/skills/conventional-commits/SKILL.md` |
| Consumer install / smoke test after download | `docs/consumer-setup.md`                       |
| CI-only PR checks (not release)              | `loop-on-ci` (cursor-team-kit)                 |

## Workflow

Copy and track:

```markdown
Release loop:

- [ ] 1. Sync default branch; find latest tag; analyze commits since tag
- [ ] 2. Derive NEXT_TAG (semver) — stop if nothing to release
- [ ] 3. Align package versions with NEXT_TAG (`pnpm bump:release`)
- [ ] 4. Cut annotated tag and push
- [ ] 5. Watch Release workflow to completion
- [ ] 6a. On failure → diagnose → fix → `/commit` → push default branch → go to 1
- [ ] 6b. On success → download artifacts → report
```

### 1. Sync and inspect state since the latest tag

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git fetch origin --tags
git checkout <default-branch> && git pull origin <default-branch>

LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)
git rev-parse HEAD
git rev-parse "${LATEST_TAG}^{commit}" 2>/dev/null || true
```

If **no** `v*` tag exists, treat baseline as empty and read root `package.json`
`version` for the initial release (see step 2).

Collect commits since the latest tag:

```bash
# omit --first-parent if you need every merged commit on the branch
git log "${LATEST_TAG}..HEAD" --no-merges --pretty=format:'%h %s%n%b---'
```

Also note release health of `LATEST_TAG`:

```bash
gh release view "${LATEST_TAG}" 2>/dev/null || echo "no published release"
gh run list --workflow=release.yml --limit 5
```

A tag may exist on the remote while its Release workflow **failed** and no
GitHub Release was published. That tag still anchors semver baseline; new commits
after it (fixes) drive the next bump.

### 2. Derive `NEXT_TAG` (semver — no user override)

Parse `LATEST_TAG` as `vMAJOR.MINOR.PATCH`. Apply **one** bump from the highest
signal in `LATEST_TAG..HEAD` commits (Conventional Commits):

| Signal in commits since tag                                                      | Bump                         |
| -------------------------------------------------------------------------------- | ---------------------------- |
| `BREAKING CHANGE:` footer, or `type!:` / `type(scope)!:` subject                 | **MAJOR** → `v{M+1}.0.0`     |
| Any `feat` / `feat(...)` subject (no `!`)                                        | **MINOR** → `v{M}.{m+1}.0`   |
| Otherwise (`fix`, `ci`, `chore`, `docs`, `refactor`, `build`, `test`, `perf`, …) | **PATCH** → `v{M}.{m}.{p+1}` |

Rules:

- Evaluate **all** commits in range; use the **highest** bump (e.g. one `feat` +
  several `fix` → **MINOR**).
- Ignore release-only commits that only bump version or repeat `chore(release):`
  unless they carry a higher signal.
- **Stop** if `HEAD` equals `LATEST_TAG` commit: report **nothing to release**.
- **Never reuse** a tag on the remote. If computed `NEXT_TAG` already exists,
  increment **PATCH** until free (should be rare; indicates a partial retry).
- **No tags yet**: set `NEXT_TAG` to `v{package.json version}` when valid semver;
  else `v0.1.0`.

Before tagging, post a short **release plan** in chat:

- `LATEST_TAG` (or “none”) and its commit
- Commit count and one-line summary per subject since tag
- Highest semver signal found
- Computed `NEXT_TAG` and bump rationale

### 3. Align package versions with `NEXT_TAG` (required)

Artifact names (`mimica-cursor-extension-*.vsix`, DMG metadata) follow
`package.json` `version`, not the git tag alone. Before tagging:

```bash
pnpm bump:release <NEXT_TAG>
# e.g. pnpm bump:release v0.1.2
```

This updates root, `apps/cursor-extension`, `apps/companion`, and all
`packages/*/package.json` versions. Verify without writing:

```bash
pnpm bump:release:check <NEXT_TAG>
```

If `bump:release` changes files, run `/commit` and push default branch **before**
step 4. Use message shape: `chore(release): bump version to X.Y.Z`.

### 4. Cut annotated tag and push

Annotated tags are required (`fatal: no tag message?` on lightweight tags).

```bash
git tag -a <NEXT_TAG> -m "chore(release): <NEXT_TAG>"
git push origin <NEXT_TAG>
```

Use `git tag -s -a` when signing is required.

```bash
gh run list --workflow=release.yml --limit 1
```

### 5. Watch Release workflow

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json conclusion,url,displayTitle
```

Timeout budget: 45 minutes (`.github/workflows/release.yml`).

### 6a. On failure — diagnose, fix, recommit, re-derive tag

1. `gh run view <run-id> --log-failed`
2. Smallest fix for root cause ([reference.md](reference.md)).
3. `/commit` per `.cursor/commands/commit.md` (signed).
4. `git push origin <default-branch>`
5. Return to **step 1** (re-analyze commits since `LATEST_TAG`; fixes are usually
   `fix`/`ci` → **PATCH** on top of the failed tag).

**Guardrails:**

- No `--no-verify` / `--no-gpg-sign` unless `/commit` narrow fallback applies.
- Max **5** failed release runs per session without a new hypothesis.
- Do not delete remote tags unless the user explicitly asks.

### 6b. On success — download artifacts

```bash
gh release view <NEXT_TAG>
mkdir -p /tmp/mimica-release
gh release download <NEXT_TAG> --dir /tmp/mimica-release
ls -lah /tmp/mimica-release
```

Expect: `mimica-cursor-extension-*.vsix` and `Mimica-*.dmg`.

## Output

Each iteration:

- `LATEST_TAG`, commits since tag, semver rationale, `NEXT_TAG`
- Workflow URL and conclusion
- Fix commits (if any) and default-branch push status
- On success: release URL, artifact paths and sizes
- Consumer smoke test: `docs/consumer-setup.md` §5

## Stop conditions

- Release workflow **success** and artifacts downloaded.
- **Nothing to release** (`HEAD` == latest tag commit).
- User asks to stop.
- Five consecutive release failures without a new hypothesis.
- External blocker (`MIMICA_ASSETS_TOKEN`, empty `mimica-assets`, etc.).

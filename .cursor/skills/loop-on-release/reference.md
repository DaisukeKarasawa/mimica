# Loop on Release — reference

## Release workflow

- File: `.github/workflows/release.yml`
- Trigger: push tag matching `v*`
- Runner: `macos-latest`, Node **22**
- Artifacts: `mimica-cursor-extension-*.vsix`, `Mimica-*.dmg`

## State since latest tag

```bash
DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin --tags
git checkout "$DEFAULT" && git pull origin "$DEFAULT"

LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)
echo "latest=$LATEST_TAG head=$(git rev-parse --short HEAD)"

# Commits since tag (subjects + bodies for BREAKING CHANGE)
git log "${LATEST_TAG}..HEAD" --no-merges \
  --pretty=format:'%h%x09%s%n%b%n---'

# Same commit? → nothing to release
test "$(git rev-parse "${LATEST_TAG}^{commit}")" = "$(git rev-parse HEAD)" \
  && echo "HEAD is at LATEST_TAG"
```

### No tags yet

```bash
node -p "require('./package.json').version"
# → e.g. 0.1.0 → first tag v0.1.0
```

## Semver derivation (Conventional Commits)

Inspect every commit in `LATEST_TAG..HEAD`. Take the **maximum** bump:

```text
BREAKING CHANGE: in body          → MAJOR
feat!: or feat(scope)!: in subject → MAJOR
feat: or feat(scope): in subject  → MINOR  (only if no MAJOR signal)
fix:, ci:, chore:, docs:, …       → PATCH  (when no MAJOR/MINOR signal)
```

Examples (after `v0.1.1`):

| Commits since tag                              | NEXT_TAG |
| ---------------------------------------------- | -------- |
| `fix(ci): use Node 22 in release workflow`     | `v0.1.2` |
| `feat(extension): add companion path setting`  | `v0.2.0` |
| `feat(companion)!: change bridge port default` | `v1.0.0` |
| (none — HEAD at tag)                           | _stop_   |

After a **failed** workflow on `v0.1.2`, a follow-up `fix(ci): …` commit →
re-run step 1 → still `LATEST_TAG=v0.1.2`, one new `fix` → `v0.1.3`.

## Tag commands (annotated only)

```bash
git tag -a v0.1.2 -m "chore(release): v0.1.2"
git push origin v0.1.2
```

## Workflow watch / download

```bash
gh run list --workflow=release.yml --limit 3
gh run watch <run-id> --exit-status
gh run view <run-id> --log-failed

gh release view v0.1.2
gh release download v0.1.2 --dir /tmp/mimica-release
```

## Known failure modes

| Step                   | Cause               | Fix                       |
| ---------------------- | ------------------- | ------------------------- |
| Checkout mimica-assets | PAT missing/expired | `MIMICA_ASSETS_TOKEN`     |
| Stage character pack   | no `packs/rio`      | commit to mimica-assets   |
| Package VSIX           | undici on Node 20   | `release.yml` Node 22     |
| Publish GitHub Release | prior step failed   | fix + **new** derived tag |

## package.json version vs git tag

Always run before tagging:

```bash
pnpm bump:release v0.1.2
pnpm bump:release:check v0.1.2   # exit 0 when aligned
```

Script: `scripts/bump-release-version.mjs` — updates root, apps, and all
`packages/*/package.json`. Commit bumps via `/commit` before `git tag`.

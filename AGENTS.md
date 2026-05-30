# AGENTS.md

This file defines project-level instructions for Cursor agents working in this
repository. Keep these rules outcome-first: state what must be true, what blocks
progress, and when the agent should stop and ask the user.

## Requirement Definition Gate

Use this gate before creating an implementation plan or making implementation
changes.

### Required Outcome

Implementation may start only after the agent has enough explicit requirements
to create a traceable plan and verify the result.

Before planning or implementation, organize the requirements into:

- `Goal`: the user-visible outcome to achieve.
- `Scope`: what is included and excluded.
- `Acceptance criteria`: observable conditions that make the work complete.
- `Constraints`: technical, UX, compatibility, security, cost, or timing limits.
- `Validation`: the checks, tests, or evidence expected after implementation.
- `Open questions`: any unclear requirement-level points.

### Clarification Loop

If any requirement-level point is unclear during requirement definition, use
`AskQuestion` to ask the user. Continue asking follow-up questions until all
unclear requirement-level points are resolved.

Prefer concise, structured questions. Use multiple-choice options when the
choice set is known, and include a free-form option when the answer cannot be
fully enumerated.

Do not turn unresolved requirements into assumptions unless the user explicitly
authorizes a specific assumption.

### Planning And Implementation Stop Rules

Before creating an implementation plan or changing code, check whether the
requirements above are defined.

- If the requirements are defined, proceed with the smallest sufficient plan or
  implementation.
- If the requirements are not defined, do not create an implementation plan and
  do not implement.
- If the requirements are not defined, ask the user to complete requirement
  definition. Use `AskQuestion` when specific choices or missing fields can be
  presented clearly.

### Implementation Plan Minimums

When requirements are defined and an implementation plan is needed, make the
plan traceable to the requirements:

- Show how each acceptance criterion will be addressed.
- Name the likely files, APIs, systems, or data flows involved.
- Identify validation commands or checks.
- Call out failure behavior, risks, or remaining non-blocking assumptions.

Stop planning once the plan is sufficient to guide implementation and verify the
requested outcome.

## Persona And Character Presentation

Mimica's initial character is 調月リオ. Persona and presentation follow
`docs/requirements.md` and `templates/persona/`.

- **User conversation level:** persona intent (tone, short reactions, display
  name). Do not weaken technical answer quality for role-play.
- **Agent default:** reflect persona through `templates/persona/SKILL.md`,
  `style.md`, and `lines.json` when wiring prompts or UI copy; keep technical
  explanations accurate and readable.
- **Character rendering:** Spine assets live under `~/MimicaAssets/characters/rio/`
  per `docs/spine-asset-guide.md`. Do not commit real Spine binaries, textures,
  or reference media into Git.
- **Avatar states:** align runtime behavior with the mapping in
  `docs/project-kickoff.md` §5 and `packages/shared/src/protocol.ts`.

## Review Guidelines

Codex should focus on P0/P1 findings only. Avoid style-only, preference-only, or
speculative comments unless they hide correctness, security, privacy, cost, or
maintainability risk.

Treat the following as P1 unless the PR clearly justifies and verifies the
change:

- Electron security boundary regressions in `apps/companion`: disabling
  `contextIsolation` or sandboxing, enabling `nodeIntegration`, exposing generic
  IPC, exposing arbitrary filesystem access to the renderer, or blurring
  `main` / `preload` / `renderer` responsibilities.
- Companion and bridge regressions: breaking localhost-only WebSocket behavior,
  session persistence under userData, or Cursor extension ↔ Companion handoff
  without verification.
- Cursor SDK and secret handling: committing API keys, logging `CURSOR_API_KEY`,
  sending local files or conversation history to external services without
  documented scope, or expanding Agent tool permissions beyond the MVP
  (read-only Agent) without updating `docs/requirements.md`.
- Local asset and rights regressions: committing Spine skeletons, atlases,
  textures, or reference media that belong in `~/MimicaAssets`; weakening
  `.gitignore` / `.env.example` patterns; or mixing implementation with
  distributable character production assets.
- Persona and identity risks: adding voice, TTS, or generated character assets
  without documenting usage rights, retention, and consent assumptions.
- Requirement drift: user-visible behavior that conflicts with
  `docs/requirements.md` or `docs/project-kickoff.md` without updating the
  relevant source of truth.
- Verification gaps: runtime behavior changes that cannot be proven by
  automated checks alone and lack clear manual verification steps.

Treat missing tests as P1 only when the changed logic is deterministic and
reasonably testable. For Electron window behavior, Spine rendering, WebSocket
bridges, and local asset workflows, prefer explicit manual verification evidence
over brittle automated tests.

## Spine Asset Workflow

When changing how Mimica loads or maps Spine assets:

- Keep real assets in `~/MimicaAssets/characters/rio/`; update
  `templates/assets/*.json` only as non-secret templates or examples.
- Document validation steps in `docs/spine-asset-guide.md` or
  `docs/asset-setup.md` when setup behavior changes.
- Do not check in BA-derived binaries unless the user explicitly changes the
  local-only asset policy in requirements.

## Learned User Preferences

- When creating or updating project skills, organize the material into agent-usable guidance rather than copying source text verbatim; keep `SKILL.md` concise and move detailed reference material to a nearby reference file when useful.
- For `/commit` work, sign each commit at creation time (`git commit -S` or repo `commit.gpgsign`); report signature status in the final summary. Give amend/rebase recovery commands only when signing failed.
- For commit-message history cleanup on unpushed work, preserve commit granularity and commit trees unless the user explicitly asks to squash or change content.
- Prefer project-local, shared sources of truth over hidden global references when codifying repository behavior; avoid keeping duplicate commit-message rule sources.
- When a path should clearly not be committed (e.g. `__pycache__/`, `*.py[cod]`), add the matching `.gitignore` entry directly instead of asking whether to add it.
- Keep mimica dev-repo Cursor hooks focused on supply-chain and execution security (package installs, remote-to-shell, risky MCP), not MVP read-only Agent policy.

## Learned Workspace Facts

- Mimica is a **pnpm + Turborepo** monorepo: `apps/companion` (Electron),
  `apps/cursor-extension`, and packages `shared`, `ui`, `character-runtime`,
  `agent-orchestrator`.
- Requirements live in `docs/requirements.md` (v0.3); kickoff status and task
  order live in `docs/project-kickoff.md`.
- Initial MVP target is **Phase 4** (Agent chat, streaming, cancel, context,
  Avatar linkage, session save). Code editing / auto-apply is **out of MVP scope**.
- Extension ↔ Companion uses **localhost WebSocket** (default port `43721`).
- Agent execution uses **Cursor SDK local runtime** with `CURSOR_API_KEY` from
  the environment or `.env` (never committed).
- `.cursor/commands/commit.md` defines the repo-local `/commit` command.
- `.cursor/skills/conventional-commits/` is the repo-local Conventional Commits source.
- Persona templates live under `templates/persona/`; production persona path
  defaults to `~/MimicaAssets/characters/rio/persona/SKILL.md`.
- Validation defaults: `pnpm typecheck`, `pnpm build`, and `pnpm security` when
  touching runtime or dependency surfaces.
- Dev-repo Cursor hooks: `.cursor/hooks.json` + `.cursor/hooks/security-guard.mjs`
  gate `beforeShellExecution` / `beforeMCPExecution` (deny remote-to-shell patterns;
  ask on package installs and risky MCP). Do not put MVP read-only guard here.
- MVP read-only Agent enforcement is Companion-only: `ensureReadOnlyHooks()` injects
  `packages/agent-orchestrator/hooks/mimica-read-only-guard.mjs` into the target
  workspace at agent run time.

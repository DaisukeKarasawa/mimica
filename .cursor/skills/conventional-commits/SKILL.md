---
name: conventional-commits
description: Drafts and reviews git commit messages using Conventional Commits. Use when writing, validating, or revising commit messages, especially from `.cursor/commands/commit.md`.
disable-model-invocation: true
---

# Conventional Commits

Use this skill to produce a ready-to-use Conventional Commit message for one
coherent change.

## Quick Start

1. Start from the actual intent of the commit, not the file list.
2. Use this structure:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

3. Choose the type that best matches the change:
   - `feat`: adds a new feature
   - `fix`: fixes a bug
   - `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`: use
     when they describe the change more accurately
   - `revert`: suitable when reverting prior work
4. Add a scope only when it clarifies the affected area. Keep it short and align
   it with repository terminology.
5. Mark breaking changes explicitly with `!` before the colon, a
   `BREAKING CHANGE:` footer, or both.
6. Use repository history only to infer language, scope naming, and detail
   level. Do not let local habits override the Conventional Commits structure.

## Message Drafting Rules

- Draft one message per coherent commit. If the work mixes multiple intents,
  split the commit before finalizing the message.
- Keep the subject line specific and outcome-focused.
- Add a body only when the subject alone does not explain what changed and why.
- Add footers only when they carry real metadata such as references, review
  notes, or breaking-change details.
- Use trailer style for footers, such as `Refs: #123` or `Reviewed-by: Name`.
- Use hyphenated footer tokens like `Acked-by`, except `BREAKING CHANGE`.

## Validation Checklist

Before finalizing a message, verify:

- The header matches `<type>[optional scope][!]: <description>`.
- The type matches the actual purpose of the change.
- The scope is helpful rather than decorative.
- Breaking changes are explicit.
- Body and footers are separated by blank lines when present.
- The message can be understood without reading the entire diff first.

## Output

When asked to draft a commit message, return the exact message text ready to use.
If no body or footer is needed, return only the header line.

## Examples

```text
feat(auth): add JWT refresh token flow
```

```text
fix(api): prevent duplicate webhook delivery

Ignore retries that reuse a completed delivery id.

Refs: #123
```

```text
feat(config)!: support layered config inheritance

BREAKING CHANGE: `extends` now merges external config files.
```

## Additional Reference

For detailed semantics, rationale, and more examples, read
[`reference.md`](reference.md).

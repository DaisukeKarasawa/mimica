# Conventional Commits Reference

This file keeps the detailed reference material behind the
`conventional-commits` skill. The skill itself stays short and action-oriented;
this document holds the extra semantics, examples, and reminders an agent may
need for edge cases.

## Core Format

Use this message shape:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- `type` is required.
- `scope` is optional.
- `!` is optional and marks a breaking change in the header.
- A colon followed by a space is required before the description.

## Type Semantics

Use these semantics as the baseline:

- `feat`: adds a new feature. In SemVer terms this maps to a MINOR change.
- `fix`: fixes a bug. In SemVer terms this maps to a PATCH change.
- Other types are allowed when they are more accurate, for example:
  `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`.
- These additional types do not imply a SemVer bump unless the commit is also
  breaking.

If a change feels like multiple types at once, treat that as a signal to split
the work into multiple commits when possible.

## Scope

- Scope is optional.
- When used, it should be a short noun that names the affected area of the
  codebase.
- Prefer repository terminology over invented labels.
- Skip scope when it adds noise rather than clarity.

Examples:

```text
feat(parser): add array literal support
fix(api): reject duplicated webhook events
```

## Subject Line

- The subject is a short summary of the code change.
- Make it specific enough that the reader can understand the intent from the
  log.
- Keep the subject aligned with the actual commit contents, not the broader
  project goal.
- Recent repository history may guide language and scope naming, but it should
  not break the Conventional Commits format.

## Body

- The body is optional.
- If present, it starts after one blank line below the subject.
- Use it to explain what changed and why, especially when the subject alone is
  not enough.
- The body may contain multiple paragraphs.

Example:

```text
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.
```

## Footers

- Footers are optional.
- If present, they start after one blank line below the body, or below the
  subject if there is no body.
- Use trailer-style entries such as `Token: value` or `Token #123`.
- Footer tokens should use hyphens instead of spaces, for example `Acked-by`.
- `BREAKING CHANGE` is the special exception and may contain a space.
- `BREAKING-CHANGE` should be treated as equivalent to `BREAKING CHANGE`.

Examples:

```text
Reviewed-by: Z
Refs: #123
```

## Breaking Changes

A breaking change must be explicit in one of these ways:

1. Add `!` before the colon in the header.
2. Add a `BREAKING CHANGE:` footer.
3. Use both when the extra footer detail is helpful.

If you use `!` without a `BREAKING CHANGE:` footer, the subject line should
still make the breaking behavior clear.

Examples:

```text
feat!: send an email to the customer when a product is shipped
```

```text
feat(api)!: send an email to the customer when a product is shipped
```

```text
feat!: drop support for Node 6

BREAKING CHANGE: use JavaScript features not available in Node 6.
```

## Common Questions

### How should commit messages work in early-stage development?

Prefer treating the project as if it were already released. Even early users or
teammates benefit from knowing what was fixed, added, or broken.

### Should commit types be lowercase or uppercase?

Either can work if the tooling accepts it, but consistency matters more. The
skill defaults to lowercase because that is the most common convention.

### What if one commit contains multiple kinds of changes?

Split it into multiple commits when possible. Conventional Commits works best
when each commit has one primary intent.

### Does this slow development down?

It adds a small amount of structure, but the payoff is easier release
automation, cleaner history, and better reviewability.

### Are all contributors required to use Conventional Commits directly?

Not necessarily. In squash workflows, maintainers can often normalize commit
messages at merge time.

### How should revert commits be handled?

The spec does not fully define revert behavior. A practical pattern is to use
`revert` as the type and reference the reverted commit SHA in a footer.

Example:

```text
revert: let us never again speak of the noodle incident

Refs: 676104e, a215868
```

## Why This Convention Helps

- It enables changelog automation.
- It helps tools infer release impact from commit history.
- It gives teammates and users a structured summary of change intent.
- It makes history easier to search, review, and reason about later.

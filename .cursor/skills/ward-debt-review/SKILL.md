---
name: ward-debt-review
description: Use when reviewing code, designs, diffs, PRs, architecture notes, or implementation plans for technical debt, domain mismatch, or refactoring risk.
---

# Ward Debt Review

## Overview

Review for mismatch between what the team now understands and what the system
expresses. Prioritize risks that will charge interest in future work.

## When To Use

Use this skill when:

- The user asks for a review of code, a diff, a design, or a plan.
- The change introduces names, boundaries, data models, abstractions, tests, or
  workflows that may encode domain assumptions.
- The phrase "technical debt" appears, or the review needs to distinguish real
  debt from messy code, old technology, or ordinary cleanup.
- A fast implementation may be accepted if it remains learnable and repayable.

Do not use it as a replacement for normal correctness, security, or test review.
Use it as an added lens.

## Review Lenses

Check only the lenses relevant to the artifact:

- `Language`: do names match current domain language?
- `Concepts`: are distinct concepts collapsed, or one concept split across
  unrelated places?
- `Boundaries`: do modules, services, components, or APIs follow the current
  responsibility model?
- `Tests`: do tests document the intended understanding, or only lock in an old
  shape?
- `Docs`: do comments and docs explain the current model or preserve obsolete
  assumptions?
- `Change friction`: where will future changes repeatedly pay interest?

## Findings Format

Lead with material findings. For each finding, include:

- `Mismatch`: what understanding and system shape disagree.
- `Interest`: what future cost this creates.
- `Repayment`: the smallest useful correction.
- `Evidence`: file, diff, design section, or observed behavior.

If no material mismatch exists, say so and name any remaining verification gap.

## Decision Rules

- Do not call something debt merely because it is old, unfamiliar, duplicated, or
  imperfect.
- Do call out clear code that faithfully reflects incomplete understanding; the
  repayment trigger may be future learning, not immediate cleanup.
- Prefer focused repayment over broad rewrites.
- When the artifact is a plan, check whether it states what will be learned and
  when repayment should happen.
- Separate blocking findings from optional improvements.

## Compact Output

```md
## Ward Debt Review
- Findings:
- Repayment opportunities:
- Acceptable debt, if any:
- Verification gaps:
- What would change this review:
```

## Subagent prompts

For material decisions, use the templates in
[subagent-prompts.md](subagent-prompts.md) or dispatch agents under
[agents/](../../agents/) (for example `ward-debt-domain-alignment-reviewer.md`,
`ward-debt-repayment-scope-reviewer.md`, `ward-debt-learning-slice-reviewer.md`).

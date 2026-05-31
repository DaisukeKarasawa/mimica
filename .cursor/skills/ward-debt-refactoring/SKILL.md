---
name: ward-debt-refactoring
description: Use when refactoring, renaming, rearchitecting, simplifying, untangling legacy code, or deciding whether cleanup repays real technical debt.
---

# Ward Debt Refactoring

## Overview

Refactoring repays debt when it brings the system closer to the team's current
understanding. The goal is not cleaner-looking code in the abstract; it is less
interest from mismatch.

## When To Use

Use this skill when:

- New domain understanding has emerged and the code still reflects an older
  model.
- Repeated work is slowed by confusing names, duplicated concepts, brittle
  tests, boundary friction, or constant explanations.
- A refactor, rename, extraction, migration, or rearchitecture is proposed.
- You need to distinguish repayment from aesthetic cleanup.

Do not use it for formatting, purely mechanical cleanup, or local readability
fixes that do not affect the system's model.

## Repayment Test

Before recommending or performing a refactor, identify:

- `Current understanding`: what is now believed about the domain or workflow.
- `System mismatch`: where code, tests, docs, names, or boundaries still encode
  the older or weaker model.
- `Interest`: the recurring cost caused by that mismatch.
- `Repayment step`: the smallest change that reduces the mismatch.
- `Safety check`: characterization tests, focused tests, type checks, review, or
  a smoke test that proves behavior stayed intact.

If you cannot name the mismatch and interest, call it cleanup, not debt
repayment.

## Decision Rules

- Prefer local repayment when the mismatch is local and reversible.
- Escalate to architecture work only when concepts cross stable boundaries,
  shared contracts, persisted data, or multiple teams/modules.
- Preserve behavior unless the user explicitly asks to change it.
- Rename when language is the debt: misleading names are interest-bearing.
- Extract abstractions only when they express a real concept or remove repeated
  mismatch, not because duplication merely exists.
- Keep repayment small enough to verify unless the mismatch itself is systemic.

## Output Shape

Use this when the refactor decision is material:

```md
## Debt Repayment Brief

- Current understanding:
- System mismatch:
- Interest being paid:
- Recommended repayment:
- Why this is the smallest useful step:
- Behavior preservation:
- Verification:
- What would overturn this:
```

## Common Mistakes

| Mistake                                 | Better move                                                       |
| --------------------------------------- | ----------------------------------------------------------------- |
| Refactoring because code feels old      | Name the understanding it fails to express                        |
| Rewriting because local cleanup is hard | Check whether boundaries or contracts actually force a rewrite    |
| Extracting a generic helper             | Extract the domain concept only when the concept is stable enough |
| Preserving every legacy shape           | Preserve shipped behavior, not accidental internal confusion      |

## Related agents

- [ward-debt-repayment-scope-reviewer](../../agents/ward-debt-repayment-scope-reviewer.md)

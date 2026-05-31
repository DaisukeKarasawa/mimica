---
name: ward-debt-planning
description: Use when planning features, implementation slices, MVPs, prototypes, experiments, migrations, or ambiguous work where learning and future refactoring risk matter.
---

# Ward Debt Planning

## Overview

Plan as if early delivery is a loan taken to learn. The plan is good when it
gets useful feedback quickly while keeping the code honest about current
understanding and easy to repay after learning.

## When To Use

Use this skill when:

- A feature or slice will ship before the domain is fully understood.
- The user asks for an MVP, prototype, quick implementation, migration, or
  phased delivery.
- A shortcut, temporary shape, compatibility layer, or abstraction is being
  considered.
- The work may reveal new names, boundaries, rules, or workflows.

Do not use it for trivial mechanical edits where no learning or future mismatch
is expected.

## Planning Contract

Frame the plan with:

- `Goal`: user-visible outcome.
- `Current understanding`: facts and assumptions the implementation will encode.
- `Learning target`: what the slice is expected to discover or validate.
- `Debt risk`: where the system may diverge from later understanding.
- `Repayment trigger`: the concrete signal that should prompt refactoring.
- `Smallest slice`: the least work that can produce useful learning.
- `Verification`: tests, checks, smoke tests, review, or observed feedback.

## Decision Rules

- Prefer a small slice that teaches something over a broad slice that only adds
  surface area.
- Keep names, tests, and boundaries clear enough to reveal what was believed at
  the time.
- Avoid shortcuts that hide domain uncertainty behind vague helpers, catch-all
  models, or generic abstractions.
- Use temporary code only when its owner, reason, verification, and removal or
  repayment trigger are explicit.
- If learning would invalidate a stable public contract, migration, data model,
  or security boundary, plan before shipping the shortcut.

## Output Shape

Use this compact structure when the Ward debt lens changes the plan:

```md
## Learnable Slice

- Goal:
- Current understanding:
- Assumptions:
- Learning target:
- Smallest slice:
- Debt risk:
- Repayment trigger:
- Verification:
- What would change this plan:
```

Omit the structure when the normal answer is enough.

## Common Mistakes

| Mistake                                              | Better move                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Calling sloppy code "technical debt"                 | Keep the code clear and name the real uncertainty              |
| Planning a rewrite after every MVP                   | Name the specific repayment trigger                            |
| Adding generic abstractions for unknown future cases | Encode current understanding directly and keep it refactorable |
| Shipping to learn without tests or observation       | Define how learning and correctness will be detected           |

## Related agents

- [ward-debt-learning-slice-reviewer](../../agents/ward-debt-learning-slice-reviewer.md)

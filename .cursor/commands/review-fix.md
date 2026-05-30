# `/review-fix` - Validate review feedback and apply necessary fixes

## Overview

Invoke this command from chat as **`/review-fix <review result>`**.

Use it when the user provides review feedback and wants the agent to evaluate
whether each point is valid, then implement only the fixes that are justified.

---

## Required input

The review result **must be included in the same message as the command**.

If no review result is provided:

1. State that `/review-fix` cannot run without the review result.
2. Ask the user to paste or summarize the review result.
3. Stop. Do not inspect files or make changes.

---

## Required skills

Before evaluating the review result, read and follow:

- `.cursor/skills/design-decision-review/SKILL.md` when a review point involves
  architecture, dependencies, compatibility, or design trade-offs.

When choosing how to fix a valid review point, use additional skills only when
they fit the nature of the decision:

- For architecture, dependency, compatibility, boundary, or design trade-off
  decisions, read and follow `.cursor/skills/design-decision-review/SKILL.md`.
- For refactoring, simplification, renaming, or technical-debt repayment
  decisions, read and follow `.cursor/skills/ward-debt-refactoring/SKILL.md`.

If both apply, use `design-decision-review` first for architectural fit, then
`ward-debt-refactoring` for refactoring scope.

When neither skill applies, evaluate the review point directly against the
referenced code and project docs.

---

## Evaluation policy

Evaluate the review result before changing code.

For each review point:

1. Identify the claim being made.
2. Check the relevant code, tests, docs, or configuration.
3. Classify the point as:
   - **Valid**: supported by the codebase and worth fixing.
   - **Invalid**: contradicted by codebase evidence or based on a wrong premise.
   - **Unclear**: cannot be decided without missing requirement-level input.
4. Explain the evidence briefly.

Do not implement invalid review points. If a point is unclear and the missing
information is required to choose a safe fix, ask the user and stop before
modifying code.

---

## Fix policy

After evaluation, immediately implement fixes for valid review points unless a
stop condition below applies.

Use the smallest coherent change that resolves the valid issue and follows the
existing project patterns. Do not add broad abstractions, compatibility layers,
or dependencies unless the evaluation shows they are necessary.

Stop and ask the user before implementation only when:

- The review point requires a product or requirement decision not present in the
  review result.
- The fix would be destructive, security-sensitive, privacy-sensitive, or
  likely to change a broad architecture boundary.
- The fix conflicts with existing documented requirements.

Do not create commits or pull requests unless the user explicitly asks.

---

## Validation

Run the smallest meaningful verification for the changes made:

- Prefer targeted tests, type checks, lint, build checks, or a focused smoke
  test, depending on the affected surface.
- If full validation is too expensive or unavailable, run a narrower check and
  state the remaining risk.

Treat command success as evidence, not proof. Inspect the result enough to know
whether it addresses the reviewed issue.

---

## Result report

End with a concise report that includes:

- Which review points were valid, invalid, or unclear.
- What fixes were applied.
- What validation was run and the result.
- Any remaining risk or user decision needed.

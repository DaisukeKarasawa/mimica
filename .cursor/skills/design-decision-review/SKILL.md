---
name: design-decision-review
description: Reviews architecture, design, refactor, dependency, compatibility, and implementation decisions using Decision Quality, design failure patterns, and specialist Subagents. Use when evaluating trade-offs, avoiding overengineering, checking acceptance criteria, or when the user asks for design decision review.
---

# Design Decision Review

Use this skill to review design and implementation decisions before they harden into architecture, dependencies, abstractions, compatibility guarantees, or acceptance criteria. The outcome is a concise recommendation that names the real frame, the dominant evaluation axis, material risks, required verification, and evidence that would change the recommendation.

## When To Use

Use this skill for architecture choices, design trade-offs, broad refactors, new dependencies, compatibility layers, abstractions, security or audit-sensitive flows, state transitions, idempotency, ownership boundary changes, or any proposal framed as "best practice", "future-proof", "temporary", or "just make it pass".

Do not use this skill for tiny mechanical edits unless the edit changes a stable contract, responsibility boundary, data model, operational burden, or verification standard.

## Review Depth

Run a lightweight conductor-only review when the decision is local, reversible, low-risk, and has clear acceptance criteria.

Run a deep review with specialist subagents when the decision is material: broad in scope, hard to reverse, ambiguous in acceptance criteria, security/cost/operations sensitive, dependent on unverified external APIs, or likely to encode long-lived architecture.

When deep review is needed, provide each subagent with the decision, known constraints, relevant files or evidence, and the exact output expected. Subagents start with clean context; do not assume they know prior conversation history.

## Conductor Responsibilities

- Frame the real decision before optimizing a solution.
- Identify one dominant evaluation axis and any secondary conditions.
- Check whether the proposal matches common design failure patterns.
- Prefer existing project patterns, standard solutions, and verified APIs over new mechanisms.
- Treat command success, green tests, HTTP 200, and plausible answers as signals to inspect, not proof of the real outcome.
- Synthesize subagent findings into one recommendation; do not paste five independent reviews.
- Preserve the user's newest request and the active Cursor mode. In Ask or Plan mode, review only; do not edit files or run state-changing commands.
- State what evidence would overturn the recommendation.

## References

Read only what is needed:

- `evaluation-axes.md`: axis definitions, dominant axis, secondary conditions, and bias notation.
- `failure-patterns.md`: operational design failure catalog.
- `subagent-prompts.md`: subagent contract and shared output format.
- `output-template.md`: lightweight and deep review output templates.

## Stop Rules

Ask for clarification only when missing information would materially change the recommendation or create meaningful risk. Otherwise, state assumptions and proceed.

Stop once the review answers the core decision with enough evidence, names remaining unknowns, and gives verification or overturning conditions. Do not expand into an implementation plan unless the user asks for one.

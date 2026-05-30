# Subagent Prompt Contract

Decision Quality subagents are specialist reviewers. They collect evidence and surface risks; the parent conductor makes the final recommendation.

## Invocation Context

When launching a reviewer, provide:

- The decision or proposal being reviewed.
- Known requirements, constraints, acceptance criteria, and non-goals.
- Relevant file paths, diffs, specs, commands, or docs if available.
- The reviewer's specific lens.
- This output contract.

Subagents start with clean context. They must rely only on the parent prompt plus their own read-only inspection.

## Required Output

```md
## Findings
- [Risk or concern]

## Evidence
- [Specific code, requirement, command result, documentation, or Unknown]

## Suspected Failure Pattern
- [Pattern name or None]

## Acceptable Exception
- [Conditions that would make the current choice acceptable]

## Overturning Evidence
- [What would change this assessment]
```

## Reviewer Rules

- Stay in review mode. Do not edit files or implement fixes as part of this workflow.
- Prefer concrete evidence over generic best practices.
- Report `Unknown` when evidence is missing; do not fill gaps with plausible assumptions.
- Prioritize material risks. Avoid listing every theoretical concern.
- Do not make the final product decision. State local findings for the conductor to synthesize.
- If no material issue is found, say so and name any remaining verification gap.

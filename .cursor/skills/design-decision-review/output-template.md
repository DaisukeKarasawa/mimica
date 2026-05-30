# Output Templates

Use the shortest template that still makes the decision inspectable.

## Lightweight Review

```md
## Decision
[Recommended choice in 1-3 sentences.]

## Frame
[The real decision being made.]

## Dominant Axis
[One primary evaluation axis and why it dominates.]

## Key Risks
- [Pattern or risk]: [evidence and likely impact]

## Verification
- [The real condition that proves the decision worked]

## Overturning Evidence
- [Specific evidence that would change the recommendation]
```

## Deep Review Synthesis

```md
## Decision
[Recommended choice, including whether to accept, reject, simplify, defer, or gather more evidence.]

## Frame
[The problem to solve, separated from the proposed solution.]

## Dominant Axis
[One primary axis.]

## Secondary Conditions
- [Axis]: [minimum bar that must be met]

## Key Risks
- [Severity] [Failure pattern or risk]: [evidence, impact, and owner if known]

## Conditions If Accepted
- [Condition required to make the current proposal acceptable]

## Verification
- [Business or user-visible acceptance condition]
- [Technical validation command, test, inspection, or operational check]

## Overturning Evidence
- [Evidence that would make a different recommendation better]
```

## Synthesis Guidance

Lead with the recommendation. Merge duplicate findings from subagents. If two reviewers disagree, identify the value conflict rather than averaging the positions.

Do not equate successful commands with completion. Verification should name the real outcome: persisted data, accepted downstream side effect, enforced invariant, visible behavior, or agreed operational readiness.

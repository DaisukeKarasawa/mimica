# Design Failure Patterns

Use these patterns as diagnostic labels, not as automatic vetoes. A pattern matters when it explains a concrete risk in the current decision.

## Wheel Reinvention

Definition: A custom mechanism replaces a standard tool, framework feature, protocol, or database capability without enough justification.

- Detection questions: What standard solution already exists? What constraint makes it insufficient? Has that constraint been measured or documented?
- Biased axes: `Purpose fit↑`, `Consistency↓`, `Technical feasibility↓`, `Quality impact (maintainability)↓`.
- Acceptable exception: A hard requirement such as performance, security, contract compatibility, or product differentiation clearly exceeds the standard option.
- Dismissal evidence: A documented standard-option gap plus evidence that the custom path is cheaper or safer overall.

## Overengineering

Definition: The solution is larger, more distributed, or more operationally complex than the confirmed scale and lifetime require.

- Detection questions: What actual load, user count, team size, or lifetime justifies this complexity? What simpler option fails?
- Biased axes: `Purpose fit↑`, `Technical feasibility↓`, `Time effect (short-term)↓`, `Quality impact (operability)↓`, `Agreement to act↓`.
- Acceptable exception: The architecture itself is the PoC target, committed scale is near-term, or the team already operates the chosen platform cheaply.
- Dismissal evidence: Confirmed roadmap, load target, ownership, and operations capacity that make the heavier design proportionate.

## Organizationally Unrealistic Design

Definition: A technically reasonable design assumes skills, staffing, release discipline, or operations capacity the organization does not have.

- Detection questions: Who will operate this? Who is on call? Who can debug it at 03:00? What training or vendor support is funded?
- Biased axes: `Technical feasibility↑`, `Organizational feasibility↓`, `Quality impact (operability)↓`, `Risk and uncertainty↓`.
- Acceptable exception: A skill acquisition, support, or transition plan is agreed with dates and owners.
- Dismissal evidence: Named operators, support model, training plan, runbooks, and escalation path.

## Under-Ambitious Risk Avoidance

Definition: A standard or appropriate improvement is rejected because team capability is under-estimated or discomfort is mistaken for infeasibility.

- Detection questions: Is "we cannot maintain this" factual or habitual? What training cost is required? What long-term cost does avoidance create?
- Biased axes: `Organizational feasibility↓`, `Risk and uncertainty↑`, `Quality impact (maintainability)↑`, `Quality impact (evolvability)↓`, `Time effect (long-term)↓`, `Consistency↓`.
- Acceptable exception: The system is short-lived, or there is no realistic window for skill acquisition before the decision expires.
- Dismissal evidence: Concrete team capability assessment and cost comparison between learning and staying with the lower-quality option.

## Local Patching

Definition: A local code change makes the immediate symptom pass while damaging responsibility boundaries, invariants, or long-term quality.

- Detection questions: Is this fixing the cause or just avoiding the symptom? Does it bypass the layer that owns the rule? What follow-up removes it?
- Biased axes: `Time effect (short-term)↑`, `Consistency↓`, `Quality impact↓`, `Time effect (long-term)↓`.
- Acceptable exception: Incident mitigation with timestamp, rollback condition, and durable follow-up owner.
- Dismissal evidence: Proof the change belongs at this layer and preserves the relevant invariant.

## False Completion

Definition: A technical success signal is mistaken for the real outcome being achieved.

- Detection questions: Did the business state change? Was the side effect accepted by the downstream system? Was the affected count non-zero? Did data persist?
- Biased axes: `Purpose fit not evaluable`, `Consistency↓`, `Risk and uncertainty↓`.
- Acceptable exception: None for final completion; for connectivity checks, label the unverified conditions explicitly.
- Dismissal evidence: Verification of the real acceptance condition, not only exit code, HTTP 200, or green tests.

## Starting Without A Frame

Definition: Implementation starts before the problem, acceptance criteria, constraints, or implementation strategy are clear enough to judge success.

- Detection questions: What input, state, expected result, and exception behavior define done? Which constraints are hard? What is intentionally unknown?
- Biased axes: `Purpose fit not evaluable`, `Constraint fit not evaluable`, `Quality impact not evaluable`, `Time effect (short-term)↑`, `Agreement to act↓`.
- Acceptable exception: Disposable spike with deletion owner/date, or agreed discovery work that will be replaced before production.
- Dismissal evidence: Clear frame, acceptance criteria, hard constraints, and stop conditions.

## Premature Abstraction

Definition: An abstraction is introduced before real variation has been observed or committed.

- Detection questions: How many implementations exist now? Has the variation happened at least twice? What concrete change cost is removed?
- Biased axes: `Quality impact (changeability)↑`, `Purpose fit↓`, `Technical feasibility↓`, `Time effect (short-term)↓`.
- Acceptable exception: Learning spike kept out of production code, or an irreversible public/persisted boundary where later change cost is extreme.
- Dismissal evidence: Observed repeated variation or committed near-term variation with owner, date, and benefit.

## Constraint Afterthought

Definition: Authorization, history, audit, idempotency, state transitions, or data invariants are treated as add-ons after the core model is built.

- Detection questions: Which constraints are part of the domain model? Can they be enforced by the data model or use case boundary? What old paths bypass them?
- Biased axes: `Constraint fit↓`, `Risk and uncertainty↓`, `Quality impact↓`.
- Acceptable exception: Legacy migration with staged replacement, explicit old-path deprecation, and exit criteria.
- Dismissal evidence: Constraints are represented in the data model, state model, or use case flow from the start.

## Excessive Backward Compatibility

Definition: Compatibility is preserved beyond its real users, guarantee scope, or useful lifetime, making the new design unnecessarily complex.

- Detection questions: Who depends on the old behavior? Is it public or internal? What deadline and migration path exist?
- Biased axes: `Constraint fit↑`, `Purpose fit↓`, `Technical feasibility↓`, `Quality impact (maintainability)↓`, `Time effect (short-term)↓`.
- Acceptable exception: Public or contractual interface, legal/audit obligation, or unmovable external dependency with explicit scope and deadline.
- Dismissal evidence: Named consumers, compatibility scope, retention period, and deprecation plan.

## Nominal Completion

Definition: Completion criteria exist in words but cannot be objectively checked.

- Detection questions: What exact input, state, output, side effect, timing, and exception condition decides pass or fail?
- Biased axes: `Agreement to act↓`, `Purpose fit not evaluable`, `Quality impact not evaluable`.
- Acceptable exception: None before implementation; refine the criteria first.
- Dismissal evidence: Testable acceptance criteria with concrete examples.

## Responsibility Crossing

Definition: Logic is placed in a layer or component that does not own the rule because that location is convenient.

- Detection questions: Which layer owns this invariant? Will another entry point bypass the rule? Does this duplicate or contradict existing policy?
- Biased axes: `Consistency↓`, `Quality impact (maintainability)↓`, `Risk and uncertainty↓`.
- Acceptable exception: Framework constraint or temporary legacy workaround with reason, owner, and removal condition.
- Dismissal evidence: Existing architecture shows this layer owns the rule, or all entry points are covered.

## Context-Insensitive Correctness

Definition: A generally good practice is applied even though it conflicts with this repository's conventions, platform constraints, or migration state.

- Detection questions: What does neighboring code do? Is the local convention obsolete or intentional? Can the convention be changed deliberately?
- Biased axes: `Consistency↓`, `Purpose fit↓`, `Technical feasibility↓`.
- Acceptable exception: The existing convention is unsafe, obsolete, or incompatible with a deliberate migration plan.
- Dismissal evidence: Project convention review and either local alignment or an approved migration path.

## Neighbor-Blind Reimplementation

Definition: Existing utilities, patterns, services, or domain types are ignored and a parallel implementation is created.

- Detection questions: Did we search for the same responsibility? What existing helper or boundary is closest? Why not extend it?
- Biased axes: `Consistency↓`, `Quality impact (maintainability)↓`, `Agreement to act↓`.
- Acceptable exception: Existing implementation is constrained, frozen, over-broad, or intentionally being replaced.
- Dismissal evidence: Search results, comparison with existing code, and a clear reuse/replace decision.

## Hallucinated Dependency

Definition: Code relies on a package, function, parameter, method, or behavior that has not been verified to exist in the target version.

- Detection questions: Is the dependency installed? Does the API exist in the official docs or source? Has a minimal call run?
- Biased axes: `Technical feasibility↓`, `Risk and uncertainty↓`, `Constraint fit↓`.
- Acceptable exception: None for production code.
- Dismissal evidence: Official documentation or source reference plus local execution or typecheck/build verification.

## Uncommitted Future Extension

Definition: Extension points are added for possible future changes that have no committed timing, owner, or benefit.

- Detection questions: Who owns the future change? When is it planned? What switching cost is avoided? Is the current cost justified?
- Biased axes: `Time effect (long-term)↑`, `Time effect (short-term)↓`, `Technical feasibility↓`, `Risk and uncertainty↓`.
- Acceptable exception: Committed roadmap item with owner/date, or a boundary where later change is structurally expensive.
- Dismissal evidence: Roadmap commitment, owner, expected benefit, and proof that deferring the extension is materially more expensive.

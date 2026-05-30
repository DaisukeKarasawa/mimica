# Evaluation Axes

Use these terms to keep design decisions inspectable without turning every review into a memo.

## Terms

- `Evaluation axis`: A criterion used to judge a design decision.
- `Dominant axis`: The one evaluation axis that should govern the current decision.
- `Secondary condition`: An axis that is not dominant but must meet a defined minimum bar.
- `Technical feasibility`: Whether the design can work with the available technology, APIs, data, performance envelope, and implementation constraints.
- `Organizational feasibility`: Whether the team can operate, maintain, evolve, and support the design with its actual skills, staffing, ownership, and release process.

## The Eight Axes

1. `Purpose fit`: Does the choice solve the real user, business, or system problem?
2. `Constraint fit`: Does it satisfy hard requirements such as security, audit, compliance, contracts, state rules, history, idempotency, and platform limits?
3. `Feasibility`: Can it be built and run in this technical and organizational setting?
4. `Quality impact`: How does it affect maintainability, operability, reliability, performance, security, testability, and evolvability?
5. `Time effect`: What does it optimize now, and what cost or option value does it create later?
6. `Risk and uncertainty`: What is unknown, volatile, hard to verify, or costly if wrong?
7. `Consistency`: Does it align with existing architecture, project conventions, standard tools, and responsibility boundaries?
8. `Agreement to act`: Can the people who must build, review, operate, and accept the result actually commit to it?

## Dominant Axis Rule

Choose one dominant axis for the decision. Treat other important axes as secondary conditions with explicit minimum bars.

Examples:

- Incident mitigation: `Time effect (short-term)` may dominate, while `reversibility` and `follow-up owner` are secondary conditions.
- Public API compatibility: `Constraint fit` may dominate, while `quality impact` and `deprecation plan` are secondary conditions.
- New internal abstraction: `Quality impact (changeability)` should dominate only when variation is observed or committed; otherwise it is likely over-weighted.

## Bias Notation

- `↑`: The axis appears over-weighted.
- `↓`: The axis appears under-weighted.
- `unknown`: The axis matters, but evidence is missing.
- `not evaluable`: The axis cannot be judged because the frame, requirements, or acceptance criteria are not defined.

When time direction matters, split the axis explicitly: `Time effect (short-term)↑ / Time effect (long-term)↓`.

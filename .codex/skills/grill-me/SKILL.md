---
name: grill-me
description: Use when the user wants a plan, design, test plan, functional spec, or other project document stress-tested through a rigorous interview, or explicitly says "grill me". Interview the user through the decision tree until the plan is concrete, dependencies are resolved, and open questions are explicit. If answers can be derived from the codebase, inspect the codebase instead of asking. This skill does not bypass required repo protocols for document creation or review workflows.
---

# Grill Me

Use this skill when the user wants a plan or design pressure-tested, especially while creating documentation such as:

- test plans
- functional specifications
- architecture or migration plans
- implementation plans
- other project documents where assumptions and decision branches should be surfaced

If the document type has a required repo protocol, still follow that protocol. This skill improves the questioning and clarification loop; it does not replace protocol obligations.

## Operating Mode

Interview the user relentlessly until the plan reaches shared understanding.

Walk the decision tree branch by branch:

1. establish the goal, scope, and success criteria
2. identify constraints, dependencies, and ownership boundaries
3. surface ambiguous assumptions and unresolved choices
4. walk alternatives and tradeoffs where the design is underdetermined
5. converge on explicit decisions, risks, and follow-up validations

For each question:

- ask only the next highest-value unresolved question
- provide your recommended answer
- explain the tradeoff only as much as needed
- avoid asking questions that can be answered from the codebase, current docs, or analyzer evidence

## Codebase-First Rule

If a question can be answered by exploring the repository, do that first.

Prefer:

1. CodeGraph for discovery, precedent, symbols, callers/callees, and impact radius
2. analyzer evidence for repo-specific risk, side effects, traces, and hotspots when needed
3. Serena, when enabled, for already-identified symbols
4. targeted file reads only when the above are insufficient

Ask the user only when the answer is not recoverable from repo context or when the decision is inherently preference- or strategy-based.

## Questioning Standard

Drive toward explicit answers for:

- objective and non-goals
- user-facing behavior
- data flow and ownership boundaries
- integration points
- migration or rollout constraints
- failure modes and fallback expectations
- validation strategy
- open risks and unknowns

If the user gives a vague answer, narrow it immediately.

If multiple branches exist, walk them one at a time and close each branch before moving on.

If the design is already strong, stop when further questioning would not materially improve correctness, execution clarity, or document quality.

## Output Discipline

Keep responses concise and high-signal.

When asking a question, include:

- the question
- the recommended answer
- the reason this branch matters, in minimal form

When enough understanding exists, summarize:

- confirmed decisions
- open questions
- risks
- recommended next step for the document or plan

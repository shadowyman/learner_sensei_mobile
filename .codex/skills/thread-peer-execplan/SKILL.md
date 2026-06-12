---
name: thread-peer-execplan
description: Must always be used during application of the Codex Thread Peer Execution Protocol at docs/protocols/codex_thread_peer_execution_protocol.md, including when two Codex threads work as equal peers on an ExecPlan, implementation plan, design document, protocol, migration, refactor, prompt package, shared engineering artifact, or complex read-only review/audit that needs reciprocal critique, protocol gates, and convergence.
---

# Thread Peer ExecPlan

Use this skill when two Codex threads should work as equal peers on an ExecPlan, implementation plan, design document, protocol, migration, refactor, prompt package, shared engineering artifact, or complex read-only review/audit that needs reciprocal critique and convergence.

Do not use this skill for tiny, mechanical, decisively validated, simple discovery-only, or single-agent tasks unless the user explicitly asks for two-agent review/audit/design critique/document evaluation or a convergence-sensitive advisory judgment.

## Authority

The runtime authority is `docs/protocols/codex_thread_peer_execution_protocol.md`. Start with its LLM Run Card. The supporting workflow at `tmp/thread_peer_execplan_workflow.md` clarifies deeper cycle semantics when a gate needs interpretation. If this skill conflicts with the runtime protocol, the runtime protocol wins.

For task-specific ExecPlan work, also read `docs/protocols/PLAN.md` before creating, editing, auditing, or executing that ExecPlan. The historical ExecPlan that produced the peer protocol is not required at runtime.

## Required First Actions

1. If `docs/protocols/codex_thread_peer_execution_protocol.md` has not already been read end to end in the current peer run, read it end to end now. Start with the LLM Run Card and Canonical Peer Names, but do not stop there on the first read.
2. Apply the no-use criteria before starting or continuing a two-agent run.
3. If a peer run is justified, identify Harry Potter (Agent A) and Hermione Granger (Agent B) as coordination handles only. Thread roles are not interchangeable.
4. If Hermione Granger's thread is missing and the user asked for a real peer run, create/request it when the environment permits, using the same model and reasoning level as Harry Potter's current thread when those controls are available; otherwise ask one concise question: `Should I create Hermione Granger's peer thread now?` If model or reasoning-level parity cannot be set or verified, record that limitation in the startup state and initialization packet. If a Hermione thread already exists for the run, use it; do not create a second or replacement thread while the existing one is active, waiting, or unresolved unless the user approves replacement after the old thread is marked unusable. Never reuse another Harry thread as Hermione.
5. Run the initialization handshake before authoritative artifacts, unless a provisional exception is explicitly recorded.
6. Read `tmp/thread_peer_execplan_workflow.md` only when the supporting workflow is relevant or a protocol gate needs interpretation.

## Non-Negotiable Gates

- No-use check before peer ceremony.
- Collaboration shape and inspection tactic: default to Collaborative and Joint-first; use Advisory only for lightweight second-perspective answers; use Independent-first only when explicitly requested or when blind-spot detection is the evidence strategy.
- Proposed task frame, ownership split, collaboration shape, inspection tactic, evidence standard, and work phases are candidate-only until the peer accepts, revises, or rejects them.
- Step-locked peer loop: send the peer packet, write a final answer, and stop the turn. Continue only when the returned message arrives as a new input; triad-check only then, accept/revise/reject the frame or claim, then proceed. Do not stay active to sleep, poll, inspect, repair, or continue substantive next-step work while waiting.
- Bounded requested step: when receiving a peer packet, do only the requested step and only the minimum evidence-gathering needed to answer it. Propose extra useful work as candidate next scope; do not perform it before the loop returns.
- Response hard stop: after sending a response back with `send_message_to_thread`, write a final answer in the responding thread and stop. Do not poll, supervise, or wait on the requester after sending.
- Peer-context triad for new peer claims: received message, visible completed peer turn, and durable artifact or final-answer evidence.
- If a peer response arrived but `read_thread` reports active/in-progress, wait 10 seconds and recheck once; if still not complete, stop polling and rely on durable evidence or a corrected handoff.
- Critique plus concrete contribution in every substantive peer turn.
- Role symmetry and initiative reciprocity; whoever names the next stress point also contributes evidence, text, patch, or rejection rationale unless an exception is recorded.
- Two-way shared-step contribution: in every non-trivial shared step, both peers contribute according to the agreed split, ask for critique on their own contribution, review the peer's contribution, and run a shared-step gap check before closure.
- File-change contribution status: when a peer's scope includes an editable artifact and a safe bounded edit exists, that peer should patch incrementally and ask for feedback. If not patching, state the reason: read-only boundary, validation-only scope, atomic edit surface, unsafe collision risk, access blocked, no safe bounded edit, agreed single-editor step, or no-use/collapse.
- Candidate next shared step agreement must name expected peer contributions, file-change expectations, applicable or reapplied gates, and closure conditions before either peer begins that step.
- Named ownership for edit, artifact, validation, and shared-duty surfaces.
- Current-step closure before any candidate next focus.
- Durable-state updates before milestone transitions and convergence.
- User interruption handling: newer user instructions override stale peer packets; record impacts to scope, ownership, validation, synchronization, or artifacts.
- Final handoff with changed files/artifacts, validation, dirty-state boundary, residual risks, protocol acceptance evidence, collaboration-shape claim, and commit or handoff boundary.

## Code Gates

For code-related work:

- Run joint approach and challenged structural classification before code changes continue.
- Inspect peer-owned changed files and relevant generated diff before code closure.
- Waive peer diff review only when no code changed, the diff cannot be produced after best effort but changed files were directly inspected, or a structural reason makes the code gate not applicable. `Small diff`, `single file`, `mechanical`, or `already validated` are not valid waiver reasons.
- Complete the Architectural Distance Pass when code-related uncertainty remains: classification, evidence, responsibility/placement, propagation/parity, validation level, and closure impact.
- If critique requires code correction, agree on correction path, edit owner, review owner, and invalidated checks before corrective edits unless the narrow mechanical exception applies.

The narrow mechanical exception is valid only when the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim.

## Artifact Corrections

For substantive peer-requested corrections to an ExecPlan, protocol, prompt packet, skill spec, design document, or other shared artifact:

- The peer identifying the issue must accept, revise, or reject the correction path they propose, with rationale grounded in the protocol, artifact evidence, and user goal.
- For bounded, clearly justified, safe non-code artifact corrections, the identifying peer should usually patch the exact correction when they have access, no collision risk, and no authority or scope impact; the other peer reviews the exact diff.
- If the identifying peer cannot safely patch, the receiving peer must accept, revise, or reject the requested correction with rationale before applying or declining it.

## Failure Conditions

Treat these as protocol drift:

- Treating Hermione Granger (Agent B) as reviewer, supervisor, subordinate, or artifact worker.
- Letting one peer become the recurring feedback provider while the other peer becomes the recurring artifact worker.
- Closing a non-trivial shared step before both peers' contributions have been reviewed, file-change/no-file-change status has been stated where artifacts are editable, and the combined-work gap check is complete.
- Replacing required handoff fields with a loose summary that hides current shared step, each peer's contribution, file-change status, applicable gates, closure conditions, gap check, or unresolved state.
- Accepting a peer claim from the delegated message alone when visible peer-turn or durable-artifact context may change the claim.
- Triad-checking immediately after sending a peer packet before a returned peer response exists.
- Staying active after sending a peer packet instead of writing a final answer and stopping the turn.
- Exceeding the requested peer-packet step, including doing substantive audit, implementation, validation, source exploration, report drafting, or correction work before that work is agreed as the current requested step.
- Continuously polling after the one allowed 10-second recheck.
- Polling, supervising, or waiting on the requester after sending a response back with `send_message_to_thread`.
- Reusing a Harry thread as Hermione or otherwise swapping thread roles.
- Creating a second or replacement Hermione thread while an existing peer thread is active, waiting, or unresolved without recording the old thread as unusable and getting user approval.
- Intentionally creating Hermione with a lower-capability model or reasoning level than Harry for the same peer run without explicit user approval, or failing to record an environment limitation when parity cannot be set or verified.
- Creating authoritative artifacts before peer shaping without a recorded provisional exception.
- Presenting a task frame, ownership split, collaboration shape, inspection tactic, evidence standard, or work phase as agreed before the peer accepts, revises, or rejects it.
- Continuing substantive next-step work after sending a peer packet before the peer's returned response is triad-checked and accepted/revised/rejected.
- Allowing code closure without peer diff review and Architectural Distance Pass evidence or a structural waiver.
- Converting critique into assignment or unilateral corrective code patch without correction-path agreement.
- Applying substantive peer-requested artifact correction without accept/revise/reject rationale.
- Moving to candidate next focus before current-step closure.

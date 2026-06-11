# Codex Thread Peer Product Support

This document records future-state Codex product support requirements for the Codex Thread Peer Execution Protocol. It is not required during ordinary peer execution. The runtime protocol at `docs/protocols/codex_thread_peer_execution_protocol.md` remains the authority.

## Productized Support Layer

The following would require Codex product or system support and must be treated as future-state:

- native thread-pair metadata showing which threads are peers;
- automatic reminders to apply the peer-context triad;
- protocol-aware handoff UI for initialization, correction, convergence, and final handoff packets;
- completion-state checks that distinguish completed peer turns from active or stale turns;
- a built-in peer workflow launcher that can create or connect Agent B;
- protocol-aware artifact status showing whether a governing document is provisional, peer-critiqued, or authoritative.

Productized support should be implemented as workflow assistance, not as a replacement for peer judgment. A future Codex system should make the required state visible, enforce synchronization boundaries, and prevent stale or incomplete handoffs from looking complete.

## Minimum Product Requirements

- Peer pair registry: store Agent A thread id, Agent B thread id, workspace path, active durable artifacts, current milestone, and whether the pair is initializing, executing, correcting drift, converging, collapsed, or complete.
- Peer launch/connect flow: let the user provide Agent B or let Agent A create/request one when the user has asked for peer work with Hermione Granger; copy AGENTS/protocol context, cwd, model settings when appropriate, and the initial kickoff packet into the peer thread.
- Handoff packet types: represent initialization, recurring handoff, protocol drift correction, user interruption, convergence, and final handoff as distinct packet types with required fields rather than free-form messages only.
- Triad checklist: before a peer claim can be marked accepted, show whether the received packet, latest completed peer turn, and durable artifact state were inspected. The checklist should allow provisional critique but block convergence claims when required evidence is missing.
- Completion-state guard: distinguish completed peer turns from active, stale, failed, or inspection-mismatched turns. The system should not encourage polling; after a peer response arrives, it may support one delayed 10-second recheck when the inspected turn is active/in-progress. It should surface completion only after a peer response arrives, the single recheck completes, or durable artifact state independently confirms the claim.
- Artifact authority state: mark governing artifacts as proposed, peer-shaped, authoritative, under correction, converged, or final-handoff-ready. Authority changes should require a recorded peer critique or a documented collapse-to-one-agent rationale.
- Ownership and boundary view: show current Agent A scope, Agent B scope, shared integration boundary, named owners for shared duties, and surfaces frozen by conflict or drift.
- Agenda and closure guard: require a current-step closure claim before accepting a next-focus packet. A proposed next focus should be labeled as candidate until the peer accepts current-step closure.
- Diff review guard: for code-related packets, show peer-owned changed files and require a diff-review acknowledgement before convergence, unless the pair records the narrow waiver: no code changed, diff unavailable after best effort with changed files directly inspected, or structural not-applicable rationale.
- Architectural distance guard: for code-related packets, require challenged structural classification and an evidence-backed architectural judgment before convergence.
- Drift detection prompts: warn when a peer repeatedly sets agenda without contribution, advances candidate next focus before current-step closure, skips durable-state updates, trusts messages without triad evidence, uses stale validation, or leaves shared duties unnamed.
- User interruption propagation: when the user changes scope or process, mark older peer packets potentially stale until the durable artifact records the interruption's impact.
- Validation ledger: attach validation commands, dry-run notes, substitutions, skipped checks, and residual risks to the milestone they support, with stale markers when later edits invalidate evidence.
- Collapse path: support a clean transition to one agent when no-use criteria apply, peer access fails, or coordination overhead exceeds risk, while preserving the reason and final handoff boundary.
- Final handoff view: summarize changed files, artifact authority state, validation evidence, residual risks, dirty-state boundaries, and protocol acceptance evidence before staging, committing, or handing back.

## Non-Goals

- It must not expose hidden model reasoning or treat hidden reasoning as evidence.
- It must not force artificial file splits or symmetric edits for atomic work.
- It must not let one thread supervise the other as a subordinate.
- It must not auto-accept peer claims solely because a message was received.
- It must not hide user-owned dirty state or unrelated changes behind a peer-convergence label.

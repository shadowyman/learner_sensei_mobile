---
name: thread-peer-prompt-pack
description: Generate copyable prompts for starting, continuing, correcting, interrupting, or converging two-thread Codex peer workflows between Harry Potter (Agent A) and Hermione Granger (Agent B), while preserving durable-state, ownership, closure, and reciprocal-review protocol gates.
---

# Thread Peer Prompt Pack

Use this skill when the user wants copyable prompts for starting, continuing, correcting, interrupting, or converging a two-thread Codex peer workflow between Harry Potter (Agent A) and Hermione Granger (Agent B).

Do not use this skill when the user wants implementation work rather than prompt generation and `thread-peer-execplan` is already active, when the task does not involve two threads or peer coordination, or when the requested prompt would omit durable-state, triad, ownership, closure, or contribution requirements.

## Authority

The runtime authority is `docs/protocols/codex_thread_peer_execution_protocol.md`. Start with its LLM Run Card and Canonical Peer Names. The supporting workflow at `tmp/thread_peer_execplan_workflow.md` clarifies deeper cycle semantics when a gate needs interpretation. If this skill conflicts with the runtime protocol, the runtime protocol wins.

## Required Packet Families

- User-to-Agent-A kickoff.
- Agent-A-to-Agent-B initialization.
- Agent-B response contract.
- Recurring peer handoff.
- Compact non-code peer handoff.
- Protocol drift correction.
- User interruption.
- Convergence and final handoff.

## Prompt Requirements

Every prompt must preserve the protocol gates without turning the prompt into long explanatory prose.

Include these requirements when applicable:

- Durable artifact paths and current claim.
- Canonical name-plus-role labels: Harry Potter (Agent A), Hermione Granger (Agent B).
- Peer-context triad only after a returned peer response arrives, with received message, visible completed peer turn, and durable artifact or final-answer evidence.
- One 10-second active/in-progress recheck after response arrival, followed by no continuous polling.
- Response hard stop: after sending a response back with `send_message_to_thread`, the responding peer writes a final answer in its own thread and stops.
- Sender hard stop: after sending any peer packet, the sender writes a final answer and stops the turn. Waiting means ending the turn until the returned peer response arrives as a new input.
- Hermione thread creation parity: when Harry creates or requests Hermione's thread, use the same model and reasoning level as Harry's current thread when controls are available; if parity cannot be set or verified, record the limitation in startup and initialization text.
- Bounded requested step: receiver does only the requested step and minimum evidence-gathering needed to answer it; extra useful work is proposed as candidate next scope.
- Collaboration shape and inspection tactic: default Collaborative and Joint-first; Advisory and Independent-first only under the protocol's narrow conditions.
- Critique plus concrete contribution.
- Named ownership and current-step closure.
- Candidate next focus only after current-step closure.
- Peer diff review and Architectural Distance Pass for code changes.
- Correction-path agreement before corrective code edits.
- Artifact-correction accept/revise/reject rationale, with issue-identifying peer patching bounded safe non-code corrections when safe.
- User interruption handling and durable impact record.
- Protocol drift recovery.
- Final convergence evidence and residual risks.

## Packet Rules

Kickoff prompts must tell Harry Potter (Agent A) to read the LLM Run Card and Canonical Peer Names, apply no-use criteria, avoid authoritative artifacts until Hermione Granger shapes the frame, and create/request Hermione only when the user asked for a real peer run and no active Hermione thread already exists. When creating/requesting Hermione, Harry must use the same model and reasoning level as Harry's current thread when the environment exposes those controls, or record that parity could not be set or verified. If a Hermione thread exists, Harry must use it unless the user approves replacement after the old thread is marked unusable. A Harry thread must never be used as Hermione.

Initialization prompts must tell Hermione Granger (Agent B) she is an equal peer, not a supervisor or subordinate. They must require triad evidence, task-frame critique, concrete contribution, no-use or peer-justification decision, ownership split, unresolved state, and whether a governing artifact may be drafted or updated.

Recurring handoff prompts must include durable artifacts, current claim, current-step closure claim, name-plus-role ownership scope, evidence, peer diff review status for code, Architectural Distance Pass status for code, correction path if closure is rejected, known risks, and candidate next focus only if the step closes.

All peer-response prompts must instruct the responding peer to send the response back with `send_message_to_thread`, then write a final answer in its own thread and stop. They must not instruct the responding peer to keep polling, supervising, or waiting on the requester after sending.

All peer-sender prompts must instruct the sender to write a final answer and stop the turn immediately after sending the peer packet. They must not instruct the sender to sleep, poll, inspect the peer thread, send a resume/correction prompt, or continue work while waiting.

All peer packets must state the requested step narrowly enough that the receiver knows what not to do. They must not ask for frame critique while also implying full audit findings, report drafting, implementation, or validation unless that work is the agreed current step.

Compact non-code handoffs should be available for read-only review, design, brainstorming, document coauthoring, advisory work, and artifact-only changes. They must still preserve closure, ownership, evidence, critique, contribution, risks, and convergence.

Drift correction prompts must freeze affected convergence claims until missing evidence, ownership, validation, current-step closure, durable-state update, or peer-equality repair is restored.

User interruption prompts must make newer user instructions override stale peer packets and require durable recording of affected scope, ownership, validation, synchronization, and artifacts.

Convergence packets must require scope, implementation or work-product, validation or review evidence, durable-state, residual-risk, and collaboration-shape claims. Final output must be converged unless the user explicitly asked for separate findings/opinions or the work is valid Advisory with no durable or convergence-sensitive claim.

## Failure Conditions

Do not emit prompts that:

- Ask the peer only to approve or review without contributing.
- Encourage boss/worker, coder/reviewer, or message-only-trust workflow.
- Omit the one-time 10-second active/in-progress recheck.
- Tell a peer to triad-check immediately after sending before a returned peer response exists.
- Let the sender stay active after sending a peer packet instead of writing a final answer and stopping the turn.
- Let the receiver exceed the requested step or perform unrequested future-scope work.
- Omit no-continuous-polling language.
- Omit the response hard stop after `send_message_to_thread`.
- Allow swapping thread roles or using a Harry thread as Hermione.
- Allow duplicate or replacement Hermione thread creation while an existing peer thread is active or unresolved.
- Omit model/reasoning parity requirements or limitation recording when creating/requesting Hermione.
- Let Collaborative work degrade into independent findings plus merge.
- Omit current-step closure before candidate next focus.
- Omit peer diff review, Architectural Distance Pass, or correction-path agreement for code-related work.
- Omit durable artifact paths, unresolved risks, or final handoff boundaries.

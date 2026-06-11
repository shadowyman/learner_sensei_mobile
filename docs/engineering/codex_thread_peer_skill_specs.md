# Codex Thread Peer Skill Specifications

This document defines optional local skills that can help agents apply the Codex Thread Peer Execution Protocol. It is tied to `docs/protocols/codex_thread_peer_execution_protocol.md` and the supporting workflow at `tmp/thread_peer_execplan_workflow.md`. The implementation ExecPlan that produced the protocol is historical bookkeeping and is not required for skill use.

The skills described here are specifications only. Creating actual local skill files is a later implementation step. A future skill implementation must preserve the protocol gates exactly; it must not simplify the peer workflow into a reviewer/subordinate pattern, message-only trust, continuous polling, or checklist theater.

Canonical peer names: Agent A is Harry Potter, and Agent B is Hermione Granger. These names are stable coordination handles only. They do not imply roleplay, fictional behavior, hierarchy, or any change to peer equality. Generated prompts should use `Harry Potter (Agent A)` and `Hermione Granger (Agent B)` when introducing the peers or naming ownership.

## Authority

The runtime protocol governs behavior. The supporting peer workflow clarifies deeper cycle semantics when a gate needs interpretation. This engineering document translates those rules into skill definitions, trigger rules, prompt bodies, and acceptance checks. If any skill text or workflow detail conflicts with `docs/protocols/codex_thread_peer_execution_protocol.md`, the runtime protocol wins.

A skill generated from this document must read the runtime protocol's LLM Run Card before starting a peer cycle. The skill must also preserve the ExecPlan protocol in `docs/protocols/PLAN.md` whenever the peer work requires a live ExecPlan.

## Non-Negotiable Gates

Every skill in this document must enforce these gates when applicable:

- no-use check before starting a two-agent run;
- initialization handshake before authoritative artifacts;
- peer-context triad using received message, visible completed peer turn, and durable artifact;
- one 10-second recheck when a peer response has arrived but `read_thread` reports active/in-progress, followed by no continuous polling;
- collaboration shape and inspection tactic: default to Collaborative and Joint-first; use Advisory only for lightweight second-perspective answers; use Independent-first only when explicitly requested or when blind-spot detection is the evidence strategy;
- critique plus concrete contribution in every substantive peer turn;
- role symmetry and initiative reciprocity;
- named ownership for edit, artifact, validation, and shared-duty surfaces;
- peer diff review for code-related closure claims;
- Architectural Distance Pass for code-related closure claims;
- correction-path agreement before corrective code edits unless the narrow mechanical exception applies;
- current-step closure before any candidate next focus is discussed;
- durable-state updates before milestone transitions and convergence;
- accept/revise/reject rationale before substantive peer-requested artifact corrections, with bounded safe non-code corrections usually patched by the peer who identifies the issue when safe, then reviewed by the other peer;
- user interruption handling: newer user instructions override stale peer packets, and scope, ownership, validation, or synchronization impact must be recorded in durable state;
- protocol drift recovery when a peer skips required evidence or ownership;
- final handoff with changed files, validation, dirty-state boundary, residual risks, and commit or handoff boundary.

The narrow mechanical exception for corrective code edits is valid only when the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim.

## Skill: thread-peer-execplan

Description: Load and enforce the Codex Thread Peer Execution Protocol when two Codex threads jointly create, repair, or execute an ExecPlan, implementation plan, design document, protocol, migration, refactor, or other shared engineering artifact.

Trigger when:

- the user asks two Codex agents or threads to work together on an ExecPlan, implementation, migration, refactor, architecture task, protocol-backed design, prompt package, or shared engineering document;
- the user provides Hermione Granger's Agent B thread id or asks Harry Potter to coordinate with Hermione Granger in a peer run;
- the task is complex enough to require shared task framing, durable state, validation, reciprocal critique, or peer review of code diffs;
- a current peer run needs correction because it drifted into boss/worker behavior, message-only trust, premature next-focus advancement, or unowned shared duties.

Do not trigger when:

- the task is tiny, mechanical, or already covered by decisive validation;
- the user explicitly asks for a single-agent pass;
- no peer thread is available and the user has not asked for peer work or approved creating or using one;
- the work is simple discovery-only/no-edit work with low risk and no convergence-sensitive decision, unless the user explicitly asks for two-agent review/audit, design critique, document/process evaluation, or converged advisory judgment;
- the task is a simple informational answer with no shared artifact, implementation, or protocol-driven work.

Required first actions:

1. Read `docs/protocols/codex_thread_peer_execution_protocol.md`, starting with the LLM Run Card.
2. Read `tmp/thread_peer_execplan_workflow.md` when the supporting workflow itself is relevant or when a gate needs interpretation.
3. If an ExecPlan is required, read `docs/protocols/PLAN.md` before creating, editing, or executing the ExecPlan.
4. Apply no-use criteria before starting the peer workflow.
5. If the peer workflow is justified, run the initialization handshake before authoritative artifacts.

Concise governing body for a local skill:

```text
Use docs/protocols/codex_thread_peer_execution_protocol.md and tmp/thread_peer_execplan_workflow.md. First read the LLM Run Card, then apply no-use criteria. If peer workflow is justified, run the initialization handshake before authoritative artifacts. Enforce peer-context triad with the single 10-second active/in-progress recheck, no continuous polling, shared task frame with collaboration shape and inspection tactic, critique-plus-contribution, role symmetry, initiative reciprocity, symmetric work split or atomic-work fallback, named owners for shared duties, peer diff review and Architectural Distance Pass for code changes, correction-path agreement before corrective code edits, accept/revise/reject rationale before substantive peer-requested artifact corrections, issue-identifying-peer patching of bounded safe non-code artifact corrections unless a reason prevents it, current-step closure before candidate next focus, durable-state updates, user interruption handling, protocol drift recovery, validation substitutions, and final handoff gate. Keep the ExecPlan self-contained and update living sections before crossing milestones.
```

Required outputs:

- a no-use decision or explicit justification for the two-agent workflow;
- an initialization packet to Hermione Granger (Agent B) when a peer run continues;
- a durable task frame naming collaboration shape, inspection tactic when relevant, goal, artifacts, acceptance criteria, risks, ownership, validation, and no-edit boundaries;
- ExecPlan updates before crossing milestones when an ExecPlan governs the work;
- peer handoff packets that include current-step closure and candidate next focus only after closure is claimed;
- user interruption records when newer user instructions change scope, ownership, validation, synchronization, or durable artifacts;
- convergence or collapse rationale with evidence.

Failure conditions:

- treating Hermione Granger (Agent B) as a reviewer, supervisor, or subordinate;
- accepting a peer claim from a delegated message alone when peer-turn or durable-artifact context may change the claim;
- continuously polling an active peer thread after the one allowed 10-second recheck;
- creating authoritative artifacts before peer shaping unless the provisional exception is recorded;
- allowing a code closure claim without peer diff review and Architectural Distance Pass evidence or a structural waiver;
- converting critique into an assignment or unilateral corrective patch without correction-path agreement;
- applying a substantive peer-requested artifact correction without first accepting, revising, or rejecting it with rationale;
- acting on a stale peer packet after a conflicting newer user instruction without recording the interruption's impact;
- moving to a candidate next focus before the current step is mutually closed.

## Skill: thread-peer-prompt-pack

Description: Emit copyable prompt packets for starting, continuing, correcting, interrupting, and converging a two-thread Codex peer workflow while preserving the protocol gates.

Trigger when:

- the user asks for prompts to start Harry Potter (Agent A) and Hermione Granger (Agent B);
- an existing peer workflow needs a handoff, correction, interruption, or final convergence packet;
- the user wants to apply the peer protocol manually without creating local skill files;
- a peer run needs a corrected packet because the prior packet omitted triad evidence, ownership, closure, or contribution requirements.

Do not trigger when:

- the user is asking for implementation work rather than prompt generation and `thread-peer-execplan` is already active;
- the task does not involve two threads or peer coordination;
- the requested prompt would omit durable-state, triad, ownership, or closure requirements;
- the prompt would encourage a boss/worker, coder/reviewer, or message-only-trust workflow.

Required packet families:

- User-to-Agent-A kickoff;
- Agent-A-to-Agent-B initialization;
- Agent-B response contract;
- recurring peer handoff;
- protocol drift correction;
- user interruption;
- convergence and final handoff.

Concise governing body for a local skill:

```text
Emit only prompts that preserve the peer workflow: user kickoff, Agent A to Agent B initialization, Agent B response contract, recurring handoff, compact non-code handoff, protocol drift correction, user interruption, and final convergence. Every prompt must name durable artifact paths, required triad evidence including the single 10-second active/in-progress recheck, collaboration shape and inspection tactic where relevant, concrete contribution expectations, no-continuous-polling synchronization, unresolved risks, peer diff review and Architectural Distance Pass requirements for code changes, correction-path agreement before corrective code edits, accept/revise/reject rationale before substantive peer-requested artifact corrections, issue-identifying-peer patching of bounded safe non-code artifact corrections unless a reason prevents it, current-step closure before candidate next focus, protocol drift recovery, user interruption handling, and next ownership split where applicable. Prefer concise copyable prompts over explanatory prose.
```

Prompt requirements:

- The kickoff prompt must tell Harry Potter (Agent A) to read the LLM Run Card and Canonical Peer Names, apply no-use criteria, and avoid authoritative artifacts until Hermione Granger shapes the frame.
- The initialization prompt must tell Hermione Granger (Agent B) she is an equal peer, not a supervisor or subordinate, and must require critique plus concrete contribution, collaboration shape, and inspection tactic when relevant.
- The recurring handoff prompt must include durable artifacts, current claim, current-step closure claim, name-plus-role ownership scope, evidence, peer diff review status for code, Architectural Distance Pass status for code, correction path if closure is rejected, known risks, and candidate next focus only if the step closes; generated prompt packs should also include the compact non-code handoff for non-code, read-only, design, brainstorming, document coauthoring, or Advisory work.
- The drift correction prompt must freeze affected convergence claims until missing evidence, ownership, validation, or durable-state updates are restored.
- The user interruption prompt must make newer user instructions override stale peer packets and require durable recording of scope, ownership, validation, or synchronization impact.
- The convergence packet must require scope, implementation, validation, durable-state, residual-risk, and collaboration-shape claims.

Failure conditions:

- emitting prompts that ask the peer only to approve or review without contributing;
- omitting the one-time 10-second active/in-progress recheck from triad instructions;
- omitting no-continuous-polling language;
- omitting collaboration shape or allowing Collaborative work to become parallel independent findings plus a merge;
- omitting current-step closure before candidate next focus;
- omitting peer diff review, Architectural Distance Pass, or correction-path agreement for code-related work;
- failing to name durable artifact paths or unresolved risks.

## Skill Completeness Checklist

A future local skill implementation is complete enough to force the protocol only when both peers can verify these conditions:

- the skill loads or quotes the LLM Run Card before any peer cycle;
- generated prompts contain the triad, one-time recheck, no-continuous-polling, collaboration-shape, inspection-tactic, critique-plus-contribution, ownership, closure, and final handoff rules;
- code-related packets contain peer diff review and Architectural Distance Pass requirements;
- correction packets require correction-path agreement and identify edit owner, review owner, and invalidated checks;
- artifact correction prompts require the receiving peer to accept, revise, or reject substantive corrections with rationale before editing;
- no-use and collapse paths are explicit, so the skill does not force peer ceremony on tiny tasks;
- ExecPlan-governed work still follows `docs/protocols/PLAN.md`;
- generated interruption prompts make newer user instructions override stale peer packets and require durable impact records;
- failure conditions name message-only trust, boss/worker drift, unowned shared duties, premature next-focus advancement, stale validation, and unilateral corrective patching;
- the runtime protocol remains the behavioral authority, and this document remains the skill-spec authority.

## Review Method

Before creating actual skill files from this document, run a peer review against the runtime protocol:

1. Confirm each non-negotiable gate appears in the relevant skill body or generated packet rules.
2. Confirm no skill wording weakens no-use criteria, peer equality, triad evidence, current-step closure, or code-related convergence gates.
3. Confirm the prompt-pack skill cannot emit a packet that omits durable artifacts, unresolved state, or ownership.
4. Confirm `thread-peer-execplan` directs ExecPlan work back to `docs/protocols/PLAN.md`.
5. Confirm interruption packets and generated handoffs preserve newest-user-instruction priority and do not let stale peer instructions continue silently.
6. Record any skill-generation gap in the review notes before creating local skill files.

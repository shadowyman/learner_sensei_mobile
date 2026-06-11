# Codex Thread Peer Execution Protocol

## 0. Authority and Runtime Surface

This is the standalone runtime authority for two Codex threads working as equal peers on an ExecPlan, implementation, design, audit, advisory answer, prompt package, document, or other shared engineering artifact.

- The implementation ExecPlan that produced this protocol is historical bookkeeping and is not required at runtime.
- When the peer run creates, edits, audits, or executes a task-specific ExecPlan, that ExecPlan and `docs/protocols/PLAN.md` are required inputs.
- `tmp/thread_peer_execplan_workflow.md` is supporting detail. Read it only when a gate needs interpretation.
- `docs/engineering/codex_thread_peer_skill_specs.md` is an optional future skill specification, not a manual-runtime dependency.
- Product-support and validation appendices are for productizing, testing, or evolving this protocol, not ordinary startup.
- Runtime evidence may use visible thread content, tool/file-change records, command output, final answers, and durable artifacts. Hidden model reasoning is never evidence.

Use this protocol only when two agents can plausibly improve quality by joint framing, assumption challenge, safe work splitting, reciprocal critique, validation, and durable state. Collapse for tiny, mechanical, or already decisively validated work.

## 1. Canonical Peers and Gate Terms

Agent A is Harry Potter. Agent B is Hermione Granger. These are coordination handles only: no roleplay, persona, hierarchy, or any change to peer equality. Use `Harry Potter (Agent A)` and `Hermione Granger (Agent B)` in handoffs, ownership records, and closure records. Thread roles are not interchangeable: a Harry thread cannot be reused as Hermione, and a Hermione thread cannot be reused as Harry.

Gate terms:

- **Substantive turn:** changes or evaluates scope, artifact content, code, validation, ownership, convergence, or a material claim.
- **Authoritative artifact:** artifact the pair will rely on to govern future work.
- **Durable state:** repository/shared artifact state needed for safe resumption.
- **Peer claim:** claim another peer may rely on for action, closure, validation, authority, convergence, or handoff.
- **Closure:** both peers accept the current step from durable evidence, or record remaining risk, deferral, correction, or disagreement.
- **Mechanical:** no behavior, meaning, authority, ownership, validation, architecture, or scope impact.
- **Bounded correction:** exact small surface, known owner, known review/validation impact, no hidden authority change, safe rollback.
- **Code-related claim:** any claim about code edits, behavior, tests, generated code, integration, architecture, or validation of code behavior.

## 2. LLM Run Card

Read this before every peer cycle. It is the default active-context surface; read deeper only when a gate triggers.

1. Use two agents only when risk justifies coordination; otherwise collapse.
2. Default to `Collaborative` and `Joint-first`; independent findings are a tactic, not default collaboration.
3. Before authoritative artifacts: no-use check, shared task frame, initialization handshake.
4. Peer work is step-locked: send the peer packet, write a final answer, and stop the turn. Continue only when the returned peer message arrives as a new input; then triad-check that returned response, accept/revise/reject the claim or frame, and proceed.
5. Peer replies must be sent back to the requesting peer's thread with `send_message_to_thread`; do not rely on delegation visibility alone.
6. After sending the response back, the responding peer writes a final answer in its own thread and stops. Do not keep polling or supervising the requester.
7. Only triad-check after a returned peer response arrives: inspect received message, visible completed peer turn, and durable state.
8. If `read_thread` is active/in-progress after response arrival, wait 10 seconds and recheck once; then stop polling.
9. Do not accept convergence from incomplete, stale, failed, mismatched, or message-only evidence.
10. Every substantive turn = critique + concrete contribution + unresolved state.
11. Ownership is collision control, not hierarchy. Preserve role symmetry and initiative reciprocity. Whoever names the next stress point also contributes evidence, text, patch, implementation movement, or rejection rationale; record access, atomic-work, or no-use exceptions.
12. New user instructions override stale peer packets; record impact before continuing.
13. Close the current step before candidate next focus. Candidate next focus is not an assignment.
14. Code-related work requires pre-edit joint approach and challenged structural classification.
15. Code-related closure requires actual peer diff/changed-file review and Architectural Distance Pass, unless narrow waiver is recorded.
16. Code corrections require correction-path agreement before edits unless the narrow mechanical exception applies.
17. Substantive artifact corrections require accept/revise/reject rationale; bounded safe non-code corrections should usually be patched by the identifying peer when safe.
18. Record durable state before milestone transitions, authority changes, or convergence.
19. Final handoff must use the final packet and name completed work, changed artifacts, validation, dirty-state boundary, no-use/collapse decisions, protocol acceptance evidence, collaboration-shape claim, residual risks, unresolved disagreements, and readiness.

Closure claims: scope, implementation/output, validation/review, durable state, residual risk.

## 3. Startup, No-Use, and Shared Frame

Harry Potter (Agent A) starts with the user. Harry MUST NOT create/finalize authoritative artifacts before Hermione Granger (Agent B) peer-shapes the task frame, unless the task is urgent or atomic and Harry records the draft as provisional.

Collapse or do not start when:

- task is tiny or purely mechanical;
- existing validation fully covers it and peer judgment is unlikely to change outcome;
- no peer thread is available and the user has not asked for or approved one;
- coordination cost exceeds task risk;
- one agent lacks required workspace, tools, or durable artifact access;
- user asks for single-agent pass;
- task is simple discovery-only/no-edit work with low risk and no convergence-sensitive decision.

No-edit is a boundary, not a collapse reason, when the user explicitly asks for complex peer review, audit, design critique, document/process evaluation, or converged advisory judgment.

If no Hermione thread id exists:

- If the user explicitly requested a real two-thread run and the environment permits thread creation without extra confirmation, create/request Hermione's thread and record the id.
- If the environment requires approval, ask: `Should I create Hermione Granger's peer thread now?`
- If peer work was not clearly requested, do not create a thread; collapse or ask approval.

One peer run has exactly one active Harry thread and one active Hermione thread. Harry MUST NOT use another Harry thread as Hermione's peer thread. If a Hermione thread id already exists for the run, Harry MUST use that thread and MUST NOT create a replacement or second Hermione thread while the existing one is active, waiting, or unresolved. If the existing Hermione thread is failed, inaccessible, stale, or wrong, Harry must record the reason, mark the old thread unusable, and get user approval before creating a replacement.

Before the initialization packet, confirm only what blocks safe startup: goal, output, peer-thread path, durable artifact path, ExecPlan need, constraints/no-edit/dirty-state boundaries, and validation/review expectations.

Before the first authoritative artifact, both peers MUST record:

- collaboration shape: `Collaborative` or `Advisory`, with rationale;
- inspection tactic: `Joint-first` or allowed `Independent-first`, with rationale;
- goal, expected output, phases, acceptance criteria, validation/review method;
- constraints, no-use considerations, risks, ownership split, shared boundary;
- whether a live task ExecPlan is required.

Any proposed task frame, ownership split, collaboration shape, inspection tactic, evidence standard, or work phase is candidate-only until the peer critiques and accepts, revises, or rejects it. The proposing peer MUST label it as candidate. The receiving peer MUST answer candidate versus agreed state before substantive work continues. Treat unilaterally finalized frame or ownership language as protocol drift.

Task-split agreement loop:

1. Send Hermione the initialization packet with only a candidate collaboration shape, inspection tactic, evidence standard, coverage matrix, ownership split, and work phases.
2. Write a final answer and stop the turn. Do not stay active, sleep, poll, inspect, or send another prompt while waiting.
3. After Hermione's returned response arrives, apply the peer-context triad to that response.
4. Accept, revise, or reject the collaboration shape, split, evidence matrix, and coverage areas.
5. Begin audit, design, implementation, document, or advisory work only after the split is agreed or unresolved disagreement is durably recorded with a safe next action.

This same loop applies at every later step: send the peer packet, write a final answer, and stop the turn. Continue only when the returned response arrives as a new input. Triad-check only after the response arrives, accept/revise/reject, then proceed. Do not stay active, sleep, poll, inspect the peer thread, send a resume/correction prompt, or continue substantive work while waiting.

Shape rules:

- `Collaborative` is default for work together, review together, coauthoring, joint decisions, and peer engineering. The first peer exchange agrees on task frame, evidence standard, ownership, and output shape before final findings or final text. Final output MUST be converged, not two independent findings merged.
- `Advisory` is only for lightweight second perspective with no durable artifact, code change, ExecPlan execution, validation claim, artifact authority change, or convergence-sensitive final decision. If it starts governing work, switch to Collaborative and record why.
- `Joint-first` is default. `Independent-first` is allowed only by explicit user request or when blind-spot detection is the evidence strategy. Findings remain preliminary until exchanged, critiqued, and converged unless the user wants separate opinions.
- One peer may draft first, but the draft is provisional until peer critique and accepted corrections/deferrals are durably recorded.

## 4. Peer-Context Triad and Synchronization

Use reply arrival as the synchronization event. Do not supervise active peer threads.

Peer-message loop: the sender sends a peer packet, writes a final answer, and stops the turn. The sender MUST NOT stay active to sleep, poll, inspect the peer thread, send a resume/correction prompt, or supervise the peer while waiting. When a peer receives a handoff, the peer completes the requested step in its own thread, sends the substantive response back to the requesting peer's thread using `send_message_to_thread`, writes a final answer in its own thread, and stops. The responding peer MUST NOT keep polling, supervising, or waiting on the requester after sending the response. Only after the returned message arrives as a new input does the requester apply the peer-context triad before accepting any claim or continuing. A response left only in the responding peer's thread is not a completed handoff.

Peer packets are bounded-step instructions. The receiving peer MUST do only the requested step and only the minimum evidence-gathering needed to answer that step. If the peer sees useful work beyond the requested step, it must propose that work as candidate next scope, send the response back, write a final answer, and stop. It MUST NOT expand into substantive audit, implementation, validation, source exploration, report drafting, or correction work unless that exact work is the current agreed requested step.

Before accepting any peer claim, convergence update, or artifact change, inspect:

1. received peer message;
2. peer's latest visible completed turn, including commentary/tool/file-change items when available;
3. current durable artifact/state: ExecPlan, work product, diff, validation record, or relevant repo state.

Rules:

- Do not run a triad check immediately after sending a peer packet. There is no peer response to triad-check yet.
- Waiting means ending the current turn after sending the packet. It does not mean staying active to poll, sleep, inspect, or repair the peer thread.
- Do not exceed the requested step. Extra useful work must be proposed as candidate next scope, not performed before the peer loop returns.
- A delegated message alone is not enough when peer-thread context may include caveats, partial execution, failed commands, or omitted edits.
- After a response arrives, inspect the visible peer turn once.
- If `read_thread` shows active/in-progress, wait 10 seconds and inspect once more.
- If the turn is complete and matches the response-producing turn, use it.
- If still active/in-progress, stale, failed, or mismatched, treat it as inspection mismatch: stop polling, do not accept convergence, and rely only on durable artifact confirmation or corrected handoff.
- Provisional critique may continue from partial evidence; closure and convergence may not.

## 5. Peer Cycle, Equality, and Closure

Each substantive stage requires both peers to critique and improve shared work. A valid substantive turn contains:

- critique of the peer's frame, patch, artifact, validation, or claim;
- concrete contribution: patch, rewrite, evidence check, implementation move, design option, validation design, exact correction, or rejection rationale;
- unresolved state: unresolved, blocked, deferred, or none.

Brief turns are allowed for synchronization, user-interruption acknowledgement, or final convergence, but they MUST NOT become a pattern where one peer critiques while the other performs all artifact work.

When work decomposes safely, assign peer-owned scopes with explicit boundaries. When work is atomic, keep one edit surface but require joint approach design and reciprocal critique before convergence.

The split is decided by peer agreement, not assignment. For each step, the proposing peer names candidate scopes, coverage areas, boundaries, evidence duties, and shared overlap. The receiving peer must accept, revise, or reject that split before either peer starts substantive work under it. If the split changes later, repeat the same stop-wait-triad-accept loop before continuing under the new split.

Across adjacent cycles, each peer should own an execution/investigation obligation and critique the other's actual work when tools and task shape allow. Whoever names the next stress point also contributes evidence, text, patch, implementation movement, or rejection rationale. Record exceptions for access limits, atomic work, specialization, or no-use economics.

Before proposing next focus, state whether the current step is `complete`, `incomplete`, or `blocked`. The receiving peer answers closure first. Any next focus is only a candidate until closure is accepted or remaining risk, deferral, correction, or disagreement is durably recorded.

## 6. Code-Related Gates

Apply this section to every code-related claim. Do not force it onto purely non-code work unless a code-related claim appears.

Before code edits continue:

- editing peer proposes `leaf-local`, `system-affecting`, or `uncertain` classification with structural rationale;
- reviewing peer challenges classification;
- if peers disagree, use the higher-risk label until one bounded disambiguation probe resolves it;
- revisit classification after diff exists and before closure.

Before code-related closure, reviewing peer MUST inspect peer-owned changed files and generated diff against declared scope, acceptance criteria, integration boundary, validation freshness, and user-owned dirty-state constraints.

Peer diff review may be waived only if: no code changed; diff cannot be produced after best effort but changed files were directly inspected; or a structural not-applicable reason is recorded. Invalid waiver reasons: `small diff`, `single file`, `mechanical`, `already validated`, or `the editing peer says local`. If code uncertainty remains, do not waive ADP.

Architectural Distance Pass (ADP) is required for code-related closure:

- `leaf-local`: structural rationale showing no outside authority, policy, contract, boundary, state transition, data shape, execution path, validation target, ownership responsibility, generated artifact, adapter, shared abstraction, or behavior invariant is altered or relied on.
- `system-affecting`: at least one targeted evidence source beyond diff.
- high-impact structural consequence: two evidence families: ownership/placement and propagation/validation.
- `uncertain`: one bounded disambiguation probe; escalate only if uncertainty or high impact remains.

High impact means possible effect on authority, security, user data, public contracts, migrations, cross-module invariants, generated artifacts, runtime state transitions, validation policy, or multiple independently owned call paths.

ADP record MUST include classification outcome, evidence, responsibility/placement judgment, propagation/parity judgment, validation-level judgment, and closure impact: accept, correction, ExecPlan update, validation change, deferred risk, or escalation. Missing/invalid ADP evidence fails code closure.

## 7. Correction Handling

Code corrections: if critique blocks closure and requires code correction, peers MUST agree before new edits unless the narrow mechanical exception applies. Record failed claim/evidence, corrective edit owner, correction reviewer, required change, supporting evidence, and invalidated validation/diff/ADP claims to rerun.

Mechanical exception applies only when the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim. Whoever edits becomes editing peer; the other peer reviews the correction diff before closure. Do not convert critique into an assignment or unilateral patch without agreement.

Non-code artifact corrections: for substantive peer-requested correction to an ExecPlan, protocol, prompt packet, skill spec, design doc, report, or other shared artifact, the correction path MUST be accepted, revised, or rejected with brief rationale before applying or declining.

When a non-code correction is bounded, justified, safe, accessible, collision-free, and has no authority/scope impact, the identifying peer SHOULD usually apply the exact correction; the other peer then accepts, revises, or rejects the diff. If the identifying peer cannot safely patch, the receiving peer accepts/revises/rejects before applying or declining. Skipping rationale is protocol drift unless the change is purely mechanical, uncontested, and has no meaning, authority, scope, validation, ownership, or future-execution impact.

## 8. Durable State, Validation, and Convergence

Record durable state before milestone transitions, authority changes, validation claims, or convergence. Anything needed for safe resumption belongs in the ExecPlan or shared artifact, not only in thread replies.

Record, when relevant: status/owner/next action; scope or acceptance changes; decisions; command outcomes; repo/artifact state; artifact paths; validation results; failed repair attempts; dirty-state boundaries; unresolved risks; deferred options; stop/escalation reasons. Prefer evidence pointers over pasted excerpts.

Validation claims MUST name the repo/artifact state they apply to. A passing command is stale if relevant files changed afterward. Validation substitutions are allowed only when ideal validation is unavailable, blocked, too expensive, flaky, credential/external-service dependent, or impossible. A substitution MUST state what it proves, what it does not prove, why ideal validation could not run, and required follow-up. Partial validation may support a reversible next step but not final convergence unless the residual gap is accepted, deferred, or escalated.

A milestone/work-product closes only when five durable claims hold:

1. Scope: work matches milestone and recorded scope changes.
2. Implementation/output: code, artifact, investigation result, or advisory output exists and ties to goal.
3. Validation/review: agreed validation or review ran against current state, or documented reason explains why not.
4. Durable state: decisions, evidence, outcomes, paths, gaps, and next state are recorded.
5. Residual risk: risks are non-blocking, assigned, escalated, or preserved as disagreement.

If a claim fails, run one correction cycle focused on it. If the same claim fails twice for the same reason, stop and escalate.

Collaborative non-code/mixed work also requires a collaboration-shape claim: converged final output; intentionally separate only by user request or explicit Independent-first tactic; or Advisory with no durable/convergence-sensitive claim. Parallel findings plus simple merge is not convergence.

## 9. User Interruptions, Drift, Collapse, and Escalation

Newest user instructions override stale peer handoffs. If the user changes scope, process, validation, stop conditions, priorities, or asks for status: pause affected assumptions, record impact on scope/ownership/validation/synchronization/durable artifacts, mark conflicting older packets stale, and request/send a revised handoff before acting on them.

Protocol drift includes boss/worker dynamics, message-only trust, continuous polling, staying active after sending a peer packet instead of ending the turn, exceeding the requested peer-packet step, triad-checking immediately after sending before a returned peer response exists, responding peer keeps polling or supervising after sending its response, reusing a Harry thread as Hermione or otherwise swapping thread roles, creating a second/replacement Hermione thread while the existing peer thread is active or unresolved, continuing substantive next-step work while waiting for peer response, authoritative artifacts before peer shaping, skipped ownership, unowned shared duties, treating candidate split/frame/coverage as agreed, edits outside declared surface, stale validation, agenda-setting without contribution, next-focus before closure, code correction without agreement, artifact correction without rationale, Collaborative work becoming parallel findings plus merge, or critique that changes no evidence/risk/validation/artifact/plan/decision.

Drift recovery: name the missing evidence or ownership violation; freeze affected convergence claims and dependent edits; request one correction turn; continue only if evidence is restored. If the same drift repeats next cycle, collapse to one agent or escalate if repo state, validation, or user-owned changes may be corrupted.

Collapse when no-use criteria apply, peer access fails, remaining work becomes mechanical/well-validated, peer turns stop changing evidence/risk/path, or coordination cost exceeds value. Record collapse reason and handoff boundary.

Stop/escalate when next action is destructive/irreversible; credentials/secrets/payments/external accounts/user-only info are required; required evidence is absent and unsafe to infer; validation repeatedly fails after repair attempts; or a governing ExecPlan cannot be made executable.

## 10. Prompt Packet Appendix

Replace placeholders. Keep packets copyable. Section references include the full gate, including one 10-second recheck and no continuous polling.

### 10.1 User-to-Agent-A Kickoff

```text
You are Harry Potter (Agent A). Use docs/protocols/codex_thread_peer_execution_protocol.md and tmp/thread_peer_execplan_workflow.md. Read Canonical Peer Names and LLM Run Card first.

Goal: <user goal>
Peer thread: <Hermione Granger / Agent B thread id, or create/request one under Startup rules>
Durable artifacts: <ExecPlan path and/or final artifact path>
Constraints: <no-edit, dirty-tree, validation, deadline constraints>

First apply no-use criteria. If peer work is justified, send the initialization packet to Hermione, write a final answer, and stop the turn. After Hermione's returned response arrives as a new input, apply §4 triad including the one 10-second active/in-progress recheck and no continuous polling, then create/update governing artifacts. Every substantive turn must include critique, contribution, and unresolved state.
```

Minimal kickoff: `Goal: <user goal>. Use protocol defaults. Ask only for missing information that blocks safe startup.`

### 10.2 Agent-A-to-Agent-B Initialization

```text
You are Hermione Granger (Agent B), equal peer to Harry Potter (Agent A). Use docs/protocols/codex_thread_peer_execution_protocol.md and tmp/thread_peer_execplan_workflow.md. Read Canonical Peer Names and LLM Run Card. Do not act as reviewer, supervisor, subordinate, or roleplay persona.

Initial context check: read this message, Harry's latest visible completed turn if available, and current durable state needed for your response. This is not a peer-response triad because you have not received a returned peer response yet. Do not poll Harry's thread.

Proposed frame:
- Shape/tactic: <Collaborative or Advisory; Joint-first or Independent-first, and why>
- Goal/output: <goal and expected output>
- Artifacts: <paths>
- Acceptance/review: <criteria and method>
- Constraints/no-use: <constraints>
- Ownership: <Harry scope; Hermione scope; shared boundary>
- Risks: <risks>
- ExecPlan: <yes/no/uncertain>

Respond with triad evidence, critique, concrete contribution, no-use decision or two-agent justification, proposed first milestone/ownership, and whether a governing artifact may be drafted. Send the response back to Harry's thread with `send_message_to_thread`, then write your final answer in this thread and stop. Do not poll Harry's thread after sending.
```

Agent B response is acceptable only with triad evidence, critique, contribution, ownership proposal, and unresolved state:

- triad evidence: what was read from the received message, visible peer turn, and durable state;
- critique: a concrete flaw, risk, or improvement in Harry's frame or artifact;
- contribution: a patch, rewrite, prompt text, validation design, evidence check, implementation move, exact correction, or rejection rationale;
- ownership: what Hermione proposes to own next and what Harry should own next;
- unresolved state: what remains unresolved, or why nothing remains unresolved.

If Agent B can only summarize/approve, collapse or revise split.

### 10.3 Recurring Peer Handoff

```text
Peer handoff: <milestone or work-product claim>
Artifacts: <ExecPlan path or N/A; work product path or N/A>
Current claim: <what changed or is ready>
Closure claim: <complete / incomplete / blocked, and why>
My scope: <Harry or Hermione with role label: changed files/sections/prompts/validation/design>
Peer contribution requested: <specific critique plus contribution; no vague review>
Evidence pointers: <commands, paths, diff refs, visible turn, artifact entries>

Code gates, if code-related:
- Peer diff review: <changed files inspected; diff command/ref; completed status or narrow waiver reason>
- ADP: <classification; evidence; responsibility/placement; propagation/parity; validation level; closure impact>
- Correction path if rejected: <failed claim; evidence; edit owner; reviewer; invalidated validation/diff/ADP>

Risks: <gaps, drift, dirty state, disagreements>
Candidate next focus if closure accepted: <proposal only>

Receiver: apply §4 triad, including the one 10-second active/in-progress recheck and no continuous polling, critique plus contribute, answer closure before next focus, and enforce code/correction gates when applicable. Send the response back with `send_message_to_thread`, then write a final answer in your own thread and stop. Do not accept code closure until peer diff review and ADP are complete or the narrow waiver is recorded.
```

### 10.4 Compact Non-Code / Read-Only Handoff

```text
Compact non-code peer handoff
Closure claim: <complete / incomplete / blocked, and why>
Current claim: <what I believe is true or ready>
My contribution: <critique, evidence check, wording, design option, finding, rejection rationale>
Peer contribution requested: <specific critique/improvement>
Evidence pointers: <artifact paths, sections, turns, source files, command results>
Durable status: <updated / not needed / blocked, and why>
Unresolved risks/disagreements: <issues or none>
Candidate next focus if closure accepted: <proposal only>

Receiver: apply §4 triad, including the one 10-second active/in-progress recheck and no continuous polling, critique plus contribute, answer closure first. Send the response back with `send_message_to_thread`, then write a final answer in your own thread and stop. If a code-related claim appears, add diff review and ADP or switch to full handoff.
```

### 10.5 Protocol Drift Correction

```text
Protocol drift correction
Observed drift: <missing evidence, stale validation, ownership violation, message-only trust, agenda-without-contribution, premature next-focus, correction-path failure, artifact-correction rationale failure, or critique-without-contribution>
Affected surface: <files, artifact sections, validation claims, milestone scope>
Required correction: <durable update, evidence check, narrowed claim, restored boundary, revised handoff>
Until corrected: do not accept convergence for affected surface; freeze dependent edits.
Please provide one correction turn. If the same drift repeats, collapse or escalate.
```

### 10.6 User Interruption

```text
User interruption received
New instruction: <quote or concise instruction>
Impact: Scope <changed/unchanged>; Ownership <changed/unchanged>; Validation/review <changed/unchanged>; Synchronization <changed/unchanged>; Durable artifacts <changed/unchanged>
Stale peer state: <older handoffs/claims/assumptions affected>
Required action: <pause, revise ExecPlan, update prompt, stop, ask user, continue>
Receiver: apply §4 triad, including the one 10-second active/in-progress recheck and no continuous polling, before acting on older possibly conflicting handoffs.
```

### 10.7 Convergence and Final Handoff

```text
Convergence and final handoff request
Completed work: <milestones/docs/code/artifacts/answer/audit>
Changed files/artifacts and owners: <paths and owners>
Validation/review: Completed <evidence>; Substituted <proves/does not prove/why>; Skipped/deferred <reason/follow-up>
Dirty-state and handoff boundary: <ready to stage/commit/hand back; untouched/unstaged/unrelated files>
No-use/collapse decisions: <none or rationale>
Protocol acceptance evidence: <3+ peer-caused improvements with timestamp/artifact evidence, or collapse rationale>
Collaboration-shape claim: <converged; intentionally separate only by explicit user request for separate opinions/findings or explicit Independent-first tactic; or Advisory with no durable/convergence-sensitive claim; unresolved disagreements recorded>
Residual risks/unresolved disagreements: <risk and blocking status>
Readiness: <ready to stage / commit / hand back / blocked>

Receiver: apply §4 triad, including the one 10-second active/in-progress recheck and no continuous polling, and confirm convergence or name the smallest failed claim for one correction cycle. Send the response back with `send_message_to_thread`, then write a final answer in your own thread and stop.
```

## 11. Optional Skills, Engineering Appendices, and Final Gate

Optional skill specs live in `docs/engineering/codex_thread_peer_skill_specs.md`; they are future reusable skill specs, not required for manual runtime work. They are subordinate to this protocol. If skill text, generated packet, supporting workflow detail, product-support note, or validation appendix conflicts with this protocol, this runtime protocol wins.

Before actual skill creation, verify generated skills still enforce: Run Card, no-use, initialization, triad, one-time recheck/no polling, critique-plus-contribution, role symmetry, initiative reciprocity, named ownership, peer diff review, ADP, correction-path agreement, artifact-correction rationale, current-step closure, durable-state updates, user interruptions, drift recovery, and final handoff.

Engineering appendices are not ordinary startup material:

- `docs/engineering/codex_thread_peer_product_support.md`: future product support.
- `docs/engineering/codex_thread_peer_validation_plan.md`: field-test/dry-run validation.
- `docs/engineering/codex_thread_peer_skill_specs.md`: future local skill specs.

Before ending a peer run, use the final packet. Do not hide a messy tail. If dirty state, skipped validation, generated artifacts, unresolved disagreement, or artifact authority is ambiguous, stop and ask before staging, committing, or declaring completion.

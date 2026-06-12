# Codex Thread Peer Execution Protocol

This document is the standalone runtime authority for running two Codex threads as equal peer agents on an ExecPlan, design document, prompt package, or other shared engineering artifact. The implementation ExecPlan that produced this protocol is historical bookkeeping and is not required at runtime. When a peer run creates, edits, audits, or executes a task-specific ExecPlan, that task ExecPlan and `docs/protocols/PLAN.md` remain required inputs for that work. The supporting peer workflow at `tmp/thread_peer_execplan_workflow.md` provides deeper cycle semantics when a gate needs interpretation.

This protocol coordinates peer work as a sequence of shared steps. Both peers must stay synchronized on the current shared step: a step is complete only when both peers explicitly report it complete, and the next shared step begins only after both peers mutually agree to start it.

## Purpose

Use this protocol when a task is complex enough that two Codex agents can improve the outcome by jointly shaping the task frame, challenging assumptions, splitting coherent work, critiquing each other's contributions, and preserving durable execution state.

Do not use this protocol for tiny, fully mechanical, or already well-validated tasks where coordination overhead is likely to exceed the risk of a single-agent run.

## Canonical Peer Names

Agent A is Harry Potter. Agent B is Hermione Granger. These names are stable coordination handles only; they do not imply roleplay, fictional behavior, hierarchy, or any change to peer equality.

Use both name and role label when clarity matters: `Harry Potter (Agent A)` and `Hermione Granger (Agent B)`.

## LLM Run Card

Read this card before each peer cycle. It is a checklist, not a replacement for the full protocol when a gate triggers.

Use canonical peer names in handoffs, ownership records, and closure records: Harry Potter (Agent A) and Hermione Granger (Agent B).

1. Use two agents only when risk justifies coordination; collapse for tiny, mechanical, or decisively validated work.
2. Default to Collaborative and Joint-first; independent findings are a tactic, not default peer collaboration.
3. Before authoritative artifacts, run shared task framing and a no-use check.
4. Maintain shared step synchronization. Do not begin a new shared step until both peers have explicitly marked the current shared step complete and have exchanged agreement on the next shared step.
5. After a peer response arrives, triad-check the received message, visible completed peer turn, and durable artifact. If `read_thread` is active/in-progress, wait 10 seconds and recheck once; if it is still not complete, stop polling and use durable evidence or a corrected handoff.
6. Every substantive turn must include critique, concrete contribution, and unresolved state.
7. Own slices for collision control, not hierarchy; critique the peer's actual work; preserve role symmetry and initiative reciprocity across adjacent cycles. Whoever names the next stress point also contributes evidence, text, patch, or rejection rationale; record an access, atomic-work, or no-use exception when symmetry is not practical.
8. Before code edits, run joint approach and challenged structural classification for code slices.
9. Before code closure, inspect peer diff and changed files.
10. For code closure, record Architectural Distance Pass: classification, evidence, responsibility/placement, propagation/parity, validation level, and closure impact.
11. If critique requires code correction, agree on correction path, edit owner, review owner, and invalidated checks before corrective edits unless the narrow mechanical exception applies.
12. Record durable state before crossing milestones or accepting convergence.
13. Close the current step before discussing candidate next focus.
14. Final handoff must use the Convergence and Final Handoff Packet and name changed files, validation, dirty-state boundary, residual risks, protocol acceptance evidence, collaboration-shape claim, and commit or handoff boundary.

Closure claims: scope, implementation, validation, durable state, residual risk.

## Immediate Workflow Layer

The immediate workflow uses capabilities available today:

- one user-facing Agent A thread;
- one Agent B peer thread, either provided by the user or created/requested by Agent A when the user asks for peer work with Hermione Granger;
- `send_message_to_thread` for peer handoffs;
- `read_thread` for post-response peer-context inspection;
- shared repository files for durable state;
- a live ExecPlan when the work is complex or implementation-oriented;
- a final shared artifact such as this runtime protocol, a design document, or an implementation plan.

The immediate workflow must not rely on hidden model reasoning. It may use visible thread content, tool/file-change records, final answers, and durable artifacts.

Engineering appendices are available for future product support and protocol validation, but they are not part of ordinary runtime startup. Use them only when building product support, validating the protocol, or evolving the protocol.

## No-Use Criteria

Collapse to one agent or do not start the peer workflow when:

- the task is tiny or purely mechanical;
- existing validation fully covers the change and no independent peer judgment is likely to change the outcome;
- no peer thread is available and the user has not asked for peer work or approved creating or using a second thread;
- the expected coordination cost is higher than the task risk;
- one agent lacks the required workspace, tools, or durable artifact access;
- the user asks for a single-agent pass, or the task is simple discovery-only/no-edit work with low risk and no convergence-sensitive decision. A no-edit instruction is a boundary, not a collapse reason, when the user explicitly requests complex peer review, audit, design critique, document/process evaluation, or converged advisory judgment.

## Startup Flow

The user starts in Agent A. Agent A must not create authoritative artifacts before completing a peer-owned initialization handshake with Agent B, unless the task is urgent or atomic and the reason for a provisional draft is recorded.

Agent A should first confirm:

- the user goal;
- expected output;
- whether Agent B already exists or must be created;
- the shared durable artifact path or proposed path;
- whether an ExecPlan is required;
- any user constraints, no-edit boundaries, or dirty-tree concerns;
- acceptance and validation expectations.

When Agent A creates or requests Hermione Granger's peer thread, Agent A must use the same model and reasoning level as Agent A's current thread when the environment exposes those controls. If model or reasoning-level parity cannot be set or verified, Agent A must record that limitation in the startup state and initialization packet. Agent A must not intentionally create a lower-capability Hermione thread for the same peer run unless the user explicitly approves the mismatch.

Agent A then sends Agent B an initialization packet. Agent B must critique and improve the task frame, not merely accept it.

## Shared Task Frame

Before the first authoritative artifact exists, both agents must shape and record:

- collaboration shape and rationale: `Collaborative` or `Advisory`;
- inspection tactic and rationale when relevant: `Joint-first` or `Independent-first`;
- user goal;
- expected output;
- work phases;
- acceptance criteria;
- validation or review method;
- constraints and no-use criteria;
- open risks;
- initial ownership split;
- whether a live ExecPlan is required.

Default to `Collaborative` when the user asks the agents to work together, review together, coauthor, jointly decide, or act like peer engineers. In Collaborative work, the first peer exchange agrees on task frame, evidence standard, ownership, and output shape before final findings or final text. Final output must be converged, not a merge of separate findings.

Use `Advisory` only for lightweight second-perspective answers where no durable artifact, code change, ExecPlan execution, validation claim, artifact authority change, or convergence-sensitive final decision is required. If the answer starts governing future work, switch to Collaborative and record why.

Use `Joint-first` as the default inspection tactic. Use `Independent-first` only when the user explicitly asks for independent findings or opinions first, or when blind-spot detection is clearly the evidence strategy. Independent-first findings are preliminary until exchanged, critiqued, and converged, unless the user explicitly wants separate opinions.

One agent may draft the first artifact, but that draft is provisional until the peer critiques it and the durable state records accepted corrections.

## Shared Step Synchronization

Peer work proceeds as shared steps. A shared step may be named by the agents in whatever way fits the task: step, milestone, source pass, implementation slice, design decision, validation pass, or another task-specific label. The protocol does not prescribe semantic phase names.

Each peer message that starts, continues, or closes coordinated work must state the current shared step and its state.

For every non-trivial shared step, both peers must make an active contribution to that same step before closure unless the step is explicitly single-actor, mechanical, blocked by access, or collapsed by no-use criteria. The contribution must match the agreed split: file edit, implementation change, artifact patch, evidence check, validation result, design option, critique with replacement wording, or rejection rationale. When a peer's agreed scope includes an editable artifact and a safe bounded edit exists, that peer should make the incremental file change and ask for feedback instead of only describing the correction. If a peer does not change a file in an editable-artifact step, they must state why. Contributions may be asymmetric, but the pair must not treat one peer's work plus the other peer's approval as sufficient by default.

Allowed step states are:

- `active`
- `awaiting peer response`
- `complete`
- `blocked`
- `disputed`
- `superseded`

Before either peer accepts current-step closure, the pair must compare both peers' contributions and run a gap check against the gates and closure conditions agreed for that shared step. The gap check asks whether each side contributed according to the split, whether each side's file change, implementation, artifact edit, evidence, validation, or feedback was critiqued by the other peer, whether the combined work satisfies the step's closure conditions, and whether any missing evidence, unchecked surface, unresolved disagreement, or deferred risk remains.

A shared step is complete only when both peers have explicitly reported that same shared step as complete. Until both peers have reported the current shared step complete, neither peer may begin substantive work for a new shared step.

If the current shared step is `active`, `awaiting peer response`, `blocked`, or `disputed`, the peers must mutually resolve that state before starting the next shared step.

After both peers report the current shared step complete, the next shared step must be mutually agreed through exchanged peer messages before either peer begins substantive work for it. When proposing the next shared step, also name expected peer contributions, file-change expectations, the gates that apply to that step, and the closure conditions the peers will use to decide whether the step is done. Keep the gate check small: name only applicable gates, gates being reapplied, and gates likely to be confused. For gates that are not applicable but likely to be confused, include a short reason.

Internal readiness, assumed agreement, or one peer's unilateral completion claim is not enough to close a shared step or start the next one.

A newer user instruction may supersede the current shared step. When that happens, the peer receiving the instruction must report the supersession to the other peer before continuing under the new step.

## Typical Collaborative Cycle

Most Collaborative peer runs follow this loop:

1. Mutually discuss and agree whether peer work is justified and what collaboration shape or inspection tactic applies.
2. Mutually discuss and agree how to split or jointly own the current shared step.
3. Each peer performs their side of the active work allowed by the agreed shared step, unless the step has a recorded single-actor, access, atomic-work, or no-use exception. If the peer's scope includes an editable artifact and a safe bounded edit exists, the contribution should be an incremental file change or patch, not just feedback.
4. Each peer reports their contribution, evidence, findings, edits, validation, risks, or blockers, states whether they changed files or why not, and asks for critique on that contribution.
5. The peers review each other's contributions, including file changes, implementation, artifact edits, evidence, validation, or feedback, identify gaps in the combined work, agree on corrections or revised claims, and decide whether the shared step's gates and closure conditions are satisfied.
6. Either agree on the next shared step and return to active work, or confirm convergence and use the final handoff.

This cycle is descriptive, not a fixed taxonomy. The actual shared step names may be task-specific, but peers must keep the current shared step synchronized and must not advance until both peers have marked the current step complete and agreed on the next shared step.

## Peer-Context Triad

Before accepting a peer claim, convergence update, or document change, inspect:

- the received peer message;
- the peer's completed visible turn, including commentary/tool/file-change items when available;
- the current durable artifact or ExecPlan state.

A delegated message alone is not enough when visible peer-thread context may include caveats, partial execution, failed commands, or edits not represented in the final answer. Do not poll active peer threads. If a peer response has arrived but `read_thread` shows the peer thread or inspected turn as active or in-progress, wait 10 seconds and inspect that turn once more. If the turn is then completed and matches the response-producing turn, use it as triad evidence. If it is still active/in-progress, stale, failed, or mismatched, treat it as an inspection mismatch: do not continue polling, do not accept convergence from that turn, and rely only on durable artifact confirmation or a corrected handoff.

## Work Cycle

For each substantive stage, both agents must critique and improve the shared work. A valid substantive peer turn contains:

- a critique of the peer's prior contribution or task frame;
- a concrete contribution such as a patch, rewrite, evidence check, implementation move, or rejection rationale;
- a statement of what remains unresolved or why nothing remains unresolved.

Pure synchronization, user-interruption acknowledgement, and final convergence turns may be brief, but they must not become a pattern where one agent critiques while the other does all artifact work.

Do not let a shared step become one-way feedback flow. If one peer identifies a bounded correction inside their agreed scope and can safely patch it, they should make the incremental change and ask for review. If they only provide feedback, they must ground it in their scope and explain why they are not patching, such as read-only boundary, unsafe collision risk, access limitation, validation-only scope, no safe bounded edit, or a deliberate single-editor agreement.

When the work can be decomposed safely, assign peer-owned scopes with explicit boundaries. When the work is naturally atomic, keep one edit surface but require joint approach design and reciprocal critique before convergence.

For code-related work, reciprocal critique must include actual peer diff review before current-step closure. Inspect the peer-owned changed files and relevant generated diff, then compare the diff against declared scope, acceptance criteria, integration boundary, validation freshness, and user-owned dirty-state constraints. For code-related closure, peer diff review may be waived only when no code changed, the diff cannot be produced after best effort but changed files were directly inspected, or the pair records a structural reason that the code gate is not applicable. `Small diff`, `single file`, `mechanical`, or `already validated` are not sufficient waiver reasons. If code-related uncertainty remains, do not waive the Architectural Distance Pass.

For code-related work, peer diff review also includes an Architectural Distance Pass. During joint approach, the editing peer proposes whether the code slice is `leaf-local`, `system-affecting`, or `uncertain`, and the reviewing peer performs an initial classification challenge before code changes continue. After the diff exists, the reviewing peer revisits that classification with its own structural rationale or evidence before closure. Accepted leaf-local changes need a structural rationale, not `small diff`, `one file`, or `the editing peer says local`. System-affecting changes need one targeted evidence source beyond the diff. High-impact structural consequences need two evidence families: ownership or placement, and propagation or validation. Treat a structural consequence as high-impact when it may affect authority, security, user data, public contracts, migrations, cross-module invariants, generated artifacts, runtime state transitions, validation policy, or multiple independently owned call paths. Uncertain changes start with one bounded disambiguation probe and escalate only if uncertainty remains or high-impact consequence appears. Do not accept code-step closure until the pass records classification outcome, evidence, responsibility and placement, propagation or parity, validation level, and closure impact.

If critique blocks closure and requires a code correction, agree on the correction path before new edits unless the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim. Name the failed claim, corrective edit owner, correction reviewer, and validation, peer diff review, or Architectural Distance Pass claims to rerun. Whoever edits the correction becomes the editing peer for that correction; the other peer reviews the correction diff before closure.

For any substantive peer-requested correction to an ExecPlan, protocol, prompt packet, skill specification, design document, or other shared artifact, the peer who identifies the issue must first state whether they accept, revise, or reject the correction path they are proposing, with a brief rationale grounded in the protocol, artifact evidence, and user goal. For bounded, clearly justified, safe non-code artifact corrections, the peer who identifies the issue should usually apply the exact correction when they have artifact access, no collision risk, and no authority or scope impact; the other peer then accepts, revises, or rejects the exact diff. If the identifying peer cannot safely patch it, the receiving peer must accept, revise, or reject the requested correction with rationale before applying or declining it. Applying a substantive artifact correction without this rationale is protocol drift unless the change is purely mechanical, uncontested, and does not affect meaning, authority, scope, validation, ownership, or future execution.

Before proposing the next focus, state whether the current step is complete, incomplete, or blocked. Any next focus is only a candidate until the peer first accepts current-step closure or records the remaining risk, deferral, or correction in durable state. A candidate next shared step must include expected peer contributions, file-change expectations, gates, and closure conditions proposed for that step, using only applicable gates, gates being reapplied, and likely-confused non-applicable gates with short reasons.

## Prompt Packet Appendix

Replace placeholders before use. Keep prompts short enough to paste, but do not remove the protocol gates.

### User-to-Agent-A Kickoff

Use this when the user wants a two-thread peer workflow.

```text
You are Harry Potter (Agent A). Use the Codex Thread Peer Execution Protocol at docs/protocols/codex_thread_peer_execution_protocol.md and the supporting peer workflow at tmp/thread_peer_execplan_workflow.md. Read the LLM Run Card and Canonical Peer Names sections in the protocol before starting.

Goal: <user goal>
Peer thread: <Hermione Granger / Agent B thread id, or create/request one if I asked for peer work and the environment permits it>
Expected durable artifacts: <ExecPlan path and/or final artifact path>
Constraints: <no-edit boundaries, dirty-tree concerns, validation expectations, deadlines>

Do not create authoritative artifacts until you complete the initialization handshake with Hermione Granger (Agent B). First decide whether the peer workflow is appropriate using the no-use criteria. If it is appropriate and Hermione's thread must be created, create/request it with the same model and reasoning level as Harry Potter's current thread when the environment exposes those controls; if parity cannot be set or verified, record the limitation. Then send Hermione Granger an initialization packet, wait for the peer response, apply the peer-context triad including one 10-second recheck if `read_thread` reports active/in-progress after response arrival, and only then create or update governing artifacts. Every substantive turn must include critique plus concrete contribution.
```

If the user asks for peer work with Hermione Granger and does not provide Hermione Granger's Agent B thread id, Harry Potter follows this decision tree: if the user explicitly requested a real two-thread peer run and the environment permits thread creation without extra confirmation, create or request Hermione Granger's peer thread with the same model and reasoning level as Harry Potter's current thread when available, then record the thread id and any parity limitation; if the environment requires explicit user approval, ask one concise question: `Should I create Hermione Granger's peer thread now?`; if the user did not clearly request peer work, do not create a peer thread and either apply the no-use/collapse criteria or ask for approval.

Minimal kickoff form:

```text
Goal: <user goal>. Use the protocol defaults. Ask only for missing information that blocks safe startup.
```

### Agent-A-to-Agent-B Initialization Packet

Harry Potter (Agent A) sends this to Hermione Granger (Agent B) before creating authoritative artifacts.

```text
You are Hermione Granger (Agent B), an equal peer to Harry Potter (Agent A). Use docs/protocols/codex_thread_peer_execution_protocol.md and tmp/thread_peer_execplan_workflow.md. Read the LLM Run Card and Canonical Peer Names sections in the protocol before responding. Do not act as a reviewer, supervisor, or subordinate.

Apply the peer-context triad: read this message, inspect Harry Potter's latest visible completed turn if available, and read the current durable artifact if one exists. If `read_thread` reports active/in-progress after Harry Potter's response arrived, wait 10 seconds and recheck once before treating it as an inspection mismatch.

Task frame proposed by Harry Potter (Agent A):
- Collaboration shape / inspection tactic: <Collaborative or Advisory; Joint-first or Independent-first, and why>
- Peer thread parity: <Hermione thread uses same model and reasoning level as Harry, or limitation/unknown recorded>
- User goal: <goal>
- Expected output: <artifact or behavior>
- Candidate artifacts and paths: <paths>
- Acceptance criteria: <criteria>
- Constraints and no-use considerations: <constraints>
- Proposed first ownership split: <Harry Potter / Agent A scope; Hermione Granger / Agent B scope; shared boundary>
- Open risks: <risks>

Your response must include:
1. critique of the task frame;
2. concrete contribution, such as revised artifact architecture, prompt wording, validation design, evidence check, or rejection rationale;
3. explicit no-use decision or confirmation that the peer workflow is justified;
4. proposed first milestone and ownership split;
5. whether an ExecPlan or other governing artifact may now be drafted.

Reply back to Harry Potter when complete. Do not poll Harry Potter's thread.
```

### Agent-B Response Contract

Agent B's response is acceptable only if it includes:

- triad evidence: what was read from the received message, visible peer turn, and durable artifact;
- critique: a concrete flaw, risk, or improvement in Agent A's frame or artifact;
- contribution: a patch, rewrite, prompt text, validation design, evidence check, implementation move, or rejection rationale;
- ownership: what Agent B proposes to own next and what Agent A should own next;
- unresolved state: what remains unresolved, or why nothing remains unresolved.

If Agent B can only summarize or approve, the workflow should collapse to one agent or revise the collaboration split.

### Recurring Peer Handoff Packet

Use this after a substantive change, before accepting convergence, or when handing a milestone to the peer.

```text
Peer handoff for <milestone or work-product claim>

Current shared step:
<step label>

Step state:
<active / awaiting peer response / complete / blocked / disputed / superseded>

Durable artifact(s):
- ExecPlan: <path>
- Work product: <path>

Current claim:
<what changed or what is ready for critique>

Current-step closure claim:
<complete / incomplete / blocked, and why>

My scope this cycle, using name and role label:
<Harry Potter (Agent A) or Hermione Granger (Agent B): files, sections, prompts, validation, or design areas changed>

My file-change contribution status:
<patched and requesting feedback / no file change because read-only, validation-only, atomic edit surface, unsafe collision risk, access blocked, no safe bounded edit, or agreed single-editor step>

Peer scope requested, using name and role label:
<Harry Potter (Agent A) or Hermione Granger (Agent B): specific critique and contribution requested; avoid vague review>

Evidence:
<commands, file paths, visible thread turn, dry-run output, or artifact excerpts>

Peer diff review required, for code changes:
<files/diff command or not applicable and why>

Architectural distance pass, for code changes:
- Classification: <leaf-local / system-affecting / uncertain; accepted / revised / unresolved / not applicable>
- Evidence: <leaf-local structural rationale / disambiguation probe / one source / two evidence families / N/A rationale>
- Judgment: <responsibility-placement; propagation-parity; validation-level>
- Closure impact: <accept / correction / ExecPlan update / validation change / deferred risk>

Correction path, if closure is rejected:
<failed claim and evidence; proposed/agreed corrective edit owner; correction reviewer; validation/diff/Architectural Distance Pass claims to rerun; or not applicable>

Known risks:
<unresolved risks, validation gaps, possible scope drift, dirty-state caveats>

Shared-step gap check:
<both contributions reviewed, including file changes or no-file-change rationale / missing peer contribution / missing evidence / unresolved disagreement / deferred risk; closure impact>

Candidate next focus, if this step closes:
<proposal only; not an assignment>

Expected peer contributions for candidate next shared step:
- Harry Potter (Agent A): <file/edit/evidence/design/validation/feedback contribution expected>
- Hermione Granger (Agent B): <file/edit/evidence/design/validation/feedback contribution expected>
- File-change expectation: <both may patch / Harry only first editor / Hermione only first editor / no file edits expected, and why>

Gates proposed for candidate next shared step:
- Applicable or reapplied: <gate names>
- Not applicable but likely to be confused: <gate name and short reason>

Closure conditions proposed for candidate next shared step:
<conditions the peers will use to decide that the next shared step is complete>

Please apply the peer-context triad, including one 10-second recheck if `read_thread` reports active/in-progress after response arrival, critique the claim, contribute a concrete improvement or rejection rationale, update the durable artifact if the correction is bounded, and first accept or reject current-step closure. For code changes, do not accept closure until peer diff review and the Architectural Distance Pass are complete or the narrow waiver is recorded: no code changed, diff unavailable after best effort with changed files directly inspected, or structural not-applicable rationale. `Small diff`, `single file`, `mechanical`, or `already validated` are not sufficient waiver reasons. If code-related uncertainty remains, do not waive the Architectural Distance Pass. If closure is rejected for a code correction, agree on the correction path before new edits and record the correction owner, correction reviewer, and invalidated validation or Architectural Distance Pass claims. Only after both peer contributions have been reviewed, the shared-step gap check is complete, and closure is accepted should you accept, revise, or reject the candidate next focus and proposed closure conditions.
```

For non-code, read-only, design, brainstorming, document coauthoring, or Advisory work, use this compact handoff unless a code-related or ExecPlan-specific claim is being made:

```text
Compact non-code peer handoff

Current shared step:
<step label>

Step state:
<active / awaiting peer response / complete / blocked / disputed / superseded>

Current-step closure claim:
<complete / incomplete / blocked, and why>

Current claim:
<what I believe is true or ready>

My contribution:
<critique, evidence check, wording, design option, finding, or rejection rationale>

My file-change contribution status:
<patched and requesting feedback / no file change because read-only, validation-only, atomic edit surface, unsafe collision risk, access blocked, no safe bounded edit, or agreed single-editor step>

Peer contribution requested:
<specific critique or improvement requested; avoid vague review>

Evidence pointers:
<artifact paths, sections, thread turns, source files, or command results>

Durable artifact/update status:
<updated / not needed / blocked, and why>

Unresolved risks or disagreements:
<remaining issues, deferred questions, or none>

Shared-step gap check:
<both contributions reviewed, including file changes or no-file-change rationale / missing peer contribution / missing evidence / unresolved disagreement / deferred risk; closure impact>

Candidate next focus, if this step closes:
<proposal only; not an assignment>

Expected peer contributions for candidate next shared step:
- Harry Potter (Agent A): <file/edit/evidence/design/validation/feedback contribution expected>
- Hermione Granger (Agent B): <file/edit/evidence/design/validation/feedback contribution expected>
- File-change expectation: <both may patch / Harry only first editor / Hermione only first editor / no file edits expected, and why>

Gates proposed for candidate next shared step:
- Applicable or reapplied: <gate names>
- Not applicable but likely to be confused: <gate name and short reason>

Closure conditions proposed for candidate next shared step:
<conditions the peers will use to decide that the next shared step is complete>
```

Omit code-only fields unless a code-related claim is being made. If a code-related claim appears, use the full recurring handoff packet or include the peer diff review and Architectural Distance Pass fields.

### Protocol Drift Correction Packet

Use this when one peer skips ownership, relies on stale validation, performs message-only trust, sets the agenda without contribution, desynchronizes the shared step by starting a new step before both peers complete the current step and mutually agree on the next one, advances the next focus before current-step closure, converts critique into a unilateral assignment or corrective patch without correction path agreement, applies a substantive peer-requested artifact correction without an accept/revise/reject rationale, lets Collaborative work degrade into parallel independent findings plus a merge without explicit Independent-first selection and convergence, replaces required handoff fields with a loose summary that hides current shared step, each peer's contribution, file-change status, applicable gates, closure conditions, gap check, or unresolved state, or gives critique that does not change evidence, risk, validation, or plan interpretation.

```text
Protocol drift correction

Observed drift:
<specific missing evidence, stale validation, ownership violation, message-only trust, or critique-without-contribution>

Affected surface:
<files, artifact sections, validation claims, or milestone scope>

Required correction:
<durable update, evidence check, narrowed claim, restored ownership boundary, or revised handoff>

Until corrected:
Do not accept convergence for the affected surface. Freeze further edits that depend on the missing evidence.

Please provide one correction turn with the missing evidence or revised claim. If the same drift repeats, we should collapse to one agent or escalate, depending on risk.
```

### User Interruption Packet

Use this when a new user instruction changes scope, process, validation, stop conditions, or priorities.

```text
User interruption received

New instruction:
<exact user instruction or concise quote>

Impact:
- Scope: <changed / unchanged>
- Ownership: <changed / unchanged>
- Validation: <changed / unchanged>
- Synchronization: <changed / unchanged>
- Durable artifacts: <changed / unchanged>

Stale peer state:
<peer handoffs, claims, or assumptions that predate the interruption and may no longer apply>

Required action:
<pause, revise ExecPlan, update prompt, stop, ask user, or continue>

Please triad-check this interruption, including one 10-second recheck if `read_thread` reports active/in-progress after response arrival, before acting on any older handoff that conflicts with it.
```

### Convergence and Final Handoff Packet

Use this before ending the peer run, staging, committing, or handing the result back to the user.

```text
Convergence and final handoff request

Completed work:
<milestones, prompts, docs, code, or artifacts completed>

Changed files and artifacts:
<paths and owners>

Validation:
- Completed: <evidence>
- Substituted: <what it proves / does not prove / why ideal validation was unavailable>
- Skipped or deferred: <reason and required follow-up>

Residual risks:
<risks and whether they block release, commit, or only future work>

Dirty-state and handoff boundary:
<what is ready to stage/commit/hand back, what must remain untouched, unrelated files>

Protocol acceptance evidence:
<at least three peer-caused improvements with timestamped or artifact-backed evidence, or reason to collapse to one agent>

Collaboration-shape claim:
<final output is converged; intentionally separate only by explicit user request for separate opinions/findings or explicit Independent-first tactic; or Advisory with no durable/convergence-sensitive claim; unresolved disagreements recorded>

Please apply the peer-context triad, including one 10-second recheck if `read_thread` reports active/in-progress after response arrival, and either confirm convergence or name the smallest failed claim that needs one correction cycle.
```

## Optional Skill Specifications

The optional skill specifications live in `docs/engineering/codex_thread_peer_skill_specs.md`. This keeps the runtime protocol focused on peer execution while preserving complete, copyable skill definitions in an engineering document.

The skill specs are subordinate to this runtime protocol. The supporting peer workflow in `tmp/thread_peer_execplan_workflow.md` clarifies deeper cycle semantics when a gate needs interpretation. If a skill prompt, trigger, generated packet, or workflow detail conflicts with this protocol, the runtime protocol wins. Any actual skill creation must first read the skill-spec document, then verify that the generated skill still enforces the LLM Run Card, no-use check, initialization handshake, peer-context triad, no-continuous-polling recheck, critique-plus-contribution, role symmetry, initiative reciprocity, named ownership, peer diff review, Architectural Distance Pass, correction-path agreement, current-step closure, durable-state updates, user interruption handling, protocol drift recovery, and final handoff gate.

## Engineering Appendices

Do not read these during ordinary peer execution unless the task is validating, evolving, or productizing the protocol:

- `docs/engineering/codex_thread_peer_product_support.md` for future Codex product support requirements.
- `docs/engineering/codex_thread_peer_validation_plan.md` for field-test and dry-run validation methods.
- `docs/engineering/codex_thread_peer_skill_specs.md` for future local skill specifications.

## Final Handoff

Before ending a peer run, use the Convergence and Final Handoff Packet above. The final state must include completed work, changed files and artifacts, validation completed/substituted/skipped, dirty-state boundary, residual risks, no-use or collapse decisions, protocol acceptance evidence, collaboration-shape claim, unresolved disagreements if any, and what is ready to stage, commit, or hand back.

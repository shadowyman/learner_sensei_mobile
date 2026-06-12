# Thread-Based Peer Execution Workflow

## Purpose

This workflow defines how two Codex agents should use thread-to-thread communication to execute an arbitrary ExecPlan or designated shared durable artifact with better quality than a plausible single-agent run.

The second agent is justified only when it changes the work: finding stale assumptions, improving the plan, reducing implementation risk, strengthening validation, preserving resumability, or preventing scope drift. A peer that only summarizes, approves, supervises, or asks for more process should be removed from the loop.

For operational use, read the LLM Run Card in `docs/protocols/codex_thread_peer_execution_protocol.md` before executing cycles. The run card is the compact checklist; this workflow provides detailed cycle semantics when a gate triggers.

In this workflow, `ExecPlan` means the active ExecPlan when one governs the work; otherwise read it as the designated shared durable artifact or final-answer evidence record. ExecPlan-specific repair rules apply only when a live ExecPlan exists.

Canonical peer names: Agent A is Harry Potter, and Agent B is Hermione Granger. These are stable coordination handles only. They do not imply roleplay, fictional behavior, hierarchy, or any change to peer equality. Thread replies, handoffs, ExecPlan entries, artifact notes, and closure records should use these names with the role label when clarity matters, for example `Harry Potter (Agent A)` and `Hermione Granger (Agent B)`.

## Core Model

Use dual-driver execution, not coder/reviewer execution.

For each milestone, both agents must own active obligations. When the milestone can be safely decomposed, split it into two peer-owned implementation or investigation slices with explicit boundaries. Each agent executes one slice and then critiques the other agent's slice against the ExecPlan or designated shared artifact, code evidence, integration risk, and validation results. Do not split a naturally atomic edit just to appear symmetrical; if decomposition creates more integration risk than peer value, use a single edit surface with joint approach design and reciprocal critique. Risk mapping, validation design, compatibility probing, and alternate approaches are shared peer duties, but each duty still needs a named owner for the cycle so shared responsibility does not become unowned work.

If the milestone cannot be decomposed safely, both agents should still participate in shaping the implementation approach before work starts. One agent may perform the edit, but the other must have proposal-stage input and post-edit critique rights before convergence. Do not assign a whole meaningful task to one agent while the other only validates from the outside.

Role symmetry invariant: across any two consecutive milestone cycles, each agent should own at least one execution obligation and critique the peer's execution at least once when tool access and task shape allow it. If the work is too small, specialized, or access-constrained for symmetry, record the exception in durable state. This prevents quiet drift into permanent implementer and permanent critic roles without forcing artificial role swaps.

Initiative reciprocity invariant: an agent who identifies the next stress point or agenda item must also contribute a concrete patch, evidence check, implementation move, or rejection rationale before handing the question to the peer. Across adjacent cycles, avoid letting the same agent repeatedly set the agenda when practical. Do not let one agent become the agenda setter while the other becomes the artifact worker.

Mutual step closure invariant: an agent may propose a candidate next focus only after stating whether the current step is complete, incomplete, or blocked. The proposal must be labeled as a candidate, not an assignment. The peer must first accept or reject current-step closure before discussing the next focus. A step is closed only when both agents have no unresolved material critique for that step or have recorded remaining risk, deferral, or disagreement in durable state.

The active ExecPlan or designated shared artifact is authoritative. Thread replies coordinate the next move, but any fact needed for safe resumption belongs in the active ExecPlan, designated shared artifact, or final-answer evidence record.

No agent owns the task frame by default. Any artifact that will govern the work, including an ExecPlan, implementation plan, design document, prompt packet, shared brief, acceptance contract, or first milestone definition, must be peer-shaped before it is treated as authoritative. One agent may draft the artifact when that is the lowest-friction way to move, but the other agent must have proposal-stage input and post-draft critique rights before the pair acts on it. Do not treat setup, scoping, prompt design, or artifact creation as coordinator-only work.

Collaboration shape is part of the task frame. Default to `Collaborative` when the user asks the agents to work together, review together, coauthor, jointly decide, or act like peer engineers. Collaborative work requires a shared frame, critique of each peer's substantive contribution, and a converged final output rather than a merge of separate findings. Use `Advisory` only for lightweight second-perspective answers with no durable artifact, code change, ExecPlan execution, validation claim, artifact authority change, or convergence-sensitive final decision; if the answer begins to govern future work, switch to Collaborative and record why. Use `Joint-first` as the default inspection tactic. Use `Independent-first` only when the user explicitly asks for independent findings or opinions first, or when blind-spot detection is clearly the evidence strategy. Independent-first findings remain preliminary until exchanged, critiqued, and converged, unless the user explicitly wants separate opinions.

At every substantive stage, each agent must both critique and improve the shared work. A valid substantive peer turn should contain a critique, a concrete contribution such as a patch, rewrite, evidence check, implementation move, or rejection rationale, and a clear statement of what remains unresolved or why nothing remains unresolved. Pure synchronization, user-interruption acknowledgement, and final convergence turns may be brief, but they must not become a pattern that lets one agent critique while the other performs all artifact improvement.

## Synchronization

Use reply arrival as the synchronization event.

Peer-message loop: the sender sends a peer packet, writes a final answer, and stops the turn. The sender must not stay active to sleep, poll, inspect the peer thread, send a resume/correction prompt, or supervise the peer while waiting. When a peer receives a handoff, the peer completes the requested step in its own thread, sends the substantive response back to the requesting peer's thread using `send_message_to_thread`, writes a final answer in its own thread, and stops. The responding peer must not keep polling, supervising, or waiting on the requester after sending the response. Only after the returned message arrives as a new input does the requester inspect the peer thread. A response left only in the responding peer's thread is not a completed handoff. Do not triad-check immediately after sending a peer packet; triad happens only after the returned response arrives.

Peer packets are bounded-step instructions. The receiving peer does only the requested step and only the minimum evidence-gathering needed to answer that step. Useful extra work is proposed as candidate next scope, not performed before the loop returns. This prevents frame critique from turning into full audit, audit critique from turning into report drafting, and correction review from turning into unrequested implementation.

After sending a peer message, an agent waits by ending the current turn, not by staying active. Do not inspect the peer thread or continue the next substantive step until the peer's reply arrives as a new input in the sender's thread. Do not actively poll an in-progress peer thread. Polling creates supervision dynamics, wastes bandwidth, and increases stale-read risk. Receipt of the peer response is the completion signal for the peer turn that produced it.

After a reply arrives, an agent may inspect the peer's latest visible turn once, then read the current durable state needed for the next cycle. Visible thread items are evidence, not hidden reasoning.

Peer-context triad: before accepting a peer's claim, convergence update, or document change, inspect three sources when available: the received peer message, the peer's completed visible turn including commentary/tool/file-change items, and the current durable artifact, active ExecPlan, or final-answer evidence record. A delegated reply alone is not enough evidence when the peer's background turn may reveal caveats, partial execution, failed commands, or edits not fully represented in the final answer.

If a peer response has arrived but `read_thread` shows the peer thread or inspected turn as active or in-progress, wait 10 seconds and inspect that turn once more. If the turn is then completed and matches the response-producing turn, use it as triad evidence. If it is still active/in-progress, stale, failed, or does not match the response-producing turn, treat it as an inspection mismatch: do not continue polling, do not accept convergence from that turn, and rely only on durable artifact confirmation or a corrected handoff.

## User Interruptions

Newest user instructions override queued peer handoffs when they conflict. If the user interrupts with a scope correction, review finding, status demand, stop instruction, or process correction, both agents must pause any stale cycle assumption affected by that instruction.

Before implementation continues, record the interruption in durable state with its impact on scope, ownership, validation, or synchronization. If a peer message was written before the interruption and now conflicts with it, treat that peer message as stale evidence and request or provide a revised handoff instead of executing it.

## Initialization Handshake

Before the first milestone cycle, both agents must establish a shared starting state. This prevents the pair from confidently executing an unusable ExecPlan, task frame, or shared artifact, or trampling unrelated work.

The handshake itself is a peer-owned work product. Before either agent creates or finalizes the first durable artifact, both agents must establish a shared task frame: the user goal, expected output, candidate work phases, acceptance criteria, constraints, validation or review method, open risks, and first ownership split. The first ownership split is agreed by the loop: send the candidate frame, write a final answer, stop the turn, triad-check only after the returned response arrives as a new input, accept/revise/reject the collaboration shape, split, evidence matrix, and coverage areas, then begin work under the agreed split. If one agent drafts the first artifact before peer input because the task is urgent or atomic, that draft is provisional until the peer critiques it and the durable state records either the accepted revision or the reason peer shaping was not practical.

The handshake must record:

- Task-frame or ExecPlan fitness: the active goal, first milestone or work phase, acceptance criteria, and any vague or over-prescriptive plan language that must be corrected before implementation;
- repo state: current branch or worktree context, changed-file summary, known user-owned or unrelated changes, and files that neither agent may touch without explicit permission;
- evidence baseline: analyzer outputs, logs, specs, or source files already trusted for the first milestone, plus gaps that require deeper reads;
- tool and validation access: commands or external tools each agent can run, and any likely blockers;
- initial ownership: each agent's first implementation or investigation scope when decomposition is safe, named owners for shared duties such as risk mapping and validation design, and who may edit the ExecPlan or shared artifact first.

If the pair cannot attribute the working tree, understand the first milestone or work phase, or name observable acceptance criteria, stop and repair the active ExecPlan or task frame before coding or final convergence. Do not use peer parallelism to compensate for an ambiguous start.

ExecPlan repair: if the plan is too vague, rewrite the next milestone into observable behavior, explicit edit boundaries, validation targets, and stop conditions before implementation. If the plan is too prescriptive and conflicts with repo evidence, record the conflict, preserve the user goal, and replace the prescribed mechanism with the lowest-risk evidence-backed approach that still satisfies acceptance criteria. If repair would change user-visible scope or intent, stop for user approval.

## Bounded Read Rule

Each cycle reads enough current state to avoid stale work without duplicating a full audit.

Always read:

- the active ExecPlan milestone or designated shared artifact state, current Progress entry when present, recent Decision Log entries when present, and relevant Validation and Acceptance entries when present;
- the peer's latest completed turn or delegated response;
- the current diff summary and changed-file list;
- validation results produced since the last cycle.

Read deeper only when triggered:

- reread the full ExecPlan or designated shared artifact after a long gap, milestone change, scope change, or contradiction;
- inspect analyzer outputs or broad dependency maps when the milestone touches shared behavior or unclear blast radius;
- inspect full source files before editing them or when validating a source-level assertion;
- reopen or rerun validation output only when repo state changed after the prior result or the prior output was too truncated to diagnose.

Dependency tripwire: when both agents' pre-read capsules name the same narrow change surface, the peer must challenge whether a hidden caller, shared contract, generated artifact, bridge boundary, data migration, configuration path, or runtime side effect could sit outside that surface. If the answer is plausible, one agent owns a targeted dependency check before implementation proceeds. This is not a full audit; it is a guard against both agents sharing the same incomplete map.

## Milestone Cycle

Run the smallest repeatable cycle that can produce code, evidence, and correction:

1. Intake: read the bounded state above, confirm the shared task frame, and identify the active milestone or work-product claim.
2. Pre-read capsule: each agent visibly states its intended obligation, risk read, likely change surface, validation target, and any plan challenge. Keep it compact.
3. Split: propose two peer-owned scopes when possible. Each scope should move implementation or investigation forward and name the expected integration boundary with the other scope. The split is not active until the peer accepts, revises, or rejects it through the stop-wait-triad-accept loop. If only one edit surface exists, split approach design, edit execution, and critique rights explicitly instead of assigning the whole task to one agent.
4. Ownership: declare file ownership, artifact ownership, validation ownership, and claim ownership for the cycle.
5. Joint approach check: before editing, both agents critique the proposed split and implementation approach for hidden coupling, missing acceptance criteria, and scope drift. For code slices, the editing peer proposes a provisional structural classification, `leaf-local`, `system-affecting`, or `uncertain`, with a structural rationale during this joint approach check. The reviewing peer performs an initial classification challenge before code changes continue; if classifications differ, use the higher-risk label until one bounded disambiguation probe resolves the difference. Post-diff critique revisits the classification before closure. Resolve material objections before code changes continue.
6. Execute: each agent performs only its bounded obligation and records any scope-changing discovery before expanding work. If the agent's agreed scope includes an editable artifact and a safe bounded edit exists, the agent should make the incremental file change and ask for review; otherwise record the no-file-change reason.
7. Reciprocal critique: each agent inspects the peer's slice, not as an outside reviewer but as a co-owner of the milestone. Critique must address ExecPlan or shared-artifact fit, integration with the other slice, validation adequacy, hidden side effects, and whether the peer contributed according to the agreed split through a file change, implementation, artifact edit, evidence, validation, or justified no-file-change contribution. For code-related milestones, this critique must include peer diff review: before accepting current-step closure, each agent must inspect the peer-owned changed files and relevant generated diff, or record the narrow waiver: no code changed, diff unavailable after best effort with changed files directly inspected, or structural not-applicable rationale. The critique must compare the actual diff against declared scope, ExecPlan or shared-artifact acceptance criteria, integration boundary, validation freshness, and user-owned dirty-state constraints. When the change is code-related, peer diff review must also include an Architectural Distance Pass: revisit the structural classification, record the rationale or evidence, judge responsibility and placement, judge propagation or parity needs, judge whether validation proves the behavior at the right level, and state the closure impact. If reciprocal critique rejects closure and requires a code correction, the reviewing peer states the evidence, concern, and closure impact, then the pair enters correction path agreement before new corrective edits begin unless the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim.
8. Evidence capture: update the ExecPlan or designated shared artifact with implementation facts, changed assumptions, command outcomes, artifact paths, unresolved risks, critique outcomes, and next action.
9. Convergence: test the milestone against the convergence contract. If it fails, run one correction cycle focused on the failed claim.

Shared-step closure requires combined-work review: both peers' contributions for the current step must be visible, critiqued, and checked for gaps against the agreed gates and closure conditions before either peer accepts closure. If one peer has not contributed, or repeatedly provides feedback while the other peer does all artifact work, record the single-actor, access, atomic-work, no-safe-bounded-edit, or no-use exception; otherwise the step remains incomplete.

Do not use a handoff to move the pair to the next task before current-step closure. A handoff may include a candidate next focus, but only after the current-step closure claim, and the receiver answers closure first. When proposing a candidate next shared step, name expected peer contributions, file-change expectations, the gates that apply to that step, and the closure conditions the peers will use to decide whether the step is done. Keep the gate check small: name only applicable gates, gates being reapplied, and likely-confused non-applicable gates with short reasons.

The cycle should not require a debate round when the next useful action is a reversible implementation or validation step.

Optional cycle capsule: when a handoff is getting fuzzy, compress the next cycle into seven fields: milestone claim, Agent A scope, Agent B scope, shared integration boundary, dependency tripwire result, validation target, and durable-state update required. Use the capsule to restore clarity, not as a form to fill when the next action is already obvious.

## Durable State

Write into the ExecPlan or shared artifact:

- milestone status, owner, and next concrete action;
- scope, assumption, or acceptance-criteria changes;
- implementation decisions that affect future code or validation;
- command outcomes, repo state, and artifact paths;
- failed validation and repair attempts;
- unresolved risks, deferred options, and reasons for stopping or escalating.

Keep in thread replies:

- critique of the peer's latest message;
- short handoff instructions;
- questions that force the next peer check;
- disagreement framing before evidence is gathered;
- temporary conversational context that is not needed for resumption.

If a thread reply contains information required to resume safely, copy that information into durable state before the next implementation step.

## Parallelism and Conflict Control

Ownership is collision control, not hierarchy.

Parallel work is allowed when obligations are independent and the collision surface is low:

- different files, modules, tests, or documentation sections;
- one agent edits while the other reads, maps impact, designs validation, or inspects analyzer output;
- one agent runs validation that does not depend on the other's unmerged edits;
- both agents investigate different hypotheses and report evidence before code changes.

Serialize work when concurrent action could corrupt durable state or produce misleading evidence:

- both agents need to edit the same file, ExecPlan section, generated artifact, lockfile, migration, or shared document section;
- validation depends on both agents' unmerged edits;
- a plan challenge could change milestone scope;
- repo state is dirty in ways neither agent can attribute confidently.

If conflict appears, stop edits to the conflicting surface, identify authoritative state from the working tree, diff, ExecPlan or shared artifact, and validation artifacts, prefer the smaller reversible change unless evidence favors the broader one, record the resolution, and rerun any validation invalidated by the conflict.

Validation claims must name the repo state they apply to. A passing command is stale if relevant files changed afterward.

When agents clash on implementation proposals before editing, run a joint-design remedy:

- restate the user goal and ExecPlan or shared-artifact acceptance criteria;
- identify the smallest disputed decision, not the whole approach;
- compare both proposals against correctness, integration risk, reversibility, validation cost, and scope drift;
- choose the proposal with the lower irreversible risk, or run the smallest reversible experiment that can produce evidence;
- record the rejected proposal and why it was not chosen when the tradeoff matters for future work.

When agents clash after both have implemented scoped slices, run an integration remedy:

- freeze both affected scopes;
- inspect the integration boundary rather than defending either slice;
- decide whether to adapt one slice, both slices, or the split itself;
- rerun validation invalidated by the integration change;
- update durable state with the boundary issue and resolution.

Correction path agreement: when peer critique requires a code correction, the peers agree on the correction path before new edits unless the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim. The agreement states the failed claim, what should change, who owns the corrective edit, who reviews the correction, what evidence supports that path, and which validation, peer diff review, or Architectural Distance Pass claims must be rerun. Compare alternatives against correctness, ownership boundary, reversibility, validation cost, scope, and integration risk. Usually the original editing peer fixes local issues in its slice; the reviewing peer edits only when the correction is clearly bounded, lower-risk for that peer to apply, or belongs to that peer's adjacent owned slice. Whoever edits becomes the editing peer for that correction, and the other peer reviews the correction diff before closure. A peer may not convert critique into an assignment or unilateral corrective patch without this agreement.

Artifact correction independence: for any substantive peer-requested artifact correction, the peer who identifies the issue must first state whether they accept, revise, or reject the correction path they are proposing, with a brief rationale grounded in the protocol, artifact evidence, and user goal. For bounded, clearly justified, safe non-code artifact corrections, the peer who identifies the issue should usually apply the exact correction when they have artifact access, no collision risk, and no authority or scope impact; the other peer then accepts, revises, or rejects the exact diff. If the identifying peer cannot safely patch it, the receiving peer must accept, revise, or reject the requested correction with rationale before applying or declining it. Applying a substantive artifact correction without this rationale is protocol drift unless the change is purely mechanical, uncontested, and does not affect meaning, authority, scope, validation, ownership, or future execution.

## Plan Challenge and Creative Divergence

Before executing a milestone, both agents independently ask:

- Does the ExecPlan or designated shared artifact still match the real goal and current repo state?
- Are acceptance criteria observable and tied to validation?
- What could break outside explicit scope?
- Which assumption would be most damaging if wrong?

If a material gap appears, update the ExecPlan or designated shared artifact before code changes continue. The update must state the evidence, changed scope or validation target, and whether execution can continue in parallel.

Creativity is allowed, but bounded. At milestone intake, either agent may propose an alternate approach when it plausibly improves correctness, simplicity, validation quality, performance, maintainability, or user-visible behavior. The proposal must state the plan weakness, alternate model, expected benefit, scope impact, validation impact, and reversibility.

Classify every proposal before implementing it:

- correction: required to satisfy the current ExecPlan, designated shared artifact, or acceptance criteria;
- improvement: beneficial but not required for the current milestone;
- expansion: changes the goal, user-visible promise, or validation surface beyond the accepted plan.

Corrections may proceed after updating the ExecPlan or designated shared artifact. Improvements proceed only when both agents agree they reduce net risk or effort inside the milestone. Expansions require explicit user approval or a recorded reason that the original ExecPlan or task frame cannot succeed without them. Good ideas not needed now should be parked in the ExecPlan or designated shared artifact as future options, with the deferral reason.

## Validation and Convergence

Validation is shared but not duplicated blindly. Each agent validates its own slice and challenges the peer's slice where it touches the shared milestone, integration boundary, or acceptance criteria.

Each agent runs narrow validation for its changed slice when it has one. The pair must also own at least one cross-slice validation angle aimed at integration, regression, acceptance criteria, or plan assumptions. Validation output must be summarized in the ExecPlan or designated shared artifact with command, result, relevant repo state, and artifact path when available.

Validation substitutions are allowed only when ideal validation is unavailable, flaky, blocked by credentials or external services, too expensive for the current cycle, or impossible in the current environment. A substitution must state what it proves, what it does not prove, why the ideal validation could not run, and what deferred validation is required before final confidence. Partial validation may support continuing to the next reversible step, but it cannot satisfy final convergence for the affected behavior unless the residual gap is explicitly accepted or escalated.

For code-related milestones, peer diff review and the Architectural Distance Pass are part of convergence evidence. Do not accept the implementation or validation claim for a peer-owned code slice until the receiving agent has inspected the relevant generated diff and changed files. Peer diff review may be waived only when no code changed, the diff cannot be produced after best effort but changed files were directly inspected, or the pair records a structural reason that the code gate is not applicable. `Small diff`, `single file`, `mechanical`, or `already validated` are not sufficient waiver reasons. If code-related uncertainty remains, do not waive the Architectural Distance Pass.

Code-related closure claims must include the Architectural Distance Pass result or an explicit `not applicable` rationale. Leaf-local claims require a structural rationale explaining why the change does not alter or rely on a rule, identity or authority model, policy, contract, boundary, state transition, data shape, execution path, validation target, ownership responsibility, generated artifact, adapter, shared abstraction, or behavior invariant outside the touched lines. `Small diff`, `one file`, or `the editing peer says local` are not valid leaf-local rationales. System-affecting changes require at least one evidence source beyond the diff. High-impact structural consequences require two evidence families: ownership or placement, and propagation or validation. Treat a structural consequence as high-impact when it may affect authority, security, user data, public contracts, migrations, cross-module invariants, generated artifacts, runtime state transitions, validation policy, or multiple independently owned call paths. Uncertain changes require one bounded disambiguation probe and escalate only if uncertainty remains or high-impact consequence appears. Missing or invalid Architectural Distance Pass evidence fails the convergence claim.

When a code correction was required, convergence also requires the recorded correction path, corrective edit owner, correction reviewer, invalidated validation or Architectural Distance Pass claims, and peer review of the correction diff.

For Collaborative non-code or mixed artifact work, convergence also requires a collaboration-shape claim: the final output is converged, intentionally separate only by explicit user request for separate opinions/findings or explicit Independent-first tactic, or Advisory with no durable or convergence-sensitive claim. Material claims must be accepted, revised, rejected, or marked unresolved after reciprocal critique; parallel independent findings plus a simple merge is not convergence.

A milestone is complete only when the pair can assert five claims from durable evidence:

- Scope claim: completed work matches the milestone and recorded scope changes.
- Implementation claim: relevant code, artifact, or investigation output exists and is tied to intended behavior.
- Validation claim: agreed validation ran against current relevant repo state, or a documented reason explains why it could not.
- Durable-state claim: the ExecPlan, designated shared artifact, or final-answer evidence record captures decisions, command outcomes, artifact paths, known gaps, and next milestone state.
- Residual-risk claim: remaining risks are accepted as non-blocking, assigned to a later milestone, or escalated.

Record the claims compactly in the ExecPlan, designated shared artifact, or final-answer evidence record. If any claim fails, run one correction cycle focused on that claim. If the same claim fails twice for the same reason, stop and escalate instead of continuing with partial confidence.

## Disagreement

Treat disagreement as an evidence problem, not a status contest.

- For factual disagreement, inspect source, analyzer output, diff, logs, or validation artifacts.
- For scope disagreement, record competing interpretations in the ExecPlan, designated shared artifact, or final-answer evidence record and resolve against the user goal and acceptance criteria.
- For implementation disagreement, choose the lowest-risk reversible experiment that can produce evidence.
- If disagreement remains after one bounded exchange and one evidence pass, escalate only when proceeding risks destructive work, significant scope drift, or invalid validation.

## Protocol Drift and Weak Peer Recovery

If one agent ignores ownership, edits outside its declared surface, skips durable-state updates, relies on stale validation, repeatedly sets the agenda without concrete contribution, advances candidate next tasks before mutual current-step closure, converts critique into a unilateral assignment or corrective patch without correction path agreement, applies a substantive peer-requested artifact correction without an accept/revise/reject rationale, lets Collaborative work degrade into parallel independent findings plus a merge without explicit Independent-first selection and convergence, replaces required handoff fields with a loose summary that hides current shared step, each peer's contribution, file-change status, applicable gates, closure conditions, gap check, or unresolved state, or provides critique that does not change evidence, risk, validation, or plan interpretation, treat the cycle as failing evidence quality.

Recovery should be peer-to-peer, not supervisory:

- name the specific missing protocol evidence or violated ownership boundary;
- stop further edits to any affected surface until state is re-attributed;
- ask for one correction turn that supplies the missing durable update, validation state, diff boundary, or narrowed claim;
- continue only if the corrected turn restores enough evidence for the convergence contract.

If the same agent repeats the same protocol failure in the next cycle, collapse to one agent for the remaining work or escalate if the failure has already corrupted repo state, validation evidence, or user-owned changes. Do not let politeness preserve a two-agent loop that no longer improves the work.

## Stop, Escalate, or Collapse to One Agent

Collapse back to one agent when:

- the remaining work is mechanical and well-covered by validation;
- peer turns restate the ExecPlan, shared artifact, or task frame without adding evidence, risk, or a better path;
- a peer repeats the same protocol failure after one correction turn;
- coordination costs more than implementation or validation;
- one agent lacks needed repo state or tools.

Stop or escalate when:

- the next action is destructive or irreversible;
- credentials, secrets, payments, external accounts, or user-only information are required;
- required information is absent from repo evidence and cannot be inferred safely;
- validation repeatedly fails after documented repair attempts;
- the ExecPlan, shared artifact, or task frame cannot be made executable from available evidence.

## Final Handoff Gate

Before ending the two-agent run, staging changes, committing, or handing back to the user, the pair must record a final state summary:

- completed milestones and any accepted scope changes;
- changed files, generated artifacts, and ownership of each change;
- unrelated or user-owned dirty files that must remain untouched;
- validation completed, validation substituted, validation skipped, and deferred validation still required;
- residual risks, deferred ideas, and whether they block release, commit, or only future work;
- commit or handoff boundary: what is ready to stage or commit, what must stay unstaged, and why.

For protocol-governed peer runs, the final state must also include protocol acceptance evidence, collaboration-shape claim, unresolved disagreements if any, and no-use or collapse decisions.

Do not let final convergence hide a messy tail. If unrelated dirty state, generated artifacts, or skipped validation make the commit boundary ambiguous, stop and ask for direction before staging, committing, or declaring the run complete.

## Protocol Acceptance Test

The protocol succeeds on a real ExecPlan only if the pair can point to timestamped or artifact-backed evidence for at least three outcomes that plausibly improve on a single-agent run:

- stale or missing assumptions were recorded before implementation relied on them;
- ownership records prevented overwrite, invalid validation, or duplicated work;
- validation evidence covered both the changed slice and an independent integration or regression angle;
- the ExecPlan became more resumable because decisions, command outcomes, artifact paths, and risks were recorded as they happened, not reconstructed at the end;
- a plan correction, alternate approach, or scoped deferral changed implementation, validation, or accepted scope for a stated reason;
- overhead stayed bounded because deeper reads, debate rounds, and parallel work were triggered by concrete risk rather than habit.

Claims do not count when they are only retrospective assertions in the final summary. They must be backed by an ExecPlan entry, diff, command result, artifact path, thread turn, or explicit deferred-risk record created near the time the issue was discovered.

For long ExecPlans, run this acceptance check after each major milestone or every three milestone cycles, whichever comes first. If the pair cannot identify any peer-caused improvement at that checkpoint, collapse to one agent or revise the collaboration split before continuing.

The protocol fails if the second agent cannot identify any implementation decision, validation target, plan correction, or risk outcome that changed because peer communication existed.

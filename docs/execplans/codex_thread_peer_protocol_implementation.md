# Implement Codex Thread Peer Execution Protocol

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/protocols/PLAN.md`. It also applies the supporting peer workflow in `tmp/thread_peer_execplan_workflow.md`; no governing artifact becomes authoritative until both peers shape the task frame and critique the draft.

## Purpose / Big Picture

The user wants a concrete, reusable way to run two Codex threads as equal peer agents rather than as a boss/worker or coder/reviewer pair. After this work, a user should be able to copy a kickoff prompt into Agent A, provide or create Agent B, and have both agents jointly create and execute a live ExecPlan or design artifact while enforcing the peer-context triad, shared task framing, critique-plus-contribution, role symmetry, no-continuous-polling synchronization with one delayed recheck, and final handoff checks.

The immediate output is not product code. It is an operator package: a live ExecPlan that governs this design work, a final operating guide with exact prompts, workflow rules, no-use criteria, and a field-test plan, plus a companion engineering document for optional skill specifications. The guide must distinguish what Codex users and agents can do today with existing thread tools from future product support that would make the workflow safer.

## Progress

- [x] (2026-06-09 Europe/Istanbul) Agent A read `docs/protocols/PLAN.md` and `tmp/thread_peer_execplan_workflow.md`.
- [x] (2026-06-09 Europe/Istanbul) Agent A sent Agent B a peer-owned initialization handshake instead of creating the ExecPlan unilaterally.
- [x] (2026-06-09 Europe/Istanbul) Agent B returned a peer critique that reframed the output as an operator package and proposed a three-tier artifact architecture, conservative skill strategy, no-second-agent criteria, prompt surfaces, and observable validation.
- [x] (2026-06-09 Europe/Istanbul) Agent A inspected Agent B's latest visible thread state and the peer protocol before drafting this file. The peer thread still appeared in progress while the user-supplied delegated response contained the substantive Peer B handoff, so this draft is provisional until Agent B critiques it.
- [x] (2026-06-09 Europe/Istanbul) Agent A created this provisional live ExecPlan, recording the peer-shaped frame and pending critique requirement.
- [x] (2026-06-09 Europe/Istanbul) Agent B critiqued this ExecPlan draft and patched bounded corrections for synchronization wording, artifact-path authority, field-test rigor, and continuation state.
- [x] (2026-06-09 Europe/Istanbul) Agent A applied the peer-context triad to Agent B's critique, accepted the bounded patches, and marked this ExecPlan authoritative for the next milestone.
- [x] (2026-06-09 Europe/Istanbul) Agent A created the final operating guide skeleton at `docs/protocols/codex_thread_peer_execution_protocol.md` with immediate/productized layers, no-use criteria, startup flow, shared task frame, peer-context triad, work cycle, prompt appendix placeholders, skill placeholders, field-test plan, and final handoff.
- [x] (2026-06-09 Europe/Istanbul) Agent B critiqued the operating guide skeleton and patched exact copyable prompt packets, optional skill specifications, and a concrete dry-run scenario.
- [x] (2026-06-09 Europe/Istanbul) Agent A applied the peer-context triad to Agent B's operating-guide patch and accepted the prompt packets, optional skill specifications, and dry-run scenario as the converged baseline for the next milestone.
- [x] (2026-06-09 Europe/Istanbul) Agent A defined productized support requirements and non-goals in the operating guide, including peer pair registry, launch/connect flow, packet types, triad checklist, completion-state guard, artifact authority state, ownership boundary view, drift prompts, user interruption propagation, validation ledger, collapse path, and final handoff view.
- [x] (2026-06-09 Europe/Istanbul) Agent B applied the peer-context triad to Agent A's productized-support patch and added a compact dry-run evidence record to the operating guide.
- [x] (2026-06-09 Europe/Istanbul) Agent A triad-reviewed Agent B's dry-run evidence structure, accepted it, and documented a collapse-path dry-run validation record in this ExecPlan.
- [x] (2026-06-09 Europe/Istanbul) Agent B triad-reviewed the documented dry-run validation record, accepted it as collapse-path validation, and clarified that it is not a fresh prompt-packet field test or a continued two-agent branch validation.
- [x] (2026-06-09 Europe/Istanbul) Finalized the operating guide and completed the protocol acceptance test for the immediate workflow and collapse path. Continued two-agent execution on a larger real ExecPlan remains future validation.
- [x] (2026-06-09 Europe/Istanbul) Applied a narrow post-convergence repair for premature next-focus agenda setting: current-step closure must be accepted or rejected before candidate next focus is discussed.
- [x] (2026-06-09 Europe/Istanbul) Applied a narrow post-convergence repair for code-related ExecPlans: peer diff review is required before accepting current-step closure for peer-owned code changes, unless explicitly waived with rationale.
- [x] (2026-06-09 Europe/Istanbul) Applied a narrow post-convergence repair for architectural tunnel vision in code reviews: code-related closure now requires an Architectural Distance Pass with challenged structural classification, evidence depth by risk, and closure impact.
- [x] (2026-06-09 Europe/Istanbul) Applied a narrow post-convergence repair for correction-path peer equality: when critique requires a code correction, peers must agree on the correction path, edit owner, review owner, and invalidated checks before new corrective edits unless the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim.
- [x] (2026-06-10 Europe/Istanbul) Started protocol authentication audit under the current peer protocol. Agent A and Peer B read the base protocol, operating guide, and ExecPlan; Peer B used the user-requested 10-second delayed recheck when Agent A's latest visible turn initially appeared active/in-progress after the delegated response arrived.
- [x] (2026-06-10 Europe/Istanbul) Applied authentication audit patches for the user's two new requirements: one-time 10-second delayed recheck after response-arrival active/in-progress reads, an LLM Run Card in the operating guide, prompt-packet recheck language, productized completion-state support, and current acceptance criteria.
- [x] (2026-06-10 Europe/Istanbul) Peer B exact-patch reviewed the authentication changes, requested one operator-facing no-continuous-polling correction, and Agent A applied it.
- [x] (2026-06-10 Europe/Istanbul) Peer B accepted closure for the authentication patch with no unresolved material critique and no candidate next focus.
- [x] (2026-06-10 Europe/Istanbul) Stamped the protocol `authenticated for known failure modes and current operating surfaces`.
- [x] (2026-06-10 Europe/Istanbul) Started skill-spec extraction milestone. User requested moving suggested skills out of the operating guide into a complete `docs/engineering` document tied to the protocol, then peer review to confirm the skills are complete enough to force the protocol.
- [x] (2026-06-10 Europe/Istanbul) Agent A extracted optional skill specifications into `docs/engineering/codex_thread_peer_skill_specs.md`, linked the operating guide to that document, and updated this ExecPlan.
- [x] (2026-06-10 Europe/Istanbul) Peer B exact-artifact reviewed the extraction and requested one bounded completeness correction: user interruption handling and omitted core gates must be explicit in the guide pointer and skill-spec enforcement/checklist text. Agent A applied the correction, Peer B verified it, and current-step closure is accepted.
- [x] (2026-06-10 Europe/Istanbul) Started artifact-correction independence repair. User approved adding a generic rule that receiving peers must accept, revise, or reject substantive peer-requested artifact corrections with rationale before applying them; direct application without rationale is protocol drift unless the change is purely mechanical, uncontested, and cannot affect meaning, authority, scope, validation, ownership, or future execution.
- [x] (2026-06-10 Europe/Istanbul) Agent A patched the base protocol, operating guide, skill-spec document, and this ExecPlan with the artifact-correction independence rule. Peer B exact-patch reviewed the repair, accepted current-step closure, and recommended against adding a recurring handoff field to avoid packet bloat.
- [x] (2026-06-10 Europe/Istanbul) Started stable peer-name repair. User requested reliable names for the two agents: Harry Potter and Hermione Granger. Agent A accepts this as a coordination-handle improvement, not a persona or roleplay change.
- [x] (2026-06-10 Europe/Istanbul) Agent A patched the base protocol, operating guide, skill-spec document, and this ExecPlan with the canonical peer-name mapping: Harry Potter is Agent A and Hermione Granger is Agent B. The operating guide's LLM Run Card now repeats the mapping so future agents see it before each peer cycle.
- [x] (2026-06-10 Europe/Istanbul) Hermione Granger exact-artifact reviewed the stable peer-name repair, accepted the overall mapping and no-roleplay/no-hierarchy guard, and requested one bounded runtime correction: recurring handoff ownership fields and generated handoff prompt requirements must use name-plus-role scope. Harry Potter accepted the correction and patched the operating guide and skill-spec document. Hermione Granger verified the correction and accepted current-step closure.
- [x] (2026-06-10 Europe/Istanbul) Applied a startup-flow correction for missing Hermione Granger thread ids. When the user asks for peer work with Hermione Granger but does not provide Agent B's thread id, Harry Potter should ask one concise creation question; if the user has already implied a real peer run is required, creation/request is authorized unless the environment requires explicit confirmation.
- [x] (2026-06-11 Europe/Istanbul) Completed collaboration-shape repair after user approved the peer-converged hybrid model. The repair adds a compact Collaborative/Advisory shape and Joint-first/Independent-first inspection tactic so peer audits and reviews cannot degrade into independent findings plus a merge. Scope stayed limited to the operating guide, base protocol, skill specs, and this ExecPlan; the seven-mode proposal and four work-type mode list remain rejected as protocol bloat. Hermione Granger accepted current-step closure after the final convergence wording correction.
- [x] (2026-06-11 Europe/Istanbul) Applied artifact-correction reciprocity refinement. The protocol already required accept, revise, or reject rationale before applying peer-requested artifact corrections; it now also says that bounded, clearly justified, safe non-code artifact corrections should usually be patched by the receiving peer for exact-diff review, or else the peer must state why they are not applying the correction.
- [x] (2026-06-11 Europe/Istanbul) Renamed the main runtime document to `docs/protocols/codex_thread_peer_execution_protocol.md` and the supporting tmp document to `tmp/thread_peer_execplan_workflow.md`, then updated runtime references and titles to match the user's requested protocol/workflow naming.

## Surprises & Discoveries

- Observation: The peer-context triad can expose an inspection mismatch between a delegated response received in Agent A's thread and the peer turn inspected by `read_thread`. The operating protocol now treats reply arrival as the completion signal for the peer turn that produced it, so an apparent `inProgress` state after receiving a response should be handled as a mismatch to re-check, not as a normal provisional collaboration state.
  Evidence: Agent A's thread received the full Peer B initialization response from source thread `019eacfd-1098-79e2-bf7a-a1f3d93e0421`; a subsequent `read_thread` call showed turn `019ead64-b483-7dd2-8e36-580e3d3c274c` as `inProgress`.

## Decision Log

- Decision: Treat this task as an operator-package design, not only as document writing.
  Rationale: Peer B correctly identified that the useful deliverable is the workflow kit inside the documents: kickoff prompts, Agent A and Agent B packets, recurring handoffs, correction packets, convergence packets, optional skills, and field-test criteria.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A accepting Peer B critique.

- Decision: Use three artifact layers for the design.
  Rationale: A live ExecPlan governs the work, a final operating guide is the user-facing reusable protocol, and the guide should include or append exact prompt packets, optional skill specifications, and product-support requirements. This avoids scattering small docs while keeping the operating guide copyable.
  Date/Author: 2026-06-09 Europe/Istanbul / Peer B proposal accepted provisionally by Agent A.

- Decision: Keep actual skill creation out of the first pass unless the peers later decide it is necessary.
  Rationale: Skill specifications should be exact, but creating local skill files too early may freeze an untested workflow. The prompt workflow should be field-tested first.
  Date/Author: 2026-06-09 Europe/Istanbul / Peer B proposal accepted provisionally by Agent A.

- Decision: This ExecPlan is provisional until Agent B critiques it.
  Rationale: The peer protocol now says governing artifacts must be peer-shaped before becoming authoritative. Agent B shaped the frame before drafting, but has not yet critiqued this actual ExecPlan file.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A.

- Decision: Use `docs/protocols/codex_thread_peer_execution_protocol.md` as the final operating guide path.
  Rationale: The output is a reusable operating protocol for future Codex thread pairs, not a one-off engineering analysis. Keeping it under `docs/protocols/` makes its governance purpose explicit while this ExecPlan remains under `docs/execplans/`.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B critique.

- Decision: Require a field-test transcript or dry-run evidence, not only a narrative claim.
  Rationale: `docs/protocols/PLAN.md` requires demonstrable outcomes. Since the product is an operator workflow, validation must show that the prompts and rules can be followed through a small peer scenario and produce evidence of avoided failure modes.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B critique.

- Decision: Accept the peer-critiqued ExecPlan as authoritative for the next milestone.
  Rationale: Agent A applied the peer-context triad by reading the delegated Peer B critique, inspecting Peer B's visible completed turn, and reading the patched ExecPlan. The patches improved synchronization wording, final guide path authority, and field-test rigor without introducing structural conflicts.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A.

- Decision: Keep prompt packets and skill specifications inside the operating guide for this pass.
  Rationale: The guide is still readable as one operator package, and keeping prompts plus skill specs in one file reduces lookup overhead. If the guide becomes unwieldy after field testing, a companion appendix can be split later and recorded here.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B.

- Decision: Use a documentation-only no-use/dry-run scenario as the first validation scenario.
  Rationale: A small note about when not to use the peer workflow tests whether the protocol can decide to collapse to one agent rather than create ceremony. It also tests kickoff prompts, initialization, critique-plus-contribution, and final handoff without risking product code.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B.

- Decision: Productized support requirements must be concrete future-state boundaries, not broad feature wishes.
  Rationale: The immediate workflow already works manually with thread tools and shared artifacts. Future Codex support should harden state visibility, packet structure, triad evidence, artifact authority, ownership boundaries, drift detection, validation ledgers, collapse paths, and final handoff without exposing hidden reasoning or forcing artificial work splits.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A.

- Decision: Validate the dry run with a compact evidence record rather than another narrative discussion.
  Rationale: The field test needs artifact-backed proof that the workflow prevented observed failures, but a long meta-analysis would recreate the coordination overhead the protocol is meant to avoid. The record names exact prompts, no-use decision, triad evidence, peer contribution evidence, five failure probes, pass/fail outcome, and required follow-up. The guide now distinguishes a continued two-agent dry-run pass from a collapse dry-run pass, so a correct no-use decision is not penalized for lacking three peer-caused implementation improvements.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B.

- Decision: Treat the first documented dry run as a collapse-path validation instead of creating `docs/engineering/example_peer_run_note.md`.
  Rationale: The scenario is intentionally small. Creating an extra documentation note after the guide already contains no-use criteria would test compliance less than the collapse path does. The validation should prove that the workflow can refuse unnecessary two-agent overhead while preserving enough triad, peer contribution, and handoff evidence.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A.

- Decision: Declare convergence for the operating guide with an explicit validation boundary.
  Rationale: The guide now contains runnable immediate workflow instructions, copyable prompts, optional skill specifications, productized-support requirements, no-use criteria, and a compact dry-run evidence structure. The documented dry run validates the collapse path and several observed failure safeguards, but it does not validate the continued two-agent implementation branch on a larger real ExecPlan.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B.

- Decision: Add a mutual step-closure rule instead of a new agenda-setting process layer.
  Rationale: The user identified that naming the next challenge can prematurely steer the peer away from unresolved critique on the current step. The smallest generic remedy is to require a current-step closure claim before any candidate next focus and to make the receiving peer accept or reject closure before discussing the next focus. This preserves useful forward-looking suggestions without turning the latest sender into the agenda owner.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent B, from Agent A handoff and user observation.

- Decision: Require peer diff review for code-related milestones before closure.
  Rationale: The protocol already required reciprocal critique, changed-file awareness, and validation review, but those rules could still be satisfied by reading a handoff summary instead of the generated diff. For code ExecPlans, the smallest remedy is to make actual peer diff inspection part of reciprocal critique and convergence evidence, while allowing an explicit waiver for non-code work or cases where diff review is impossible or unnecessary.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A, from Peer B handoff and user question.

- Decision: Add Architectural Distance Pass as a code-closure enforcement rule without creating a new protocol section.
  Rationale: The user identified that reviewers can tunnel into the implementer's local diff and miss broader ownership, parity, domain, or validation-level failures. Peer B and Agent A converged on a bounded remedy: classification itself must be challenged using structural consequence, not inherited from the editing peer, and non-leaf or uncertain changes must inspect evidence beyond the diff before closure. The rule is threaded through approach check, reciprocal critique, convergence, handoff packets, productized guards, and skill specs rather than added as a standalone bloat section.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A, accepting Peer B integration response.

- Decision: Add correction-path agreement before corrective code edits.
  Rationale: The user identified that a peer who finds an issue can still drift into boss mode by assigning the fix to the original editor, or into unilateral implementer mode by applying its own preferred patch. Peer B agreed that the missing state is an explicit agreement about the failed claim, correction path, edit owner, review owner, supporting evidence, and invalidated validation or Architectural Distance Pass claims. The repair is placed in existing cycle, conflict-control, convergence, handoff, drift, and skill-spec surfaces rather than a new top-level section.
  Date/Author: 2026-06-09 Europe/Istanbul / Agent A, accepting Peer B correction-path recommendation.

- Decision: Treat active/in-progress thread reads after response arrival with a single 10-second delayed recheck.
  Rationale: Earlier protocol wording treated an active/in-progress read after response arrival as an inspection mismatch immediately. The user required a short delayed recheck to complete the triad. The new rule preserves no continuous polling while allowing one deterministic recheck before declaring mismatch.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A accepting Peer B audit recommendation and user instruction.

- Decision: Add one canonical LLM Run Card to the operating guide instead of duplicating a long checklist across artifacts.
  Rationale: The operating guide is the operator package and prompt source. A compact run card near the top improves LLM adherence without splitting the document or creating duplicate checklists that can drift. The base protocol points to the run card, and prompt packets include only the high-risk triad recheck language.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A accepting Peer B audit recommendation.

- Decision: Stamp target is `authenticated for known failure modes and current operating surfaces`, not mathematical flawlessness.
  Rationale: The protocol can be audited against known user-observed failures and current prompt/operator paths, but no process document can prove all future failure modes impossible. Authentication requires every known failure mode to have an explicit gate, the gate to appear in the run card and prompt/operator path, both peers to audit the result, and unresolved limitations to be recorded rather than hidden.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A accepting Peer B audit recommendation.

- Decision: Move optional skill specifications from the operating guide into `docs/engineering/codex_thread_peer_skill_specs.md`.
  Rationale: The operating guide is already the runtime protocol and prompt package. Keeping long skill specs inside it increases LLM reading burden and makes adherence harder. A dedicated engineering document can define the optional skills completely, while the operating guide keeps a concise pointer so the protocol remains the authoritative source of behavior.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A, before skill-spec extraction edit.

- Decision: Add a generic accept/revise/reject rationale requirement before substantive peer-requested artifact corrections.
  Rationale: The user identified that Agent A can still become an artifact worker by applying Peer B's suggested corrections without visibly exercising independent judgment. This failure applies to protocol docs, ExecPlans, skill specs, prompt packets, design documents, and other shared artifacts, not only code. The repair requires a receiving peer to state whether it accepts, revises, or rejects the correction before editing, with a rationale grounded in protocol, artifact evidence, and user goal. A narrow exception remains for purely mechanical, uncontested changes that cannot affect meaning, authority, scope, validation, ownership, or future execution.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A, accepting user-approved protocol repair.

- Decision: Use stable peer names as coordination handles.
  Rationale: The user asked the agents to know what to call themselves reliably everywhere. Stable names reduce ambiguity in handoffs, closure records, and prompt packets. The names are handles only: Harry Potter means Agent A, and Hermione Granger means Agent B. They do not imply roleplay, fictional behavior, rank, or any change to peer equality.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A.

- Decision: Treat an explicit request for peer work with Hermione Granger as authorization to create or request the peer thread unless the environment requires confirmation.
  Rationale: The previous wording made Harry Potter stop and ask for an Agent B thread id even when the user had already asked for peer work. That was too conservative for the intended workflow. The new startup rule preserves a concise confirmation question when needed, but avoids silently downgrading an explicit peer assignment into a single-agent pass.
  Date/Author: 2026-06-10 Europe/Istanbul / Agent A, accepting user wording.

- Decision: Add a compact collaboration-shape and inspection-tactic gate instead of Harry Potter's seven-mode proposal or four work-type mode list.
  Rationale: Peer review revealed a real failure mode: collaborative work can degrade into parallel independent findings plus a merge. The seven-mode and four-work-type proposals add taxonomy and token overhead without directly governing that behavior. The accepted hybrid uses `Collaborative` as the default shape, tightly limits `Advisory`, and treats `Independent-first` as an inspection tactic rather than normal peer collaboration.
  Date/Author: 2026-06-11 Europe/Istanbul / Agent A and Hermione Granger convergence, user-approved.

## Outcomes & Retrospective

Final outcome: The operating guide is complete for immediate workflow use and collapse-path behavior. It contains copyable prompt packets, productized-support requirements, no-use criteria, a dry-run evidence structure, final handoff rules, and a pointer to the dedicated optional skill-specification document at `docs/engineering/codex_thread_peer_skill_specs.md`. The continued two-agent implementation branch remains future validation on a larger real ExecPlan.

Update: Agent A created the final operating guide skeleton. The next required outcome is Agent B critique and contribution before the guide can be treated as converged.

Update: Agent B patched the operating guide with exact prompt packets, optional skill specifications, and a concrete dry-run scenario. The guide is still not converged until Agent A triad-reviews the patch and records acceptance or corrections.

Update: Agent A triad-reviewed Agent B's operating-guide patch using the delegated handoff, Peer B's completed visible turn, and the durable ExecPlan plus guide. The prompt packet, skill specification, and dry-run scenario baseline is accepted. The next active milestone is productized support requirements detail.

Update: Agent A patched the operating guide with productized support requirements and non-goals. The next active milestone is dry-run validation, which should test both the prompt packet and the no-use collapse path.

Update: Agent B triad-reviewed Agent A's productized-support patch and kept it as future-state requirements rather than expanding it. Agent B patched the operating guide with a dry-run evidence record that turns the field test into a bounded artifact-backed validation step, then corrected the pass/fail rule so continued runs and no-use collapses are evaluated by different evidence. The remaining gate is Agent A triad review before executing or documenting the dry run.

Update: Agent A triad-reviewed Agent B's dry-run evidence structure. Peer B's latest thread turn still reported `inProgress`, but the delegated response and durable file contents matched the described patch, so Agent A accepted the file-backed contribution and recorded the active turn state as an inspection mismatch rather than completed-turn evidence. Agent A documented a collapse-path dry-run validation record. The remaining gate is Peer B's triad review of that record before final convergence.

Final update: Agent B triad-reviewed Agent A's documented dry-run record using the delegated handoff, Agent A's completed visible turn, and the durable ExecPlan plus guide. Agent B accepted the record as valid collapse-path validation and patched this ExecPlan to state the limitation clearly: the guide is complete for immediate use and collapse-path behavior, while the continued two-agent branch still needs future field testing on a larger real ExecPlan.

Update: Agent A extracted optional skill specifications from the operating guide into `docs/engineering/codex_thread_peer_skill_specs.md`. The guide now points to the skill-spec document while remaining the behavioral authority. The new document defines `thread-peer-execplan` and `thread-peer-prompt-pack` with authority rules, non-negotiable gates, triggers, non-use rules, governing bodies, failure conditions, a completeness checklist, and a review method. Peer B exact-artifact review is required before this milestone closes.

Post-convergence repair: The user observed that peers can prematurely advance the agenda by ending handoffs with the next challenge before both agents close the current step. Agent A framed the issue and requested Peer B critique. Agent B patched `tmp/thread_peer_execplan_workflow.md` with a mutual step-closure invariant and patched the operating guide's productized support, work cycle, recurring handoff packet, and drift packet so current-step closure is answered before candidate next focus.

Post-convergence repair closure: Agent A triad-reviewed Peer B's patch and accepted the closure-before-agenda rule. Agent A added two consistency corrections: productized drift prompts now include premature next-focus advancement, and the ExecPlan's rule summary includes mutual step closure.

Post-convergence repair: The user asked whether the protocol would make agents read and review each other's actual generated diffs during code-related ExecPlan work. Peer B identified that reciprocal critique was too implicit because an agent could still rely on a handoff summary. Agent A patched the base protocol and operating guide so code-related milestones require peer diff review before current-step closure, unless explicitly waived with rationale.

Post-convergence repair: The user identified a deeper review failure: even after reading the diff, a peer can stay trapped in the editing peer's local frame and miss wrong ownership, missing sibling paths, domain identity mistakes, or duplicated central infrastructure. Agent A and Peer B brainstormed a generic remedy and converged on the Architectural Distance Pass. Agent A patched the base protocol and operating guide so code-related closure requires challenged structural classification, evidence depth by risk, responsibility and placement judgment, propagation or parity judgment, validation-level judgment, and a closure impact.

Post-convergence repair: The user clarified that the peer who finds a code issue should not dictate the fix or apply its own preferred corrective patch without agreement. Agent A and Peer B agreed on correction-path agreement: when critique requires a code correction, peers first agree on the failed claim, correction path, corrective edit owner, correction reviewer, supporting evidence, and invalidated validation or Architectural Distance Pass claims. The peer who edits the correction becomes the editing peer for that correction, and the other peer reviews the correction diff before closure.

Protocol authentication audit: The user added two final authentication requirements: active/in-progress peer-thread reads after response arrival get one 10-second delayed recheck, and the protocol must be formatted for easy LLM consumption. Agent A and Peer B agreed to patch synchronization, the operating guide's Peer-Context Triad, productized completion-state support, prompt packets, optional skill governing bodies, and ExecPlan acceptance criteria. The operating guide now contains a canonical LLM Run Card near the top.

Protocol authentication closure: Peer B exact-patch reviewed the authentication changes and accepted closure after Agent A made the requested no-continuous-polling correction in the operating guide. The protocol is now authenticated for known failure modes and current operating surfaces. This stamp means the known user-observed failure modes have explicit gates in the protocol/operator path, both peers reviewed the current surfaces, and no unresolved material critique remains. It does not claim mathematical impossibility of future failure modes.

Skill-spec extraction: The user asked to move suggested skills out of the operating guide into a complete `docs/engineering` document while keeping the skills tied to the original protocol. Agent A created `docs/engineering/codex_thread_peer_skill_specs.md`, replaced the embedded skill specs in the operating guide with an authority pointer, and updated this ExecPlan. The extraction is not closed until Peer B exact-artifact review confirms the skill specs are complete enough to force the protocol or names a bounded correction.

Skill-spec completeness correction: Peer B found that user interruption handling was present as a packet family but missing from some non-negotiable and enforcement lists. Peer B also found that the operating-guide pointer's verification sentence omitted several core gates. Agent A accepted this critique as valid because future skill creation could otherwise treat those omitted gates as optional. Agent A patched the guide pointer and skill-spec document to include no-use check, initialization handshake, role symmetry, initiative reciprocity, named ownership, durable-state updates, user interruption handling, and review checks for newest-user-instruction priority.

Skill-spec extraction closure: Peer B triad-reviewed the bounded completeness correction and accepted closure. Agent A independently accepted the closure because the guide pointer and skill-spec document now include the omitted gates, and the partial Interfaces/Dependencies skill summary is clearly subordinate to the complete skill-spec document rather than a competing source of truth. No unresolved material critique remains for this milestone.

Artifact-correction independence repair: The user approved a generic rule that applies beyond code corrections. Agent A accepted the rule because it directly addresses the observed pattern where Agent A can become the artifact worker after Peer B suggests a correction. Agent A patched the base protocol, operating guide, and skill-spec document so substantive peer-requested corrections to ExecPlans, protocols, prompt packets, skill specs, design documents, and other shared artifacts require an accept/revise/reject rationale before editing. The narrow exception is only for purely mechanical, uncontested changes that do not affect meaning, authority, scope, validation, ownership, or future execution.

Stable peer-name repair: The user requested reliable names for both peer agents. Agent A accepted the change because stable names reduce ambiguity in handoffs and closure records. The base protocol, operating guide, and skill-spec document now define Harry Potter as Agent A and Hermione Granger as Agent B. The names are handles only and do not create roleplay instructions, fictional behavior, hierarchy, or changes to peer equality.

Artifact-correction independence closure: Peer B triad-reviewed the exact patch and accepted closure. Peer B agreed that the rule fixes the artifact-worker failure, that the mechanical exception is narrow enough, and that placement in the base protocol, operating guide, skill specs, and ExecPlan is sufficient. Peer B rejected adding a recurring handoff field because Work Cycle, Protocol Drift, and skill-spec enforcement already require the rationale when the rule triggers; Agent A independently accepts that as the lower-bloat choice.

## Context and Orientation

This repository uses `docs/protocols/PLAN.md` as the source of truth for ExecPlans. An ExecPlan is a living execution document that must remain self-contained. Another agent should be able to open only this file and safely continue the work.

The supporting peer workflow being productized is currently in `tmp/thread_peer_execplan_workflow.md`. It defines how two Codex threads should work as equal peers. A Codex thread is a conversation with tools and workspace access. A delegated peer response is a message sent from one thread to another through thread coordination tooling. A visible completed peer turn is the readable transcript exposed by `read_thread`, including user messages, assistant commentary, tool/file-change items, and final answers when available. Hidden private reasoning is not available and must not be treated as evidence.

The protocol's most important operational rules for this design are:

- Agent A is Harry Potter and Agent B is Hermione Granger; these are stable coordination handles only and do not imply roleplay, hierarchy, fictional behavior, or any change to peer equality;
- no agent owns the task frame by default;
- any governing artifact must be peer-shaped before it is authoritative;
- every substantive peer turn must include critique plus contribution;
- use reply arrival as the synchronization event, do not continuously poll active peer threads, and if a peer response has arrived but `read_thread` reports active/in-progress, wait 10 seconds and recheck once before treating it as an inspection mismatch;
- before accepting peer claims or document changes, inspect the received message, the peer's visible completed turn when available, and durable artifact state;
- read the LLM Run Card in `docs/protocols/codex_thread_peer_execution_protocol.md` before each peer cycle;
- do not split atomic work just to look symmetrical;
- shared peer duties still need named owners;
- code-related milestones require peer inspection of the relevant generated diff and peer-owned changed files before current-step closure, unless explicitly waived with rationale;
- code-related closure also requires an Architectural Distance Pass: the reviewing peer challenges the editing peer's structural classification, inspects evidence beyond the diff when risk requires it, and records responsibility or placement, propagation or parity, validation level, and closure impact;
- code-related corrections require correction-path agreement before new edits unless the fix is purely mechanical, uncontested, already inside the current edit owner's declared surface, and changes no behavior, ownership boundary, validation target, or architectural claim;
- current-step closure must be accepted or rejected before discussing a candidate next focus;
- final handoff must name changed files, validation, residual risk, and commit or handoff boundaries.

The design we are creating should be generic enough for implementing an existing ExecPlan, creating a new ExecPlan, drafting a design document, writing prompt packets, or brainstorming an architecture. The user emphasized the manager-like framing: two engineers receive the same task and must work together equally to shape and complete it.

## Plan of Work

First, the peers must converge the task frame and this provisional ExecPlan. Agent A has drafted this file from the peer-shaped handshake. Agent B must critique the plan as a peer, focusing on whether the plan is too document-heavy, whether the artifact architecture is right, whether no-use criteria are explicit, whether prompt surfaces are concrete enough, and whether validation is observable.

Second, create the final operating guide at `docs/protocols/codex_thread_peer_execution_protocol.md`. The peers chose `docs/protocols/` because the output is a reusable operating protocol rather than a one-off engineering analysis. The guide should contain the immediate workflow layer, productized support layer, no-use criteria, exact prompt packets, recurring handoff templates, correction and convergence packets, and field-test instructions.

Third, define exact prompt surfaces. At minimum, the final guide must include:

- user-to-Agent-A kickoff prompt;
- Agent-A-to-Agent-B initialization packet;
- Agent-B response contract;
- recurring peer handoff packet;
- protocol drift correction packet;
- user interruption packet;
- convergence and final handoff packet.

Fourth, define conservative optional skill specifications without creating actual skill files in this pass unless the peers explicitly decide to promote skill creation into scope. The minimum proposed skill specs are `thread-peer-execplan` and `thread-peer-prompt-pack`. Each specification must include the skill name, trigger, description, concise governing instructions, explicit non-use criteria, failure conditions, and a completeness checklist. These specs now live in `docs/engineering/codex_thread_peer_skill_specs.md`, while the operating guide links to that file and remains the behavioral authority.

Fifth, define validation and run a small field test or documented dry run. Since this is a design artifact, observable validation means a user can take the copyable prompts and run a small peer workflow that creates a shared ExecPlan and final handoff while avoiding the observed failures. If running a full second live thread test would create too much overhead, the dry run must still use the exact prompts against a concrete small scenario and record timestamped or artifact-backed evidence, including which observed failures the workflow prevented.

After Agent B fills the prompt and skill sections, Agent A must inspect the guide and decide whether the prompt packet is concrete enough to run. If accepted, the next milestone is productized support detail and then the dry-run validation.

## Concrete Steps

Work from `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`.

Read the governing documents:

    sed -n '1,260p' docs/protocols/PLAN.md
    sed -n '1,260p' tmp/thread_peer_execplan_workflow.md

Create or update this ExecPlan:

    docs/execplans/codex_thread_peer_protocol_implementation.md

Create the final operating guide after Agent A accepts the peer-critiqued ExecPlan as authoritative:

    docs/protocols/codex_thread_peer_execution_protocol.md

After the guide skeleton exists, send it to Agent B for reciprocal critique and contribution. Agent B's expected slice is to challenge the skeleton's operational usefulness and draft or patch the prompt packet and optional skill specification sections.

Use thread coordination for peer turns:

    Agent A sends handoffs to thread 019eacfd-1098-79e2-bf7a-a1f3d93e0421.
    Agent A reads the peer turn with read_thread only after a peer response arrives.

This ExecPlan is now authoritative for the next milestone. Continue to update `Progress`, `Decision Log`, `Surprises & Discoveries`, and `Outcomes & Retrospective` before crossing milestone boundaries.

## Validation and Acceptance

Acceptance for this design requires observable artifacts and a small field-test plan:

1. This ExecPlan exists, is self-contained, and records peer decisions as they happen.
2. The final operating guide exists at the agreed path and contains exact copyable prompts for user kickoff, Agent A initialization, Agent B response, recurring handoff, correction, interruption, convergence, and final handoff.
3. The guide includes no-second-agent criteria: do not use the peer protocol when the task is tiny, fully mechanical, already covered by decisive validation, lacks an available peer thread, or coordination overhead would exceed implementation risk.
4. The guide separates immediate workflow support from productized support. Immediate support uses existing Codex thread tools, shared files, and optional local skills. Productized support is labeled future-state.
5. Optional skill specifications live in `docs/engineering/codex_thread_peer_skill_specs.md` and include exact names, descriptions, triggers, concise rule bodies, non-use criteria, failure conditions, and a completeness checklist tied back to the operating guide and live protocol.
6. The final guide explains how to enforce peer-context triad with the one-time 10-second active/in-progress recheck, no continuous polling, shared task framing, critique-plus-contribution, initiative reciprocity, role symmetry, durable-state updates, user interruptions, protocol drift recovery, peer diff review, Architectural Distance Pass, correction-path agreement, validation substitutions, current-step closure, and final handoff.
7. The final guide contains an LLM Run Card near the top that names the non-negotiable gates: no-use check, initialization, triad with 10-second recheck, critique-plus-contribution, code diff review, Architectural Distance Pass, correction-path agreement, durable state, current-step closure, and final handoff.
8. Field-test or dry-run evidence shows the workflow can prevent observed failures, such as unilateral task framing, message-only trust, agenda-setter/artifact-worker asymmetry, artificial work splitting, unowned shared duties, reviewer-as-boss correction assignment, local-diff tunnel vision, and stale active-thread triad reads. A continued two-agent field test should show at least three peer-caused improvements and include the exact prompts used. A collapse-path dry run may pass by showing that no-use criteria were evaluated before unnecessary artifact creation, both peers had enough context to challenge the collapse, and the final handoff records why one agent is sufficient.
9. The protocol can be stamped `authenticated for known failure modes and current operating surfaces` only after both peers confirm that the 10-second recheck rule is present in synchronization, the operating guide, productized support, prompt packets, and skill specs; the LLM Run Card contains all non-negotiable gates; the dedicated skill-spec document is complete enough to force those gates in future local skills; this ExecPlan records current gates; no unresolved material peer critique remains; and any remaining limitation is recorded as future validation rather than hidden risk.

Dry-run evidence record:

    Scenario:
    Two agents are asked to create a small documentation-only note at docs/engineering/example_peer_run_note.md explaining when not to use the peer workflow. Expected outcome: collapse before creating the note or a new ExecPlan if no-use criteria show the peer workflow would be ceremony.

    Prompt evidence:
    - Kickoff prompt used: docs/protocols/codex_thread_peer_execution_protocol.md, User-to-Agent-A Kickoff packet, instantiated by this validation scenario in this ExecPlan.
    - Initialization packet used: not sent as a fresh packet for this tiny scenario because this is a documented collapse-path validation inside an already-active peer workflow, not a fresh prompt-packet field test.
    - Final handoff packet used, if any: this ExecPlan record plus the outgoing Peer A to Peer B handoff requesting triad review of the collapse validation.

    Decision point:
    - No-use criteria outcome: collapse.
    - Rationale: the proposed note is tiny, documentation-only, and already substantively covered by the operating guide's no-use criteria; creating another note or ExecPlan would add coordination overhead without improving risk coverage.
    - Authoritative artifact created: no new dry-run artifact; validation is recorded in this ExecPlan.

    Triad evidence:
    - Received peer message inspected: yes; user-delivered Peer B dry-run validation contribution from source thread 019eacfd-1098-79e2-bf7a-a1f3d93e0421.
    - Completed peer turn inspected: inspection mismatch; read_thread showed Peer B turn 019ead70-29c6-74b0-af5d-33c7c93427ec as inProgress, so Agent A did not treat it as completed-turn convergence evidence.
    - Durable artifact inspected: yes; docs/protocols/codex_thread_peer_execution_protocol.md and this ExecPlan contain the dry-run evidence record patch and pass/fail rule described by Peer B.

    Peer contribution evidence:
    - Agent A critique plus contribution: Agent A critiqued the productized support section as too broad, then added concrete productized requirements and non-goals.
    - Agent B critique plus contribution: Agent B accepted those future-state requirements, critiqued the missing validation evidence structure, then patched a compact dry-run evidence record and distinct pass criteria.
    - If one side did not contribute, correction or collapse rationale: not applicable; both peers contributed substantive artifact changes before this collapse dry run.

    Failure probes:
    - Unilateral task framing prevented by: Agent A did not create the initial ExecPlan until Agent B shaped the artifact architecture; the dry-run scenario was also shaped by Agent B before Agent A recorded validation.
    - Message-only trust prevented by: Agent A accepted Peer B's dry-run patch only where the durable guide and ExecPlan confirmed it; the inProgress peer-thread state is recorded as an inspection mismatch.
    - Agenda-setter/artifact-worker asymmetry prevented by: Agent A and Agent B both critiqued and patched durable artifacts in adjacent cycles; Agent A contributed productized requirements, and Agent B contributed validation structure.
    - Artificial split work prevented by: the dry run collapses before creating docs/engineering/example_peer_run_note.md, because splitting or co-authoring a tiny note would be ceremony.
    - Unowned shared duties prevented by: Agent B owned the evidence-template patch; Agent A owned the collapse validation record; Peer B is now assigned triad review before convergence.

    Validation result:
    - Pass/fail: pass for collapse-path validation; not a pass for the continued two-agent implementation branch.
    - Why: the protocol identified a low-risk documentation-only task, evaluated no-use criteria before creating unnecessary artifacts, preserved triad and durable-state evidence, and still required peer review before final convergence.
    - Follow-up required before using the workflow broadly: run the continued two-agent branch on a larger real ExecPlan when the next suitable task appears.

## Idempotence and Recovery

All planned edits are documentation edits and can be repeated safely. If Agent B is unavailable, the protocol says to collapse to single-agent mode only after recording why the peer path cannot proceed. If Agent B's response lacks enough triad evidence, request a corrected handoff instead of accepting convergence.

If the final operating guide becomes too long, keep the main guide concise. Prompt packets remain in the guide because they are part of the immediate operator workflow. Optional skill specs now live in `docs/engineering/codex_thread_peer_skill_specs.md`; if the guide or skill-spec document changes later, update both links and record the authority relationship in this ExecPlan.

If the field test reveals that a prompt or rule creates ceremony, revise the guide and record the change in `Decision Log`.

## Artifacts and Notes

Agent B's peer-shaped frame contributed the following provisional decisions:

    Artifact architecture:
    - Live ExecPlan: docs/execplans/codex_thread_peer_protocol_implementation.md
    - Final operating guide: docs/protocols/codex_thread_peer_execution_protocol.md
    - Appendix/spec pack inside the final guide unless length forces a companion document

    Conservative skill specifications:
    - thread-peer-execplan
    - thread-peer-prompt-pack

    Initial prompt surfaces:
    - User to Agent A kickoff
    - Agent A to Agent B initialization packet
    - Recurring peer handoff packet

    Initial ownership after peer agreement:
    - Agent A drafts the live ExecPlan skeleton and first Progress/Decision entries
    - Agent B drafts the final operating-guide outline and exact prompt/skill appendix skeleton
    - Both agents critique the other's artifact before either becomes authoritative

Agent B's operating-guide patch contributed:

    Prompt packets:
    - User-to-Agent-A kickoff prompt
    - Agent-A-to-Agent-B initialization packet
    - Agent-B response contract
    - Recurring peer handoff packet
    - Protocol drift correction packet
    - User interruption packet
    - Convergence and final handoff packet

    Optional skill specifications:
    - thread-peer-execplan
    - thread-peer-prompt-pack

    Field-test scenario:
    - Documentation-only no-use/dry-run scenario for a short note explaining when not to use the peer workflow

Agent A's productized-support patch contributed:

    Productized support requirements:
    - Peer pair registry
    - Peer launch/connect flow
    - Typed handoff packets
    - Triad checklist
    - Completion-state guard
    - Artifact authority state
    - Ownership and boundary view
    - Drift detection prompts
    - User interruption propagation
    - Validation ledger
    - Collapse path
    - Final handoff view

    Productized support non-goals:
    - No hidden reasoning exposure
    - No artificial file splitting
    - No supervisor/subordinate mode
    - No message-only claim acceptance
    - No hiding user-owned dirty state

Agent B's dry-run validation patch contributed:

    Dry-run evidence record fields:
    - Scenario
    - Prompt evidence
    - Decision point
    - Triad evidence
    - Peer contribution evidence
    - Failure probes
    - Validation result

    Failure probes:
    - Unilateral task framing
    - Message-only trust
    - Agenda-setter/artifact-worker asymmetry
    - Artificial split work
    - Unowned shared duties

Documented dry-run result:

    Outcome:
    - Collapse before creating docs/engineering/example_peer_run_note.md or a separate dry-run ExecPlan

    Reason:
    - The task is too small and documentation-only; the peer workflow's value is proven here by refusing ceremony rather than forcing a two-agent edit

    Remaining gate:
    - None for the operating guide's immediate workflow and collapse path; continued two-agent execution remains future validation on a larger real ExecPlan

Post-convergence repair artifact changes:

    Protocol:
    - Added mutual step closure invariant
    - Added milestone-cycle warning against advancing next tasks before closure
    - Added premature next-focus advancement to protocol drift

    Operating guide:
    - Added agenda and closure guard to productized support requirements
    - Added current-step closure rule to Work Cycle
    - Added current-step closure claim and candidate next focus fields to Recurring Peer Handoff Packet
    - Added premature next-focus advancement to Protocol Drift Correction Packet
    - Added closure-before-agenda language to optional skill governing bodies

Post-convergence code-diff-review repair artifact changes:

    Protocol:
    - Added peer diff review to reciprocal critique for code-related milestones
    - Added peer diff review as convergence evidence for code-related implementation and validation claims

    Operating guide:
    - Added productized diff review guard
    - Added code-work diff review requirement to Work Cycle
    - Added peer diff review field to Recurring Peer Handoff Packet
    - Added closure instruction blocking code-step closure until peer diff review is complete or waived
    - Added peer diff review language to optional skill governing bodies

Post-convergence Architectural Distance Pass repair artifact changes:

    Protocol:
    - Added provisional structural classification to joint approach check for code slices
    - Added Architectural Distance Pass requirements to reciprocal critique
    - Added convergence enforcement for classification rationale, evidence depth, and invalid leaf-local rationales

    Operating guide:
    - Added productized architectural distance guard
    - Added code-work Architectural Distance Pass requirement to Work Cycle
    - Added Architectural Distance Pass field to Recurring Peer Handoff Packet
    - Added closure instruction blocking code-step closure until peer diff review and Architectural Distance Pass are complete or structurally waived
    - Added Architectural Distance Pass language to optional skill governing bodies

Post-convergence correction-path agreement repair artifact changes:

    Protocol:
    - Added correction-path trigger to reciprocal critique when code critique rejects closure
    - Added full correction-path agreement rule to Parallelism and Conflict Control
    - Added convergence enforcement for correction path, correction owner, review owner, invalidated checks, and peer review of correction diff
    - Added unilateral assignment or corrective patch without correction-path agreement to Protocol Drift

    Operating guide:
    - Added correction-path agreement paragraph to Work Cycle
    - Added conditional correction path field to Recurring Peer Handoff Packet
    - Added closure instruction requiring correction-path agreement before new code edits when closure is rejected
    - Added correction-path drift wording and optional skill-spec language

Protocol authentication audit artifact changes:

    Protocol:
    - Added pointer to the operating guide LLM Run Card
    - Replaced immediate active/in-progress mismatch handling with one 10-second delayed recheck after response arrival

    Operating guide:
    - Added canonical LLM Run Card after Purpose
    - Added one-time 10-second delayed recheck to Peer-Context Triad
    - Added one-time delayed recheck to productized Completion-state guard
    - Added recheck language to copyable prompt packets and optional skill governing bodies

    ExecPlan:
    - Added authentication progress, decisions, context, validation, artifact notes, and revision records

Protocol authentication audit result:

    Stamp:
    - Authenticated for known failure modes and current operating surfaces

    Evidence:
    - Base protocol includes the one-time 10-second active/in-progress recheck and no-continuous-polling stop condition
    - Operating guide includes the LLM Run Card, Peer-Context Triad recheck, prompt-packet recheck language, productized completion-state guard, and optional skill-spec language
    - ExecPlan Validation and Acceptance names current gates and authentication criteria
    - Peer B exact-patch reviewed the authentication changes and accepted closure after the no-continuous-polling wording correction

    Remaining limitation:
    - Continued two-agent execution on a larger real ExecPlan remains useful future validation, but no unresolved material critique blocks the current protocol artifact

Skill-spec extraction artifact changes:

    Operating guide:
    - Replaced embedded optional skill specifications with a concise pointer to docs/engineering/codex_thread_peer_skill_specs.md
    - Preserved the operating guide and tmp/thread_peer_execplan_workflow.md as behavioral authorities over any future skill text
    - Required future skill creation to verify LLM Run Card, no-use check, initialization handshake, triad, no-continuous-polling recheck, critique-plus-contribution, role symmetry, initiative reciprocity, named ownership, peer diff review, Architectural Distance Pass, correction-path agreement, current-step closure, durable-state updates, user interruption handling, drift recovery, and final handoff gates

    Engineering document:
    - Added docs/engineering/codex_thread_peer_skill_specs.md
    - Defined thread-peer-execplan and thread-peer-prompt-pack
    - Added authority rules, non-negotiable gates, trigger and non-use rules, concise governing bodies, required outputs or prompt families, failure conditions, completeness checklist, and review method
    - Added Peer B's completeness correction so user interruption handling and newest-user-instruction priority are enforced in gates, governing bodies, required outputs, failure conditions, checklist, and review method

Artifact-correction independence repair changes:

    Base protocol:
    - Added Artifact correction independence under Parallelism and Conflict Control
    - Added applying a substantive peer-requested artifact correction without an accept/revise/reject rationale to Protocol Drift

    Operating guide:
    - Added the same accept/revise/reject rationale rule to Work Cycle
    - Added the same failure mode to Protocol Drift Correction Packet

    Skill-spec document:
    - Added accept/revise/reject rationale before substantive peer-requested artifact corrections to Non-Negotiable Gates
    - Added the rule to thread-peer-execplan and thread-peer-prompt-pack governing bodies
    - Added failure and completeness checks so future generated skills preserve the rule

Stable peer-name repair changes:

    Base protocol:
    - Added canonical peer names after Purpose: Harry Potter is Agent A and Hermione Granger is Agent B

    Operating guide:
    - Added Canonical Peer Names section
    - Updated kickoff and initialization prompt packets to introduce Harry Potter (Agent A) and Hermione Granger (Agent B)

    Skill-spec document:
    - Added canonical peer names to generated-skill authority text
    - Updated trigger, output, failure, and prompt requirements to preserve the names when introducing peers or naming ownership

## Interfaces and Dependencies

Existing Codex capabilities available for immediate workflow design:

- `codex_app.send_message_to_thread` sends a follow-up prompt to Agent B's thread.
- `codex_app.read_thread` reads visible thread state after a peer response arrives.
- Shared repository files provide durable state.
- `docs/protocols/PLAN.md` governs ExecPlan creation.
- `tmp/thread_peer_execplan_workflow.md` provides supporting peer workflow semantics.

Future productized support may include thread-pair metadata, protocol-aware handoff UI, automatic triad reminders, completion-state checks, and built-in peer workflow templates. These are future-state requirements and must not be described as available today.

Potential local skills, specified but not created in this first pass unless promoted:

The complete optional skill specifications live in `docs/engineering/codex_thread_peer_skill_specs.md`.

- `thread-peer-execplan`: Trigger when a user asks two Codex threads or agents to jointly execute an ExecPlan or design a protocol-backed plan. It must load the operating guide, enforce the LLM Run Card, initialization handshake, peer-context triad, no-continuous-polling recheck, role symmetry, critique-plus-contribution, current-step closure, correction-path agreement, and final handoff gate.
- `thread-peer-prompt-pack`: Trigger when a user asks for copyable prompts to start or continue a peer-agent flow. It must emit prompt packets that preserve durable artifact paths, triad evidence, contribution expectations, peer diff review and Architectural Distance Pass for code changes, correction-path agreement, current-step closure, unresolved risks, and final convergence claims.

## Revision Notes

2026-06-09 Europe/Istanbul / Agent A: Created provisional ExecPlan after peer-shaped initialization handshake. This plan is not authoritative until Agent B critiques it and accepted changes are recorded.

2026-06-09 Europe/Istanbul / Agent B: Critiqued the provisional ExecPlan and patched bounded corrections. The remaining gate is Agent A's triad review and acceptance before the final operating guide is drafted.

2026-06-09 Europe/Istanbul / Agent A: Applied triad review to Agent B's patches and accepted the ExecPlan as authoritative. Next milestone is the final operating guide skeleton.

2026-06-09 Europe/Istanbul / Agent A: Created the final operating guide skeleton. It is not converged until Agent B critiques it and adds or revises the prompt/skill appendix content.

2026-06-09 Europe/Istanbul / Agent B: Patched the operating guide with exact prompt packets, optional skill specifications, and a concrete dry-run scenario. Next gate is Agent A triad review and acceptance or correction.

2026-06-09 Europe/Istanbul / Agent A: Triad-reviewed Agent B's guide patch, accepted the prompt and skill baseline, added concrete productized support requirements and non-goals, and tightened the dry-run scenario to allow correct collapse before ExecPlan creation when the task is too small.

2026-06-09 Europe/Istanbul / Agent B: Triad-reviewed Agent A's productized-support patch, accepted it as concrete enough for future-state requirements, patched the operating guide with a compact dry-run evidence record, and corrected the validation rule so continued peer runs and no-use collapses have distinct pass criteria. Next gate is Agent A triad review, then executing or documenting the dry run.

2026-06-09 Europe/Istanbul / Agent A: Triad-reviewed Agent B's dry-run evidence patch and documented a collapse-path dry-run validation record in this ExecPlan instead of creating a ceremonial sample note or dry-run ExecPlan.

2026-06-09 Europe/Istanbul / Agent B: Triad-reviewed Agent A's collapse-path validation record, clarified that this was not a fresh prompt-packet field test, and marked the operating guide converged for immediate workflow use with continued-branch validation deferred to a future larger ExecPlan.

2026-06-09 Europe/Istanbul / Agent B: Applied narrow protocol repair for premature next-focus agenda setting after Agent A surfaced the user observation. The repair requires mutual current-step closure before discussing candidate next focus.

2026-06-09 Europe/Istanbul / Agent A: Triad-reviewed Peer B's convergence patch, accepted the final validation boundary, and cleaned up stale outcome and revision-note wording so the ExecPlan reflects completion.

2026-06-09 Europe/Istanbul / Agent B: Triad-reviewed Agent A's closure response and consistency corrections for the premature next-focus repair. Agent B accepted current-step closure with no unresolved critique and no candidate next focus.

2026-06-09 Europe/Istanbul / Agent A: Triad-reviewed Peer B's code-diff-review repair handoff and accepted the current-step claim as incomplete. Agent A patched the protocol, operating guide, and ExecPlan so code-related milestones require peer review of actual generated diffs before current-step closure unless explicitly waived with rationale.

2026-06-09 Europe/Istanbul / Agent B: Triad-reviewed Agent A's code-diff-review repair patch and accepted current-step closure. The artifacts now make peer review of actual generated diffs mandatory for code-related ExecPlan closure unless explicitly waived with rationale; no unresolved critique or candidate next focus remains.

2026-06-09 Europe/Istanbul / Agent A: Applied the peer-approved Architectural Distance Pass integration plan after the user requested protocol and ExecPlan updates. The patch keeps the repair inside existing approach-check, reciprocal-critique, convergence, handoff, productized-support, and skill-spec surfaces so code review must challenge structural classification without adding a standalone protocol layer.

2026-06-09 Europe/Istanbul / Agent A: Applied Peer B's exact-patch review correction clarifying Architectural Distance Pass timing: the first classification challenge happens during joint approach before code changes continue, then post-diff critique revisits classification before closure.

2026-06-09 Europe/Istanbul / Agent A: Applied the peer-confirmed correction-path agreement repair after the user approved making the change. The patch prevents reviewer-as-boss drift by requiring peers to agree on failed claim, correction path, edit owner, review owner, and invalidated checks before corrective code edits, with a narrow exception only for fixes that are purely mechanical, uncontested, already inside the current edit owner's declared surface, and change no behavior, ownership boundary, validation target, or architectural claim.

2026-06-09 Europe/Istanbul / Agent A: Applied Peer B's exact-patch review correction tightening the mechanical exception so it cannot hide behavior, ownership-boundary, validation-target, or architectural-claim changes.

2026-06-10 Europe/Istanbul / Agent A: Started the protocol authentication audit using the current peer protocol. Agent A read the base protocol, operating guide, and ExecPlan, sent Peer B an audit initialization packet, and applied the user's one-time 10-second recheck rule when Peer B's visible turn initially reported active/in-progress after the delegated response arrived.

2026-06-10 Europe/Istanbul / Agent A: Applied Peer B's authentication audit patch plan. The protocol now allows one 10-second delayed recheck after response-arrival active/in-progress reads, the operating guide has a canonical LLM Run Card, prompt packets carry the recheck language, and acceptance criteria define authentication for known failure modes and current operating surfaces.

2026-06-10 Europe/Istanbul / Agent A: Applied Peer B's exact-patch review correction making the operating-guide triad paragraph explicitly say not to continue polling after a failed one-time recheck. The LLM Run Card now also says to stop polling and use durable evidence or a corrected handoff if the recheck is still not complete.

2026-06-10 Europe/Istanbul / Agent A: Triad-checked Peer B's closure response for the authentication patch. Peer B accepted current-step closure with no unresolved material critique and no candidate next focus. Agent A recorded the final stamp: authenticated for known failure modes and current operating surfaces.

2026-06-10 Europe/Istanbul / Agent A: Extracted optional skill specifications from the operating guide into docs/engineering/codex_thread_peer_skill_specs.md to reduce guide bloat while preserving complete skill definitions. The guide now links to the skill-spec document, and the ExecPlan records the authority relationship and pending Peer B review gate.

2026-06-10 Europe/Istanbul / Agent A: Applied Peer B's exact-artifact review correction for skill-spec completeness. The operating-guide pointer and skill-spec document now explicitly enforce user interruption handling, durable-state updates, and omitted core gates so future local skills cannot silently weaken the protocol.

2026-06-10 Europe/Istanbul / Agent A: Triad-checked Peer B's closure response for the skill-spec extraction milestone. Peer B accepted current-step closure with no unresolved material critique and no candidate next focus. Agent A recorded milestone closure after independently accepting that the abbreviated Interfaces/Dependencies skill summary is non-authoritative and does not need another correction cycle.

2026-06-10 Europe/Istanbul / Agent A: Applied the user-approved artifact-correction independence repair. Substantive peer-requested artifact corrections now require the receiving peer to accept, revise, or reject the correction with rationale before editing, and applying such corrections without rationale is protocol drift unless the change is purely mechanical, uncontested, and cannot affect meaning, authority, scope, validation, ownership, or future execution.

2026-06-10 Europe/Istanbul / Agent A: Triad-checked Peer B's closure response for the artifact-correction independence repair. Peer B accepted current-step closure and no candidate next focus. Agent A recorded closure and accepted Peer B's rejection of a recurring handoff field as the lower-bloat enforcement path.

2026-06-10 Europe/Istanbul / Agent A: Applied the stable peer-name repair. Harry Potter is now the canonical name for Agent A, and Hermione Granger is now the canonical name for Agent B across the base protocol, operating guide prompt introductions, skill-spec document, and ExecPlan current-state summary. The names are coordination handles only and do not imply roleplay or hierarchy.

2026-06-10 Europe/Istanbul / Agent A: Applied Hermione Granger's exact-artifact review correction for stable peer names. The recurring handoff packet now requires name-plus-role scope fields, and the skill-spec prompt requirements now require name-plus-role ownership scope so runtime handoffs do not drift back to anonymous ownership labels.

2026-06-10 Europe/Istanbul / Agent A: Triad-checked Hermione Granger's closure response for the stable peer-name repair. Hermione accepted current-step closure with no unresolved material critique and no candidate next focus.

2026-06-10 Europe/Istanbul / Agent A: Applied user-approved startup-flow correction for missing Hermione Granger thread ids. The operating guide and skill specs now say that when the user asks for peer work with Hermione Granger, Harry Potter should create or request the peer thread unless the environment requires explicit confirmation; if confirmation is needed, Harry asks one concise creation question.

2026-06-11 Europe/Istanbul / Agent A: Applied user-approved collaboration-shape repair. The operating guide now defaults peer work to Collaborative and Joint-first, limits Advisory to lightweight second-perspective answers, treats Independent-first as a tactic for explicit independent findings or blind-spot detection, adds a collaboration-shape claim to final handoff, and marks parallel independent findings plus merge as drift. The base protocol and skill specs carry the same compact enforcement without adding seven modes, four work-type modes, long loops, or recurring stage fields.

2026-06-11 Europe/Istanbul / Agent A: Applied Hermione Granger's exact-patch review correction for collaboration-shape convergence wording. Intentionally separate final outputs now require explicit user request for separate opinions/findings or an explicit Independent-first tactic, preventing the phrase from becoming a bypass around convergence.

2026-06-11 Europe/Istanbul / Agent A: Triad-checked Hermione Granger's closure response for the collaboration-shape repair. Hermione verified the tightened convergence wording and accepted current-step closure with no unresolved material critique and no candidate next focus.

2026-06-11 Europe/Istanbul / Agent A: Applied user-approved artifact-correction reciprocity refinement. For shared non-code artifacts, the receiving peer should usually patch bounded, clearly justified, safe corrections and request exact-diff review; if they do not patch, they must state the blocking reason. Code corrections remain governed by correction-path agreement.

2026-06-11 Europe/Istanbul / Agent A: Applied user-requested artifact rename. The main peer runtime document is now `docs/protocols/codex_thread_peer_execution_protocol.md`; the supporting tmp document is now `tmp/thread_peer_execplan_workflow.md`. References and current-facing authority wording were updated to use runtime protocol and supporting workflow terminology.

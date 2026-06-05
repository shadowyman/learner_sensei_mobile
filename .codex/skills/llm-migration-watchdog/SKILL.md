---
name: llm-migration-watchdog
description: Use for supervising a separate Codex worker thread during Recursive Sensei mobile LLM migrations or PR review remediation. The watchdog audits worker ExecPlan updates, actual git diffs, protocol gates, master-plan compliance, tests, and PR review handling, then issues granular worker packets through thread coordination instead of implementing feature code itself.
---

# LLM Migration Watchdog

Use this skill when supervising another Codex thread that is implementing a
Recursive Sensei mobile LLM migration or migration review fix.

Prime directive: the watchdog is the compliance controller, not the feature
implementer. It audits the worker thread, active ExecPlan, packet-owned
changes, master plan, migration protocol, and validation evidence. It then
issues the next small packet or correction packet.

The worker's ExecPlan is evidence to inspect, not proof. Accept a packet only
when the worker claim, ExecPlan, changed files for the packet, and protocol
gates agree.

## Protocol Authority

`docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md` is the watchdog's audit
source of truth. The gates in this skill are smoke checks and role mechanics;
they are not a substitute for the protocol.

For every worker packet, audit the packet against the protocol directly. A
packet cannot pass unless every protocol section is classified as:

- `PASS`: evidence exists in the ExecPlan and changed files or validation.
- `N/A`: not applicable to this backlog row or packet, with rationale.
- `BLOCKED`: blocked with the blocker recorded and next action identified.
- `FAIL`: correction packet required before feature progress continues.

## Preferred Architecture

Prefer two Codex threads over subagents for this workflow:

- Watchdog thread: supervises, audits, and sends packets.
- Worker thread: implements only the current packet and maintains the ExecPlan.

Use `read_thread` to inspect the worker and `send_message_to_thread` to issue
the next packet when those tools are available. Use subagents only for bounded
side investigations, not as the primary long-running worker.

## Required Reads

Before starting a watchdog run, refresh from durable sources:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `.codex/skills/llm-migration-compliance/SKILL.md`
4. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
5. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
6. `docs/llm_entry_exit_traces.md`
7. active ExecPlan
8. packet-owned changed files and relevant generated output
9. recent worker thread turns

After the run is active, do not mechanically re-read the full authority stack
for every packet. Re-read heavy protocol, master-plan, trace, and skill
documents when drift appears, after compaction, before major/final acceptance,
or when a packet depends on exact wording. Always read the active ExecPlan,
recent worker turn, and files directly relevant to the current packet.

Use templates:

- `docs/templates/llm_migration_watchdog_kickoff.md`
- `docs/templates/llm_migration_watchdog_packet.md`
- `docs/templates/llm_migration_watchdog_audit.md` for escalated or major-gate
  audits

## Operating Loop

1. Refresh from required reads.
2. Read the worker's latest claim and current ExecPlan.
3. Inspect packet-owned changed files and any relevant generated output.
4. Fill or update the protocol-section audit ledger from the protocol itself.
5. Compare against master-plan scope and protocol gates.
6. Mark the packet PASS, CORRECTION NEEDED, or BLOCKED.
7. Send exactly one next packet to the worker.
8. Repeat after the worker reports completion or a blocker.

Do not let the worker proceed from one subsystem to the next if a required
gate is stale, untested, or contradicted by the diff.

## Watchdog Audit Record

Keep a watchdog-owned compact audit log under `docs/mission_state/`. The worker
owns implementation state in the ExecPlan; the watchdog owns compliance
findings in the audit log.

After every worker turn, append one compact audit entry before sending the next
packet or correction. Include:

- watchdog audit ID
- packet ID
- worker turn ID
- decision: PASS, CORRECTION NEEDED, or BLOCKED
- inputs checked
- ExecPlan turn markers found or missing
- diff match result
- failing or blocking protocol sections
- failing or blocking final acceptance gates
- next packet or correction
- one short note

Use the full `docs/templates/llm_migration_watchdog_audit.md` only for major
gates, final acceptance, commit or push readiness, serious contradictions, or
when compact audit evidence is insufficient.

Do not edit the worker ExecPlan to fix worker omissions. Send a correction
packet when the ExecPlan lacks required live state, turn markers, decisions,
validation evidence, or protocol ledger entries.

## Packet Rules

Packets must be serial, small, and auditable. Prefer these packet types:

- discovery only
- ExecPlan gate repair only
- prompt custody only
- parser/normalizer custody only
- BFF schema and negative tests only
- Core capability only
- RN bridge/client only
- WebView routing only
- reload/retry/cache path only
- provider failure behavior only
- validation only
- PR inline remediation only

Each packet must specify allowed files/modules, required ExecPlan updates,
required tests, stop conditions, and worker return format. Use allowed work,
stop conditions, and the packet objective to keep scope tight instead of a
standing prohibition section in every packet.

Packets should not ask the worker to repeat standing boilerplate. The worker
return should summarize packet-owned changed files, validation, blockers, and
the recommended next packet.

## Worker Hygiene Cadence

Do not ask the worker to run git hygiene after every small edit. The worker
should keep the ExecPlan live as discoveries, decisions, failed commands, and
validation results occur, but diff hygiene belongs at the end of the packet
unless there is a suspected scope violation or command failure.

Packet validation should normally require `git diff --check` once after all
packet edits and ExecPlan updates are complete. If the worker edits files again
after that check, ask for one final rerun of the affected hygiene command
before return.

For doc-only correction packets, prefer `git diff --check` scoped to the edited
document. Avoid repeated whole-tree hygiene loops for small plan or audit-note
edits.

Only request `git diff --cached --name-status` in packets that authorize or
prepare staging, commit, push, or review handoff, or when there is concrete
reason to suspect staging occurred.

Packet-owned diff alignment is primarily the watchdog's audit responsibility.
Worker packets may ask the worker to summarize packet-owned changed files at
return, but the watchdog must independently compare the worker claim, ExecPlan,
and changed files after the turn completes.

## Autonomous Supervision

When running autonomously, continue the loop until the scoped feature is
implemented, blocked by a real hard stop, or the user interrupts. After sending
a packet, poll the worker until that packet turn is complete, then begin the
audit immediately.

Use dynamic polling intervals. Start with longer waits after sending a packet
or during bookkeeping and validation, and shorten to roughly 20-30 seconds
when source edits, architectural decisions, or mission-critical reasoning are
actively happening. Poll summaries should explain worker progress and the
watchdog audit lens, not just say that the worker is still running.

Maintain a temporary watchdog scratch note under `docs/mission_state/` when
there are packet-local audit reminders. Keep reminders short, investigate every
reminder during audit, clear packet-local reminders after the audit, and retain
only future-stage reminders that cannot yet be resolved.

If context compaction occurs, resume from the active ExecPlan, watchdog audit
log, scratch note, worker thread, and current files. Do not restart the
workflow from memory or worker summaries alone.

Do not stop an audit at the first issue. Finish the current audit topics, then
send one consolidated correction packet covering all findings. Passing worker
test reports may be accepted when code, diff, and ExecPlan evidence do not
contradict them; use watchdog time for deeper source, protocol, and
cross-function review instead of rerunning every passing test.

When polling a worker thread, request bounded recent output. Avoid repeatedly
pulling large overlapping tool logs unless the audit depends on exact
intermediate output. If mission-critical reasoning is happening, poll more
often with smaller output; if validation or bookkeeping is happening, poll less
often.

Classify worker changes by packet. If a worker made a user-directed edit before
the watchdog packet arrived, audit and report it separately instead of treating
it as part of the packet or as a packet violation.

For LLM migration ExecPlans, phase ledgers and protocol tables are live gates.
Initial gating rows must be filled before implementation begins when the
protocol requires that, and they must be updated as discovery, decisions,
validation, or failures occur. Do not accept a packet merely because the final
ledger row exists; verify that the contents match source, tests, and protocol.

## Boundary Contract Audit

For every final migration audit and every review-remediation packet that
touches a runtime boundary, perform a source-level boundary contract audit.
This is not satisfied by route existence, type names, or worker summaries.

Create or verify a compact table that follows each migrated capability across
all applicable boundaries:

| Boundary | Source field/behavior | Destination field/behavior | Required transformation | Evidence checked | Status |
|---|---|---|---|---|---|

Required boundaries when applicable:

- WebView UI/state -> React Native bridge
- React Native bridge -> BffClient
- BffClient -> BFF route/controller
- BFF controller/service -> Core capability request
- Core capability -> prompt/provider request
- provider response -> Core parser/normalizer
- Core/BFF response -> React Native/WebView UI state

The watchdog must verify field names, required/optional semantics, action or
mode discriminants, transcript/history fields, original user intent fields,
retry/cache keys, timeout budgets, rate limiting, provider failure behavior,
and structured error shapes. A final migration cannot pass if any field or
behavior is assumed rather than traced through source, tests, or explicit
user-approved deferral.

## Watchdog Audit Gates

Audit every packet against the full protocol first. Then use these summary
gates as a quick consistency scan:

- ExecPlan live-document compliance: `docs/protocols/PLAN.md` is followed,
  and the ExecPlan can restart the task without chat history.
- ExecPlan currency: discoveries, decisions, progress, validation, and blockers
  are current.
- Master-plan alignment: backlog row, scope, and status match the master doc.
- Diff scope: packet-owned changed files match the packet objective and
  allowed edit set.
- Capability matrix: regular/Socratic, intro/main, reload/retry/cache,
  desktop/mobile, bridge-present/missing, and provider success/failure are
  represented when applicable.
- Prompt custody: Core owns migrated prompt text; BFF has no prompt bodies;
  `src/` has no second migrated prompt body.
- Parser custody: pure parser/normalizer behavior is Core-owned or explicitly
  deferred.
- Trust boundary: BFF rejects prompt strings, arbitrary control fields,
  oversized rendered fields, oversized arrays, and aggregate payload excess.
- Runtime routing: mobile structured requests cannot call browser/provider
  paths and bridge-missing behavior fails closed.
- Boundary contract parity: every migrated field and behavior is traced across
  WebView, RN, BffClient, BFF, Core, provider, parser, and return path when
  applicable.
- State continuity: follow-up, retry, reload, duplicate/in-flight, and
  transcript/history flows preserve required context or have user-approved
  deferral.
- Operational parity: migrated provider-backed BFF routes match sibling route
  expectations for rate limiting, timeout budgets, config, validation, logging,
  and failure semantics.
- Sibling paths: worker findings are reflected in discoveries, matrices,
  invariant ledgers, tests, and diff.
- Tests: both required behavior and forbidden behavior are covered.
- Validation: commands match risk and results are recorded.

## Final Acceptance Model

A worker packet or final migration passes only when all of these are true:

1. `docs/protocols/PLAN.md` live-document behavior is satisfied.
2. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md` section ledger is
   complete.
3. ExecPlan claims match the actual git diff.
4. Master-plan scope matches the backlog row.
5. Required positive and negative tests exist.
6. Validation evidence is recorded.
7. Commit, push, staging, cleanup, or review handoff happened only when
   explicitly authorized.
8. Final boundary contract audit passes for all applicable runtime boundaries,
   state-continuity flows, and operational route-parity checks.

## Hard Stops

Stop feature progress and send a correction packet if:

- `docs/protocols/PLAN.md` live-document behavior is not being followed
- any protocol section is unclassified
- any applicable protocol section lacks ExecPlan, diff, or test evidence
- worker claims a discovery but it is absent from ExecPlan gates
- ExecPlan says a gate is green but the diff or tests do not prove it
- a sibling path is discovered but not added to the matrix and test gates
- mobile routing can still reach direct provider code
- BFF accepts prompt-shaped or prompt-controlling client input
- prompt SHA/parity is missing for moved prompt text
- parser behavior is duplicated after migration
- bridge-missing behavior is untested
- validation failure is summarized but not recorded with next action
- packet-owned file changes are hidden from the worker return or contradicted
  by the ExecPlan
- a boundary adapter renames, drops, or reshapes a prompt-rendered,
  prompt-control, transcript/history, retry/cache, or action-specific field
  without source-level evidence and tests
- a multi-turn, follow-up, reload, retry, duplicate/in-flight, or provider
  failure path is claimed migrated without state-continuity evidence
- a provider-backed BFF route lacks required sibling-route operational controls
  such as rate limiting, timeout alignment, validation, config, logging, or
  structured failure behavior

## Output Contract

Report audits as gate decisions, not general impressions. A good watchdog
message cites the exact protocol section, explains what evidence was checked,
states PASS / N/A / BLOCKED / FAIL, and gives the next packet the worker must
complete.

Do not add feature code in watchdog mode. Git commits, pushes, and PR replies
are allowed only when explicitly requested and only after the audit gates pass.

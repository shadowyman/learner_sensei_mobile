---
name: llm-migration-watchdog
description: Use for supervising a separate Codex worker thread during Recursive Sensei mobile LLM migrations or PR review remediation. The watchdog audits worker ExecPlan updates, actual git diffs, protocol gates, master-plan compliance, tests, and PR review handling, then issues granular worker packets through thread coordination instead of implementing feature code itself.
---

# LLM Migration Watchdog

Use this skill when supervising another Codex thread that is implementing a
Recursive Sensei mobile LLM migration or migration review fix.

Prime directive: the watchdog is the compliance controller, not the feature
implementer. It audits the worker thread, active ExecPlan, actual diff, master
plan, migration protocol, and validation evidence. It then issues the next
small packet or correction packet.

The worker's ExecPlan is evidence to inspect, not proof. Accept a packet only
when the worker claim, ExecPlan, actual diff, and protocol gates agree.

## Protocol Authority

`docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md` is the watchdog's audit
source of truth. The gates in this skill are smoke checks and role mechanics;
they are not a substitute for the protocol.

For every worker packet, audit the packet against the protocol directly. A
packet cannot pass unless every protocol section is classified as:

- `PASS`: evidence exists in the ExecPlan and actual diff or validation.
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

Before issuing or auditing a packet, refresh from durable sources:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `.codex/skills/llm-migration-compliance/SKILL.md`
4. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
5. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
6. `docs/llm_entry_exit_traces.md`
7. active ExecPlan
8. current `git status` and relevant `git diff`
9. recent worker thread turns

Use templates:

- `docs/templates/llm_migration_watchdog_kickoff.md`
- `docs/templates/llm_migration_watchdog_packet.md`
- `docs/templates/llm_migration_watchdog_audit.md` for escalated or major-gate
  audits

## Operating Loop

1. Refresh from required reads.
2. Read the worker's latest claim and current ExecPlan.
3. Inspect actual diff and staged state.
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

Each packet must specify allowed files/modules, forbidden work, required
ExecPlan updates, required tests, stop conditions, and worker return format.

## Worker Hygiene Cadence

Do not ask the worker to run git hygiene after every small edit. The worker
should keep the ExecPlan live as discoveries, decisions, failed commands, and
validation results occur, but diff hygiene belongs at the end of the packet
unless there is a suspected scope violation or staging problem.

Packet validation should normally require `git diff --check` and
`git diff --cached --name-status` once after all packet edits and ExecPlan
updates are complete. If the worker edits files again after those checks, ask
for one final rerun of the affected hygiene command before return.

For doc-only correction packets, prefer `git diff --check` scoped to the edited
document plus one staged-state check. Avoid repeated whole-tree hygiene loops
for small plan or audit-note edits.

Actual diff alignment is primarily the watchdog's audit responsibility. Worker
packets may ask the worker to summarize packet-owned changed files at return,
but the watchdog must independently compare the worker claim, ExecPlan, and
actual git diff after the turn completes.

## Watchdog Audit Gates

Audit every packet against the full protocol first. Then use these summary
gates as a quick consistency scan:

- ExecPlan live-document compliance: `docs/protocols/PLAN.md` is followed,
  and the ExecPlan can restart the task without chat history.
- ExecPlan currency: discoveries, decisions, progress, validation, and blockers
  are current.
- Master-plan alignment: backlog row, scope, and status match the master doc.
- Diff scope: changed files match the packet and no unrelated files are staged.
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
7. No unrelated files are staged.

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
- unrelated files are staged or hidden in the packet diff

## Output Contract

Report audits as gate decisions, not general impressions. A good watchdog
message cites the exact protocol section, explains what evidence was checked,
states PASS / N/A / BLOCKED / FAIL, and gives the next packet the worker must
complete.

Do not add feature code in watchdog mode. Git commits, pushes, and PR replies
are allowed only when explicitly requested and only after the audit gates pass.

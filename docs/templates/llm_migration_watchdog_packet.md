# LLM Migration Watchdog Packet

Use this template when the watchdog sends one serial packet to the worker
thread. The packet must be small enough that the watchdog can audit it against
the ExecPlan and actual diff.

## Packet Header

- Packet ID:
- Worker thread:
- Watchdog thread:
- Active ExecPlan:
- Backlog row:
- Mode: Full Migration / Review Remediation / Audit Only
- Packet status: NOT_STARTED

## Objective

One concrete outcome only:

## Applicable Protocol Sections For This Packet

The worker must classify each listed section as `PASS`, `N/A`, `BLOCKED`, or
`FAIL` in the ExecPlan before returning the packet.

| Protocol Section | Required Packet Outcome | Expected Evidence |
|---|---|---|
| Core Rule | | |
| Non-Negotiable Rules | | |
| Required Authority Stack | | |
| ExecPlan Compliance Block | | |
| Phase 0: Activation | | |
| Phase 1: Scope Lock | | |
| Phase 2: Capability x Mode x Lifecycle Matrix | | |
| Phase 3: Direct Provider Authority Sweep | | |
| Phase 4: Prompt Custody Ledger | | |
| Phase 5: Parser / Normalizer Custody Ledger | | |
| Phase 6: Boundary Invariant Ledger | | |
| Phase 7: Trust-Boundary Schema Plan | | |
| Phase 8: Runtime Routing Plan | | |
| Phase 9: Red-Test Gate | | |
| Phase 10: Implementation Order | | |
| Backlog-Specific Instructions | | |
| Test Gate Ledger | | |
| Review Remediation Mode | | |
| Final Migration Evidence Block | | |
| Stop Conditions | | |
| Output Contract | | |

## Required Refresh

Before doing work, the worker must read:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- active ExecPlan
- current `git status --short`
- files directly named in this packet

## Allowed Work

Files/modules the worker may inspect:

Files/modules the worker may edit:

## Forbidden Work

The worker must not:

- edit files outside the allowed edit set
- commit or push unless explicitly authorized
- mark gates green without tests or explicit evidence
- proceed to the next subsystem after this packet
- treat ExecPlan updates as proof without code/test evidence

## Required ExecPlan Updates

Before code changes, update these sections:

- Progress:
- Surprises & Discoveries:
- Decision Log:
- LLM Migration Compliance Block:
- Protocol Coverage Ledger:

After code or validation, update these sections:

- Progress:
- Boundary Invariant Ledger:
- Test Gate Ledger:
- Validation and Acceptance:
- Artifacts and Notes:
- Outcomes & Retrospective when applicable:

## Final Acceptance Model For This Packet

The worker must not call the packet complete unless all are true or explicitly
`N/A` with rationale:

| Acceptance Gate | Evidence |
|---|---|
| `docs/protocols/PLAN.md` live-document behavior is satisfied | |
| LLM migration protocol section ledger is complete | |
| ExecPlan claims match actual git diff | |
| Master-plan scope matches backlog row | |
| Required positive and negative tests exist | |
| Validation evidence is recorded | |
| No unrelated files are staged | |

## Required Implementation

Exact behavior to implement:

Required sibling paths to consider:

Required hard-stop checks:

## Required Tests

Tests to add or update:

Validation commands to run:

## Stop Conditions

Stop and report to watchdog if:

- a new sibling path is discovered
- prompt/parser ownership is unclear
- a required negative test cannot be written
- validation fails after one repair attempt
- the packet requires files outside the allowed edit set
- any hard stop in the watchdog or compliance skill applies

## Worker Return Format

Return exactly:

- Packet ID:
- Files changed:
- ExecPlan sections updated:
- Protocol sections PASS/N/A/BLOCKED/FAIL:
- Final acceptance gates PASS/N/A/BLOCKED/FAIL:
- Tests added/updated:
- Validation run and results:
- Discoveries/blockers:
- Diff summary:
- Recommended next packet:

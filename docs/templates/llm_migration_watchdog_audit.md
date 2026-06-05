# LLM Migration Watchdog Audit

Use this template after each worker packet. The watchdog must compare the
worker claim, active ExecPlan, actual diff, and protocol gates before sending
the next packet.

## Audit Header

- Audit ID:
- Worker thread:
- Packet ID:
- Active ExecPlan:
- Backlog row:
- Worker-reported status:
- Watchdog finding: PASS / CORRECTION NEEDED / BLOCKED

## Inputs Reviewed

- Worker thread turns:
- `docs/protocols/PLAN.md`:
- ExecPlan sections:
- `git status`:
- `git diff` files:
- Relevant protocol sections:
- Relevant master-plan row:
- Test output:

## Worker Claim

Summary of what the worker says it discovered or changed:

## Actual Diff

| File | In Packet Scope? | Claimed In ExecPlan? | Watchdog Notes |
|---|---|---|---|
| | | | |

Unrelated staged files:

Unrelated unstaged files affecting audit:

## ExecPlan Consistency

| Section | Current? | Evidence | Correction Needed |
|---|---|---|---|
| Progress | | | |
| Surprises & Discoveries | | | |
| Decision Log | | | |
| Capability Matrix | | | |
| Boundary Invariant Ledger | | | |
| Trust-Boundary Schema Plan | | | |
| Runtime Routing Plan | | | |
| Red-Test Gate | | | |
| Test Gate Ledger | | | |
| Validation and Acceptance | | | |
| Artifacts and Notes | | | |

## Protocol Verbatim Compliance Ledger

Every section of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md` must be
classified. The summarized gate table below cannot make a packet pass if this
ledger has any unclassified or failed applicable section.

Allowed statuses: `PASS`, `N/A`, `BLOCKED`, `FAIL`.

| Protocol Section | Applicable? | Worker Evidence | Diff Evidence | Test Evidence | Status | Notes |
|---|---|---|---|---|---|---|
| Core Rule | | | | | | |
| Non-Negotiable Rules | | | | | | |
| Required Authority Stack | | | | | | |
| ExecPlan Compliance Block | | | | | | |
| Phase 0: Activation | | | | | | |
| Phase 1: Scope Lock | | | | | | |
| Phase 2: Capability x Mode x Lifecycle Matrix | | | | | | |
| Phase 3: Direct Provider Authority Sweep | | | | | | |
| Phase 4: Prompt Custody Ledger | | | | | | |
| Phase 5: Parser / Normalizer Custody Ledger | | | | | | |
| Phase 6: Boundary Invariant Ledger | | | | | | |
| Phase 7: Trust-Boundary Schema Plan | | | | | | |
| Phase 8: Runtime Routing Plan | | | | | | |
| Phase 9: Red-Test Gate | | | | | | |
| Phase 10: Implementation Order | | | | | | |
| Backlog-Specific Instructions | | | | | | |
| Test Gate Ledger | | | | | | |
| Review Remediation Mode | | | | | | |
| Final Migration Evidence Block | | | | | | |
| Stop Conditions | | | | | | |
| Output Contract | | | | | | |

## Protocol Gate Audit

This is a secondary summary. It must agree with the Protocol Verbatim
Compliance Ledger.

| Gate | PASS / FAIL / N/A | Evidence |
|---|---|---|
| ExecPlan live-document compliance with `docs/protocols/PLAN.md` | | |
| Master-plan alignment | | |
| Prompt custody | | |
| Parser/normalizer custody | | |
| Mobile no direct provider | | |
| Mobile no final prompt strings | | |
| Bridge-missing fail closed | | |
| BFF provider ownership | | |
| BFF rejects prompt-shaped payloads | | |
| BFF validates prompt-control fields | | |
| BFF caps prompt-rendered fields | | |
| Sibling paths represented | | |
| Reload/retry/cache represented | | |
| Provider failure behavior | | |
| Positive tests | | |
| Negative tests | | |
| Validation recorded | | |
| Diff hygiene | | |

## Final Acceptance Model

The packet cannot pass unless every row is `PASS` or `N/A` with rationale.

| Acceptance Gate | PASS / FAIL / N/A | Evidence |
|---|---|---|
| `docs/protocols/PLAN.md` live-document behavior is satisfied | | |
| LLM migration protocol section ledger is complete | | |
| ExecPlan claims match actual git diff | | |
| Master-plan scope matches backlog row | | |
| Required positive and negative tests exist | | |
| Validation evidence is recorded | | |
| No unrelated files are staged | | |

## Watchdog Decision

Decision:

Reason:

Protocol sections failing or blocked:

Required correction, if any:

## Next Packet

Send this exact packet next:

```text

```

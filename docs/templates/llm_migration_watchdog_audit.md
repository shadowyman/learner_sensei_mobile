# LLM Migration Watchdog Audit

Use this template after each worker packet. The watchdog must compare the
worker claim, active ExecPlan, packet-owned changed files, and protocol gates
before sending the next packet.

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
- Packet-owned changed files:
- Relevant protocol sections:
- Relevant master-plan row:
- Test output:

## Worker Claim

Summary of what the worker says it discovered or changed:

## Packet-Owned Diff

| File | In Packet Scope? | Claimed In ExecPlan? | Watchdog Notes |
|---|---|---|---|
| | | | |

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

## Final Boundary Contract Audit

Required for final migration acceptance and for review-remediation packets that
touch a runtime boundary. The watchdog must fill this from source, tests, and
ExecPlan evidence rather than worker summaries.

| Boundary | Source field/behavior | Destination field/behavior | Evidence Checked | PASS / FAIL / N/A | Notes |
|---|---|---|---|---|---|
| WebView UI/state -> React Native bridge | | | | | |
| React Native bridge -> BffClient | | | | | |
| BffClient -> BFF route/controller | | | | | |
| BFF controller/service -> Core capability request | | | | | |
| Core capability -> prompt/provider request | | | | | |
| provider response -> Core parser/normalizer | | | | | |
| Core/BFF response -> React Native/WebView UI state | | | | | |
| Timeout budget parity | | | | | |
| BFF route operational parity | | | | | |
| State continuity paths | | | | | |

A final audit cannot pass while any applicable row is unfilled, failed, or
supported only by assertion.

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
| Boundary contract audit | | |
| State continuity across lifecycle paths | | |
| Timeout/rate-limit/config operational parity | | |
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
| ExecPlan claims match packet-owned changed files | | |
| Master-plan scope matches backlog row | | |
| Required positive and negative tests exist | | |
| Validation evidence is recorded | | |
| Commit, push, staging, cleanup, or review handoff happened only if explicitly authorized | | |
| Final boundary contract audit passes | | |

## Watchdog Decision

Decision:

Reason:

Protocol sections failing or blocked:

Required correction, if any:

## Next Packet

Send this exact packet next:

```text

```

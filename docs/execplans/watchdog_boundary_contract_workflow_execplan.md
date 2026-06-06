# Strengthen LLM migration watchdog boundary audits

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `docs/protocols/PLAN.md`.

## Purpose / Big Picture

This workflow update makes future LLM migration watchdog passes harder to accept on broad structural evidence alone. After this change, final migration audits and review-remediation packets must trace field names, lifecycle state, operational route controls, timeout budgets, and provider/error behavior across the actual WebView, React Native, BFF, Core, provider, parser, and return-path boundaries. A future watchdog or worker should be able to see the required audit table directly in the protocol and templates before declaring a backlog item complete.

## Progress

- [x] (2026-06-05T23:38:56Z) Read `docs/protocols/PLAN.md` and created this lightweight ExecPlan before editing workflow documents.
- [x] (2026-06-05T23:43:10Z) Patched the watchdog skill, compliance protocol, compliance block template, watchdog audit template, and watchdog packet template with the generic Boundary Contract Audit gate.
- [x] (2026-06-05T23:46:12Z) Validated the edited workflow files for wording consistency and whitespace.

## Surprises & Discoveries

- Observation: The watchdog skill already required protocol and source evidence, but it did not force a boundary-by-boundary final table that could expose dropped fields, mismatched timeout budgets, or missing route controls.
  Evidence: `.codex/skills/llm-migration-watchdog/SKILL.md` had summary gates for runtime routing and trust boundary, but no final boundary contract audit section.

## Decision Log

- Decision: Add a generic Boundary Contract Audit gate across both worker-facing and watchdog-facing documents instead of adding Selection Sensei-specific rules.
  Rationale: The user explicitly wants lessons that apply to future backlog items, and the failure mode was shallow final-audit execution rather than a capability-specific requirement.
  Date/Author: 2026-06-05T23:38:56Z / Codex

## Outcomes & Retrospective

The workflow documents now require a generic Boundary Contract Audit in both worker-side evidence and watchdog-side final audit paths. The new gate is present in the watchdog skill, the authoritative migration protocol, worker compliance block template, watchdog audit template, and watchdog packet template. Targeted validation passed.

## Context and Orientation

The workflow has two roles. The worker implements LLM migration packets and maintains the active migration ExecPlan. The watchdog audits the worker, the active ExecPlan, source diffs, protocol gates, master-plan scope, and validation evidence before sending the next packet. The relevant workflow documents are `.codex/skills/llm-migration-watchdog/SKILL.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/templates/llm_migration_compliance_block.md`, `docs/templates/llm_migration_watchdog_audit.md`, and `docs/templates/llm_migration_watchdog_packet.md`.

The new term "Boundary Contract Audit" means a source-level trace of every applicable migrated field or behavior from its producing boundary to its consuming boundary. It includes WebView state, React Native bridge payloads, BffClient request payloads, BFF controller/service requests, Core capability requests, provider prompts/responses, Core parser output, and UI return handling.

## Plan of Work

First, add a Boundary Contract Audit section to the watchdog skill and make final acceptance depend on it. Second, add the worker-side protocol requirement and final evidence wording to `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`. Third, update the compliance block template so new migration ExecPlans contain the table from the start. Fourth, update the watchdog audit template and packet template so watchdog packets and final audits request and verify the same evidence.

## Concrete Steps

Edit the five workflow files named above with additive wording. Run a targeted search for the new heading and run `git diff --check` after all edits.

## Validation and Acceptance

Validation passes when `rg "Boundary Contract Audit|boundary contract" .codex/skills/llm-migration-watchdog/SKILL.md docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md docs/templates/llm_migration_compliance_block.md docs/templates/llm_migration_watchdog_audit.md docs/templates/llm_migration_watchdog_packet.md` shows the gate in all intended files and `git diff --check` passes.

## Idempotence and Recovery

The edits are additive documentation changes. If a patch applies partially, inspect the affected document and reapply only the missing section. Do not remove historical audit logs or active migration evidence.

## Artifacts and Notes

Edited files:

- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/templates/llm_migration_compliance_block.md`
- `docs/templates/llm_migration_watchdog_audit.md`
- `docs/templates/llm_migration_watchdog_packet.md`

Validation evidence:

- `rg "Boundary Contract Audit|boundary contract|Boundary contract|state-continuity|operational parity|rate-limit/config" ...` confirmed the new gate appears across all intended workflow files.
- `git diff --check -- .codex/skills/llm-migration-watchdog/SKILL.md docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md docs/templates/llm_migration_compliance_block.md docs/templates/llm_migration_watchdog_audit.md docs/templates/llm_migration_watchdog_packet.md` passed with no output.
- `perl -ne 'print "$ARGV:$.:$_" if /[ \t]$/ || /\r/' docs/execplans/watchdog_boundary_contract_workflow_execplan.md` passed with no output.

## Interfaces and Dependencies

No runtime interfaces or dependencies change. This is a workflow documentation update only.

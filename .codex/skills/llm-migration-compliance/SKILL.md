---
name: llm-migration-compliance
description: Use for Recursive Sensei mobile LLM backlog migrations and PR review remediation that touches prompt ownership, provider routing, Core/BFF boundaries, React Native bridge transport, structured payload validation, or direct Gemini/provider surfaces. Enforces the Phase 1 master plan with compact gates and points to the detailed protocol/template only when needed.
---

# LLM Migration Compliance

Use this skill for Recursive Sensei Phase 1 mobile LLM backlog migrations and
PR review remediation.

Prime directive: mobile migrated runtime must not own prompt text or provider
execution. Core owns migrated prompts, parsers, normalizers, prompt-control
types, and provider-agnostic capability contracts. BFF owns provider execution,
secrets, validation, fallback policy, rate limits, telemetry, and mobile
HTTP/WebSocket routes. React Native owns transport. WebView owns UI, state,
DOM, placeholders, cache coordination when UI-owned, and rendering.

If this skill conflicts with
`docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, the master plan
wins and the active ExecPlan must be revised before implementation continues.

## Trigger

Use this skill when work touches any remaining master-plan LLM backlog row:

- Selection Sensei follow-up
- Selection Sensei toolbar action
- Enhancement request
- Key-takeaway enhancement internals
- Pedagogical directive generation
- Meta-prompt directive wrappers
- Sensei enhancement wrappers
- Legacy generic BFF turn stream retirement
- any direct provider path listed in `docs/llm_entry_exit_traces.md`

Also trigger on PR review remediation for migrated or partially migrated LLM
capabilities, or when a change touches direct-provider or prompt-shaped code.

Provider search terms:
`GoogleGenAI`, `new GoogleGenAI`, `Chat`, `chats.create`,
`sendMessageStream`, `sendMessage(`, `generateContent`,
`generateContentStream`, `CoreLlmClient`, `GeminiGateway`.

Prompt-shaped search terms:
`prompt`, `systemInstruction`, `instruction`, `template`, `directive`,
`metaPrompt`, `promptText`, `finalPrompt`, `curriculumFocusInstruction`,
`selectedTextPrompt`, `enhancementPrompt`, `keyTakeaway`.

## Mode Selection

Full Migration Mode applies to a new backlog migration. Read the detailed
protocol and insert the template block into the active ExecPlan before code
changes.

Review Remediation Mode applies to PR review fixes. Map each finding to an
invariant, sweep sibling paths and modes, add a regression test, patch all
affected siblings, validate, then reply inline with commit/test evidence after
the fix is pushed.

Audit-Only Mode applies to analysis or reporting. Do not edit files. Classify
risks against the gates and report which gates are missing, stale, or satisfied.

## Required Reads

For Full Migration Mode, read:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
4. `docs/llm_entry_exit_traces.md`
5. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
6. the active backlog-specific ExecPlan, or create one if absent
7. `docs/templates/llm_migration_compliance_block.md`

For Review Remediation Mode, read the review thread, the affected ExecPlan
gates, and the relevant sections of
`docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`.

## Hard Stops

Stop and record a blocker if any of these are true:

- the exact master-plan backlog row is unknown
- prompt SHA or old prompt owner cannot be established
- parser/normalizer ownership is unclear
- a migrated mobile structured request can still call browser provider code
- mobile bridge-missing behavior lacks a fail-closed sentinel
- BFF accepts prompt strings, prompt fragments, or arbitrary prompt-control
  values from mobile
- prompt-rendered fields lack per-field, array, and aggregate caps
- Core and `src/` retain duplicate migrated prompt bodies
- BFF contains prompt bodies
- review remediation has not swept sibling paths and modes
- the capability matrix has untested required rows
- the active ExecPlan compliance block is stale
- live provider smoke failure might be routing/application failure rather than
  provider or quota failure

## Full Migration Workflow

1. Fill Scope Lock.
2. Fill Capability x Mode x Lifecycle Matrix.
3. Run Direct Provider Authority Sweep.
4. Fill Prompt Custody and Parser/Normalizer ledgers.
5. Add red/golden parity tests before route work.
6. Move prompt and parser custody to Core by parity.
7. Add Core capability, BFF validation/route, RN bridge/client, and WebView
   routing.
8. Add positive and negative deterministic tests for required and forbidden
   behavior.
9. Add live provider smoke when applicable, or record provider/quota blocker.
10. Update traces/status only after review passes, or label evidence as
    PR-stage.

## Review Remediation Workflow

1. Fetch current review threads and ignore outdated findings already fixed by
   later commits.
2. Classify the finding under an invariant; add the invariant if missing.
3. Sweep sibling paths, modes, reload/retry/cache paths, and bridge-missing
   paths.
4. Add or strengthen a regression test that proves the old behavior fails.
5. Patch all affected siblings, not only the commented line.
6. Run targeted validation and any full validation required by risk.
7. Update the affected ExecPlan gates or evidence.
8. Commit and push only when instructed.
9. Reply inline with commit hash, files, tests, and sibling sweep; resolve only
   after the pushed fix exists.

## Required Output

Report gates, not just files. A useful status names the backlog row, old entry
point, Core owner, BFF route, bridge method, prompt SHA/length evidence,
forbidden-behavior tests, and remaining blockers.

Detailed protocol:
`docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`

Copyable ExecPlan block:
`docs/templates/llm_migration_compliance_block.md`

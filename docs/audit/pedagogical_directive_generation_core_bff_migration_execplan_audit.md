# Pedagogical Directive Generation ExecPlan Audit

Date: 2026-06-11

Audit target: `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`

Governing master plan: `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`

Peer run:

- Harry Potter (Agent A): `019eb689-299a-7213-9429-2d1cf10b487d`
- Hermione Granger (Agent B): `019eb689-dcd2-7332-980a-5bc4d16a9ff9`

## Scope

This was a read-only peer audit of whether the target ExecPlan can correctly migrate the Phase 1 pedagogical directive generation LLM capability into the Core/BFF/mobile architecture. The audit did not evaluate a code implementation because the target ExecPlan is still `NOT_STARTED`.

The audit standard was the Phase 1 master plan requirement that mobile migrated LLM runtime must not own prompt text or provider execution. The specific pedagogical directive scope is prompt construction, provider execution, directive normalization/fallback, Core capability ownership, BFF mobile route ownership, React Native bridge/BffClient transport, mobile WebView routing, desktop compatibility, parity tests, direct-provider sweeps, generated WebView bundle update, and trace/status update.

## Verdict

The ExecPlan is technically aligned with the mobile LLM migration master plan for the pedagogical directive generation backlog row. It covers the active source entry points, keeps WebView orchestration in `PedagogicalProfiler`, moves LLM-facing prompt/provider/normalizer work to Core/BFF, adds mobile routing through RN/BffClient, preserves desktop compatibility, closes the raw directive guidance backdoor through directive provenance, and defines broad validation.

One low-severity ExecPlan compliance issue remains: the plan omits the explicit `Mobile Routing Gate` milestone required by `docs/protocols/PLAN.md`.

## Issues

### A1 - Low - Missing Explicit Mobile Routing Gate Milestone

`docs/protocols/PLAN.md` makes an explicit `Mobile Routing Gate` milestone non-negotiable for any ExecPlan that migrates or introduces an LLM tool. The gate must appear in both `Progress` and `Plan of Work`, and must cover mobile WebView wiring to BFF, desktop-only SDK gating with `window.__SENSEI_MOBILE_BUILD__`, and a sentinel test that fails if mobile uses browser `CoreLlmClient`.

Evidence:

- `docs/protocols/PLAN.md:36-45` defines the non-negotiable ExecPlan requirements and specifically requires an explicit `Mobile Routing Gate` milestone in `Progress` and `Plan of Work`.
- `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:738-759` has `## Progress`, but no item named `Mobile Routing Gate`.
- `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:820-830` uses `## Implementation Plan`, not `## Plan of Work`, and no `Mobile Routing Gate` heading appears anywhere in the file.
- Current source still contains the mobile-sensitive boundaries that this gate is meant to highlight: `src/pedagogicalProfiler.ts:7-10` imports `GoogleGenAI` and `generateDirectiveFromMetaPrompt`; `src/pedagogicalProfiler.ts:246-277` renders the directive prompt and calls the wrapper; `src/geminiService.ts:170-188` calls `ai.models.generateContent` and owns fallback behavior; `src/index.tsx:411-436` returns early in native bridge mode when no browser API key exists; `bff/src/controllers/sessionController.js:151-177` and `bff/src/controllers/sessionController.js:191-203` currently accept raw standard and Socratic directive guidance fields.

Execution impact:

The plan already includes the mobile-routing substance: bridge routing, BffClient, RN handling, no-browser-key behavior, generated bundle checks, no mobile provider call sentinels, directive references, and raw guidance rejection. Because the implementation substance is present, this is not a migration-design blocker. It is still reportable because it violates the explicit ExecPlan standard and could let a future executor treat mobile routing as distributed tasks instead of a named closure gate required before LLM migration completion.

Expected correction:

Revise the target ExecPlan before implementation starts so `Progress` includes an unchecked `Mobile Routing Gate` item and the work section includes an explicit `Mobile Routing Gate` milestone, or rename/restructure the work section to satisfy `PLAN.md` while preserving the existing mobile routing details.

## Accepted Non-Findings

### Directive Provenance Is Not Scope Creep

The plan's requirement that mobile main-response streams consume a server-issued directive reference is stricter than the short backlog row, but it is justified by source reality. Current WebView code sends raw directive guidance into main-response request objects, and current BFF schemas accept raw guidance. Without closing that sibling path, migrating only directive generation would still leave mobile with prompt-control authority.

Evidence: `src/index.tsx:874-910`, `bff/src/controllers/sessionController.js:151-177`, `bff/src/controllers/sessionController.js:191-203`, and target ExecPlan sections `Directive Provenance Plan`, `Decision Log`, and `Milestone 7`.

### Prompt, Provider, and Fallback Ownership Are Covered

The plan names the required prompt owner `core/prompts/pedagogicalDirective.ts`, Core capability `core/pedagogicalDirective.ts`, BFF route/service/controller, RN bridge/BffClient, WebView routing, desktop Core-backed wrapper, safe fallback normalization, prompt parity, provider-envelope parity, and no duplicate active prompt body requirements.

Evidence: target ExecPlan `Scope Lock`, `Prompt Custody Ledger`, `Parser / Normalizer Custody Ledger`, `Provider Envelope Parity Plan`, `Milestone 2`, `Milestone 4`, and `Required Tests By Layer`.

### WebView Orchestration Is Preserved

The plan repeatedly keeps learner-model inspection, active-flag selection, recent-context selection, curriculum flow, UI behavior, and key-takeaway behavior out of BFF/Core except for structured inputs and explicit backlog classification. That matches the master plan's Phase 1 boundary.

Evidence: master plan `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md:15-27`, `:40-50`, `:396-400`, `:467-482`; target ExecPlan `Purpose / Big Picture`, `Pedagogy-Specific Workflow Invariants`, `Scope Lock`, and `Decision Log`.

### Mobile, RN, and Validation Coverage Are Adequate

The plan covers the missing route as future implementation work rather than assuming it exists. It defines WebView bridge helpers, RN contracts, BffClient method, BFF endpoint, bridge-present/bridge-missing/no-key behavior, generated bundle checks, root tests, BFF tests, mobile tests, analyzer, direct-provider sweep, and live provider smoke/blocker handling. The package scripts checked during audit support the named command style.

Evidence: target ExecPlan `Milestone 1`, `Milestone 5`, `Milestone 6`, `Milestone 8`, `Milestone 9`, `Required Tests By Layer`, and `Validation Commands`; package script anchors in `package.json`, `bff/package.json`, and `SenseiMobile/package.json`.

## Residual Risks

- This audit did not run implementation tests because the target ExecPlan is not implemented.
- The final implementation must still prove every planned gate with current-source tests, especially prompt SHA/length parity, no mobile browser provider path, no raw directive guidance in mobile BFF streams, no-browser-key full-turn behavior, directive reference resolution, timeout layering, cap/rate-limit behavior, generated WebView bundle freshness, and trace/status updates.
- Existing worktree changes outside this report predated the audit and were not modified or reverted.

## Peer Protocol Evidence

The audit used the Codex Thread Peer Execution Protocol in `Collaborative` and `Joint-first` mode.

- Hermione Granger (Agent B) tightened the audit frame from broad "pedagogical engine" language to Phase 1 pedagogical directive LLM capability migration, preventing over-migration findings against learner-state/UI orchestration that the master plan keeps in WebView.
- Harry Potter (Agent A) contributed the master/source-backed candidate finding A1 and source-backed non-findings for Core/BFF/provider custody.
- Hermione Granger (Agent B) independently inspected the ExecPlan/mobile/RN/validation surface, accepted A1, revised severity to Low based on the plan's substantive mobile routing coverage, and added evidence-backed non-findings.

Convergence state: both agents accept A1 as the only surviving reportable issue. No unresolved peer disagreement remains.

## Dirty-State Boundary

This audit intentionally changed only this report under `docs/audit/`. It did not edit source, config, tests, the target ExecPlan, or existing `docs/audits/` artifacts. No files were staged, committed, or pushed.

<system_directives>

## Mission authority

Seeing `AGENTS.md` or `<system_directives>` shifts you into a disciplined operating mode: systematic analysis, careful scope control, and strong respect for protocols that protect correctness and recovery.

Directives here govern repo work unless the user explicitly overrides them.

When the user types `start system`, read this file from beginning to end. From that point forward, follow it for future repo work.

## Inviolable rules

- Never make up facts, APIs, or function names. If you are unsure, state that clearly and propose how to find the information, such as reading a file or running a command.
- Never include comments in code changes.
- Do not waste tokens re-reading files after applying a patch.
- Never run git commands or any other action that reverts, discards, overwrites, or changes modifications you did not author, even if you discover them later.
- Before starting a new task, ensure your own prior work-in-progress is resolved. Never discard, reset, checkout, or overwrite changes unless you authored them and the user explicitly approved that cleanup.

## Protocol execution

This is a protocol-driven system. Use protocols only for major workflows such as feature delivery, bug investigation, architecture work, cleanup/refactor planning, unclear implementation boundaries, or broad multi-component impact reasoning. Do not trigger protocols for direct bounded edits with explicit targets, such as doc wording changes, AGENTS/protocol edits, renames, copy/error-text updates, config value changes, or other narrow mechanical edits. Informational questions, clarifications, and other low-risk guidance also do not require protocol execution. When a protocol is required, read only that protocol’s documentation from the Protocol Catalog, then execute its steps in order and track them with `update_plan`.

| Protocol | Documentation | When to run |
|---|---|---|
| MANDATORY CORE ANALYSIS PROTOCOL (STEP 0) | `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md` | First before any major workflow or major protocol; use Serena for semantic discovery and source inspection, and analyzer for repo-specific risk evidence. |
| MANDATORY RCI REVIEW PROTOCOL | `docs/protocols/MANDATORY_RCI_REVIEW_PROTOCOL.md` | During Feature Implementation Step 8 and Root Cause Step 11 for the self-review cycle and review artifact. |
| COMPREHENSIVE IMPACT ANALYSIS PROTOCOL | `docs/protocols/COMPREHENSIVE_IMPACT_ANALYSIS_PROTOCOL.md` | Before non-trivial changes to existing production code when blast radius, shared contracts, side effects, or validation targets are not already obvious. |
| MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL | `docs/protocols/MANDATORY_ARCHITECTURAL_SYNTHESIS_PROTOCOL.md` | For non-trivial architecture work, such as new modules or architecture changes, after Core Analysis and before implementation. |
| MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL | `docs/protocols/MANDATORY_PRINCIPLE_DRIVEN_FEATURE_IMPLEMENTATION_PROTOCOL.md` | For approved feature delivery after Core Analysis and Impact Analysis; run Architecture Synthesis first when complexity warrants. |
| MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL | `docs/protocols/MANDATORY_ADAPTIVE_ROOT_CAUSE_ANALYSIS_AND_REMEDIATION_PROTOCOL.md` | For every bug investigation and fix, immediately after Core Analysis upon receiving a bug report. This is the exception to `update_plan` tracking. |
| FUNCTIONAL SPECIFICATION PROTOCOL | `docs/protocols/FUNCTIONAL_SPECIFICATION_PROTOCOL.md` | Whenever the user requests a functional specification or requirements document. |
| EXECPLAN PROTOCOL | `docs/protocols/PLAN.md` | For complex, multi-session, migration-scale, or high-uncertainty work needing a durable plan. Does not replace other protocols. Read the ExecPlan doc fully before creating/editing/executing; if a relevant `docs/execplans/` plan exists, read it before unrelated repo inspection. |
| TEST IMPLEMENTATION PROTOCOL | `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md` | When creating, modifying, or evaluating tests. This protocol is the sole source of truth for the functional test mandate.|

## Repository paths, backups and commits

Generated documents go under `./docs`; zipped backups go under `./backup`; miscellaneous files go under `./tmp`; root-folder file creation is forbidden unless the file is core project code; mission state checkpoints go under `./docs/mission_state/` as `mission_state_<descriptive_title>_[timestamp].md`.

Before modifying non-doc production/test/config code during major implementation work, run once `npm run backup:create -- --feature "<feature_slug>" --context "<custom context>"`. Intermediate modifications do not need another. `<feature_slug>` must be a clear human-readable stub, such as `enhance_agentsmd_update_git_commit_message`, and the context must be 1-2 sentences stating the scope and planned changes that will follow after backup.

For any `git commit`, use a long explanatory message, not a terse one-liner: commits must include a concise subject plus a body covering behavior, key files/data flow, validation, and operational notes.

## Project path map

Use this map for orientation only. Do not broad-read these paths; use Serena, analyzer evidence, or targeted file reads according to the Analysis mandate.

| Path | Purpose |
|---|---|
| src/ | Main web app, WebView-side UI, core app logic code, and browser runtime logic. |
| src/mobile/ | WebView-side mobile bridge, message routing, and mobile integration helpers. |
| SenseiMobile/ | React Native iOS shell, native chrome, WebView host, mobile services, bridge host, and app packaging. |
| SenseiMobile/src/mobile/ | RN mobile components/services such as MainScreen, SelectionOverlay, BFF client, save/load, telemetry, and bridge adapters. |
| SenseiMobile/app_web/webview_dist/ | Generated WebView bundle output. Do not treat as source of truth. Rebuild with `npm run webview:bundle` after web source changes. |
| bff/ | Local Backend-for-Frontend used by the mobile shell and LLM proxy flows. |
| core/ | Environment-neutral shared logic. |
| protocol/ | Shared protocol/contracts package. |
| docs/execplans/ | Durable execution plans for complex or multi-session work. |
| docs/functional_spec/ | Functional specifications and master plans. |
| docs/mission_state/ | Mission checkpoints created by protocols when durable recovery context is needed. |
| tmp/ | Scratch work and generated temporary analysis files. |
| backup/ | Backup archives. |

## Analysis mandate and tooling
Use progressive disclosure: choose the smallest tool, query, and source read that answers the current decision.

Tool order:

1. Serena, when enabled, for semantic discovery, project overview, relevant files and symbols, references, diagnostics, source inspection, and symbol-level edits or refactors.
2. Analyzer for repo-specific evidence: side effects, assumptions, mutation risk, DOM and event analysis, focused traces, fan-in and fan-out, boundary APIs, and protocol-grade validation evidence.
3. Built-ins for tiny patches, config and docs work, logs, tests, shell commands, final diffs, and validation commands.

Do not start with broad file reads, broad grep, or large analyzer artifact reads when Serena or a targeted query can answer.

Do not read `brief.md`, `brief.json`, `functions.json`, or `calls.json` end to end by default. Filter with `jq` or a small script and expose only the relevant subset.

Analyzer command:

`npm run analysis:run [-- <option>...]`

Prefer scoped analyzer runs:

`npm run analysis:run -- --include <path-substrings>`

Focused trace:

`npm run analysis:run -- --include <scope> --entry <file::functionPrefix> --maxDepth <N>`

For DOM, UI, or event work, add `--dom-index`.

Read `docs/tooling/analyzer_reference.md` only when analyzer use is needed.

Runtime validation logs are at `./logs/console_logs.log` when log evidence is required.

## Development workflow: Mobile/WebView
Run `npm run webview:bundle` after any web code change; it builds the Sensei web app (`src/`) into `SenseiMobile/app_web/webview_dist/index.js` so WKWebView renders the full interface. Mobile dev order: 1) `cd bff && npm start` for the local BFF at `http://localhost:8787`; 2) `cd SenseiMobile && npm start` for Metro; 3) after bundling, `cd SenseiMobile && npm run ios` or use Xcode.

For mobile LLM proxy work, read `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

</system_directives>

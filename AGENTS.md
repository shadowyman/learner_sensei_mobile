# AGENTS.md

<system_directives>

## Mission authority

Seeing `AGENTS.md` or `<system_directives>` shifts you into a disciplined operating mode: systematic analysis, careful scope control, and strong respect for protocols that protect correctness and recovery.

Directives here govern repo work unless the user explicitly overrides them.

When the user types `start system`, read this file from beginning to end. From that point forward, follow it for future repo work.

Do not read every protocol document. Before executing any protocol, read only that protocol’s documentation from the file path listed in the Protocol Catalog, then execute every required step of that protocol.

## Inviolable rules

- Never make up facts, APIs, or function names. If you are unsure, state that clearly and propose how to find the information, such as reading a file or running a command.
- Never include comments in code changes.
- Do not waste tokens re-reading files after applying a patch.
- Never run git commands or any other action that reverts, discards, overwrites, or changes modifications you did not author, even if you discover them later.
- Always modify files directly on `main`; do not create or switch branches. Before starting a new task, ensure your own prior work-in-progress is resolved. Never discard, reset, checkout, or overwrite changes unless you authored them and the user explicitly approved that cleanup.

## Protocol execution

This is a protocol-driven system. Treat a request as a major workflow only when it requires feature delivery, bug investigation, architecture work, cleanup/refactor planning, unclear implementation boundaries, or broad impact reasoning across multiple components. Do not trigger protocols for direct, bounded edits where the target files and requested change are already explicit. Examples include doc wording changes, AGENTS/protocol text edits, renames, copy/error-message updates, config value changes, and other narrow mechanical edits that do not require system understanding. Purely informational questions, clarifying discussions, and other low-risk guidance also do not require protocol execution, but all other constraints still apply. Before beginning any protocol, you MUST read its documentation. Execute every required protocol step one by one according to "when to run", without skipping or combining steps, and use `update_plan` to enumerate and track every required step from start to finish.

| Protocol | Documentation | When to run |
|---|---|---|
| MANDATORY CORE ANALYSIS PROTOCOL (STEP 0) | `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md` | First before any major workflow or major protocol; use CodeGraph for discovery, analyzer for repo-specific risk evidence, and Serena for known-symbol inspection when enabled. |
| MANDATORY RCI REVIEW PROTOCOL | `docs/protocols/MANDATORY_RCI_REVIEW_PROTOCOL.md` | During Feature Implementation Step 8 and Root Cause Step 11 for the self-review cycle and review artifact. |
| COMPREHENSIVE IMPACT ANALYSIS PROTOCOL | `docs/protocols/COMPREHENSIVE_IMPACT_ANALYSIS_PROTOCOL.md` | Before modifying existing code to map blast radius and validation needs. |
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

## Analysis mandate and tooling
Use progressive disclosure: choose the smallest tool, query, and source read that answers the current decision.

Tool order:

1. CodeGraph, when available, for first-pass context, precedent discovery, relevant files and symbols, callers and callees, and impact radius.
2. Analyzer for repo-specific evidence: side effects, assumptions, mutation risk, DOM and event analysis, focused traces, fan-in and fan-out, boundary APIs, and protocol-grade validation evidence.
3. Serena, when enabled, for exact known-symbol operations: overview, lookup, references, diagnostics, whole-symbol edits, insertion around symbols, and semantic rename or refactor.
4. Built-ins for tiny patches, config and docs work, logs, tests, shell commands, final diffs, and validation commands.

Do not start with broad file reads, broad grep, or large analyzer artifact reads when CodeGraph or a targeted query can answer.

Do not read `brief.md`, `brief.json`, `functions.json`, or `calls.json` end to end by default. Filter with `jq` or a small script and expose only the relevant subset.

Analyzer command:

`npm run analysis:run [-- <option>...]`

Prefer scoped analyzer runs:

`npm run analysis:run -- --include <path-substrings>`

Focused trace:

`npm run analysis:run -- --include <scope> --entry <file::functionPrefix> --maxDepth <N>`

For DOM, UI, or event work, add `--dom-index`.

Read `docs/tooling/analyzer_reference.md` only when analyzer use is needed.

When creating, modifying, or evaluating tests, follow `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`. Runtime validation logs are at `./logs/console_logs.log` when log evidence is required.

## Development workflow: Mobile/WebView
Run `npm run webview:bundle` after any web code change; it builds the Sensei web app (`src/`) into `SenseiMobile/app_web/webview_dist/index.js` so WKWebView renders the full interface. Mobile dev order: 1) `cd bff && npm start` for the local BFF at `http://localhost:8787`; 2) `cd SenseiMobile && npm start` for Metro; 3) after bundling, `cd SenseiMobile && npm run ios` or use Xcode.

For mobile LLM proxy work, read `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

</system_directives>

# Exhaustive Peer Audit: Pedagogical Directive Generation Core/BFF Mobile Migration ExecPlan

Audit target: `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`

Governing references:
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/protocols/PLAN.md`
- `docs/protocols/codex_thread_peer_execution_protocol.md`
- Current repository source under `src/`, `core/`, `bff/`, `protocol/`, and `SenseiMobile/`

Peer roles:
- Harry Potter, Agent A, thread `019eb689-299a-7213-9429-2d1cf10b487d`
- Hermione Granger, Agent B, thread `019eb689-dcd2-7332-980a-5bc4d16a9ff9`

## Verdict

The ExecPlan is technically aligned with the Phase 1 mobile LLM proxy master plan for the pedagogical directive generation capability. It preserves the correct migration boundary: WebView retains learner-state inspection and UI orchestration while prompt text, provider execution, parser/fallback semantics, BFF routing, mobile bridge transport, directive provenance, raw-guidance rejection, and validation ownership move to Core/BFF/mobile bridge surfaces.

The second audit found two low-severity issues. Neither issue invalidates the migration design, but both should be corrected before implementation so the plan satisfies the LLM ExecPlan protocol and the direct-provider sweep evidence remains precise.

## Audit Method

This was a second, stricter peer audit after the first report was judged too narrow for sentence-level confidence.

Both peers read the full 1,529-line target ExecPlan end to end. The split assigned primary validation depth, not partial reading:
- Harry primary: lines 1-665, covering purpose, authority reads, source map/current workflow, pedagogy invariants, scope lock, provenance, rate limit, provider envelope, no-key behavior, cap/timeout plans, capability matrix, direct-provider sweep, prompt custody, parser/normalizer custody, boundary invariants, trust-boundary schema, runtime routing, and boundary contract audit.
- Hermione primary: lines 667-1529, covering prior PR failure classes, Progress, Surprises & Discoveries, Decision Log, milestones 0-9, tests by layer, validation commands, review remediation rules, outcomes, and final migration evidence.
- Crosscut review: Harry challenged milestone/test/validation feasibility in Hermione-owned ranges; Hermione challenged source/master evidence support in Harry-owned ranges.

Both peers confirmed they did not treat the first-pass report as source truth.

## Findings

### A1. Low - Missing explicit Mobile Routing Gate milestone

The target ExecPlan does not include the required named `Mobile Routing Gate` milestone in both `Progress` and the plan-of-work section.

Evidence:
- ExecPlan `Progress` is present at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:738`.
- ExecPlan work breakdown starts as `## Implementation Plan` at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:820`.
- A repository search for `Mobile Routing Gate` in the target ExecPlan returned no hits.
- `docs/protocols/PLAN.md` requires LLM ExecPlans to include a `Mobile Routing Gate` milestone in both `Progress` and `Plan of Work`.

Execution impact:
The plan contains strong mobile-routing substance across BffClient, RN bridge, WebView routing, BFF endpoint, no-key behavior, bundle validation, and sentinel tests. The defect is protocol compliance and executor discoverability: the required gate is distributed across milestones instead of being named as the protocol requires.

Correction:
Add a named `Mobile Routing Gate` entry in `Progress` and the work plan. It should consolidate bridge availability, fail-closed/no-key behavior, RN BffClient route, BFF endpoint, Core route, WebView routing, and sentinel proof that mobile cannot reach browser provider or browser `CoreLlmClient` paths.

### A2. Low - Direct Provider Authority Sweep under-identifies the key-takeaway provider owner

The ExecPlan correctly treats key-takeaway enhancement as a separate backlog item, but the Direct Provider Authority Sweep table does not explicitly name the actual source owner of the key-takeaway direct provider call.

Evidence:
- ExecPlan `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:475` says to run the direct-provider sweep before implementation, after major milestones, before PR, and after review remediation.
- ExecPlan `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:479` says to classify every hit.
- ExecPlan `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:486` classifies `src/index.tsx` / `src/moduleSelectionHandler.ts` key-takeaway provider use as a separate backlog.
- Current source shows the actual provider owner is `src/keyTakeawayEnhancerController.ts`: it imports `GoogleGenAI` at line 1, defines `KeyTakeawayEnhancerController` at line 33, creates a provider chat at lines 81-87, and calls `sendMessage` at lines 88-90.
- The master plan names `KeyTakeawayEnhancerController.start` as the key-takeaway provider owner in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md:162` and describes the same provider-chat/send behavior at `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md:450`.

Execution impact:
This is not a scope inversion. The plan repeatedly says key-takeaway enhancement remains separate backlog and must not be counted as migrated. The issue is evidence precision: an executor could overclaim direct-provider sweep closure or miss the exact remaining source owner while proving mobile no-key behavior and final provider-sweep honesty.

Correction:
Add an explicit Direct Provider Authority Sweep row for `src/keyTakeawayEnhancerController.ts:KeyTakeawayEnhancerController.start`, classified as `separate backlog / do not count as migrated`. The required action should prove mobile no-key mode cannot newly invoke it, or explicitly gate mobile bridge-present behavior without claiming repo-wide no-provider completion.

## Coverage Ledger

| Range | Primary owner | Disposition | Notes |
| --- | --- | --- | --- |
| 1-29 | Harry | confirmed-current | Purpose/status correctly gate implementation behind evidence ledgers. |
| 31-47 | Harry | confirmed-current | Required authority paths exist and are appropriate. |
| 49-66 | Harry | confirmed-structural-only | Historical authoring-audit claims treated as context, not source truth. |
| 68-160 | Harry | confirmed-current | Current workflow/source ownership claims are source-supported. |
| 162-221 | Harry | confirmed-current | Pedagogy invariants and scope lock match master-plan boundaries. |
| 223-436 | Harry | confirmed-current | Provenance, rate-limit, provider-envelope, no-key, cap, and timeout plans align with current patterns. |
| 438-471 | Harry | confirmed-current | Capability matrix correctly refuses to count key-takeaway as migrated. |
| 473-493 | Harry | issue-low | A2: direct-provider sweep should name `KeyTakeawayEnhancerController.start`. |
| 495-554 | Harry | confirmed-current | Prompt custody, parser/normalizer, and boundary invariant ledgers cover active directive semantics. |
| 556-665 | Harry | confirmed-current with A1 caveat | Trust-boundary and routing plan are aligned but should be grouped under the named Mobile Routing Gate. |
| 667-736 | Hermione | confirmed-current | Prior PR failure classes are concrete prevention gates. |
| 738-759 | Hermione | issue-low | A1: missing explicit Mobile Routing Gate progress item. |
| 761-775 | Hermione | confirmed-current with A2 caveat | Discoveries are source-supported; key-takeaway owner naming should be precise. |
| 776-818 | Hermione | confirmed-current | Decision Log matches Phase 1 scope and source reality. |
| 820-851 | Hermione | confirmed-current | Pre-implementation gates are feasible and require revalidation. |
| 853-930 | Hermione | confirmed-current with A2 caveat | Test list is broad; key-takeaway classification should name the controller owner. |
| 932-988 | Hermione | confirmed-current | Core prompt/capability/provider envelope work is aligned with master plan. |
| 990-1016 | Hermione | confirmed-current | Provenance storage/token decision is feasible against current session-store shape. |
| 1018-1093 | Hermione | confirmed-current | BFF route, service, config, rate-limit, and cap work match existing patterns. |
| 1095-1114 | Hermione | confirmed-current | BffClient placement and retry/error patterns are current. |
| 1116-1142 | Hermione | confirmed-current | RN bridge route placement matches existing bridge structure. |
| 1144-1170 | Hermione | confirmed-current | Main stream sibling update is necessary, not scope creep. |
| 1172-1228 | Hermione | confirmed-current with A1 caveat | WebView/no-key route coverage is strong but should be grouped under Mobile Routing Gate. |
| 1230-1268 | Hermione | confirmed-current with A2 caveat | Final validation commands are feasible; key-takeaway classification should name exact owner. |
| 1270-1347 | Hermione | confirmed-current | Required tests by layer are comprehensive for the planned migration. |
| 1349-1379 | Hermione | confirmed-current | Validation commands match package-script style and current scripts. |
| 1381-1411 | Hermione | confirmed-current | Review remediation rules are appropriate. |
| 1413-1435 | Hermione | future-not-verifiable-until-implementation | Outcomes section is correctly blank before implementation. |
| 1437-1529 | Hermione | future-not-verifiable-until-implementation | Final evidence section is correctly blank before implementation, with A2 precision caveat. |

## Accepted Non-Findings

The plan does not over-migrate the pedagogical engine. It correctly keeps learner-state inspection, active-flag selection, recent conversation context, UI orchestration, teaching-state mutation, and WebView stream handling outside Core/BFF unless they are LLM-facing prompt/provider/parser concerns.

The plan does not under-migrate the active pedagogical directive capability. It identifies the active prompt template, `PedagogicalProfiler.getDirective`, `generateDirectiveFromMetaPrompt`, provider call, fallback behavior, Core prompt/capability placement, BFF endpoint/service, mobile bridge transport, and desktop compatibility wrapper.

The directive provenance change is justified. Replacing raw mobile-supplied directive guidance with server-issued directive references is necessary to close mobile prompt-control authority after the directive generator moves server-side.

The validation plan is comprehensive enough for the master plan. It covers prompt parity, parser/fallback parity, desktop compatibility, BFF service/endpoint behavior, RN bridge/BffClient transport, WebView mobile routing sentinels, no-key behavior, generated WebView bundle, provider sweep, trace/status update, and package-specific test commands.

Desktop compatibility is preserved. The plan allows desktop web to keep a browser Core client path while requiring mobile to use structured WebView -> RN -> BffClient -> BFF -> Core routing.

## Residual Risks

The audit validates the ExecPlan, not the future implementation. The final implementation still must prove the blank Outcomes and Final Migration Evidence sections with actual command output, provider sweeps, bundle generation, and source diffs.

The target ExecPlan is currently untracked. This audit assumes the untracked file at the audited path is the intended artifact.

The first-pass report remains in `docs/audit/` as historical context. This second report supersedes it for exhaustive coverage claims.

## Dirty-State Boundary

Files intentionally created or edited by this second audit:
- `docs/audit/pedagogical_directive_generation_core_bff_migration_execplan_exhaustive_audit.md`

Files intentionally not edited:
- `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`
- production source files
- test files
- package/config files

No staging, commit, or push was performed.

## Convergence State

Both peers completed full end-to-end reads of the target ExecPlan and agreed on the survivor findings:
- A1: Low, accepted by both peers.
- A2: Low, accepted by both peers.

No unresolved peer disagreements remain in the issue ledger.

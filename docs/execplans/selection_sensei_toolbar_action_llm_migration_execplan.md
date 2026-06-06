# Selection Sensei Modal LLM Flow Migration ExecPlan

This ExecPlan is a live document. It must be updated continuously before and after every meaningful discovery, decision, code change, failed command, validation result, or stopping point. A future agent must be able to resume from this file and the current working tree without chat history.

Implementation status: FINAL_SWEEP_COMPLETE_FOR_SELECTION_SENSEI_MODAL_FLOW. WDG-004 moved Selection Sensei prompt/action and parser custody into Core; WDG-004C repaired Core's `json5` runtime dependency metadata and protocol-ledger coverage; WDG-005/WDG-005C added and corrected the Core modal capability; WDG-006 added the BFF route/schema/service and server Gemini task routing; WDG-007 added the mobile `BffClient` transport method; WDG-008 added the RN bridge/MainScreen transport seam; WDG-008C repaired bridge/network modal type ownership direction and stale ExecPlan outcome text; WDG-009 implemented WebView mobile routing/provider-removal for toolbar and follow-up; WDG-009C repaired stale cached WebView bridge sender fail-closed behavior and strengthened non-LLM public action coverage; WDG-010 ran the embedded WebView bundle command, final source/generated provider sweep, trace/master-plan status updates, final selected validation, diff hygiene, and staged-state checks. The generated bundle command passed with no tracked generated diff. Commit and push remain not authorized.

## Purpose / Big Picture

Migrate the Selection Sensei modal LLM flow from a WebView-owned direct Gemini chat path to the Phase 1 Core/BFF/mobile bridge model. This expanded scope intentionally includes both backlog-related modal LLM paths:

- the initial toolbar action at `src/selectionSensei.ts:handleToolbarAction`
- the modal follow-up path at `src/selectionSensei.ts:dispatchFollowupToAI`

After completion, the Selection Sensei toolbar actions `explainSimpler`, `explainWithAnalogy`, `explainInMoreDepth`, `showAnExample`, `showExampleCodeSnippet`, and `askQuestion`, plus follow-up questions submitted through the response modal composer, must still behave as one coherent modal conversation. Prompt text, prompt builders, parser/normalizer logic, provider execution, model config, modal conversation request contracts, and mobile trust-boundary validation must move to the correct owners:

- Core owns prompt text, toolbar prompt builders, follow-up prompt builders, action instruction mapping, modal transcript normalization contracts, parser/normalizer logic, request/result types, and the LLM capability function.
- BFF owns provider execution, secrets, model routing/config, request validation, rate limiting, structured route responses, and server telemetry.
- React Native owns transport from the embedded `WKWebView` to the BFF and back.
- WebView owns selection capture, DOM geometry, toolbar rendering, ask UI, response modal state, markdown rendering, bounded modal transcript collection, modal transcript/composer UI, copy/share, and Add to Notepad.

The original selected backlog row is from `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`: `Selection Sensei toolbar action` with current entry `src/selectionSensei.ts:handleToolbarAction`. The user expanded this plan to include the adjacent Selection Sensei follow-up backlog item because both paths share the same modal conversation and migrating only toolbar action would risk a UX regression.

The target files remain `core/prompts/selectionSensei.ts`, `core/selectionSensei.ts`, a BFF Selection Sensei modal route/service, and a mobile bridge route. The preferred route/bridge shape is a single modal-message capability with a discriminated request mode for `toolbarAction` and `followUp`, rather than two unrelated paths.

## Watchdog Turn Ledger

| Packet ID | Turn ID | Status | Timestamp | Files changed | ExecPlan sections updated | Validation | Blockers | Recommended next packet |
|---|---|---|---|---|---|---|---|---|
| WDG-001-protocol-activation-ledger | TURN-20260605T180334Z | COMPLETE | 2026-06-05T18:03:34Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md` only | `Watchdog Turn Ledger`, `Progress`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | `git status --short --branch`, `git diff --name-status`, and `git diff --cached --name-status` captured; no implementation tests authorized or run | No packet-blocking contradiction found. Current dirty tree includes pre-existing tracked changes outside this packet scope and untracked docs; they are recorded as present but not touched. Phase 3 fresh provider sweep and implementation tests remain blocked until authorized by later packets. | WDG-002 Milestone 0 / pre-implementation gate packet: backup, test protocol read, fresh direct-provider sweep, and source-drift analysis before any feature-code edit |
| WDG-002-milestone-0-preimplementation-gates | TURN-20260605T182838Z | COMPLETE | 2026-06-05T18:28:38Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; backup command generated `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip` and refreshed manifests (`src/backup-file-manifest.json` is modified in final diff; `src/file-manifest.json` has no final diff) | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Direct Provider Authority Sweep`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Required authority/test/master/trace/ExecPlan refresh completed; backup exited 0; direct-provider sweep exited 0 and was classified; final `git status --short --branch`, `git diff --name-status`, and `git diff --cached --name-status` captured; no implementation tests run | None. Dirty tree contains pre-existing tracked/untracked files outside this packet plus allowed ExecPlan and backup-generated artifacts; no staged files. | WDG-003 red-test/golden-test packet for Selection Sensei modal flow before feature source implementation |
| WDG-002C-plan-live-doc-repair | TURN-20260605T183746Z | COMPLETE | 2026-06-05T18:37:46Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md` only | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Refreshed `docs/protocols/PLAN.md`, active ExecPlan, skill entry because active skill governance applies, and current git status/diff/cached state; recorded the missed WDG-002 failed patch/context mismatch and the correction-packet patch context mismatch; final status/diff/cached baseline captured; no tests or implementation validation run | None. The missed patch-context events are documentation/live-state corrections and do not alter provider-sweep classification, feature scope, or implementation order. | WDG-003 red-test/golden-test packet for Selection Sensei modal flow after watchdog accepts this repair |
| WDG-003-red-golden-tests | TURN-20260605T190803Z | COMPLETE | 2026-06-05T19:08:03Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `__tests__/selectionSensei.prompts.test.ts`; `__tests__/selectionSenseiResponseParser.test.ts`; `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`; `__tests__/BffClient.test.ts`; `bff/tests/selectionSenseiModal.validation.red.test.js` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Prompt Custody Ledger`, `Parser/Normalizer Ledger`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Required refresh and git baselines captured; root Jest exited `1` with expected missing `../src/selectionSenseiRouting`; individual prompt/parser/BffClient suites exited `1` with expected missing Core prompt module, Core parser module, and BFF client method; BFF red test exited `1` with expected missing route `404`; `git diff --check` exited `0`; final staged diff empty | None requiring stop. Remaining implementation blockers are expected red gates: missing Core prompt/parser modules, Selection Sensei routing helper, BFF client method, BFF route/schema, and deferred provider-failure/duplicate/retry tests until seams exist. | Prompt/parser custody implementation packet after watchdog accepts red/golden test evidence |
| WDG-003C-red-test-completeness-correction | TURN-20260605T194731Z | COMPLETE | 2026-06-05T19:47:31Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `__tests__/selectionSensei.prompts.test.ts`; `__tests__/selectionSensei.test.ts`; `bff/tests/selectionSenseiModal.validation.red.test.js` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Prompt Custody Ledger`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Required refresh completed; prompt suite exited `1` with expected missing Core prompt owner after old-golden tests passed; Selection Sensei suite exited `1` with expected public mobile direct-provider and duplicate-provider red failures; BFF suite exited `1` with expected missing route `404`; `git diff --check` exited `0`; staged diff empty | None requiring stop. Remaining blockers are expected implementation gates: missing Core prompt/action owner, missing routed public mobile execution, missing toolbar in-flight guard, missing BFF route/schema, and route-call de-dup assertion blocked until routing seam exists. | Prompt/parser custody implementation packet only after watchdog accepts WDG-003C correction |
| WDG-004-core-prompt-parser-custody | TURN-20260605T200403Z | COMPLETE | 2026-06-05T20:04:03Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `core/prompts/selectionSensei.ts`; `core/selectionSensei.ts`; `core/prompts/index.ts`; `core/index.ts`; `core/package.json`; `src/prompts.ts`; `src/selectionSenseiResponseParser.ts`; `src/selectionSensei.ts`; `__tests__/selectionSensei.prompts.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Prompt Custody Ledger`, `Parser/Normalizer Ledger`, `Boundary Invariant Ledger`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Required refresh completed; `npm run core:build` exited `0`; prompt suite exited `0` with 8 tests passed; parser suite exited `0` with 5 tests passed; public mobile Selection Sensei suite stayed red for expected direct-provider/duplicate-provider failures; routing/BffClient/BFF route suites stayed red for expected missing helper/method/route; `git diff --check` exited `0`; staged diff empty | None requiring stop. Remaining blockers are expected implementation gates: missing Selection Sensei routing helper, missing BFF client method, missing BFF route/schema/service, public mobile direct-provider behavior, bridge fail-closed behavior, and route-level duplicate/retry/provider-failure seams. | Bounded BFF route/schema or WebView/RN routing packet after watchdog accepts Core prompt/parser custody |
| WDG-004C-core-dependency-and-protocol-ledger-correction | TURN-20260605T202519Z | COMPLETE | 2026-06-05T20:25:19Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `core/package.json`; `package-lock.json`; `bff/package-lock.json` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Parser/Normalizer Ledger`, `Boundary Invariant Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Required refresh completed; `npm run core:build` exited `0`; Core dependency check exited `0`; root/BFF lock metadata check exited `0`; prompt suite exited `0` with 8 tests passed; parser suite exited `0` with 5 tests passed; `git diff --check` exited `0`; staged diff empty | None. Remaining blockers are expected implementation gates: missing Selection Sensei routing helper, missing BFF client method, missing BFF route/schema/service, public mobile direct-provider behavior, bridge fail-closed behavior, and route-level duplicate/retry/provider-failure seams. | Bounded BFF route/schema or WebView/RN routing packet after watchdog accepts WDG-004C correction |
| WDG-005-core-modal-capability-provider-boundary | TURN-20260605T203651Z | COMPLETE | 2026-06-05T20:36:51Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `core/selectionSensei.ts`; `core/prompts/selectionSensei.ts`; `core/modelUsage.ts`; `core/browserLlmClient.ts`; `__tests__/selectionSenseiCoreModal.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Prompt Custody Ledger`, `Parser/Normalizer Ledger`, `Boundary Invariant Ledger`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Targeted refresh completed; `npm run core:build` exited `0`; combined prompt/parser/Core modal suite exited `0` with 20 tests passed; public Selection Sensei suite stayed red for expected direct-provider/duplicate failures; BffClient suite stayed red for expected missing method; BFF validation stayed red for expected missing route `404`; `git diff --check` exited `0`; staged diff empty | None. Remaining blockers are expected implementation gates: missing Selection Sensei routing helper, missing BFF client method, missing BFF route/schema/service, public mobile direct-provider behavior, bridge fail-closed behavior, and route-level duplicate/retry/provider-failure seams. | Bounded BFF route/schema or WebView/RN routing packet after watchdog accepts WDG-005 Core seam |
| WDG-005C-core-modal-boundary-correction | TURN-20260605T205157Z | COMPLETE | 2026-06-05T20:51:57Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `core/selectionSensei.ts`; `__tests__/selectionSenseiCoreModal.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Prompt Custody Ledger`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | `npm run core:build` exited `0`; combined prompt/parser/Core modal suite exited `0` with 21 tests passed; public Selection Sensei, BffClient, and BFF validation suites stayed red for expected missing later seams; `git diff --check` exited `0`; staged diff empty | None. Remaining blockers are expected implementation gates: missing Selection Sensei routing helper, missing BFF client method, missing BFF route/schema/service, public mobile direct-provider behavior, bridge fail-closed behavior, and route-level duplicate/retry/provider-failure seams. | Bounded BFF route/schema or WebView/RN routing packet after watchdog accepts WDG-005C |
| WDG-006-bff-selection-sensei-modal-route-schema | TURN-20260605T210646Z | COMPLETE | 2026-06-05T21:06:46Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `bff/src/server.js`; `bff/src/container.js`; `bff/src/config/modelUsage.js`; `bff/src/integration/geminiGateway.js`; `bff/src/routes/selectionSensei.js`; `bff/src/controllers/selectionSenseiController.js`; `bff/src/services/selectionSenseiService.js`; `bff/tests/selectionSenseiModal.service.test.js` | `Watchdog Turn Ledger`, `Progress`, `Surprises & Discoveries`, `Decision Log`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Core build exit `0`; Core prompt/parser/modal suite exit `0` with 21 tests; BFF validation route test exit `0`; BFF service/model test exit `0`; BffClient and public Selection Sensei suites stayed red for expected later seams; `git diff --check` exit `0`; staged diff empty | None. Remaining blockers are expected later seams: BffClient method, RN bridge wiring, WebView routing helper, public direct-provider removal, bridge fail-closed behavior, and route-call de-dup/retry handling. | BffClient/RN/WebView routing packet after watchdog accepts BFF route/schema/service evidence |
| WDG-007-bffclient-selection-sensei-modal-transport | TURN-20260605T212253Z | COMPLETE | 2026-06-05T21:22:53Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `SenseiMobile/src/mobile/network/BffClient.ts`; `SenseiMobile/src/mobile/network/types.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | BffClient suite exit `0` with 8 tests; BFF validation/service tests exit `0`; public Selection Sensei suite stayed red for expected direct-provider/duplicate seams; `git diff --check` exit `0`; staged diff empty | None. Remaining blockers are expected later seams: RN bridge wiring, WebView routing helper, public direct-provider removal, bridge fail-closed behavior, route-call de-dup/retry handling, generated bundle, final sweep. | RN bridge/WebView routing packet after watchdog accepts BffClient transport evidence |
| WDG-008-rn-selection-sensei-modal-bridge-transport | TURN-20260605T213520Z | COMPLETE | 2026-06-05T21:35:20Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `SenseiMobile/src/mobile/bridge/contracts.ts`; `SenseiMobile/src/mobile/MainScreen.tsx`; `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | RN bridge/MainScreen test exit `0` with 3 tests; BffClient and BFF validation/service tests exit `0`; WebView routing and public Selection Sensei suites remain expected-red; `git diff --check` exit `0`; staged diff empty | None. Remaining blockers are expected later seams: WebView routing helper, public direct-provider removal, bridge-missing fail-closed behavior, route-call de-dup/retry handling, generated bundle, final sweep. | WebView routing/helper and public provider-removal packet after watchdog accepts RN bridge transport evidence |
| WDG-008C-rn-type-ownership-and-execplan-repair | TURN-20260605T214730Z | COMPLETE | 2026-06-05T21:47:30Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `SenseiMobile/src/mobile/bridge/contracts.ts`; `SenseiMobile/src/mobile/network/types.ts`; `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Outcomes & Retrospective`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | RN bridge/MainScreen test exit `0` with 3 tests; BffClient test exit `0` with 8 tests; `git diff --check` exit `0`; staged diff empty | None. Remaining blockers are expected later seams: WebView routing helper, public direct-provider removal, bridge-missing fail-closed behavior, route-call de-dup/retry handling, generated bundle, final sweep. | WebView routing/helper and public provider-removal packet after watchdog accepts WDG-008C correction |
| WDG-009-webview-selection-sensei-modal-routing-provider-removal | TURN-20260605T215752Z | COMPLETE | 2026-06-05T21:57:52Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `src/selectionSensei.ts`; `src/selectionSenseiRouting.ts`; `src/mobile/webviewBridge.ts`; `src/mobile/webviewMessageRouter.ts`; `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`; `__tests__/selectionSensei.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Boundary Invariant Ledger`, `Trust-Boundary Schema Plan`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Outcomes & Retrospective`, `Revision Note` | Routing-helper, public Selection Sensei, and RN bridge/MainScreen suites exited `0`; focused static provider check classified; `git diff --check` exited `0`; staged diff empty | None. Generated WebView bundle, trace/master-plan status, final provider sweep, commit, push, staging, reset, checkout, and cleanup remain pending/forbidden unless a later packet authorizes them. Desktop local provider compatibility remains intentionally preserved and classified. | Bundle/final sweep/status packet after WDG-009 validation |
| WDG-009C-webview-bridge-failclosed-test-repair | TURN-20260605T221844Z | COMPLETE | 2026-06-05T22:18:44Z | `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`; `src/mobile/webviewBridge.ts`; `__tests__/selectionSensei.test.ts`; `__tests__/webviewBridge.failClosed.test.ts` | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Boundary Invariant Ledger`, `Runtime Routing Plan`, `Red-Test Gate`, `Test Gate Ledger`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Bridge fail-closed, routing-helper, and public Selection Sensei suites exited `0`; `git diff --check` exited `0`; staged diff empty | None. Generated bundle, final sweep/status, commit, push, staging, reset, checkout, and cleanup remain pending/forbidden unless a later packet authorizes them. `src/mobile/webviewMessageRouter.ts` and `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` were validated but not edited in WDG-009C. | Bundle/final sweep/status packet after WDG-009C validation |
| WDG-010-final-bundle-sweep-status | TURN-20260605T222730Z | COMPLETE | 2026-06-05T22:27:30Z | Active ExecPlan; `docs/llm_entry_exit_traces.md`; `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`; generated WebView bundle command produced no tracked generated diff | `Watchdog Turn Ledger`, `Progress`, `Decision Log`, `Direct Provider Authority Sweep`, prompt/parser/boundary/trust/routing/test ledgers, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Outcomes & Retrospective`, `Revision Note` | Bundle exit `0`; final source/generated provider/routing sweeps classified; root focused Jest aggregate exit `0`; BFF validation and service tests exit `0`; Core build exit `0`; `git diff --check` exit `0`; staged diff empty | None. Selection Sensei toolbar/follow-up unified modal flow final evidence passed. Remaining LLM backlog rows are enhancement, key takeaway enhancement, and pedagogical directive generation. | Watchdog audit, then commit/review packet only if explicitly authorized |
| WDG-010C-execplan-final-state-repair | TURN-20260605T224420Z | COMPLETE | 2026-06-05T22:44:20Z | Active ExecPlan only | `Watchdog Turn Ledger`, top `Implementation status`, `Progress`, `Scope Lock`, `Capability x Mode x Lifecycle Matrix`, `Red-Test Gate`, `Protocol Coverage Ledger`, `Validation and Acceptance`, `Artifacts and Notes`, `Revision Note` | Targeted stale-status scan completed; `git diff --check` exited `0`; `git diff --cached --name-status` had no output | None. Repairs were ExecPlan-only current-state corrections. Pre-packet known-bugs doc edit from the prior user request remains present but was not touched during WDG-010C. | Watchdog audit, then commit/review packet only if explicitly authorized |

## Progress

- [x] 2026-06-05T15:35:59Z - Read required governance and example documents before authoring this plan: `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/templates/llm_migration_compliance_block.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, and `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`.
- [x] 2026-06-05T15:35:59Z - Performed manual source and test investigation before any analyzer usage. Manual investigation covered WebView Selection Sensei entry points, prompt custody, parser custody, mobile bridge contracts, RN bridge dispatch, BFF route/service patterns, Core LLM client patterns, model usage, and existing tests.
- [x] 2026-06-05T15:35:59Z - Ran an authored-source direct-provider sweep with generated WebView bundle and generated reports excluded: `rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**'`.
- [x] 2026-06-05T15:35:59Z - Captured current runtime prompt parity baselines for exported Selection Sensei prompts using `node -r ts-node/register/transpile-only`.
- [x] 2026-06-05T15:35:59Z - Created this planning-only ExecPlan.
- [x] 2026-06-05T15:35:59Z - User expanded scope to migrate Selection Sensei toolbar action and follow-up together as one modal LLM flow. The plan must now include Core/BFF ownership for both `handleToolbarAction` and `dispatchFollowupToAI`.
- [x] 2026-06-05T15:35:59Z - Began Core Analysis Protocol after user explicitly allowed `npm run analysis:run`.
- [x] 2026-06-05T15:35:59Z - Analyzer wrapper command failed before producing analyzer evidence because the shell variable name `status` is read-only in zsh. This was a command-wrapper failure, not yet an analyzer failure; rerun with a safe variable name.
- [x] 2026-06-05T15:35:59Z - Baseline `npm run analysis:run` completed with exit 0 and refreshed `tmp/analysis/*`; it also regenerated `src/file-manifest.json`.
- [x] 2026-06-05T15:35:59Z - Read `tmp/analysis/brief.md` and `tmp/analysis/summary.txt` after the baseline analyzer run. A first `jq` drilldown into `brief.json` failed because the query assumed array fields where the artifact uses object-shaped sections; rerun structured queries against actual keys before patching final analysis evidence.
- [x] 2026-06-05T15:35:59Z - Narrowed analyzer drilldown to Selection Sensei modal flow. One function-catalog `jq` query had a parenthesis typo and failed as a wrapper/query issue; the call-edge query succeeded and confirmed `handleToolbarAction` and `dispatchFollowupToAI` both route through `ensureSelectionChat`.
- [x] 2026-06-05T15:57:53Z - Focused analyzer trace for `src/selectionSensei.ts::SelectionSensei.handleToolbarAction` completed with exit 0 and confirmed toolbar action calls prompt builders, `ensureSelectionChat`, modal loading/update helpers, bridge clear through `hideSelectionToolbar`, and parser wrapper.
- [x] 2026-06-05T15:57:53Z - Focused analyzer trace for `src/selectionSensei.ts::SelectionSensei.dispatchFollowupToAI` completed with exit 0 and confirmed follow-up calls `ensureSelectionChat`, `formatFollowupAnswer`, modal append helpers, composer state toggles, and the same parser wrapper.
- [x] 2026-06-05T15:57:53Z - Core analysis complete for the planning update. I have mapped the execution trace and identified dependencies and side effects. I am now ready to proceed with updating the LLM Migration Compliance ExecPlan.
- [x] 2026-06-05T16:03:52Z - Created Core Analysis Protocol mission-state checkpoint at `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`.
- [x] 2026-06-05T16:45:40Z - Revised this ExecPlan with accepted planning decisions from `docs/known_bugs/bounded_llm_history_context_limit.md`: use explicit stateless modal context for Selection Sensei follow-up, keep `json5` support for parser parity, and use generous Selection Sensei-specific trusted-boundary caps rather than blindly inheriting main Sensei's current history caps.
- [x] 2026-06-05T18:03:34Z - TURN-20260605T180334Z / WDG-001-protocol-activation-ledger: refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, and this ExecPlan; captured git status/diff baselines; added the Watchdog Turn Ledger; classified every LLM migration protocol section for the current planning-only state. No feature implementation, source edit, test edit, commit, push, backup, or implementation validation was performed.
- [ ] TURN-20260605T180334Z next gate - Wait for a watchdog packet before any new subsystem or milestone. Recommended next packet is Milestone 0 / pre-implementation gates, not Core/BFF/RN/WebView feature code.
- [x] 2026-06-05T18:28:38Z - TURN-20260605T182838Z / WDG-002-milestone-0-preimplementation-gates started. Refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, and this ExecPlan before Milestone 0 commands. Captured initial dirty-tree baseline and confirmed this packet remains pre-implementation only.
- [x] 2026-06-05T18:29:11Z - TURN-20260605T182838Z / WDG-002 backup gate completed. Command exited 0 with output capped to the final 12000 bytes without terminating the command. It refreshed `src/file-manifest.json` and `src/backup-file-manifest.json` and created `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip`.
- [x] 2026-06-05T18:30:02Z - TURN-20260605T182838Z / WDG-002 fresh direct-provider authority sweep completed. Command exited 0, output was 14492 bytes / 178 lines, and the wrapper printed the full output under a 70000-byte cap while preserving exit status. The sweep found the already-planned in-scope Selection Sensei direct-provider path plus expected Core/BFF provider infrastructure, desktop compatibility surfaces, unrelated backlog rows, test mocks, and false positives; no contradiction to the unified toolbar plus follow-up Selection Sensei modal scope was found.
- [x] 2026-06-05T18:31:10Z - TURN-20260605T182838Z / WDG-002 final dirty-tree baseline captured after backup/sweep/ExecPlan edits. Final `git status --short --branch` shows no staged files; tracked diffs are `.codex/skills/llm-migration-compliance/SKILL.md`, `.codex/skills/llm-migration-watchdog/SKILL.md`, and `src/backup-file-manifest.json`; untracked docs include this ExecPlan and pre-existing planning/watchdog docs. `git diff --cached --name-status` has no output.
- [x] TURN-20260605T182838Z before future source edits - Required backup gate ran successfully for `selection_sensei_modal_llm_migration`; later implementation packets do not need to repeat it unless source drift or watchdog requires another backup.
- [x] TURN-20260605T182838Z before future source edits - Read `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md` before any future test edits.
- [x] 2026-06-05T18:37:46Z - TURN-20260605T183746Z / WDG-002C-plan-live-doc-repair completed. Repaired the PLAN.md live-document omission from WDG-002 by recording the failed patch/context mismatch that had appeared only in chat. The WDG-002 failed patch happened because one assumed discovery-note anchor was not present in the ExecPlan; recovery was to inspect nearby anchors and split the update into smaller anchored patches. During this correction packet, the first repair patch also hit a context mismatch because the expected progress anchor did not exactly match the active file; that current packet failure was likewise recorded and recovered with smaller anchored edits. This correction does not change feature scope, provider-sweep classification, implementation gates, or the recommended next packet.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z / WDG-003-red-golden-tests started. Refreshed required authority files and active plan, read allowed existing tests/source seams for test placement, and captured initial git status/diff/cached baseline. This packet is red/golden tests only; no production source, Core, BFF source, RN, WebView, generated bundle, package, master-plan, trace, skill, mission-state, staging, commit, push, checkout, reset, or cleanup work is authorized.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z test placement decision before edits: extend `__tests__/selectionSensei.prompts.test.ts` for old prompt SHA/length golden fixtures plus future Core prompt destination red check; extend `__tests__/selectionSenseiResponseParser.test.ts` for parser parity fixtures plus future Core parser destination red check; add `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` because no Selection Sensei routing helper exists yet; extend `__tests__/BffClient.test.ts` for future mobile client route/request-shape red checks; add `bff/tests/selectionSenseiModal.validation.red.test.js` because no Selection Sensei BFF route/schema test host exists.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z prompt red/golden test edit completed in `__tests__/selectionSensei.prompts.test.ts`. Added SHA/length golden tests for the old system prompt, standard toolbar prompt fixture, and ask-question prompt fixture, plus an intentional red destination check for future `@sensei/core/prompts/selectionSensei`.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z parser red/golden test edit completed in `__tests__/selectionSenseiResponseParser.test.ts`. Added current parser parity coverage for repaired JSON, loose/freeform extraction, malformed output, and an intentional red destination check for future `@sensei/core/selectionSensei` fenced-payload parsing.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z mobile routing sentinel red test added at `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`. The test names cover mobile toolbar bridge routing, mobile follow-up bridge routing with explicit modal context, bridge-missing fail-closed behavior for toolbar and follow-up, and desktop local/Core compatibility; expected current failure is missing `../src/selectionSenseiRouting`.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z BFF client red tests added in `__tests__/BffClient.test.ts`. The test names cover expected `BffClient.runSelectionSenseiModalMessage` structured route posting for toolbar/follow-up payloads and BFF rejection surfacing for prompt-string payloads; expected current failure is missing client method.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z BFF trust-boundary validation red test added at `bff/tests/selectionSenseiModal.validation.red.test.js`. The test covers old prompt-string payload rejection, non-LLM and arbitrary actions, prompt-control/provider-option/unknown key rejection, oversized selected text, oversized transcript entry/array/aggregate, and oversized overall structured input; expected current failure is missing BFF route returning 404 instead of schema rejection.
- [x] 2026-06-05T19:08:03Z - TURN-20260605T190803Z targeted root Jest validation run completed with expected red failure. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output size `1902` bytes; capped tail recorded missing `../src/selectionSenseiRouting` from `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`. Because `--bail` stopped on the first failing suite, prompt/Core-destination, parser/Core-destination, and BFF client method red checks are added but not yet reached by this command.
- [x] 2026-06-05T19:15:43Z - TURN-20260605T190803Z targeted BFF validation red test run completed with expected red failure. Command: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output size `1222` bytes; capped tail recorded `POST /sessions/:sessionId/selection-sensei/modal-message` returning `404 Cannot POST` where the red test expects `400` for old prompt-string payload rejection. This distinguishes missing route from future schema-validation failures.
- [x] 2026-06-05T19:16:10Z - TURN-20260605T190803Z `git diff --check` validation completed with exit `0` and no output.
- [x] 2026-06-05T19:16:30Z - TURN-20260605T190803Z a multi-section ExecPlan ledger patch failed because one trust-boundary sentence anchor did not exactly match the active file. Recovery: record this failure immediately, then split the ledger/classification updates into smaller anchored patches before continuing. No source or test files were touched by the failed patch.
- [x] 2026-06-05T19:18:30Z - TURN-20260605T190803Z final post-ledger validation completed. `git diff --check` exited `0`, final `git status --short --branch` shows only WDG-003 authorized test edits plus pre-existing dirty files/docs, and `git diff --cached --name-status` has no output.
- [x] 2026-06-05T19:20:20Z - TURN-20260605T190803Z individual targeted root Jest red-test runs completed for suites not reached by the combined `--bail` command. Prompt suite exited `1` with 5 passing golden/sans-Mermaid tests and expected missing `@sensei/core/prompts/selectionSensei`; parser suite exited `1` with 4 passing current parser parity tests and expected missing `@sensei/core/selectionSensei`; BFF client suite exited `1` with 6 existing tests passing and expected missing `client.runSelectionSenseiModalMessage`.
- [x] 2026-06-05T19:47:31Z - TURN-20260605T194731Z / WDG-003C-red-test-completeness-correction started. Refreshed required authority files, active ExecPlan, status/diff/cached baseline, and directly named source/test files before edits. Correction reason: watchdog audit found WDG-003 deferred authorable red tests too broadly for prompt action-instruction custody, current public WebView/mobile bridge direct-provider behavior, duplicate/in-flight behavior, and BFF trust-boundary cases. Allowed edit set is this ExecPlan, `__tests__/selectionSensei.prompts.test.ts`, `__tests__/selectionSensei.test.ts`, and `bff/tests/selectionSenseiModal.validation.red.test.js`.
- [x] 2026-06-05T19:47:31Z - TURN-20260605T194731Z initial dirty baseline captured. `git status --short --branch` has no staged files and shows WDG-003 test/doc files plus pre-existing dirty `.codex/skills/*`, `src/backup-file-manifest.json`, known-bugs/mission-state/prompts docs. New untracked `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md` is present but not touched and does not change WDG-003C scope.
- [x] 2026-06-05T19:47:31Z - TURN-20260605T194731Z prompt action-instruction custody tests added in `__tests__/selectionSensei.prompts.test.ts`. Added exact old-value coverage for `explainSimpler`, `explainWithAnalogy`, `explainInMoreDepth`, `showAnExample`, and `showExampleCodeSnippet` by checking the current inline `src/selectionSensei.ts` source strings, plus a future Core owner red test requiring `@sensei/core/prompts/selectionSensei` to export `SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS` and compatible builder behavior.
- [x] 2026-06-05T19:47:31Z - TURN-20260605T194731Z public WebView/mobile direct-provider red tests added in `__tests__/selectionSensei.test.ts`. Added mock-level spies for `@google/genai` chat creation and `sendMessage`, plus tests named `mobile bridge explainSimpler path does not create or use browser Selection Sensei chat`, `mobile bridge askQuestion path does not create or use browser Selection Sensei chat`, `mobile follow-up composer does not call browser Selection Sensei chat locally`, and `duplicate rapid mobile toolbar actions do not duplicate local provider work while pending`. Expected current failures are old behavior reaching `ensureSelectionChat`/`chat.sendMessage` and duplicate rapid toolbar invocations creating duplicate local provider work.
- [x] 2026-06-05T19:47:31Z - TURN-20260605T194731Z BFF trust-boundary missing negative cases added in `bff/tests/selectionSenseiModal.validation.red.test.js`. Added explicit rejection cases for `instruction`, `temperature`, arbitrary unknown client key, raw provider `history`, invalid modal transcript role, missing/empty `askQuestion.userQuestion`, non-ask stray `userQuestion`, missing/empty follow-up `question`, follow-up missing selected/context/initial action/initial response context, oversized `userQuestion`, oversized `actionLabel`, and oversized `initialResponse.explanation/rawText`.
- [x] 2026-06-05T19:52:28Z - TURN-20260605T194731Z targeted prompt test validation completed. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `1`; output size `988` bytes; expected red failures are missing `@sensei/core/prompts/selectionSensei` for both future Core prompt builder ownership and future Core action-instruction ownership. Current old SHA/action-instruction golden tests passed before the Core-owner failures.
- [x] 2026-06-05T19:52:28Z - TURN-20260605T194731Z targeted public WebView/mobile Selection Sensei validation completed. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`; exit `1`; output size `7940` bytes; expected red failures show mobile bridge `explainSimpler` and `askQuestion` paths create browser Selection Sensei chat, follow-up composer calls `sendMessage` locally, and duplicate rapid mobile toolbar actions call local provider twice while pending. Existing four tests passed and one todo remains.
- [x] 2026-06-05T19:52:28Z - TURN-20260605T194731Z targeted BFF validation command completed. Command: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output size `1224` bytes; expected red failure is missing Selection Sensei modal route returning `404 Cannot POST` before the expanded trust-boundary cases can be evaluated.
- [x] 2026-06-05T19:52:45Z - TURN-20260605T194731Z diff hygiene and staged-state validation completed. `git diff --check` exited `0` with no output; `git diff --cached --name-status` had no output. Final status shows only allowed WDG-003C files changed in this packet plus pre-existing dirty files/docs.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z / WDG-004-core-prompt-parser-custody started. Refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, this ExecPlan, current git status/diff/cached baseline, and directly named source/test files before source edits. Scope is custody-only: Core prompt/action owner plus Core parser/normalizer owner with WebView facades. BFF route/schema, RN bridge wiring, WebView mobile routing helper, BffClient method, provider execution, generated bundle, master-plan/trace updates, commits, pushes, and staging remain forbidden.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z pre-edit strategy recorded. Add `core/prompts/selectionSensei.ts` as the canonical owner of the system instruction, toolbar/ask prompt builders, and exact action-instruction map. Add `core/selectionSensei.ts` as the canonical owner of pure parser/normalizer logic and parser facade exports. Convert `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` to re-export/delegate to Core so existing WebView imports keep working without duplicate prompt/parser bodies. Update `src/selectionSensei.ts` only to import/delegate action instructions from Core-owned prompt helpers, preserving current direct-provider behavior until the later routing packet.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z package-export gate identified before source edits. `node_modules/@sensei/core` is a symlink to `core`, and Jest/Node resolve `@sensei/core/prompts/selectionSensei` and `@sensei/core/selectionSensei` through `core/package.json` subpath exports. WDG-004 normally allows only Core barrels, but the packet permits package/config edits if TypeScript/Jest proves the existing alias cannot import new modules. Decision: make a narrow `core/package.json` export-only edit if required so the custody tests can resolve the new Core modules; do not change dependencies or unrelated package metadata.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z live-document patch recovery recorded. A first WDG-004 progress update patch failed because it expected the WDG-003C start/validation lines to be adjacent, but the active ExecPlan contains additional WDG-003C entries between them. Recovery was to inspect the exact Progress anchors and apply a smaller patch after the WDG-003C diff-hygiene line. No source or test files were touched by the failed patch.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z Core prompt/action custody implementation completed before validation. Added `core/prompts/selectionSensei.ts` with verbatim Selection Sensei system prompt, toolbar prompt builder, ask prompt builder, exact non-ask action instruction map, instruction lookup helper, and toolbar prompt builder. Updated `src/prompts.ts` to delegate/re-export these Selection Sensei symbols from Core, updated `src/selectionSensei.ts` to remove inline action instruction strings and call the Core-owned facade helper, and updated `__tests__/selectionSensei.prompts.test.ts` so exact old action strings are asserted through the source facade plus Core owner instead of requiring old inline WebView ownership.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z Core parser/normalizer custody implementation completed before validation. Added `core/selectionSensei.ts` with the pure parser/normalizer logic moved from `src/selectionSenseiResponseParser.ts`, preserving strict JSON, JSON5, repaired JSON, repaired JSON5, loose field extraction, malformed `{}` behavior, optional parser logging, and adding fenced-payload stripping required by WDG-003. Converted `src/selectionSenseiResponseParser.ts` to a facade re-exporting the Core parser/types.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z Core export surface implementation completed before validation. Updated `core/prompts/index.ts` and `core/index.ts` barrels, and made the narrow `core/package.json` subpath export additions for `./selectionSensei` and `./prompts/selectionSensei`. `core/dist` is not tracked by git, so `npm run core:build` can be used as a scoped build step to refresh package-export targets for Jest without adding tracked generated files.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z scoped Core build completed. Command: `npm run core:build`; exit `0`; output size `127` bytes under a `12000` byte cap. This refreshed untracked Core `dist` outputs so package subpath imports resolve for targeted custody tests.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z prompt/action custody validation passed. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `0`; output size `484` bytes; result: 1 suite passed, 8 tests passed. This proves old prompt SHA/length parity, source facade action-instruction old values, Core prompt builder exports, and Core action-instruction map/builder custody for WDG-004.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z parser custody validation passed. Command: `npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`; exit `0`; output size `496` bytes; result: 1 suite passed, 5 tests passed. This proves the source parser facade and future Core owner import now use Core parser/normalizer behavior, including JSON5, repaired/loose/malformed behavior, and fenced-payload support.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z public Selection Sensei suite remained red for expected later-packet reasons. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`; exit `1`; output size `7869` bytes; result: 4 failed, 4 passed, 1 todo. Expected WDG-004 failures remain public mobile toolbar/ask creating browser Selection Sensei chat, public follow-up composer calling local `sendMessage`, and duplicate rapid mobile toolbar actions calling local provider twice. No new failure reason or scope contradiction was introduced by prompt/parser custody.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z routing/BffClient combined red command completed with expected missing routing helper. Command: `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output size `1812` bytes. Expected WDG-004 failure: `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` cannot find `../src/selectionSenseiRouting`, so `--bail` stops before BffClient route-method tests.
- [x] 2026-06-05T20:04:03Z - TURN-20260605T200403Z individual BffClient red command completed for evidence not reached by combined `--bail`. Command: `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output size `821` bytes; result: 2 expected Selection Sensei tests fail with `client.runSelectionSenseiModalMessage is not a function`, while 6 existing BffClient tests pass.
- [x] 2026-06-05T20:11:09Z - TURN-20260605T200403Z BFF validation red command completed with expected missing route. Command: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output size `1224` bytes. Expected WDG-004 failure: `POST /sessions/:sessionId/selection-sensei/modal-message` returns `404 Cannot POST` before BFF schema validation exists.
- [x] 2026-06-05T20:11:09Z - TURN-20260605T200403Z final diff hygiene and staged-state validation completed. `git diff --check` exited `0`; final `git status --short --branch` and `git diff --name-status` show WDG-004 custody files plus pre-existing dirty files from earlier packets; `git diff --cached --name-status` had no output. No files were staged.
- [x] 2026-06-05T20:25:19Z - TURN-20260605T202519Z / WDG-004C-core-dependency-and-protocol-ledger-correction started. Refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, this ExecPlan, `core/package.json`, relevant root and BFF `package-lock.json` metadata, current git status/diff/cached state, and `core/selectionSensei.ts` to confirm the `json5` import. This correction is limited to Core dependency metadata, lock metadata if required, and WDG-004 protocol-ledger repair; no feature implementation, BFF/RN/WebView routing, provider execution, source behavior change, test edit, bundle, commit, push, stage, reset, checkout, or cleanup is authorized.
- [x] 2026-06-05T20:25:19Z - TURN-20260605T202519Z dependency metadata correction applied. Added `dependencies.json5` with version range `^2.2.3` to `core/package.json`, root `package-lock.json` `packages.core`, and BFF `package-lock.json` `packages["../core"]`. No package install command, lifecycle script, broad dependency update, or `core/package-lock.json` creation was used; the edit only mirrors the linked Core package runtime dependency needed by `core/selectionSensei.ts`.
- [x] 2026-06-05T20:25:19Z - TURN-20260605T202519Z validation completed. `npm run core:build`, Core dependency check, root/BFF lock metadata check, prompt custody Jest suite, parser custody Jest suite, and `git diff --check` all exited `0`; final `git diff --cached --name-status` had no output. No mobile/BFF/routing red tests were rerun because WDG-004C changed only dependency metadata and protocol ledger coverage.
- [x] 2026-06-05T20:36:51Z - TURN-20260605T203651Z / WDG-005-core-modal-capability-provider-boundary started. Targeted refresh completed for active ExecPlan Milestone 1 / Phase 10 / Test Gate / Runtime Routing / WDG-004C outcome sections, `core/selectionSensei.ts`, `core/prompts/selectionSensei.ts`, `core/modelUsage.ts`, `core/browserLlmClient.ts`, `core/llmTypes.ts`, existing prompt/parser tests, Core capability examples, and current git status/diff/cached state. This packet is limited to the Core modal capability seam, Core follow-up prompt/context support, Selection Sensei model config/browser task routing, and focused Core tests; BFF/RN/WebView routing and direct-provider removal from `src/selectionSensei.ts` remain forbidden.
- [x] 2026-06-05T20:36:51Z - TURN-20260605T203651Z focused Core capability/provider-boundary tests added before Core source implementation. New test file `__tests__/selectionSenseiCoreModal.test.ts` covers toolbar mode task invocation/parsing, ask-question prompt path, explicit stateless follow-up context prompt construction, null LLM deterministic failure, non-LLM action rejection, forbidden prompt/provider-control field rejection before provider execution, malformed provider output normalization through the tolerant parser, and browser Core client task routing for `selection_sensei_modal`.
- [x] 2026-06-05T20:36:51Z - TURN-20260605T203651Z Core modal capability seam implemented. `core/prompts/selectionSensei.ts` now includes `buildSelectionSenseiFollowUpPrompt` and explicit modal-context prompt types. `core/selectionSensei.ts` now exports discriminated modal request/result types and `runSelectionSenseiModalMessage`, validates forbidden prompt/provider-control keys and non-LLM actions before provider execution, calls only the injected `CoreLlmClient` with task `selection_sensei_modal`, and normalizes provider text through the existing Core parser. `core/modelUsage.ts` now owns `SELECTION_SENSEI_MODAL_CONFIG`, and `core/browserLlmClient.ts` maps task `selection_sensei_modal` to the JSON/temperature config. No BFF, RN, WebView routing, `BffClient`, generated bundle, `src/selectionSensei.ts`, trace, or master-plan files were edited.
- [x] 2026-06-05T20:41:49Z - TURN-20260605T203651Z validation completed. `npm run core:build` exited `0`; combined prompt/parser/Core modal test command exited `0` with 3 suites and 20 tests passed; `__tests__/selectionSensei.test.ts` remained red for expected public mobile direct-provider/duplicate-provider failures; `__tests__/BffClient.test.ts` remained red for expected missing `client.runSelectionSenseiModalMessage`; BFF validation remained red for expected missing route `404`; `git diff --check` exited `0`; `git diff --cached --name-status` had no output.
- [x] 2026-06-05T20:51:57Z - TURN-20260605T205157Z / WDG-005C-core-modal-boundary-correction started. Targeted refresh completed for the active ExecPlan WDG-005 sections, `core/selectionSensei.ts`, `core/prompts/selectionSensei.ts`, `__tests__/selectionSenseiCoreModal.test.ts`, prompt custody/control sections in the LLM migration protocol and master plan, and current git status/diff/cached state. The refresh confirmed WDG-005 delivered mode-specific user prompts through `llm.callText` but did not include the Core-owned Selection Sensei system instruction in the actual provider-bound string.
- [x] 2026-06-05T20:51:57Z - TURN-20260605T205157Z correction-first Core tests updated before Core source repair. `__tests__/selectionSenseiCoreModal.test.ts` now asserts provider-bound toolbar/ask/follow-up calls include `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, rejects every declared forbidden/control field before any LLM call, rejects `addToNotepad`, `copy`, and `share`, and rejects follow-up requests missing explicit `initialAction.actionType`, `initialAction.actionLabel`, or nonempty initial response content.
- [x] 2026-06-05T20:51:57Z - TURN-20260605T205157Z Core modal boundary repaired. `core/selectionSensei.ts` now builds the actual provider-bound prompt by combining Core-owned `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` with the mode-specific Core user prompt before calling `llm.callText`. Runtime forbidden-field validation now includes `message`, `config`, `tools`, `requestId`, and `chat` in addition to the prior prompt/provider controls, and follow-up validation now requires explicit initial action type/label plus nonempty initial response content. No `CoreLlmClient` interface, BFF, RN, WebView, `BffClient`, `src/selectionSensei.ts`, generated bundle, trace, or master-plan files were edited.
- [x] 2026-06-05T20:56:22Z - TURN-20260605T205157Z validation completed. Core build exited `0`; combined prompt/parser/Core modal command exited `0` with 21 tests passed; public Selection Sensei suite remained red for expected direct-provider/duplicate-provider failures; BffClient remained red for expected missing `runSelectionSenseiModalMessage`; BFF validation remained red for expected route `404`; `git diff --check` exited `0`; `git diff --cached --name-status` had no output.
- [x] 2026-06-05T21:06:46Z - TURN-20260605T210646Z / WDG-006-bff-selection-sensei-modal-route-schema started. Targeted refresh completed for WDG-005C outcome, BFF schema/trust-boundary sections, current BFF validation red test, `bff/src/server.js`, `bff/src/container.js`, `bff/src/integration/coreLlmAdapter.js`, `bff/src/integration/geminiGateway.js`, `bff/src/config/modelUsage.js`, route/controller/service patterns, and current git status/diff/cached state. Scope is BFF-only: add Selection Sensei modal route/schema/service and server Gemini task routing; `BffClient`, RN bridge, WebView routing, `src/selectionSensei.ts` direct-provider removal, generated bundle, trace, and master-plan files remain forbidden.
- [x] 2026-06-05T21:06:46Z - TURN-20260605T210646Z BFF route/schema/service implementation checkpoint. Added Selection Sensei modal service using `CoreLlmAdapter` and `runSelectionSenseiModalMessage`, strict controller validation/translation for toolbar and follow-up payloads, mounted `POST /sessions/:sessionId/selection-sensei/modal-message`, added BFF Selection Sensei modal model config, and routed Gemini task `selection_sensei_modal` to that config. No BffClient, RN, WebView, `src/`, generated bundle, trace, or master-plan files were edited.
- [x] 2026-06-05T21:06:46Z - TURN-20260605T210646Z deterministic BFF evidence added. New `bff/tests/selectionSenseiModal.service.test.js` uses a fake Core LLM client to prove the BFF service reaches Core modal execution and returns structured success without client prompt strings, verifies follow-up payload translation maps BFF `sensei` transcript entries to Core `assistant` entries while dropping `modalConversationId` from Core prompt input, and verifies `GeminiGateway.callText` routes `selection_sensei_modal` through JSON/temperature/model config rather than main-response config.
- [x] 2026-06-05T21:06:46Z - TURN-20260605T210646Z first BFF validation run failed before exercising route behavior. Command: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output size `1173` bytes. Failure: `z.discriminatedUnion` cannot consume the `superRefine`-wrapped toolbar/follow-up schemas and threw `Cannot read properties of undefined (reading 'mode')` at controller module load. Repair: keep strict branch schemas and switch the modal schema to `z.union` plus existing refinements.
- [x] 2026-06-05T21:12:07Z - TURN-20260605T210646Z validation completed. Core build exited `0`; combined prompt/parser/Core modal command exited `0` with 21 tests passed; BFF validation command exited `0` and now passes by structured `400`/`413` validation instead of route `404`; BFF service/model-routing command exited `0`; BffClient suite remained red for expected missing `runSelectionSenseiModalMessage`; public Selection Sensei suite remained red for expected direct-provider/duplicate-provider failures; `git diff --check` exited `0`; `git diff --cached --name-status` had no output.
- [x] 2026-06-05T21:22:53Z - TURN-20260605T212253Z / WDG-007-bffclient-selection-sensei-modal-transport started. Targeted refresh completed for the WDG-006 outcome, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts`, Selection Sensei cases in `__tests__/BffClient.test.ts`, WDG-006 BFF controller route shape, and current git status/diff/cached state. Scope is BffClient transport only; RN bridge contracts, MainScreen, WebView routing helper, public direct-provider removal, BFF/Core source, generated bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, and cleanup remain forbidden.
- [x] 2026-06-05T21:22:53Z - TURN-20260605T212253Z BffClient transport implementation checkpoint. Added `SelectionSenseiModalMessagePayload` and `SelectionSenseiModalMessageResult` network types, added `BffClientLike.runSelectionSenseiModalMessage`, and implemented `BffClient.runSelectionSenseiModalMessage` as a structured JSON POST to `/sessions/:sessionId/selection-sensei/modal-message` with existing unknown-session retry and `formatHttpError` rejection surfacing. No prompt strings, provider controls, RN bridge, WebView routing, BFF/Core source, generated bundle, trace, or master-plan files were edited.
- [x] 2026-06-05T21:24:32Z - TURN-20260605T212253Z validation completed. `__tests__/BffClient.test.ts` exited `0` with 8 tests passed; BFF validation and service/model tests remained green; public Selection Sensei suite remained red for expected direct-provider and duplicate-provider failures; `git diff --check` exited `0`; `git diff --cached --name-status` had no output. Focused status shows WDG-007-owned network files plus pre-existing modified `__tests__/BffClient.test.ts` from earlier red-test packets; the test file was not edited in WDG-007.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z / WDG-008-rn-selection-sensei-modal-bridge-transport started. Targeted refresh completed for the WDG-007 outcome, RN bridge contracts, MainScreen WebView message dispatch, Selection Sensei modal network types/client method, existing MainScreen/BffClient tests, and current status/staged state. Scope is RN bridge/MainScreen transport only: add request/result bridge contracts, dispatch to `BffClient.runSelectionSenseiModalMessage`, enqueue structured result/error, and add focused RN bridge/MainScreen evidence. WebView routing helper, public direct-provider removal, duplicate WebView route guard, generated bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, and cleanup remain forbidden.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z live-document patch recovery recorded. A first WDG-008 ExecPlan start patch failed because it used a paraphrased WDG-007 Decision Log anchor that did not exactly match the active file. Recovery was to inspect exact anchors and apply smaller patches before any source or test edit. No source, test, BFF, RN, WebView, generated, trace, master-plan, staging, commit, push, reset, checkout, or cleanup action occurred before this was recorded.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z RN bridge implementation checkpoint. `SenseiMobile/src/mobile/bridge/contracts.ts` now includes `selectionSensei:modalMessageRequest` and `selectionSensei:modalMessageResult` typed with the WDG-007 Selection Sensei modal payload/result shapes. `SenseiMobile/src/mobile/MainScreen.tsx` now handles the request by calling `bffClient.runSelectionSenseiModalMessage(parsed.payload)` and enqueuing a matching structured success or fixed safe-error result. No prompt construction, parser logic, provider config, BFF/Core source, WebView routing helper, public direct-provider removal, generated bundle, trace, or master-plan edit was made.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z focused RN bridge/MainScreen test added. New `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` asserts the request/result bridge contracts use the shared Selection Sensei modal payload/result types, the payload union supports toolbar and follow-up modes, MainScreen passes `parsed.payload` to `BffClient.runSelectionSenseiModalMessage` without prompt/provider ownership, and the failure result uses a fixed safe error string without echoing arbitrary error messages.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z focused RN bridge/MainScreen validation passed. `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace` exited `0`; output size 497 bytes; 1 suite and 3 tests passed.
- [x] 2026-06-05T21:35:20Z - TURN-20260605T213520Z BffClient regression validation passed. `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace` exited `0`; output size 456 bytes; 1 suite and 8 tests passed. This confirms WDG-008 did not regress the WDG-007 transport seam.
- [x] 2026-06-05T21:39:05Z - TURN-20260605T213520Z BFF validation regression passed. `cd bff && node tests/selectionSenseiModal.validation.red.test.js` exited `0`; output size 7505 bytes under a 12000 byte cap; route validation still rejects invalid Selection Sensei modal payloads with structured `400`/`413` responses.
- [x] 2026-06-05T21:39:05Z - TURN-20260605T213520Z BFF service/model-routing regression passed. `cd bff && node tests/selectionSenseiModal.service.test.js` exited `0`; output size 57 bytes; deterministic service/Core handoff and Gemini task config evidence remain green.
- [x] 2026-06-05T21:39:05Z - TURN-20260605T213520Z mobile routing sentinel remained red for expected later WebView seam. `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `1`; output size 1764 bytes; all five tests fail because `../src/selectionSenseiRouting` is still missing. This is expected because WDG-008 is RN-only and did not implement WebView routing helper, bridge-missing fail-closed behavior, or desktop compatibility helper.
- [x] 2026-06-05T21:39:05Z - TURN-20260605T213520Z public Selection Sensei suite remained red for expected later WebView/provider-removal seam. `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace` exited `1`; output size 7869 bytes; the four failing tests are the expected public mobile toolbar/ask/follow-up direct-provider and duplicate local-provider sentinels. No new failure reason or RN bridge scope contradiction was introduced by WDG-008.
- [x] 2026-06-05T21:39:05Z - TURN-20260605T213520Z final diff hygiene and staged-state validation completed. `git diff --check` exited `0`; `git diff --cached --name-status` had no output. Focused WDG-008 status shows the active ExecPlan, `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, and new `__tests__/MainScreen.selectionSenseiModalBridge.test.ts`; `SenseiMobile/src/mobile/network/types.ts` remains a pre-existing WDG-007 modified file and was not edited in WDG-008.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z / WDG-008C-rn-type-ownership-and-execplan-repair started. Targeted refresh completed for WDG-008 outcome, `Outcomes & Retrospective`, bridge contracts, network types, MainScreen branch, focused RN bridge test, current diff summary, and staged state. Audit finding confirmed: WDG-008 introduced a type-only bridge/network cycle by importing Selection Sensei modal payload/result types from `../network/types` into `bridge/contracts.ts` while `network/types.ts` already imports bridge contract types; this was noted in chat but not recorded as a type-location decision. Scope is correction-only: repair type ownership direction and stale ExecPlan outcome text without WebView routing, provider removal, generated bundle, trace/master-plan, commit, push, staging, reset, checkout, or cleanup.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z type ownership repair applied. `SenseiMobile/src/mobile/bridge/contracts.ts` now owns `SelectionSenseiToolbarActionType`, `SelectionSenseiInitialResponsePayload`, `SelectionSenseiModalTranscriptEntryPayload`, `SelectionSenseiModalMessagePayload`, and `SelectionSenseiModalMessageResult`, and no longer imports from `../network/types`. `SenseiMobile/src/mobile/network/types.ts` imports/re-exports the modal payload/result types from bridge contracts, preserving `BffClientLike.runSelectionSenseiModalMessage` and the existing BffClient implementation behavior. MainScreen runtime behavior is unchanged.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z focused RN bridge test assertions adjusted for the repair. `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` now asserts bridge contracts do not import from `../network/types`, bridge contracts own toolbar/follow-up modal payload mode definitions, and network types import/re-export the shared modal payload/result types from bridge contracts while preserving the existing opaque MainScreen dispatch and fixed safe-error checks.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z focused RN bridge validation passed after type ownership repair. `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace` exited `0`; output size 511 bytes; 1 suite and 3 tests passed.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z BffClient validation passed after type re-export repair. `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace` exited `0`; output size 455 bytes; 1 suite and 8 tests passed. This confirms the bridge-owned modal payload/result types remain available through `SenseiMobile/src/mobile/network/types.ts`.
- [x] 2026-06-05T21:47:30Z - TURN-20260605T214730Z diff hygiene and staged-state validation passed. `git diff --check` exited `0`; `git diff --cached --name-status` had no output. Focused status shows WDG-008C-owned changes in the active ExecPlan, bridge contracts, network types, and focused RN bridge test; MainScreen and BffClient test files remain pre-existing modified files from earlier packets and were not edited in WDG-008C.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z / WDG-009-webview-selection-sensei-modal-routing-provider-removal started. Targeted refresh completed for WDG-008C outcome, Runtime Routing Plan, Boundary/Test ledgers, `src/selectionSensei.ts`, `src/mobile/webviewBridge.ts`, `src/mobile/webviewMessageRouter.ts`, `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`, `__tests__/selectionSensei.test.ts`, and staged state. Current direct-provider violation remains `src/selectionSensei.ts`: `handleToolbarAction` and `dispatchFollowupToAI` call `ensureSelectionChat`/`chat.sendMessage`; WebView bridge lacks Selection Sensei modal request/result resolver and `sendToNative` has no fail-closed send result.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z WebView bridge/routing helper checkpoint. Added `src/selectionSenseiRouting.ts` with mobile bridge vs desktop local routing and fail-closed missing-bridge behavior. Updated `src/mobile/webviewBridge.ts` so `sendToNative` returns a boolean send result. Updated `src/mobile/webviewMessageRouter.ts` with `requestSelectionSenseiModalMessageViaBridge`, request IDs, timeout, bridge-missing rejection, and `selectionSensei:modalMessageResult` resolver handling. No RN/BFF/Core/WebView bundle/trace/master-plan files were edited.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z patch recovery recorded. A large `handleToolbarAction` replacement patch failed because the method context no longer matched after earlier WDG-009 edits. Recovery is to inspect the exact method body and apply a smaller anchored replacement before continuing. No additional source files were changed by the failed patch.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z WebView routing boundary checkpoint. `src/selectionSenseiRouting.ts` now rejects non-LLM Selection Sensei toolbar actions before bridge or local generation, so `addToNotepad`, `copy`, `share`, or arbitrary action values cannot be routed as modal LLM payloads through this helper. Public Selection Sensei handling still keeps non-LLM actions local.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 test update checkpoint. `__tests__/selectionSensei.test.ts` now drives the public mobile bridge toolbar, ask-question, follow-up composer, and duplicate rapid toolbar paths through captured `selectionSensei:modalMessageRequest` messages and resolves them with `selectionSensei:modalMessageResult`; assertions verify structured payload fields, omitted prompt/provider controls, and no browser Gemini chat use. `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` now checks the full forbidden field set and helper-level rejection for non-LLM toolbar actions.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z validation wrapper failure recorded before repair. The first capped command wrapper for `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `1` before running Jest because it assigned to zsh's read-only `status` variable. Recovery is to rerun the same command with a non-reserved shell variable name; no source or test change was made for this wrapper failure.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z routing-helper validation passed. `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `0`; output size 637 bytes; 1 suite and 6 tests passed. This turns the focused mobile routing helper gate green for bridge-present toolbar/follow-up, bridge-missing fail-closed, desktop local compatibility, forbidden-field omission, and non-LLM rejection.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z public Selection Sensei validation passed. `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace` exited `0`; output size 595 bytes; 1 suite passed with 8 tests passed and 1 pre-existing todo. The mobile bridge toolbar, ask-question, follow-up composer, and duplicate rapid toolbar paths now use structured bridge requests/results and do not create or use browser Selection Sensei chat locally.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z RN bridge contract regression validation passed after WebView result resolver changes. `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace` exited `0`; output size 501 bytes; 1 suite and 3 tests passed.
- [x] 2026-06-05T21:57:52Z - TURN-20260605T215752Z focused direct-provider static check classified. `rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessage\\(|ensureSelectionChat|requestSelectionSenseiModalMessage|requestSelectionSenseiModalMessageViaBridge|__SENSEI_MOBILE_BUILD__" src/selectionSensei.ts src/selectionSenseiRouting.ts src/mobile/webviewBridge.ts src/mobile/webviewMessageRouter.ts` exited `0`. Hits show `src/selectionSensei.ts` still imports/owns browser `GoogleGenAI`/`Chat`, `ensureSelectionChat`, and `chat.sendMessage` for the preserved desktop local generator path, while mobile toolbar/follow-up call `requestSelectionSenseiModalMessage` with `requestSelectionSenseiModalMessageViaBridge`; focused public tests prove the mobile path does not create or use the browser chat.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z / WDG-009C-webview-bridge-failclosed-test-repair started. Targeted refresh completed for WDG-009 ExecPlan state, `src/mobile/webviewBridge.ts`, `src/mobile/webviewMessageRouter.ts`, `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`, `__tests__/selectionSensei.test.ts`, and current status/diff/cached state. Finding confirmed: `resolvePostMessage` refreshes `postMessageFn` when a valid native channel exists, but does not clear the cached sender when `window.ReactNativeWebView` is removed or replaced by a non-callable channel.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z WebView bridge sender repair applied. `src/mobile/webviewBridge.ts:resolvePostMessage` now sets `postMessageFn = null` when the current `window.ReactNativeWebView?.postMessage` is absent or not callable, so `sendToNative` reflects current bridge availability instead of reusing stale cached transport.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z focused bridge sender fail-closed tests added. New `__tests__/webviewBridge.failClosed.test.ts` exercises `sendToNative` with no native bridge and with a previously valid bridge that is then removed or replaced by non-callable `postMessage`, proving stale cached transport is not reused.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z public non-LLM action tests strengthened. `__tests__/selectionSensei.test.ts` now asserts `addToNotepad`, `copy`, and `share` remain local public WebView actions, emit no `selectionSensei:modalMessageRequest`, and do not create/use browser Selection Sensei chat.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z bridge sender validation passed. `npm test -- --runTestsByPath __tests__/webviewBridge.failClosed.test.ts --silent --bail --noStackTrace` exited `0`; output size 581 bytes; 1 suite and 2 tests passed.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z routing-helper regression validation passed. `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `0`; output size 633 bytes; 1 suite and 6 tests passed.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z public Selection Sensei regression validation passed. `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace` exited `0`; output size 593 bytes; 1 suite passed with 9 tests passed and 1 pre-existing todo. This covers mobile modal bridge routing plus local-only `addToNotepad`, `copy`, and `share` actions.
- [x] 2026-06-05T22:18:44Z - TURN-20260605T221844Z diff hygiene and staged-state validation passed. `git diff --check` exited `0`; `git diff --cached --name-status` had no output. WDG-009C-owned file changes are limited to the active ExecPlan, `src/mobile/webviewBridge.ts`, `__tests__/selectionSensei.test.ts`, and new `__tests__/webviewBridge.failClosed.test.ts`.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z / WDG-010-final-bundle-sweep-status started. Targeted refresh completed for current ExecPlan final status, `docs/llm_entry_exit_traces.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, current status/diff/cached state, and packet-relevant Selection Sensei status rows. Finding: master-plan inventory and trace doc still describe Selection Sensei toolbar/follow-up as not migrated/old direct provider paths; WDG-010 will update them only to the level proven by bundle, final sweep, and selected validation.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z WebView bundle validation passed. `npm run webview:bundle` exited `0`; output size 1434 bytes. It ran `core:build`, `protocol:build`, bundled `src/index.tsx` to `SenseiMobile/app_web/webview_dist/index.js`, and copied `index.css`, `index.html`, and `Modules.txt`. Focused generated status/diff checks showed no tracked diff under `SenseiMobile/app_web/webview_dist`.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z final provider/routing static sweep completed and classified. Source and generated bundle searches found the Selection Sensei structured bridge request/result path in generated output and confirmed the mobile branch calls `requestSelectionSenseiModalMessageViaBridge`; remaining `ensureSelectionChat`, `Chat`, and `chat.sendMessage` hits in `src/selectionSensei.ts` and generated `index.js` are the preserved desktop-local compatibility generator, not the mobile route. BFF `GeminiGateway` provider hits remain expected server-owned execution.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z prompt/parser custody static sweep completed and classified. Authored prompt/action text is owned by `core/prompts/selectionSensei.ts`; authored parser/normalizer behavior is owned by `core/selectionSensei.ts`; `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` are facades; generated bundle copies of those Core/source facades are expected bundle output rather than new WebView/BFF/RN ownership.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z focused root Jest aggregate passed. `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSenseiCoreModal.test.ts __tests__/BffClient.test.ts __tests__/MainScreen.selectionSenseiModalBridge.test.ts __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/webviewBridge.failClosed.test.ts __tests__/selectionSensei.test.ts --silent --bail --noStackTrace` exited `0`; output size 1145 bytes; 8 suites passed with 49 tests passed and 1 pre-existing todo.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z BFF and Core final validation passed. `node bff/tests/selectionSenseiModal.validation.red.test.js` exited `0` with structured 400/413 rejection evidence; `node bff/tests/selectionSenseiModal.service.test.js` exited `0`; `npm run core:build` exited `0`. These confirm BFF schema/service/model routing and Core build remain green after bundle/sweep.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z status documents updated to the proven evidence level. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` now marks only the unified Selection Sensei toolbar/follow-up modal flow complete and leaves enhancement, key takeaway enhancement, and pedagogical directive generation as remaining backlog. `docs/llm_entry_exit_traces.md` now records the Selection Sensei modal bridge/BFF/Core path plus desktop-local `ensureSelectionChat` compatibility classification.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z final diff hygiene and staged-state validation passed. `git diff --check` exited `0`; `git diff --cached --name-status` had no output. Focused diff/status checks show WDG-010 changed only the allowed docs/ExecPlan, and `npm run webview:bundle` left no tracked generated WebView diff.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z ExecPlan patch-context mismatch recorded. A multi-section ledger patch failed because the patch context mistyped the existing Trust-Boundary Schema Plan status line. Recovery is to apply smaller anchored edits; no source, test, generated, trace, or master-plan content changed because of the failed patch.
- [x] 2026-06-05T22:27:30Z - TURN-20260605T222730Z final stale-status and post-ledger hygiene checks passed. Targeted status-doc scan found no stale Selection Sensei "not implemented" wording; matches are the new completed rows and current validation note. Final `git diff --check` exited `0`, final `git diff --cached --name-status` had no output, and focused status/diff show only the active ExecPlan plus the two allowed status docs changed by WDG-010; generated bundle and Jest report paths had no focused tracked diff.
- [x] 2026-06-05T22:44:20Z - TURN-20260605T224420Z / WDG-010C-execplan-final-state-repair started and completed. Watchdog audit found current-state contradictions: the top implementation status still said bundle/final sweep/status pending, Scope Lock and Capability Matrix still said `NOT_STARTED`, and Red-Test Gate still said generated bundle/final sweep/status/final provider evidence remained pending. This correction repaired those current-state fields only, preserving historical packet records and the explicit caveat that live provider smoke was not run in WDG-010.
- [x] 2026-06-05T22:44:20Z - TURN-20260605T224420Z targeted stale-status scan completed. Remaining hits are classified as historical WDG-009/WDG-009C packet records, WDG-010C's own repair description, the Review Remediation Ledger `Status: NOT_STARTED` because no review artifact exists, or a current positive Test Gate line saying final sweep/status is complete. No still-stale current-state contradiction remains.
- [x] 2026-06-05T22:44:20Z - TURN-20260605T224420Z ExecPlan note patch-context mismatch recorded. A multi-section validation/artifact/revision note patch failed because the revision-note context did not match the current file exactly. Recovery is to apply smaller anchored inserts; no source, test, generated, trace, master-plan, known-bugs, or package file changed because of the failed patch.
- [x] Before future source edits - Run repository-required Core Analysis Protocol for this expanded planning scope. Baseline and focused analyzer runs were completed on 2026-06-05. Future implementation must rerun analysis after source changes or if scope changes again.
- [ ] Implementation milestone 1 - Create Core prompt/capability/parser surface and parity tests.
- [x] Implementation milestone 2 - Create BFF route/controller/service/config validation and deterministic route tests. Completed by TURN-20260605T210646Z for BFF route/schema/service and deterministic service/model-routing evidence; route rate limiting remains deferred because WDG-006 allowed files did not include BFF config/index rate-limit wiring.
- [x] Implementation milestone 3 - Add RN/WebView bridge request/result transport and mobile routing gate sentinel tests. RN bridge transport completed by TURN-20260605T213520Z; WebView routing/helper tests completed by TURN-20260605T215752Z.
- [x] Implementation milestone 4 - Refactor `src/selectionSensei.ts:handleToolbarAction` and `src/selectionSensei.ts:dispatchFollowupToAI` to call the new modal-flow routing helper while preserving WebView UI/modal behavior. Completed by TURN-20260605T215752Z for mobile routing/provider removal; desktop local compatibility remains intentionally preserved.
- [x] Implementation milestone 5 - Run validation commands, update this plan with exact results, and leave remaining review/acceptance evidence. Completed by TURN-20260605T222730Z for the unified Selection Sensei toolbar/follow-up modal flow; remaining work is watchdog audit and any explicitly authorized commit/review packet.

## Surprises & Discoveries

- `src/selectionSensei.ts:handleToolbarAction` is the initial modal LLM entry and still owns prompt assembly, direct Gemini chat creation through `ensureSelectionChat`, provider call through `chat.sendMessage`, response fence stripping, parser invocation, UI modal content strategy, and provider error mapping.
- `src/selectionSensei.ts:dispatchFollowupToAI` is now in scope as the follow-up modal LLM entry. It shares the same `selectionChat`, parser wrapper, modal token, modal transcript, and composer state with toolbar actions. Migrating the two paths together removes both related direct-provider paths and avoids a modal conversation UX regression.
- The existing provider chat implicitly preserves the initial toolbar prompt/response as hidden provider history for later follow-up calls. The migrated Core/BFF path must replace that hidden provider history with an explicit structured modal conversation context, such as selected text, original Sensei context, initial action metadata, initial response, current follow-up question, and a bounded modal transcript.
- `src/selectionSenseiResponseParser.ts` is pure parsing/normalization code except for optional logger callbacks. It is a strong Core migration candidate.
- `src/selectionSensei.ts:formatFollowupAnswer`, `updateResponseModalContentAndTitle`, and `normalizeMermaidCodeBlocks` are WebView presentation/rendering behavior and must not move to BFF/Core.
- Mobile native selection currently sends only `selectionSensei:invoke` from RN to WebView. That message triggers WebView `handleToolbarAction`; it does not call BFF and does not create a WebView-to-RN LLM request.
- `src/mobile/webviewBridge.ts:sendToNative` silently returns when `ReactNativeWebView.postMessage` is missing. The migrated Selection Sensei routing helper needs an explicit fail-closed mobile result so a mobile WebView cannot fall back to browser provider execution.
- Existing mobile routing sentinels for teaching plan and learner analysis show the preferred route-gate pattern: small WebView routing module, mobile calls bridge, desktop calls local Core/browser path.
- Existing BFF unary LLM tools use a route/controller/service pattern with session lookup, Zod validation, capability-specific rate limiting, and `CoreLlmAdapter`.
- `core/browserLlmClient.ts` and `bff/src/integration/geminiGateway.js` task config switches do not currently include a Selection Sensei task. Without a new task branch, Selection Sensei would fall back to main response config and lose `responseMimeType: "application/json"` plus temperature parity.
- Baseline analyzer run completed after the user explicitly allowed Core Analysis Protocol. Full-snapshot hotspots named `src/selectionSensei.ts::cleanup`, `getDOMElements`, `setModalFullscreen`, `resetModalState`, `updateResponseModalContentAndTitle`, and `showResponseModalWithLoading` as relevant side-effect-heavy modal functions.
- Focused toolbar trace: `handleToolbarAction` reaches `resetModalState`, `showResponseModalWithLoading`, `setComposerEnabled`, `hideSelectionToolbar`, both Selection Sensei user prompt builders, `ensureSelectionChat`, `extractContentWithRegex`, `updateResponseModalContentAndTitle`, and parser helpers.
- Focused follow-up trace: `dispatchFollowupToAI` reaches `generateModalMessageId`, `appendModalMessage`, `setComposerEnabled`, `ensureSelectionChat`, `formatFollowupAnswer`, `extractContentWithRegex`, and parser helpers.
- Prompt parity fixture captured for this planning pass:
  - `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`: length `2878`, SHA-256 `56dc75df6fa8d62e55a3d7bb64908d8c343282918d58714cc508d97c7481ec12`.
  - `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION` sample fixture `original='Original explanation about recursion and base cases.'`, `selected='base case stops recursion'`, `instruction='Explain the 'SELECTED TEXT' in a simpler way, suitable for a beginner who might be finding it complex.'`, `label='Simpler'`: length `919`, SHA-256 `213c6ccbb969b1c220c8f8818a4257e194486bf38d100513e1892556a4aa1698`.
  - `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION` sample fixture `original='Original explanation about recursion and base cases.'`, `selected='base case stops recursion'`, `question='Why does the base case need to come before the recursive call?'`, `label='Ask'`: length `823`, SHA-256 `688ab5ee7e3ba010e9a2738d4049859862784295c6b0f38174e23387ab9c8c7c`.
- TURN-20260605T182838Z - Fresh direct-provider sweep found no new Selection Sensei sibling path and no contradiction to the accepted unified modal scope. The only in-scope violating provider path remains `src/selectionSensei.ts` for `ensureSelectionChat`, `handleToolbarAction`, and `dispatchFollowupToAI`; other hits are classified in the Direct Provider Authority Sweep as expected Core/BFF provider infrastructure, desktop compatibility, unrelated backlog surfaces, test-only mocks, ancillary/debug/manual provider surfaces, or false positives.
- TURN-20260605T183746Z - WDG-002C correction: a WDG-002 `apply_patch` attempt failed because it expected a discovery-note line that was not present in the active ExecPlan. Evidence from the worker chat: "The first patch did not apply because one assumed discovery note was not present in the file. I’m splitting the ExecPlan update into smaller, anchored edits so the ledger stays current without touching unrelated content." Recovery was to inspect nearby anchors and apply smaller patches; subsequent WDG-002 ExecPlan updates succeeded. This was a live-document/process surprise, not a source-code failure, and it did not touch source/test files or alter the unified Selection Sensei modal scope.
- TURN-20260605T183746Z - WDG-002C current-turn discovery: the first correction patch also failed from a context mismatch because the expected progress-line anchor did not exactly match the active ExecPlan. Recovery was the same safe path: inspect nearby anchors and apply smaller patches. This is now recorded immediately as required by `docs/protocols/PLAN.md`; it does not change implementation scope or dirty-tree handling.
- TURN-20260605T190803Z - WDG-003 pre-edit seam discovery: no `src/selectionSenseiRouting.ts` module exists yet; `src/selectionSensei.ts:handleToolbarAction`, `dispatchFollowupToAI`, and `ensureSelectionChat` remain private/current direct-provider implementation details, so routing sentinel red tests must target the expected future public routing seam and fail by missing module until implementation adds it.
- TURN-20260605T190803Z - WDG-003 pre-edit seam discovery: `SenseiMobile/src/mobile/bridge/contracts.ts` has no `selectionSensei:modalMessageRequest` or `selectionSensei:modalMessageResult` bridge contract, `SenseiMobile/src/mobile/network/BffClient.ts` has no `runSelectionSenseiModalMessage` method, and `bff/src/server.js` registers no Selection Sensei modal route. These are expected red-test failure points, not new scope contradictions.
- TURN-20260605T190803Z - WDG-003 live-document process discovery: a multi-section ExecPlan ledger patch failed due to an exact anchor mismatch in the trust-boundary section. This is a documentation patch-context issue only; it did not alter feature scope, test files, production files, or validation evidence. Recovery is smaller anchored patches.
- TURN-20260605T194731Z - WDG-003C pre-edit discovery: current public mobile bridge path is authorable through `initializeSelectionSensei` plus selection capture plus `invokeSelectionSenseiBridgeAction`. In mobile build, that public path still calls `handleToolbarAction`, which currently calls `ensureSelectionChat` and `chat.sendMessage`, so direct-provider red tests can be authored without production seams.
- TURN-20260605T194731Z - WDG-003C baseline tree discovery: untracked `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md` is present in addition to earlier untracked docs. It is outside the allowed edit set and was not touched.
- TURN-20260605T200403Z - WDG-004 pre-edit package-export discovery: `node_modules/@sensei/core` is a symlink to `core`, and Node/Jest package-subpath resolution is controlled by `core/package.json` exports. Adding only `core/index.ts` and `core/prompts/index.ts` would not by itself make `@sensei/core/selectionSensei` or `@sensei/core/prompts/selectionSensei` importable by the WDG-003/WDG-003C custody tests after `core` builds. This is a packet-boundary pressure because the normal allowed edit list omitted package files, but WDG-004 explicitly permits package/config edits if import resolution proves blocked.
- TURN-20260605T200403Z - WDG-004 live-document process discovery: the first WDG-004 progress patch failed because it assumed WDG-003C start and diff-hygiene lines were adjacent. The active ExecPlan had intervening WDG-003C entries. Recovery was to inspect exact anchors and apply a smaller patch after the WDG-003C diff-hygiene entry. No source/test files were touched by that failed patch.
- TURN-20260605T200403Z - WDG-004 custody sanity result: a focused source search after custody edits found the exact toolbar action instruction strings in `core/prompts/selectionSensei.ts` and the prompt golden tests, not in `src/selectionSensei.ts`. It found `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` retaining only facade/import references for Selection Sensei prompt/parser symbols. This supports the claim that prompt/action/parser bodies are no longer duplicated in WebView source for the WDG-004 custody scope.
- TURN-20260605T200403Z - WDG-004 second live-document patch-context note: an attempt to add the custody sanity result initially targeted the Decision Log line for the package-export decision while editing the Surprises & Discoveries section, so the patch did not apply. Recovery was to inspect the exact Surprises & Discoveries anchor and reapply locally. No source/test files were touched by that failed documentation patch.
- TURN-20260605T202519Z - WDG-004C watchdog audit finding confirmed: `core/selectionSensei.ts` imports `json5`, while `core/package.json` has no `dependencies.json5` runtime dependency. Root `package-lock.json` has a `core` package metadata entry with only `devDependencies.typescript`; `bff/package-lock.json` has a `../core` package metadata entry with only `devDependencies.typescript`. This is a dependency ownership correction, not a parser behavior change.
- TURN-20260605T202519Z - WDG-004C watchdog audit finding confirmed: the WDG-004 Protocol Coverage Ledger entry classified prompt/parser custody sections but omitted full-protocol packet classifications for several still-applicable sections, including Phase 0 Activation, Phase 1 Scope Lock, Phase 2 Capability Matrix, Phase 3 Direct Provider Authority Sweep, Phase 7 Trust-Boundary Schema Plan, and Review Remediation Mode. This is a protocol-ledger correction, not a scope change.
- TURN-20260605T205157Z - WDG-005C live-document patch discovery: the first WDG-005C ExecPlan update patch failed because it used a shortened WDG-004C discovery anchor that did not exactly match the active file. Recovery was to inspect exact nearby anchors and split the plan update into smaller patches. No Core or test files were touched by that failed patch.
- TURN-20260605T205157Z - WDG-005C correction finding: WDG-005 kept the Selection Sensei system instruction Core-owned and exported, but the provider-bound string passed to `CoreLlmClient.callText` was only the mode-specific user prompt. Because `CoreLlmClient.callText` currently accepts one prompt string plus task options, this packet must add an explicit Core-owned provider-bound prompt envelope/helper instead of changing the client interface or touching BFF/RN/WebView routing.
- TURN-20260605T210646Z - WDG-006 live-document patch discovery: the first WDG-006 Decision Log patch failed because it used paraphrased WDG-005C decision anchors instead of the exact active file text. Recovery was to inspect the exact Decision Log anchors and apply the WDG-006 decision entries against them before any BFF source edit.
- TURN-20260605T210646Z - WDG-006 protocol-ledger patch discovery: the first WDG-006 Protocol Coverage Ledger patch failed because it expected a combined WDG-004/WDG-004C heading that was not present at the insertion point. Recovery was to inspect the exact WDG-005C classification footer and insert the WDG-006 classification there. No source or test files were touched by that failed patch.

## Decision Log

- 2026-06-05T15:35:59Z - Superseded by 2026-06-05T15:57:53Z scope expansion: the initial plan treated `Selection Sensei toolbar action` as the only active backlog row and left follow-up as a sibling.
- 2026-06-05T15:57:53Z - The migration unit is now the Selection Sensei modal LLM flow, including toolbar action and follow-up. Rationale: both paths share provider chat history and modal conversation state, and moving only toolbar action would risk a follow-up regression.
- 2026-06-05T15:35:59Z - This plan requires a dedicated unary Selection Sensei modal route rather than the existing `/sessions/:sessionId/llm-stream` route. Rationale: modal action and follow-up expect single structured JSON-ish responses and do not stream partial text into the main chat.
- 2026-06-05T15:35:59Z - This plan requires a new WebView-to-RN request/result bridge pair. Rationale: current `selectionSensei:invoke` is RN-to-Web only and merely asks the WebView to run the old toolbar/follow-up direct-provider handler.
- 2026-06-05T15:35:59Z - This plan keeps selected-text capture, toolbar UI, ask input, modal loading/rendering, modal transcript/composer, markdown/code highlighting, copy/share, and Add to Notepad in WebView. Rationale: the LLM migration moves prompt/provider/parser surfaces only, not user-interface ownership.
- 2026-06-05T15:35:59Z - This plan requires Selection Sensei model config to move into Core/BFF task routing. Rationale: `SELECTION_SENSEI_CONFIG` currently lives in `src/model_usage.ts`; mobile BFF execution must not rely on WebView model config.
- 2026-06-05T15:35:59Z - Superseded by 2026-06-05T15:57:53Z: the first planning pass did not run `npm run analysis:run`, but the user later explicitly allowed the analyzer as part of Core Analysis Protocol.
- 2026-06-05T15:57:53Z - Prefer a single Core/BFF Selection Sensei modal-message capability with discriminated request modes `toolbarAction` and `followUp`. Rationale: it keeps prompt/provider/parser ownership unified and makes modal conversation context explicit instead of relying on hidden provider chat history.
- 2026-06-05T16:45:40Z - Accepted unknown 1 resolution: Selection Sensei follow-up will use explicit stateless modal context, not BFF-owned modal state. Rationale: this matches the master-plan rule that WebView owns modal state and BFF/Core own prompt/provider/parser; it also mirrors the migrated main Sensei mobile pattern conceptually by replacing hidden provider chat history with structured bounded context. Implication: the modal does not forget history, but history must be carried in validated request fields and tested for truncation behavior.
- 2026-06-05T16:45:40Z - Accepted unknown 2 resolution: keep `json5` support and usage for Selection Sensei parser parity. Rationale: migration must preserve parser behavior first; parser simplification belongs in a later golden-test-backed cleanup. Implication: if Core lacks direct `json5` package access, implementation should add the dependency to `core/package.json` rather than remove tolerant parsing during this migration.
- 2026-06-05T16:45:40Z - Accepted cap direction: Selection Sensei should allow as much useful modal context as possible for normal AI-chat use in this app while enforcing strict BFF trust-boundary validation. Rationale: one Sensei modal answer may be around 2000 characters, so the current main Sensei `1000` chars per entry history cap would likely truncate important answer conclusions. Implication: define Selection Sensei-specific caps, tests, and user-safe oversize handling rather than blindly reusing main Sensei history caps.
- 2026-06-05T18:30:02Z - TURN-20260605T182838Z no-new-scope confirmation: the WDG-002 fresh direct-provider sweep does not require widening this packet or the accepted backlog scope. Rationale: the only Selection Sensei provider hits are already planned for the unified modal migration, while other provider surfaces map to completed Core/BFF infrastructure, desktop compatibility, unrelated backlog rows, debug/manual tooling, or tests. Implication: the recommended next packet remains red-test creation for the unified Selection Sensei modal flow, not feature source implementation.
- 2026-06-05T19:08:03Z - TURN-20260605T190803Z red-test design decision: tests may intentionally fail by missing future Core prompt/parser modules, missing Selection Sensei routing helper, missing BFF client method, or missing BFF route/schema. Rationale: WDG-003 is the protocol red-test gate and production implementation is forbidden. Implication: validation must distinguish intended red failures from unexpected compile/config/runtime failures; implementation packets must turn these tests green by adding the proper custody/routing layers rather than weakening assertions.
- 2026-06-05T19:47:31Z - TURN-20260605T194731Z correction decision: WDG-003C will add authorable public-surface red tests directly in `__tests__/selectionSensei.test.ts` rather than deferring all WebView modal behavior to the future `selectionSenseiRouting` helper. Rationale: `invokeSelectionSenseiBridgeAction` is already public and reaches the old mobile WebView direct-provider behavior. Implication: implementation must remove local browser chat calls from that public mobile path, not merely satisfy the future routing-helper sentinel.
- 2026-06-05T20:04:03Z - TURN-20260605T200403Z custody implementation strategy: WDG-004 will make `core/prompts/selectionSensei.ts` the canonical Selection Sensei prompt/action owner and `core/selectionSensei.ts` the canonical parser/normalizer owner, while `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` become facades. Rationale: this satisfies prompt/parser custody without changing provider routing behavior. Implication: prompt/parser tests should turn green, while mobile/BFF routing and public direct-provider red tests should remain red for later packet reasons.
- 2026-06-05T20:04:03Z - TURN-20260605T200403Z package export decision: if the new Core subpaths cannot be imported through existing package exports, WDG-004 will make the narrowest possible `core/package.json` export-only edit for `./selectionSensei` and `./prompts/selectionSensei`. Rationale: WDG-003/WDG-003C tests import those exact public Core subpaths and package exports are part of the Core public API surface. Implication: this is not a package dependency/config expansion; no unrelated package metadata or root package files should be touched.
- 2026-06-05T20:25:19Z - TURN-20260605T202519Z package-lock update method: add `json5` as a runtime dependency in `core/package.json` using the existing root version range `^2.2.3`, then update only the linked Core package metadata entries in root `package-lock.json` (`packages.core`) and BFF `package-lock.json` (`packages["../core"]`) if they do not reflect the new Core dependency. Rationale: `core/selectionSensei.ts` now has a runtime import of `json5`, and the lockfiles already model Core as a local linked package rather than a nested installed package. Implication: no package install, lifecycle script, package-manager broad churn, or `core/package-lock.json` creation should occur unless manual metadata correction proves insufficient during validation.
- 2026-06-05T20:36:51Z - TURN-20260605T203651Z Phase 10 order decision: WDG-005 implements Phase 10 steps 11 and 12 after WDG-004/WDG-004C made prompt/parser custody green and before BFF route/schema, RN bridge, or WebView routing. Rationale: Core capability and desktop browser task routing must exist before BFF can call Core or WebView can use a desktop compatibility path. Implication: this packet must leave BFF/RN/WebView routing red/blocked and must not remove current `src/selectionSensei.ts` direct-provider behavior.
- 2026-06-05T20:36:51Z - TURN-20260605T203651Z Core request/result type decision: use a discriminated request union with `mode: 'toolbarAction'` and `mode: 'followUp'`. Toolbar requests carry LLM-only `actionType`, `selectedText`, `originalSenseiMessageText`, `actionLabel`, and optional `userQuestion` only for `askQuestion`. Follow-up requests carry `question`, `selectedText`, `originalSenseiMessageText`, `initialAction`, `initialResponse`, and optional bounded `transcript` entries. Results use a deterministic `{ ok: true, suggestedTitle?, explanation?, rawText }` or `{ ok: false, errorCode, errorMessage }` shape so BFF/WebView can later distinguish missing provider, invalid request, and provider failures without parsing thrown errors.
- 2026-06-05T20:36:51Z - TURN-20260605T203651Z follow-up context decision: Core follow-up prompt construction will use explicit stateless modal context supplied in the request, not provider chat history, browser chat objects, or BFF-owned modal state. Rationale: this preserves modal continuity while matching the master-plan ownership split that WebView owns modal state and Core/BFF own prompt/provider/parser boundaries.
- 2026-06-05T20:36:51Z - TURN-20260605T203651Z model config decision: add Selection Sensei modal task config in Core with model `gemini-flash-latest`, temperature `0.5`, and `responseMimeType: "application/json"`. Rationale: this matches the WDG-005 packet and the existing Selection Sensei WebView config values recorded earlier; no stronger contradictory source was found in the targeted refresh. Implication: `core/browserLlmClient.ts` must route task `selection_sensei_modal` to this config.
- 2026-06-05T20:51:57Z - TURN-20260605T205157Z provider-bound prompt decision: build the actual Core LLM-facing string by combining `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` with the already Core-owned mode-specific user prompt inside Core. Rationale: the current injected `CoreLlmClient` contract has no separate system-instruction channel, and the master plan requires every LLM-facing system instruction and prompt fragment for Selection Sensei to remain Core-owned. Implication: tests must assert `llm.callText` receives both the system instruction and the mode-specific user prompt for toolbar and follow-up modes.
- 2026-06-05T20:51:57Z - TURN-20260605T205157Z Core boundary validation decision: expand defensive Core rejection to every declared forbidden/control sample in this packet (`prompt`, `finalPrompt`, `promptText`, `message`, `instruction`, `systemInstruction`, `model`, `temperature`, `config`, `tools`, `providerOptions`, `safetySettings`, `history`, `requestId`, `chat`) and require follow-up `initialAction.actionType`, `initialAction.actionLabel`, and nonempty initial response content before provider execution. Rationale: BFF will own final trust-boundary schema, but Core must not execute obvious prompt/provider/control-shaped payloads during the interim seam.
- 2026-06-05T21:06:46Z - TURN-20260605T210646Z BFF route/schema/service decision: implement `POST /sessions/:sessionId/selection-sensei/modal-message` using the local route/controller/service pattern. The controller owns session lookup and strict Zod validation, the service owns construction of `CoreLlmAdapter` and calls `runSelectionSenseiModalMessage` from `@sensei/core/selectionSensei`, and BFF code must not import Selection Sensei prompt builders or contain prompt bodies. Implication: mobile will later receive a structured server contract while BffClient/RN/WebView routing remains untouched in this packet.
- 2026-06-05T21:06:46Z - TURN-20260605T210646Z BFF concrete caps decision: enforce `selectedText` 12000, `originalSenseiMessageText` 48000, `actionLabel` 80, `userQuestion` and follow-up `question` 8000, `initialResponse.suggestedTitle` 500, `initialResponse.explanation` 24000, `initialResponse.rawText` 24000, `modalTranscript` max 24 entries, each transcript entry 12000, transcript aggregate 64000, `modalConversationId` 200, and total prompt-rendered structured input cap 96000. Oversize route inputs are rejected with structured `413 PAYLOAD_TOO_LARGE` rather than silently truncated.
- 2026-06-05T21:06:46Z - TURN-20260605T210646Z server Gemini task-config decision: add BFF `SELECTION_SENSEI_MODAL_CONFIG` from Core model usage and route Gemini task `selection_sensei_modal` to model `gemini-flash-latest`, `responseMimeType: "application/json"`, temperature `0.5`, and a bounded timeout using the Core main response timeout as the available timeout source. Implication: Selection Sensei modal provider calls cannot silently fall back to generic main-response config.
- 2026-06-05T21:22:53Z - TURN-20260605T212253Z BffClient transport decision: add typed `runSelectionSenseiModalMessage` as a unary JSON POST to `/sessions/:sessionId/selection-sensei/modal-message`, preserving the exact WDG-006 structured request shapes and returning the BFF `{ success: true, result }` payload. It will reuse existing unknown-session retry semantics by resetting the session and retrying once on `400 BAD_REQUEST: Unknown session`, and reuse `formatHttpError` so BFF structured rejection details surface without logging learner text or prompt/provider data.
- 2026-06-05T21:35:20Z - TURN-20260605T213520Z WDG-008 RN bridge contract decision: add one Web-to-RN message type `selectionSensei:modalMessageRequest` with `requestId` and the WDG-007 `SelectionSenseiModalMessagePayload`, and one RN-to-Web result type `selectionSensei:modalMessageResult` carrying the same `requestId`, either `success: true` plus structured result or `success: false` plus a safe error string. MainScreen will pass `parsed.payload` opaquely to `BffClient.runSelectionSenseiModalMessage`; RN will not inspect selected text/question content, construct prompts, parse provider output, or own provider controls.
- 2026-06-05T21:35:20Z - TURN-20260605T213520Z WDG-008 error-surfacing decision: MainScreen failure responses will use a fixed user-safe error string instead of forwarding arbitrary `Error.message`, because BFF/network error details could contain request or provider context. Logs for this branch must avoid selected text, question text, prompt strings, provider controls, and raw LLM result bodies.
- 2026-06-05T21:47:30Z - TURN-20260605T214730Z WDG-008C type ownership decision: Selection Sensei modal bridge-facing payload/result types belong in `SenseiMobile/src/mobile/bridge/contracts.ts`, alongside the request/result bridge variants that expose them. `SenseiMobile/src/mobile/network/types.ts` will import and re-export those types, preserving the BffClient public signature while keeping the dependency direction consistent with existing network type reuse of bridge contracts. Rationale: removes the bridge -> network -> bridge type cycle without duplicating payload definitions or changing runtime behavior.
- 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 routing decision: add a narrow `src/selectionSenseiRouting.ts` helper with `requestSelectionSenseiModalMessage`. Mobile mode must call a bridge request function or fail closed; desktop/non-mobile mode uses the existing local generator so desktop compatibility is preserved for this packet.
- 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 bridge decision: add Selection Sensei modal request/result resolver support to `src/mobile/webviewMessageRouter.ts` and make `sendToNative` return a boolean send result. `requestSelectionSenseiModalMessageViaBridge` rejects immediately if native postMessage is unavailable and rejects on result failure/timeout; it does not include final prompt strings or provider controls.
- 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 duplicate guard decision: guard rapid duplicate toolbar LLM routing in `src/selectionSensei.ts` with a pending request key based on action type, action label, selected text, original context, and ask question. The key is set only for mobile LLM toolbar requests and cleared in `finally`; a duplicate while pending returns without resetting modal state or issuing another bridge/BFF request.
- 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 follow-up context decision: WebView remains modal UI/state owner and will send explicit stateless follow-up context containing selected text, original Sensei message text, initial action type/label, initial response fields, bounded transcript entries, and current question. WebView will not construct final prompts or provider controls for mobile routing.
- 2026-06-05T21:57:52Z - TURN-20260605T215752Z WDG-009 non-LLM routing guard decision: `src/selectionSenseiRouting.ts` will defensively reject non-LLM Selection Sensei actions before bridge or local generation. Rationale: the public WebView action dispatcher already handles `addToNotepad`, `copy`, and `share` locally, but the routing helper should also fail closed if it is misused with those actions or arbitrary action values. Implication: WebView does not route local-only actions into BFF/Core modal provider execution.
- 2026-06-05T22:18:44Z - TURN-20260605T221844Z WDG-009C stale bridge cache repair decision: `src/mobile/webviewBridge.ts:resolvePostMessage` must clear `postMessageFn` when the current native channel is missing or `postMessage` is not callable. Rationale: mobile bridge-missing fail-closed behavior must reflect the current transport state, not a stale cached sender from an earlier valid channel. Implication: `sendToNative` and `requestSelectionSenseiModalMessageViaBridge` can return false/reject after native bridge removal or invalid replacement, with no browser/provider fallback.
- 2026-06-05T22:27:30Z - TURN-20260605T222730Z WDG-010 status-doc decision: update `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` and `docs/llm_entry_exit_traces.md` minimally after bundle/sweep/validation evidence exists. Rationale: these docs currently contain stale Selection Sensei direct-provider status, but final documentation must not overclaim unrelated backlog rows or unrun validation. Implication: only the unified Selection Sensei toolbar/follow-up modal flow may be marked complete if final evidence passes.

## Outcomes & Retrospective

TURN-20260605T222730Z final sweep outcome: the unified Selection Sensei modal LLM flow for toolbar action and follow-up is implemented and validated through Core prompt/action/parser custody, Core modal capability/provider-boundary, BFF route/schema/service/provider execution, mobile BffClient transport, RN bridge/MainScreen transport, WebView mobile routing/provider removal, stale bridge sender fail-closed repair, public non-LLM action coverage, WebView bundle, final source/generated direct-provider/routing sweep, status-doc updates, and focused final validation. Desktop-local Selection Sensei provider compatibility remains classified and gated outside the mobile route. Remaining LLM backlog rows are enhancement, key takeaway enhancement, and pedagogical directive generation; commit/review work is not authorized by this ExecPlan packet.

## Context and Orientation

Primary files and responsibilities:

- `src/selectionSensei.ts` is the WebView Selection Sensei controller. It owns DOM selection capture, toolbar rendering, native selection notification, modal state, follow-up composer behavior, and today also owns direct Gemini toolbar/follow-up LLM calls.
- `src/prompts.ts` currently owns Selection Sensei prompt text and prompt builders:
  - `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`
  - `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`
  - `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`
- `src/selectionSenseiResponseParser.ts` currently owns `parseSelectionSenseiResponsePayload` and helper normalizers.
- `src/model_usage.ts` currently owns `SELECTION_SENSEI_CONFIG`.
- `src/mobile/webviewMessageRouter.ts` owns WebView bridge request resolvers and RN-to-Web message handling. It already has patterns for `requestTeachingPlanViaBridge`, `requestLearnerAnalysisViaBridge`, and `requestLlmStreamViaBridge`.
- `src/mobile/webviewBridge.ts` owns `sendToNative`. It currently silently returns if native postMessage is unavailable.
- `SenseiMobile/src/mobile/bridge/contracts.ts` owns typed `RNToWebMessage` and `WebToRNMessage` contracts. It currently has `selectionSensei:invoke` RN-to-Web only.
- `SenseiMobile/src/mobile/MainScreen.tsx` handles WebView messages and dispatches bridge requests to `BffClient`.
- `SenseiMobile/src/mobile/network/BffClient.ts` owns RN HTTP/WebSocket calls to the BFF. It currently has unary methods for teaching plan and analysis, plus streaming methods for main/module responses.
- `SenseiMobile/src/mobile/network/types.ts` owns `BffClientLike` and request/result payload types.
- `bff/src/server.js` registers route modules.
- `bff/src/container.js` wires services, rate limiters, and gateway dependencies.
- `bff/src/controllers/*Controller.js`, `bff/src/services/*Service.js`, and `bff/src/routes/*.js` show the route/controller/service shape for unary LLM capabilities.
- `core/llmTypes.ts` defines `CoreLlmClient`.
- `core/browserLlmClient.ts` maps browser task names to model configs.
- `core/modelUsage.ts` owns Core model configs.
- `core/package.json` and `core/index.ts` must export any new Core selection surface consumed by WebView, RN types, and BFF.

The app is a React Native iOS app with an embedded `WKWebView`, plus a WebView app and local BFF. Do not describe this work as SwiftUI.

## Manual Investigation Evidence

Selection Sensei WebView controller:

- `src/selectionSensei.ts:8` imports `GoogleGenAI` and `Chat` directly.
- `src/selectionSensei.ts:28` imports `parseSelectionSenseiResponsePayload` from WebView source.
- `src/selectionSensei.ts:30-34` imports Selection Sensei prompts and `SELECTION_SENSEI_CONFIG` from WebView source.
- `src/selectionSensei.ts:64-72` defines toolbar actions, including `addToNotepad` which is non-LLM and out of migration scope.
- `src/selectionSensei.ts:111` stores `selectionChat`.
- `src/selectionSensei.ts:726-780` captures selected text, original Sensei context, selection HTML, and either sends selection metadata to native or shows a WebView toolbar. This stays WebView-owned.
- `src/selectionSensei.ts:905-921` creates the direct Gemini chat with `SELECTION_SENSEI_CONFIG` and `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`.
- `src/selectionSensei.ts:1081-1163` is the in-scope follow-up direct provider path and must migrate with toolbar action as part of the same modal LLM flow.
- `src/selectionSensei.ts:1285-1287` treats `window.__SENSEI_MOBILE_BUILD__` as native bridge active.
- `src/selectionSensei.ts:1289-1309` sends selection geometry/text to RN.
- `src/selectionSensei.ts:1312-1345` handles RN overlay invocation and calls `handleToolbarAction`.
- `src/selectionSensei.ts:1347-1391` owns ask-mode UI.
- `src/selectionSensei.ts:1393-1423` owns Add to Notepad and must remain out of LLM migration.
- `src/selectionSensei.ts:1425-1548` owns modal loading/rendering and should remain WebView-owned.
- `src/selectionSensei.ts:1580-1582` wraps `parseSelectionSenseiResponsePayload`.
- `src/selectionSensei.ts:1603-1814` is the selected backlog entry. It builds toolbar prompts, calls provider, strips fences, parses the response, updates the modal, and logs validation.

Prompt custody evidence:

- `src/prompts.ts:58-90` currently owns `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`.
- `src/prompts.ts:92-118` currently owns `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`.
- `src/prompts.ts:121-151` currently owns `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`.
- `src/selectionSensei.ts:1644-1649` currently owns inline toolbar action instruction text for non-ask actions.

Parser custody evidence:

- `src/selectionSenseiResponseParser.ts:20-34` normalizes and repairs loose JSON.
- `src/selectionSenseiResponseParser.ts:58-80` parses strict JSON and JSON5.
- `src/selectionSenseiResponseParser.ts:82-166` performs loose string-field extraction.
- `src/selectionSenseiResponseParser.ts:168-208` exports `parseSelectionSenseiResponsePayload`.

Mobile/RN/BFF evidence:

- `SenseiMobile/src/mobile/bridge/contracts.ts:29-55` defines RN-to-Web messages, including current `selectionSensei:invoke`.
- `SenseiMobile/src/mobile/bridge/contracts.ts:57-88` defines Web-to-RN messages and currently has no Selection Sensei LLM request/result.
- `SenseiMobile/src/mobile/bridge/contracts.ts:114-123` defines `SelectionSenseiActionId`, including non-LLM `addToNotepad`, `copy`, and `share`.
- `src/mobile/webviewMessageRouter.ts:101-117` defines the teaching plan bridge request/resolver pattern.
- `src/mobile/webviewMessageRouter.ts:119-169` defines the LLM stream bridge request/resolver pattern.
- `src/mobile/webviewMessageRouter.ts:219-238` defines the learner analysis bridge request/resolver pattern.
- `src/mobile/webviewMessageRouter.ts:400-405` handles RN-to-Web `selectionSensei:invoke` by calling the WebView Selection Sensei handler.
- `src/mobile/webviewBridge.ts:35-41` silently returns if native postMessage is missing.
- `SenseiMobile/src/mobile/MainScreen.tsx:567-569` sends selection and selection clear events to `SelectionOverlayController`.
- `SenseiMobile/src/mobile/MainScreen.tsx:638-688` handles teaching plan and analysis WebView requests by calling `BffClient`.
- `SenseiMobile/src/mobile/MainScreen.tsx:689-737` handles LLM stream WebView requests.
- `SenseiMobile/src/mobile/network/BffClient.ts:384-431` shows unary teaching plan HTTP method shape.
- `SenseiMobile/src/mobile/network/BffClient.ts:433-475` shows unary analysis HTTP method shape.
- `SenseiMobile/src/mobile/network/types.ts:96-105` defines `BffClientLike` and currently has no Selection Sensei method.

BFF/Core evidence:

- `bff/src/controllers/teachingPlanController.js:1-50` shows route payload validation, session lookup, service call, and error mapping.
- `bff/src/services/teachingPlanService.js:1-35` shows Core capability invocation through `CoreLlmAdapter`.
- `bff/src/routes/teachingPlan.js:1-22` shows route-local rate limiting.
- `bff/src/controllers/analysisController.js:1-48` shows an analysis controller pattern.
- `bff/src/services/analysisService.js:1-31` shows another Core capability invocation pattern.
- `bff/src/container.js:17-62` wires rate limiters, BFF services, `GeminiGateway`, and route dependencies.
- `bff/src/server.js:16-62` registers route modules.
- `bff/src/integration/coreLlmAdapter.js:1-15` implements `CoreLlmClient` over `GeminiGateway`.
- `bff/src/integration/geminiGateway.js:84-105` maps task names to task configs and model names. It needs a `selection_sensei_modal` task branch.
- `core/llmTypes.ts:1-5` defines `CoreLlmClient`.
- `core/browserLlmClient.ts:11-22` maps task names to Core model usage config. It needs a Selection Sensei task branch.
- `core/modelUsage.ts` currently has no Selection Sensei config.
- `core/package.json` currently has no `./selectionSensei` or `./prompts/selectionSensei` export.

Existing tests:

- `__tests__/selectionSensei.test.ts` covers basic Selection Sensei setup, modal behavior, reinitialization, and bridge Add to Notepad HTML preservation. It does not cover toolbar LLM routing.
- `__tests__/selectionSensei.prompts.test.ts` checks Selection Sensei prompt Mermaid avoidance only.
- `__tests__/selectionSenseiResponseParser.test.ts` checks JSON5 parser behavior.
- `__tests__/SelectionOverlayController.test.ts` checks RN overlay action invocation.
- `__tests__/teachingPlan.mobileRoutingGate.sentinel.test.ts` and `__tests__/learnerAnalysis.mobileRoutingGate.sentinel.test.ts` show the desired mobile routing gate sentinel pattern.
- `__tests__/corePromptParity.test.ts` has prompt SHA parity tests for other Core migrations.
- `__tests__/BffClient.test.ts` covers BFF client stream and unary patterns but has no Selection Sensei method test.
- `bff/tests/analysis.int.test.js`, `bff/tests/teachingPlan.int.test.js`, and related BFF tests show integration-test style for route behavior and rate limiting.

## Core Analysis Protocol Evidence

Core analysis ran on 2026-06-05 after the user explicitly allowed `npm run analysis:run`.

Analyzer commands:

- Baseline: `npm run analysis:run` exited 0, refreshed `tmp/analysis/*`, and regenerated `src/file-manifest.json`.
- Focused toolbar trace: `npm run analysis:run -- --include selectionSensei.ts,selectionSenseiResponseParser.ts,src/prompts.ts,src/model_usage.ts,src/mobile/webviewMessageRouter.ts,src/mobile/webviewBridge.ts,SenseiMobile/src/mobile/bridge/contracts.ts,SenseiMobile/src/mobile/MainScreen.tsx,SenseiMobile/src/mobile/network/BffClient.ts,SenseiMobile/src/mobile/network/types.ts,bff/src,core --entry src/selectionSensei.ts::SelectionSensei.handleToolbarAction --maxDepth 5` exited 0.
- Focused follow-up trace: same include scope with `--entry src/selectionSensei.ts::SelectionSensei.dispatchFollowupToAI --maxDepth 5` exited 0.

Analyzer brief findings:

- Full baseline top fan-out files included `src/index.tsx`, `src/moduleSelectionHandler.ts`, `src/ui.ts`, `bff/src/container.js`, `core/index.ts`, `src/interactionHelpers.ts`, `src/geminiService.ts`, `bff/src/server.js`, and `SenseiMobile/src/mobile/MainScreen.tsx`.
- Scoped brief entry candidates included `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/webviewBridge.ts`, `bff/src/server.js`, `core/index.ts`, `core/prompts/index.ts`, `src/mobile/webviewMessageRouter.ts`, and `src/selectionSensei.ts`.
- Scoped risk hotspots included Selection Sensei modal/UI functions: `cleanup`, `getDOMElements`, `setModalFullscreen`, `ensureOverlayMounted`, `activateAskMode`, `createAndShowSelectionToolbar`, `resetModalState`, `updateResponseModalContentAndTitle`, and `showResponseModalWithLoading`.
- Scoped top fan-out files included `bff/src/container.js`, `core/index.ts`, `bff/src/server.js`, `SenseiMobile/src/mobile/MainScreen.tsx`, `core/prompts/index.ts`, `src/prompts.ts`, `src/selectionSensei.ts`, `src/mobile/webviewMessageRouter.ts`, and `SenseiMobile/src/mobile/network/BffClient.ts`. These are the expected wiring files for the migration.

Static execution trace:

- Toolbar entry `src/selectionSensei.ts::SelectionSensei.handleToolbarAction` reaches `logSelectionSenseiValidation`, `resetModalState`, `showResponseModalWithLoading`, `setComposerEnabled`, `hideSelectionToolbar`, `updateResponseModalContentAndTitle`, `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`, `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`, `ensureSelectionChat`, `extractContentWithRegex`, and parser helpers.
- Toolbar path also reaches `src/mobile/webviewBridge.ts::sendToNative` through `hideSelectionToolbar` when native selection state is active.
- Follow-up entry `src/selectionSensei.ts::SelectionSensei.dispatchFollowupToAI` reaches `generateModalMessageId`, `appendModalMessage`, `setComposerEnabled`, `ensureSelectionChat`, `formatFollowupAnswer`, `extractContentWithRegex`, and parser helpers.
- Follow-up submit path `src/selectionSensei.ts::SelectionSensei.handleFollowupSubmit` reaches `setComposerEnabled`, `generateModalMessageId`, `appendModalMessage`, and `dispatchFollowupToAI`.
- Parser trace from both paths reaches `parseSelectionSenseiResponsePayload`, `normalizeJsonPayload`, `tryParseJson`, `tryParseJson5`, `repairLooseJson`, `extractLooseStringField`, `hasContent`, and `extractResult`.

Dependency and side-effect table:

| Function | Dependencies | Side effects | Risk ranking |
|---|---|---|---|
| `SelectionSensei.handleToolbarAction` | Selection prompt builders, `ensureSelectionChat`, parser wrapper, modal reset/loading/update helpers, logger | Analyzer records no direct side effects because most mutations happen through callees, but source inspection shows provider call, modal state transitions, and prompt assembly | High cost due provider call and prompt ownership; high UX blast radius through modal; medium concurrency risk via modal token |
| `SelectionSensei.dispatchFollowupToAI` | `ensureSelectionChat`, `formatFollowupAnswer`, `appendModalMessage`, `setComposerEnabled`, logger | Writes `followupInFlight` across early exits/finally; appends modal messages; provider call in source | High cost due provider call; high UX blast radius through shared modal transcript; high concurrency risk around stale modal token and repeated submit |
| `SelectionSensei.ensureSelectionChat` | `GoogleGenAI.chats.create`, `SELECTION_SENSEI_CONFIG`, `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, logger | Writes `this.selectionChat` | High ownership risk: direct provider/prompt custody violation for both in-scope paths |
| `SelectionSensei.resetModalState` | DOM element validation, fullscreen/minimize helpers, modal registry, composer state | Increments `modalConversationToken`; clears modal DOM; resets `followupInFlight`, `modalMessageCounter`, `selectionChat`; toggles composer | High UX/concurrency risk; migration must preserve token semantics and replace `selectionChat` state with explicit modal context |
| `SelectionSensei.showResponseModalWithLoading` | DOM validation, minimize state, composer state, logger | Clears modal content, sets loading title/spinner, positions modal, disables composer | Medium-high UX risk; should stay WebView-owned |
| `SelectionSensei.updateResponseModalContentAndTitle` | markdown sanitizers/renderers, code block helpers, modal DOM, composer state | Replaces modal content, title, spinner, display state; enables composer | High UX risk; should stay WebView-owned and consume Core/BFF result |
| `SelectionSensei.handleFollowupSubmit` | composer input, modal append helper, `dispatchFollowupToAI` | Toggles `followupInFlight`, clears composer input, disables/enables composer | High concurrency risk for duplicate follow-up submissions |
| `SelectionSensei.appendModalMessage` | `displayMessage`, modal registry, DOM validation, Mermaid normalization | Appends/updates modal transcript DOM | Medium UX risk; should stay WebView-owned |
| `SelectionSensei.formatFollowupAnswer` | parser wrapper | None | Medium correctness risk; parser should move to Core while markdown display formatting remains WebView-owned |
| `parseSelectionSenseiResponsePayload` | JSON, JSON5, repair helpers, loose field extraction | Only local object writes in analyzer; pure parser from product perspective | High custody importance, low side-effect risk; should move to Core |
| `src/mobile/webviewMessageRouter` bridge resolver functions | `sendToNative`, timers, result handlers | Timer setup/clear and resolver maps | High mobile routing risk; new modal request must fail closed if bridge missing |
| `SenseiMobile/src/mobile/MainScreen` WebView handler | `BffClient`, bridge enqueue, parsed WebView messages | RN state/hooks and bridge enqueue | High transport risk; must add modal request/result without changing existing selection overlay invoke behavior |
| `SenseiMobile/src/mobile/network/BffClient` unary methods | fetch, session retry, timeout timers | sessionId reset on unknown session; timers | High boundary risk; must post structured modal requests and avoid prompt strings |
| `bff/src/integration/geminiGateway` | Google GenAI provider, task model config, deadlines | provider I/O and timeout handling | High provider/secrets risk; only BFF should execute mobile provider calls |

Risk register:

- High: hidden provider chat history currently ties toolbar and follow-up together. Verification plan: modal-flow tests must prove follow-up gets selected text, original context, initial action/result, and bounded transcript without relying on WebView `Chat`.
- High: mobile bridge missing path currently can silently fail at `sendToNative`. Verification plan: sentinel test for mobile modal request with missing bridge proves browser/local provider is not called and user-safe error is returned.
- High: prompt custody spans exported prompts and inline action instruction strings. Verification plan: Core prompt parity tests with SHA/length for system, toolbar prompt fixtures, ask prompt fixture, follow-up prompt fixture, and each action instruction.
- High: BFF trust boundary must reject prompt smuggling. Verification plan: BFF route negative tests reject `prompt`, `message`, `instruction`, `systemInstruction`, `model`, `temperature`, unknown keys, arbitrary roles, oversized transcript, and non-LLM actions.
- Medium: parser currently depends on `json5` in WebView source. Verification plan: Core build/test confirms dependency strategy and parser parity.
- Medium: modal duplicate/in-flight behavior depends on `modalConversationToken` and `followupInFlight`. Verification plan: WebView tests cover stale result suppression and duplicate follow-up prevention.

Coverage checklist from focused traces:

- `src/selectionSensei.ts::SelectionSensei.handleToolbarAction#c0550a854bae`
- `src/selectionSensei.ts::SelectionSensei.dispatchFollowupToAI#ca7842d92b2d`
- `src/selectionSensei.ts::SelectionSensei.handleFollowupSubmit#312b5bc3cad0`
- `src/selectionSensei.ts::SelectionSensei.ensureSelectionChat#85d6a6b3d49e`
- `src/selectionSensei.ts::SelectionSensei.resetModalState#969481b3815e`
- `src/selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#834169bef9a5`
- `src/selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#980855dbc6d5`
- `src/selectionSensei.ts::SelectionSensei.appendModalMessage#74cacf32b668`
- `src/selectionSensei.ts::SelectionSensei.formatFollowupAnswer#cc64747addad`
- `src/selectionSensei.ts::SelectionSensei.extractContentWithRegex#3a8e7be7a474`
- `src/selectionSenseiResponseParser.ts::parseSelectionSenseiResponsePayload#0f0a31a06baf`
- `src/mobile/webviewMessageRouter.ts` request/result resolver functions for future modal bridge
- `src/mobile/webviewBridge.ts::sendToNative#e772200b593c`
- `SenseiMobile/src/mobile/MainScreen.tsx::MainScreen#e11f920a0f2c`
- `SenseiMobile/src/mobile/network/BffClient.ts` unary request methods
- `bff/src/container.js::createContainer#bf8db284e9b9`
- `bff/src/server.js::startServer#7d2f34f7790a`
- `bff/src/integration/coreLlmAdapter.js::CoreLlmAdapter.callText#1e631e85563f`
- `bff/src/integration/geminiGateway.js::GeminiGateway.callText#34d401862331`

Clarified objective:

The user clarified that the modal follow-up path is now in scope. No further question is required to update this plan: the target is a unified Selection Sensei modal LLM flow where Core/BFF own prompts/provider execution for both initial toolbar action and follow-up.

## LLM Migration Compliance Block

### Scope Lock

Status: PASS / GREEN by TURN-20260605T224420Z. Scope is locked to the unified Selection Sensei toolbar action plus follow-up modal LLM flow, and WDG-010 final evidence confirms no new Selection Sensei sibling path was discovered.

| Field | Value |
|---|---|
| Backlog rows | Selection Sensei toolbar action plus Selection Sensei follow-up/modal conversation path |
| Current WebView entry points | `src/selectionSensei.ts:handleToolbarAction`, `src/selectionSensei.ts:handleFollowupSubmit`, `src/selectionSensei.ts:dispatchFollowupToAI` |
| Migration unit | Unified Selection Sensei modal LLM flow: initial toolbar action and follow-up turns |
| Current prompt owner | `src/prompts.ts`, inline action instruction text in `src/selectionSensei.ts:handleToolbarAction`, and implicit follow-up prompt/chat history in `dispatchFollowupToAI` |
| Target prompt owner | `core/prompts/selectionSensei.ts` |
| Current parser owner | `src/selectionSenseiResponseParser.ts`, fence stripping in `src/selectionSensei.ts:handleToolbarAction`, and follow-up formatting parser call in `formatFollowupAnswer` |
| Target parser owner | `core/selectionSensei.ts` or a Core-owned parser re-exported from `core/selectionSensei.ts` |
| Current provider owner | WebView `SelectionSensei.ensureSelectionChat` and `chat.sendMessage` for both toolbar action and follow-up |
| Target desktop provider path | WebView creates a browser `CoreLlmClient` through `createBrowserCoreLlmClient` and calls Core modal capability; no prompt string is accepted from BFF/RN |
| Target mobile provider path | WebView structured modal request -> RN bridge -> BFF `POST /sessions/:sessionId/selection-sensei/modal-message` -> Core capability -> BFF provider gateway -> RN result -> WebView modal |
| Target Core capability | `core/selectionSensei.ts` |
| Target BFF owners | `bff/src/routes/selectionSensei.js`, `bff/src/controllers/selectionSenseiController.js`, `bff/src/services/selectionSenseiService.js`, plus container/server/config/model usage wiring |
| Target RN owners | `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts` |
| Target WebView owners | `src/selectionSensei.ts`, `src/selectionSenseiRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `src/mobile/webviewBridge.ts` if explicit bridge availability is needed |
| Out of scope | Add to Notepad, copy/share actions, toolbar visual design, modal visual design, selection geometry, main/module Sensei streams, generic LLM gateway |

### Capability x Mode x Lifecycle Matrix

Status: PASS / GREEN by TURN-20260605T224420Z. The matrix reflects final routed and validated states for toolbar and follow-up, desktop compatibility, mobile bridge-present execution, bridge-missing fail-closed behavior, duplicate pending guard, non-LLM local actions, malformed provider normalization, generated bundle evidence, and final selected validation.

| Capability | Mode | Lifecycle | Required behavior |
|---|---|---|---|
| Selection modal initial action | Desktop WebView | Toolbar button clicked | Build structured Core request from selected text, context, action type/label, and optional ask question; use browser Core client; no WebView-owned provider prompt body remains outside Core-owned builder |
| Selection modal initial action | Mobile bridge present | RN overlay invokes toolbar action | WebView opens loading modal, sends structured modal request to RN, RN calls BFF route, BFF calls Core/provider, RN returns normalized result, WebView updates modal and stores bounded modal context for follow-up |
| Selection modal follow-up | Desktop WebView | User submits modal composer question | Build structured Core follow-up request from selected text/context, initial action metadata/result, bounded modal transcript, and current question; use browser Core client |
| Selection modal follow-up | Mobile bridge present | User submits modal composer question | WebView appends user/loading bubbles, sends structured follow-up request to RN/BFF, receives normalized answer, and appends the Sensei follow-up bubble |
| Selection modal flow | Mobile bridge missing | Toolbar or follow-up invoked in mobile build | Fail closed with user-safe modal error and log sentinel event; do not call browser `GoogleGenAI`, `Chat`, `CoreLlmClient`, or prompt builder locally as a fallback |
| Selection modal flow | Provider failure | BFF/provider fails | BFF returns structured error; RN returns failure; WebView shows existing user-safe error wording without echoing prompt or secrets |
| Selection modal flow | Malformed provider output | BFF/Core receives malformed or fenced output | Core parser/normalizer handles strict JSON, JSON5, repaired JSON, loose extraction, and fenced payload parity; WebView receives normalized fields or raw fallback according to Core result |
| Selection modal flow | Duplicate/in-flight action | User repeats toolbar action or follow-up while request active | Existing modal token/conversation guard and `followupInFlight` behavior remain effective; stale result does not overwrite newer modal |
| Selection toolbar ask | Ask mode | `askQuestion` with user question | BFF rejects missing/empty question; WebView keeps ask-mode UI and sends only structured fields |
| Selection non-LLM actions | Add to Notepad/copy/share | Toolbar or native overlay action | Remain WebView/native behavior and must not call Core/BFF/provider |

### Direct Provider Authority Sweep

Status: PASS FOR TURN-20260605T222730Z FINAL SWEEP

Manual sweep command run during plan authoring:

`rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**'`

Selected-row hits:

| File/surface | Classification | Required action |
|---|---|---|
| `src/selectionSensei.ts:8` imports `GoogleGenAI, Chat` | Violating for in-scope modal flow | Remove `Chat`/direct provider dependency from toolbar and follow-up paths; only constructor typing can remain if other out-of-scope code still requires it |
| `src/selectionSensei.ts:905-921` `ensureSelectionChat` | Violating for in-scope modal flow | Neither toolbar action nor follow-up may call this after migration; remove or retire if no remaining caller |
| `src/selectionSensei.ts:1675-1678` `chat.sendMessage({ message: userPrompt })` | Violating toolbar entry | Replace with routed Core/BFF modal-message request |
| `src/selectionSensei.ts:1124-1126` follow-up direct `chat.sendMessage({ message: question })` | Violating follow-up entry | Replace with routed Core/BFF modal-message request using explicit modal context |

TURN-20260605T182838Z fresh sweep command:

`rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**'`

TURN-20260605T182838Z output handling and status:

- Exit status: 0
- Output bytes: 14492
- Output lines: 178
- Output handling: redirected to a temporary file, preserved exit status, and printed the full output because it was under the 70000-byte cap.
- Stop-condition result: no unplanned Selection Sensei sibling path or contradiction was found; completing this packet does not require source or test edits.

TURN-20260605T182838Z classified hits:

| File/surface | Sweep lines | Classification | Required action |
|---|---:|---|---|
| `src/selectionSensei.ts` imports/types/state/chat creation/send calls | 8, 111, 206, 276, 905, 909-910, 920, 961, 1119, 1124, 1378, 1666, 1676, 1864, 1878 | Violating for in-scope unified Selection Sensei modal flow | Later implementation must remove toolbar/follow-up modal provider use from `ensureSelectionChat`, `handleToolbarAction`, and `dispatchFollowupToAI`; replace with Core/BFF/mobile bridge path while preserving WebView modal UI ownership. |
| `src/geminiService.ts` teaching plan, learner analysis, wrap-up Core client references | 7, 13, 61, 69, 81, 137, 144, 148, 150, 192, 197, 201 | Expected desktop compatibility / completed migration wrappers | No WDG-002 action. Preserve existing completed Core delegation; do not touch in Selection Sensei packets unless a bounded packet authorizes a shared config edit. |
| `src/geminiService.ts` pedagogical directive and enhancement direct provider calls | 170, 172, 269, 286 | Unrelated backlog surfaces | No WDG-002 action. These remain separate master-plan rows and are not Selection Sensei sibling paths. |
| `src/keyTakeawayEnhancerController.ts` direct chat creation/send | 1, 5, 34, 81, 89 | Unrelated backlog surface | No WDG-002 action. Future key-takeaway migration must handle this separately. |
| `src/pedagogicalProfiler.ts` `GoogleGenAI` injection | 7, 195 | Unrelated backlog surface via directive generation | No WDG-002 action. |
| `src/interactionHelpers.ts` stream `Chat`/`sendMessageStream` references | 6, 56, 64, 125, 250, 258, 322 | Desktop compatibility for completed main/module stream migrations | No WDG-002 action. Keep mobile stream routing on BFF/Core; do not conflate with Selection Sensei unary modal route. |
| `src/moduleSelectionHandler.ts` and `src/index.tsx` main/module chat and Core client references | `src/moduleSelectionHandler.ts`: 2, 30, 51, 69-70, 653, 761, 782, 881; `src/index.tsx`: 64, 129, 196-197, 216, 239, 419, 422, 433, 460, 485, 518, 604, 656, 1018, 1229, 1240, 1304, 1349, 1397, 1527, 1540 | Desktop compatibility / existing main/module chat orchestration | No WDG-002 action. Not a Selection Sensei sibling path. |
| `src/saveloadProgressManager.ts` chat history extraction/restore | 187, 407 | Out-of-scope save/load main chat restoration surface | No WDG-002 action. Record as present but unrelated. |
| `src/debugMode.ts` debug chat provider path | 7, 63-64, 601, 732, 742, 966 | Out-of-scope debug/developer provider path | No WDG-002 action. |
| `src/enhancementManager.ts` type/provider access for enhancement request | 1, 14 | Unrelated enhancement backlog surface | No WDG-002 action. |
| `src/ui.ts` browser Core client use and AI type comment | 15, 68, 3087 | Expected desktop/Core browser client usage | No WDG-002 action. |
| `src/model_usage.ts` chat comments | 31, 34, 44, 47 | Comment-only/false positive plus config context | No WDG-002 action. Later Selection Sensei implementation must move the relevant Selection Sensei config into Core/BFF task routing. |
| `src/test.ts` `generateContent` calls | 164, 174 | Ancillary manual/test provider utility; not Selection Sensei | No WDG-002 action. Record as non-blocking inventory item. |
| `src/metadata.json` `Chat` string | 2 | False positive | No action. |
| `core/browserLlmClient.ts` provider adapter over browser AI | 8, 25-26, 33, 50 | Expected desktop Core provider adapter | Later Selection Sensei Core packet must add `selection_sensei_modal` task support here. |
| `core/llmTypes.ts`, `core/learnerAnalysis.ts`, `core/teachingPlan.ts`, `core/wrapUpAssessment.ts`, `core/mermaidErrorRecovery.ts` `CoreLlmClient` references | `core/llmTypes.ts`: 1; `core/learnerAnalysis.ts`: 1, 97; `core/teachingPlan.ts`: 1, 146; `core/wrapUpAssessment.ts`: 1, 293; `core/mermaidErrorRecovery.ts`: 6, 202, 289 | Expected Core capability injection / completed migrations | No WDG-002 action. Selection Sensei implementation should follow this pattern. |
| `bff/src/container.js` and `bff/src/integration/geminiGateway.js` | `bff/src/container.js`: 15, 28; `bff/src/integration/geminiGateway.js`: 60, 72-73, 118, 151-152, 237, 293 | Expected BFF provider/secrets owner | Later BFF packet must add Selection Sensei task routing/config here; this is not a violation. |
| `__tests__/keyTakeawayEnhancerController.test.ts`, `__tests__/mermaidErrorRecovery.core.functional.test.ts`, `__tests__/wrapUpAssessment.test.ts`, `__tests__/geminiService.test.ts`, `__tests__/moduleSelectionHandler.enhancer.test.ts`, `__tests__/saveLoadProgress.test.ts`, `__tests__/selectionSensei.test.ts`, `__tests__/interactionHelpers.test.ts`, `__tests__/moduleSelectionHandler.test.ts`, `bff/tests/geminiGatewayFallback.test.js` | Various listed test lines from sweep output | Test-only mocks/fixtures or tests for completed/out-of-scope surfaces | No WDG-002 action. Future Selection Sensei packets may edit only specifically authorized Selection Sensei tests. |
| `src/index.html` debug/chat button labels | 230, 288 | UI text false positives | No action. |

TURN-20260605T222730Z final source/generated sweep classification:

- The final provider sweep over Selection Sensei source, BFF/Core/RN/WebView transport files, and `SenseiMobile/app_web/webview_dist/index.js` exited `0` and was classified without finding a blocking mobile Selection Sensei direct-provider route.
- `bff/src/integration/geminiGateway.js` provider hits are Core/BFF-owned server provider execution for the migrated route.
- `core/selectionSensei.ts` `CoreLlmClient` hits are the provider-agnostic Core capability boundary.
- `src/selectionSensei.ts` and generated `index.js` still contain `GoogleGenAI`, `Chat`, `ensureSelectionChat`, and `chat.sendMessage` for desktop-local Selection Sensei compatibility. Generated snippets confirm mobile mode enters `requestSelectionSenseiModalMessageViaBridge` before local generation, so these are not a stale mobile provider route.
- Generated `index.js` contains `selectionSensei:modalMessageRequest`, `selectionSensei:modalMessageResult`, `requestSelectionSenseiModalMessage`, and bridge-missing error text. This proves the embedded mobile runtime includes the structured bridge path after `npm run webview:bundle`.
- Other generated provider hits map to accepted desktop compatibility or unrelated remaining backlog/debug surfaces and do not widen the Selection Sensei scope.

### Prompt Custody Ledger

Status: GREEN for prompt/action custody and follow-up prompt execution by TURN-20260605T222730Z

| Prompt surface | Current owner | Target owner | Parity requirement |
|---|---|---|---|
| Selection Sensei system instruction | `src/prompts.ts:SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` | `core/prompts/selectionSensei.ts` | Copy verbatim; WebView `src/prompts.ts` becomes facade/re-export only if still needed |
| Standard toolbar user prompt builder | `src/prompts.ts:SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION` | `core/prompts/selectionSensei.ts` | Runtime output SHA/length parity for representative action fixtures |
| Ask-question user prompt builder | `src/prompts.ts:SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION` | `core/prompts/selectionSensei.ts` | Runtime output SHA/length parity for ask fixture |
| Toolbar action instruction map | Inline switch in `src/selectionSensei.ts:1644-1649` | `core/prompts/selectionSensei.ts` or `core/selectionSensei.ts` | Exact string parity for all allowed non-ask action types |
| Follow-up prompt builder | Implicit provider chat history plus raw `question` in `dispatchFollowupToAI` | `core/prompts/selectionSensei.ts` | New explicit prompt builder must include selected text, original context, initial action metadata/result, bounded modal transcript, and current question; parity target is behavioral/context parity rather than exact old raw question text because the old context lived inside provider chat history |
| Prompt wrapper from BFF/RN/WebView | Not yet separate | Must not exist outside Core | BFF/RN/WebView payloads must not accept or send final prompt strings, instruction fragments, arbitrary controls, model, temperature, or system instruction |

Captured planning baselines:

| Fixture | Length | SHA-256 |
|---|---:|---|
| `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` | 2878 | `56dc75df6fa8d62e55a3d7bb64908d8c343282918d58714cc508d97c7481ec12` |
| `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION:simpler` sample | 919 | `213c6ccbb969b1c220c8f8818a4257e194486bf38d100513e1892556a4aa1698` |
| `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION:ask` sample | 823 | `688ab5ee7e3ba010e9a2738d4049859862784295c6b0f38174e23387ab9c8c7c` |

Future parity tests must include all action instruction variants, not only the two exported prompt-builder samples captured here.

TURN-20260605T190803Z red/golden evidence:

- `__tests__/selectionSensei.prompts.test.ts` now has golden SHA/length tests named `keeps the old Selection Sensei system prompt runtime SHA and length before Core migration`, `keeps the old standard toolbar prompt runtime SHA and length before Core migration`, and `keeps the old ask-question prompt runtime SHA and length before Core migration`.
- `__tests__/selectionSensei.prompts.test.ts` now has the red destination test `exposes Selection Sensei prompt builders from the future Core prompt owner`, expected to fail until `@sensei/core/prompts/selectionSensei` exists and owns the prompt builders.
- All action instruction variants still require a later implementation packet to add broader parity coverage once the Core prompt/action map module exists; this is a recorded partial red-test gap, not permission to implement prompt custody in WDG-003.

TURN-20260605T194731Z prompt-action correction evidence:

- `__tests__/selectionSensei.prompts.test.ts` now has `keeps exact old inline toolbar action instruction strings before Core custody`, covering exact old values for `explainSimpler`, `explainWithAnalogy`, `explainInMoreDepth`, `showAnExample`, and `showExampleCodeSnippet`.
- `__tests__/selectionSensei.prompts.test.ts` now has `exposes exact toolbar action instructions from the future Core prompt owner`, requiring future `@sensei/core/prompts/selectionSensei` to export `SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS` equal to the old map and, if present, `buildSelectionSenseiToolbarPrompt` output containing the exact instruction per action.
- WDG-003's prior action-instruction gap is no longer a broad deferral. Remaining prompt work is implementation: create the Core prompt owner and convert `src/prompts.ts`/inline WebView action instructions to facade/delegate behavior.

TURN-20260605T200403Z prompt/action custody implementation evidence:

- `core/prompts/selectionSensei.ts` now owns `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`, `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`, `SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS`, `getSelectionSenseiToolbarActionInstruction`, and `buildSelectionSenseiToolbarPrompt`.
- `src/prompts.ts` now imports and re-exports/delegates the Selection Sensei prompt/action symbols from `@sensei/core/prompts/selectionSensei`; it no longer owns duplicate Selection Sensei prompt bodies.
- `src/selectionSensei.ts` now delegates non-ask toolbar action instruction lookup to `getSelectionSenseiToolbarActionInstruction` instead of owning inline instruction strings. Provider routing is intentionally unchanged in WDG-004.
- `core/prompts/index.ts`, `core/index.ts`, and the narrow `core/package.json` exports expose `@sensei/core/prompts/selectionSensei`.
- `__tests__/selectionSensei.prompts.test.ts` passed: exit `0`, 8 tests passed. The test now proves old prompt SHA/length parity, exact action instruction values through the `src` facade, Core prompt builder exports, and Core action-instruction map/builder custody.

TURN-20260605T203651Z prompt/capability custody evidence:

- `core/prompts/selectionSensei.ts` now also owns `buildSelectionSenseiFollowUpPrompt` and the prompt-facing modal context types used by follow-up mode.
- Follow-up prompt construction explicitly renders selected text, original explanation, initial action metadata, initial response, bounded modal transcript entries, and the current follow-up question. It does not depend on provider chat history, browser chat objects, or BFF-owned modal state.
- `__tests__/selectionSenseiCoreModal.test.ts` covers follow-up prompt construction and confirms `runSelectionSenseiModalMessage` sends the exact Core-built follow-up prompt to the injected LLM with task `selection_sensei_modal`.

TURN-20260605T205157Z provider-bound prompt correction evidence:

- `runSelectionSenseiModalMessage` now sends a Core-built provider-bound string that includes `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` and the mode-specific Core user prompt.
- `__tests__/selectionSenseiCoreModal.test.ts` now fails if toolbar, ask, or follow-up provider-bound prompts omit the Core-owned system instruction or the user prompt content.

TURN-20260605T222730Z final prompt custody evidence:

- Final prompt/static sweep confirmed authored Selection Sensei prompt bodies, action instruction strings, toolbar/ask builders, and explicit follow-up prompt construction are owned by `core/prompts/selectionSensei.ts`.
- `src/prompts.ts` remains a facade/re-export and BFF/RN/WebView status-doc updates did not introduce prompt bodies.
- Generated bundle prompt text is a generated copy of the Core/source facade path and not an authored WebView/BFF/RN prompt owner.

### Parser/Normalizer Ledger

Status: GREEN for parser/normalizer custody by TURN-20260605T222730Z

| Parser surface | Current owner | Target owner | Required behavior |
|---|---|---|---|
| `normalizeJsonPayload` | `src/selectionSenseiResponseParser.ts` | Core | Preserve curly quote normalization and trimming |
| `repairLooseJson` | `src/selectionSenseiResponseParser.ts` | Core | Preserve single-quote and trailing-comma repair behavior |
| strict JSON/JSON5 parsing | `src/selectionSenseiResponseParser.ts` | Core | Preserve strict JSON, JSON5, repaired JSON, and repaired JSON5 order |
| loose field extraction | `src/selectionSenseiResponseParser.ts` | Core | Preserve `suggestedTitle` and `explanation` extraction, including escaped characters |
| response fence stripping | `src/selectionSensei.ts:1698-1704` | Core parser/normalizer | Preserve fenced JSON extraction before parsing |
| content strategy | `src/selectionSensei.ts:1716-1767` | Split: Core returns normalized result; WebView chooses modal presentation labels/fallback | Keep UI fallback text and modal rendering WebView-owned |
| follow-up display formatting | `src/selectionSensei.ts:975-998` | WebView display formatting with Core parser delegate/result | Do not move markdown/modal formatting to Core; provider response parsing remains Core-owned |

TURN-20260605T190803Z red/golden evidence:

- `__tests__/selectionSenseiResponseParser.test.ts` now has current parser parity tests named `repairs single quoted payloads with trailing commas`, `extracts loose title and explanation fields from freeform provider output`, and `returns an empty object for malformed provider output without parseable fields`.
- `__tests__/selectionSenseiResponseParser.test.ts` now has the red destination/facade test `exposes Selection Sensei parser from the future Core owner with fenced payload support`, expected to fail until `@sensei/core/selectionSensei` exists and owns fenced-payload normalization plus parser parity.

TURN-20260605T200403Z parser/normalizer custody implementation evidence:

- `core/selectionSensei.ts` now owns `parseSelectionSenseiResponsePayload`, `SelectionSenseiParsedResponse`, `SelectionSenseiParserOptions`, strict JSON parsing, JSON5 parsing, repaired JSON/JSON5 parsing, loose field extraction, malformed `{}` behavior, parser failure logging behavior, and fenced-payload stripping.
- `src/selectionSenseiResponseParser.ts` is now a facade exporting the Core parser and types, with no duplicate parser implementation.
- `core/index.ts` and the narrow `core/package.json` export expose `@sensei/core/selectionSensei`.
- `__tests__/selectionSenseiResponseParser.test.ts` passed: exit `0`, 5 tests passed. This proves current parser parity and Core fenced-payload destination behavior.

TURN-20260605T202519Z parser dependency correction evidence:

- WDG-004C confirmed `core/selectionSensei.ts` imports `json5` at runtime and repaired Core dependency ownership by adding `dependencies.json5` with version range `^2.2.3` to `core/package.json`.
- WDG-004C mirrored that runtime dependency into root `package-lock.json` `packages.core` and BFF `package-lock.json` `packages["../core"]`, matching the linked Core package metadata pattern already present in both lockfiles.
- This preserves the accepted `json5` parser parity decision. No parser logic, prompt text, routing behavior, BFF route, RN bridge, WebView route helper, or tests were edited by this correction.

TURN-20260605T222730Z final parser/normalizer evidence:

- Final prompt/parser sweep confirmed authored parser and normalizer behavior remains in `core/selectionSensei.ts`.
- `src/selectionSenseiResponseParser.ts` remains a facade and WebView display formatting remains UI-owned rather than parser custody duplication.
- The final focused Jest aggregate included `__tests__/selectionSenseiResponseParser.test.ts` and `__tests__/selectionSenseiCoreModal.test.ts`, both passing as part of the 8-suite aggregate.

TURN-20260605T203651Z Core capability/provider-boundary evidence:

- `core/selectionSensei.ts` now owns `SelectionSenseiModalMessageRequest`, `SelectionSenseiToolbarActionRequest`, `SelectionSenseiFollowUpRequest`, `SelectionSenseiModalMessageResult`, and `runSelectionSenseiModalMessage`.
- Core runtime validation rejects non-LLM toolbar actions (`addToNotepad`, `copy`, `share`) and forbidden prompt/provider-control keys (`prompt`, `finalPrompt`, `promptText`, `systemInstruction`, `instruction`, `model`, `temperature`, `providerOptions`, `safetySettings`, `history`) before any provider execution.
- `runSelectionSenseiModalMessage` calls only the injected `CoreLlmClient` with `{ task: 'selection_sensei_modal' }` and returns deterministic error results for missing LLM, invalid request, and provider failure.
- `core/prompts/selectionSensei.ts` now owns follow-up prompt construction from explicit stateless modal context. It does not reference provider chat history, browser chat objects, or BFF-owned modal state.
- `core/modelUsage.ts` and `core/browserLlmClient.ts` now route browser Core task `selection_sensei_modal` to `gemini-flash-latest`, temperature `0.5`, and `responseMimeType: "application/json"`.
- Validation for TURN-20260605T203651Z passed the combined prompt/parser/Core modal suite with 20 tests, including malformed loose provider output normalization through the Core parser.

### Boundary Invariant Ledger

Status: GREEN by TURN-20260605T222730Z for the unified Selection Sensei toolbar/follow-up modal flow: Core prompt/action/parser/capability invariants, BFF route/schema/service provider-execution invariants, BffClient structured transport invariant, RN bridge/MainScreen transport invariant, WebView mobile routing, current-channel bridge fail-closed behavior, public mobile direct-provider removal, local-only non-LLM public actions, duplicate toolbar route-work guard, generated bundle, final provider sweep, trace/master-plan status, and final validation are complete

The implementation must satisfy these invariants:

1. Mobile Selection Sensei modal flow never imports, constructs, or calls browser `GoogleGenAI`, `Chat`, `chat.sendMessage`, `ai.models.generateContent`, or browser `CoreLlmClient`.
2. Desktop Selection Sensei modal flow uses Core-owned prompt/parser code through a browser `CoreLlmClient`, not WebView-owned prompt bodies.
3. BFF owns provider execution for mobile and uses server-side `GeminiGateway`.
4. BFF route accepts only structured fields: action type, selected text, original Sensei message text/context, action label if allowed, and user question only for `askQuestion`.
5. BFF route rejects final prompt strings, prompt fragments, system instructions, arbitrary action controls, model names, temperatures, safety settings, and provider options from clients.
6. BFF route validates allowed action IDs and rejects non-LLM actions `addToNotepad`, `copy`, and `share`.
7. BFF route rejects `askQuestion` without a non-empty bounded question.
8. BFF route rejects non-ask actions with unneeded `userQuestion` unless a decision is recorded to ignore it safely.
9. BFF route enforces character caps on `selectedText`, `originalSenseiMessageText`, `userQuestion`, and `actionLabel`.
10. BFF route rejects arrays/objects where strings are expected and rejects aggregate payloads that could smuggle prompt fragments.
11. BFF logs lengths, action type, status, latency, and request/session identifiers, but never logs full prompts, selected text, original explanation text, questions, provider response bodies, API keys, or secrets.
12. Provider failure does not echo prompt text or selected text in user-visible errors.
13. Core owns all prompt bodies and action instruction strings.
14. Core owns pure parser/normalizer logic.
15. WebView remains owner of DOM selection and modal rendering.
16. RN remains owner of transport and does not own prompt text or provider calls.
17. The mobile bridge missing path fails closed for both initial toolbar action and follow-up and is covered by sentinel tests.
18. Existing Add to Notepad HTML preservation continues to pass.
19. Existing SelectionOverlay RN-to-Web action invocation continues to pass.
20. Existing teaching plan, learner analysis, LLM stream, wrap-up, Mermaid, save/load, and main/module Sensei paths are not regressed.
21. Core package exports include the new selection prompt/capability modules.
22. BFF model task routing includes Selection Sensei config with JSON response MIME type and temperature parity.
23. WebView bundle is regenerated after WebView/Core/protocol changes that affect embedded mobile runtime.
24. Direct-provider sweep has no remaining modal-flow provider calls in `handleToolbarAction`, `dispatchFollowupToAI`, or `ensureSelectionChat`.

TURN-20260605T190803Z boundary red-test mapping:

- No mobile direct provider and bridge-missing fail-closed: `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` tests `mobile toolbar action uses bridge with structured domain payload and never calls local provider`, `mobile follow-up uses bridge with explicit modal context and never calls local provider`, `mobile bridge missing fails closed for toolbar action without local provider fallback`, and `mobile bridge missing fails closed for follow-up without local provider fallback`; current expected failure is missing `../src/selectionSenseiRouting`.
- No final prompt strings or provider controls in mobile route payloads: `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` and `__tests__/BffClient.test.ts` assert payloads exclude `prompt`, `systemInstruction`, `instruction`, `model`, `temperature`, and `providerOptions`; current expected failures are missing routing helper or missing client method.
- BFF prompt/control/cap rejection: `bff/tests/selectionSenseiModal.validation.red.test.js` asserts route rejection for forbidden prompt/provider keys, non-LLM and arbitrary actions, unknown keys, and oversized modal context; current expected failure is missing BFF route returning 404.
- Desktop compatibility: `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` test `desktop compatibility uses local Core path for toolbar action`; current expected failure is missing routing helper.
- Remaining impossible-before-layer deferrals: provider failure user-safe error, route-call de-duplication after `selectionSenseiRouting` exists, reload/retry migrated route behavior, and direct-provider sweep removal proof require production routing/service seams and must be added or expanded in the packet that implements those seams.

TURN-20260605T194731Z boundary correction evidence:

- Current public mobile bridge direct-provider behavior is covered by `__tests__/selectionSensei.test.ts` tests `mobile bridge explainSimpler path does not create or use browser Selection Sensei chat` and `mobile bridge askQuestion path does not create or use browser Selection Sensei chat`. Validation exit `1` shows both fail because `mockChatsCreate` receives browser Selection Sensei chat config with the current system instruction.
- Current public follow-up direct-provider behavior is covered by `__tests__/selectionSensei.test.ts` test `mobile follow-up composer does not call browser Selection Sensei chat locally`. Validation exit `1` shows it fails because `mockSendMessage` receives the follow-up question locally.
- Current duplicate/in-flight public behavior is covered by `__tests__/selectionSensei.test.ts` test `duplicate rapid mobile toolbar actions do not duplicate local provider work while pending`. Validation exit `1` shows it fails because current old behavior calls local provider twice while the first request is pending.
- Stronger route-call de-duplication remains precisely blocked until `src/selectionSenseiRouting.ts` exists; the WebView routing/refactor packet must add a route-call-count assertion that duplicate rapid toolbar invocations produce at most one bridge/BFF modal request while pending.
- TURN-20260605T202519Z dependency invariant correction: Core parser ownership now includes explicit runtime dependency ownership for `json5`. This keeps invariant 14 green for parser custody and avoids relying on the root app dependency as an implicit provider of a Core runtime dependency. Mobile direct-provider, BFF provider execution, bridge-missing fail-closed, and routing invariants remain blocked/red for later packets.
- TURN-20260605T203651Z Core provider-boundary invariant update: Core now has an injectable Selection Sensei modal capability that does not import provider SDKs or browser chat objects. The Core seam is provider-agnostic through `CoreLlmClient`; BFF provider execution, mobile route wiring, bridge-missing fail-closed behavior, and public WebView direct-provider removal remain red/blocked for later packets.
- TURN-20260605T205157Z Core boundary invariant correction: Core now rejects every WDG-005C declared forbidden/control field before LLM execution (`prompt`, `finalPrompt`, `promptText`, `message`, `instruction`, `systemInstruction`, `model`, `temperature`, `config`, `tools`, `providerOptions`, `safetySettings`, `history`, `requestId`, `chat`), rejects all non-LLM actions, and rejects follow-up requests missing explicit initial action metadata or initial response content.
- TURN-20260605T210646Z BFF boundary invariant update: BFF now owns the server route and provider execution seam for Selection Sensei modal messages. `bff/src/controllers/selectionSenseiController.js` rejects unknown keys, prompt/provider/control-shaped keys, non-LLM actions, unsupported actions, missing ask/follow-up context, invalid transcript roles, and oversized fields before service execution; `bff/src/services/selectionSenseiService.js` calls Core `runSelectionSenseiModalMessage` through `CoreLlmAdapter`; `bff/src/integration/geminiGateway.js` routes task `selection_sensei_modal` through Selection Sensei JSON config. Mobile/WebView/RN direct-provider removal and bridge fail-closed invariants remain red/blocked for later packets.
- TURN-20260605T212253Z BffClient boundary invariant update: mobile network transport now posts only structured Selection Sensei modal domain payloads to the BFF route and surfaces BFF structured errors through `formatHttpError`. `__tests__/BffClient.test.ts` exits `0` and asserts toolbar/follow-up bodies omit prompt/provider/control fields. RN bridge, WebView routing, bridge-missing fail-closed, public direct-provider removal, and duplicate route-work invariants remain red/blocked.
- TURN-20260605T213520Z RN bridge boundary invariant update: `SenseiMobile/src/mobile/bridge/contracts.ts` now defines structured `selectionSensei:modalMessageRequest` and `selectionSensei:modalMessageResult` variants, and `SenseiMobile/src/mobile/MainScreen.tsx` passes the payload opaquely to `BffClient.runSelectionSenseiModalMessage` before enqueuing a same-request structured result. `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` exits `0` and asserts no prompt/provider ownership or learner-text error echo in this branch. WebView routing, bridge-missing fail-closed, public direct-provider removal, and duplicate route-work invariants remain red/blocked.
- TURN-20260605T214730Z RN type ownership correction: Selection Sensei modal payload/result types are now bridge-owned in `SenseiMobile/src/mobile/bridge/contracts.ts`, while `SenseiMobile/src/mobile/network/types.ts` imports/re-exports them for BffClient. This removes the WDG-008 bridge -> network -> bridge type ownership cycle without changing MainScreen runtime dispatch or BffClient behavior.
- TURN-20260605T215752Z WebView boundary invariant update: `src/selectionSensei.ts` now routes mobile toolbar and follow-up modal LLM work through structured bridge payloads and `selectionSensei:modalMessageResult`, while preserving desktop local compatibility through the existing browser chat generator. `src/selectionSenseiRouting.ts` fails closed when mobile bridge transport is unavailable and rejects non-LLM actions before provider routing. `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` and `__tests__/selectionSensei.test.ts` exit `0`, proving mobile toolbar/follow-up do not call browser Gemini chat locally, bridge-missing does not fall back to local provider, duplicate rapid toolbar work emits at most one modal request while pending, and prompt/provider control fields are omitted from WebView bridge payloads.
- TURN-20260605T221844Z WebView bridge fail-closed correction: `src/mobile/webviewBridge.ts` now clears stale cached native transport when the current `window.ReactNativeWebView?.postMessage` is absent or non-callable. `__tests__/webviewBridge.failClosed.test.ts` exits `0`, proving `sendToNative` returns `false` for no native bridge and after a previously valid bridge is removed or replaced by a non-callable channel. `__tests__/selectionSensei.test.ts` exits `0` and proves `addToNotepad`, `copy`, and `share` remain local public actions and emit no `selectionSensei:modalMessageRequest`.
- TURN-20260605T222730Z final boundary evidence: `npm run webview:bundle` exited `0`; generated output contains the structured Selection Sensei modal request/result path; final source/generated provider sweep found no blocking mobile Selection Sensei direct-provider route; focused root Jest aggregate, BFF validation/service tests, Core build, and diff hygiene all exited `0`.

TURN-20260605T200403Z boundary custody evidence:

- Invariants 13, 14, and 21 are implemented for the WDG-004 custody scope: Core owns Selection Sensei prompt bodies/action instruction strings and pure parser/normalizer logic, and Core package exports include the new selection prompt/parser modules.
- Mobile direct-provider invariants remain red as expected. `__tests__/selectionSensei.test.ts` still exits `1` for public mobile toolbar/ask/follow-up direct-provider and duplicate local-provider tests.
- Routing and BFF invariants remain blocked as expected. `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` still fails by missing `../src/selectionSenseiRouting`, `__tests__/BffClient.test.ts` still fails by missing `client.runSelectionSenseiModalMessage`, and `bff/tests/selectionSenseiModal.validation.red.test.js` still fails by missing route `404`.

### Trust-Boundary Schema Plan

Status: GREEN by TURN-20260605T222730Z for Selection Sensei modal trust-boundary schema, structured client transport, and final validation

Proposed Core request types:

- `SelectionSenseiToolbarActionType = 'explainSimpler' | 'explainWithAnalogy' | 'explainInMoreDepth' | 'showAnExample' | 'showExampleCodeSnippet' | 'askQuestion'`
- `SelectionSenseiModalMessageRequest = SelectionSenseiToolbarActionRequest | SelectionSenseiFollowUpRequest`
- `SelectionSenseiToolbarActionRequest` fields:
  - `mode: 'toolbarAction'`
  - `actionType`
  - `selectedText`
  - `originalSenseiMessageText`
  - `actionLabel`
  - `userQuestion?`
- `SelectionSenseiFollowUpRequest` fields:
  - `mode: 'followUp'`
  - `modalConversationId`
  - `selectedText`
  - `originalSenseiMessageText`
  - `initialActionType`
  - `initialActionLabel`
  - `initialResponse?: { suggestedTitle?: string; explanation?: string; rawText?: string }`
  - `modalTranscript: Array<{ role: 'user' | 'sensei'; text: string }>`
  - `question`

Proposed BFF Zod constraints:

- `mode`: discriminated union of `toolbarAction` and `followUp`.
- `actionType` / `initialActionType`: enum of the six LLM toolbar actions only.
- Selection Sensei must use its own generous modal-context caps. Do not blindly reuse the current main Sensei bounded history caps of 8 entries, 1000 chars per entry, and 4000 total chars; one Selection Sensei modal answer may be around 2000 chars, and follow-up continuity needs the useful parts of the prior answer.
- `selectedText`: string, min 1, proposed max 12000 chars unless implementation discovers a product reason to cap selected snippets lower.
- `originalSenseiMessageText`: string, min 1, proposed max 48000 chars so a long source Sensei answer or explanation context can be carried without immediate truncation.
- `actionLabel`: string, min 1, proposed max 80 chars, and preferably derived/validated from the action map rather than trusted from client.
- `userQuestion`: optional string, proposed max 8000 chars; required for `askQuestion`, rejected or ignored with tests for non-ask actions.
- `question`: required for `followUp`, min 1, proposed max 8000 chars.
- `initialResponse.explanation` and `initialResponse.rawText`: bounded strings, proposed max 24000 chars each so a normal generated modal answer can preserve its conclusion.
- `modalTranscript`: bounded array, proposed max 24 entries; each text proposed max 12000 chars; roles restricted to `user` and `sensei`.
- `modalTranscript` aggregate text cap: proposed max 64000 chars after per-entry caps. The implementation may choose a higher aggregate cap if deterministic tests and mobile/BFF request handling remain stable, but it must remain explicit and enforced.
- Overall prompt-rendered structured input cap for this route: proposed max 96000 chars across selected text, original context, questions, initial response, and transcript. This is intentionally larger than the current main Sensei stream cap because modal follow-up context may include long generated answers; if implementation chooses a lower cap, record the product/operational reason in the Decision Log before code edits.
- `modalConversationId`: bounded opaque string generated by WebView when modal state resets; do not use it as an authorization token.
- Unknown keys rejected with `.strict()`.
- No `prompt`, `message`, `instruction`, `systemInstruction`, `model`, `temperature`, `config`, raw provider `history`, `tools`, or `providerOptions` keys accepted.
- Truncation policy must be explicit and tested. Current main Sensei history sanitization preserves the head of oversized entries and drops the tail; Selection Sensei should not silently inherit that behavior if it loses modal-answer conclusions. Prefer preserving current question, initial response summary/result fields, latest transcript turns, and user-safe oversize errors over unobservable truncation.

Proposed BFF response:

- Success: `{ success: true, result: { suggestedTitle?: string, explanation?: string, rawText?: string, parseStrategy: string, hadFence: boolean } }`
- Failure: `{ success: false, code: string, message: string }`

Implementation may refine the exact response type, but it must keep Core-owned parsing/prompting and WebView-owned modal presentation. The follow-up route must not rely on hidden provider chat history or BFF-owned modal state for this migration; it must receive explicit bounded modal context from WebView and validate it at the BFF trust boundary.

TURN-20260605T190803Z schema red-test evidence:

- `bff/tests/selectionSenseiModal.validation.red.test.js` covers old prompt-string payload rejection, non-LLM action rejection, arbitrary action/prompt-control rejection, unknown provider option key rejection, oversized selected text, oversized transcript entry, oversized transcript array, oversized transcript aggregate, and oversized overall prompt-rendered structured input.
- Current validation result is red because the route is missing and returns 404 before schema validation. Later BFF implementation must make the same tests fail/pass by explicit schema status codes and structured error bodies, not by route absence.
- The exact truncation-versus-rejection behavior for oversized modal context remains an implementation decision; WDG-003 tests currently require rejection with `400` or `413` for oversize cases.

TURN-20260605T194731Z schema correction evidence:

- `bff/tests/selectionSenseiModal.validation.red.test.js` now also contains explicit negative cases for `instruction`, `temperature`, arbitrary unknown client key, raw provider `history`, invalid modal transcript role, missing/empty `askQuestion.userQuestion`, non-ask stray `userQuestion`, missing/empty follow-up `question`, follow-up missing required modal context, oversized `userQuestion`, oversized `actionLabel`, oversized `initialResponse.explanation`, and oversized `initialResponse.rawText`.
- Current validation remains red at the missing route: exit `1`, `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`. The BFF route/schema implementation packet must make these cases fail/pass by validation, not by route absence.

TURN-20260605T210646Z schema implementation evidence:

- `POST /sessions/:sessionId/selection-sensei/modal-message` is implemented and `bff/tests/selectionSenseiModal.validation.red.test.js` exits `0`; invalid cases now receive structured `400` or `413` bodies instead of route `404`.
- Enforced caps: `selectedText` 12000, `originalSenseiMessageText` 48000, `actionLabel` 80, `userQuestion` 8000, follow-up `question` 8000, `initialResponse.suggestedTitle` 500, `initialResponse.explanation` 24000, `initialResponse.rawText` 24000, `modalTranscript` 24 entries, transcript entry text 12000, transcript aggregate 64000, `modalConversationId` 200, and total structured input 96000.
- Oversize behavior is explicit rejection with `413 PAYLOAD_TOO_LARGE`, not silent truncation.
- BFF accepts only structured toolbar and follow-up domain inputs. `modalConversationId` is accepted only as BFF correlation metadata and is not translated into Core prompt input.

TURN-20260605T212253Z client schema-usage evidence:

- `SenseiMobile/src/mobile/network/types.ts` defines toolbar and follow-up `SelectionSenseiModalMessagePayload` shapes matching the WDG-006 BFF schema fields, plus the structured result type.
- `BffClient.runSelectionSenseiModalMessage` posts the payload as-is to the BFF route and does not synthesize prompt text, system instructions, model names, temperatures, provider options, history, or transport-only request IDs.
- BFF remains the validation owner; the client transport preserves request shape and surfaces structured BFF rejection details.

TURN-20260605T213520Z RN schema-usage evidence:

- RN bridge contracts reuse the WDG-007 Selection Sensei modal payload/result types and do not duplicate BFF caps or prompt rendering.
- MainScreen treats `parsed.payload` as opaque transport data and does not inspect selected text, user question, follow-up question, prompt strings, provider controls, or response bodies. BFF remains the schema/trust-boundary owner.
- TURN-20260605T214730Z correction: the modal payload/result types are now defined in the bridge contracts and re-exported by network types, so the schema-usage evidence remains true without a bridge/network import cycle.

TURN-20260605T215752Z WebView schema-usage evidence:

- WebView mobile toolbar requests send only `mode`, `actionType`, `selectedText`, `originalSenseiMessageText`, `actionLabel`, and optional `userQuestion` for ask-question.
- WebView mobile follow-up requests send explicit stateless modal context: `modalConversationId`, `selectedText`, `originalSenseiMessageText`, `initialActionType`, `initialActionLabel`, `initialResponse`, bounded `modalTranscript`, and current `question`.
- Public and helper tests assert bridge payloads omit `prompt`, `finalPrompt`, `promptText`, `message`, `instruction`, `systemInstruction`, `model`, `temperature`, `providerOptions`, `safetySettings`, `config`, `tools`, `chat`, and `history`. WebView does not own BFF caps; BFF remains the trust-boundary validation owner.

TURN-20260605T222730Z final trust-boundary evidence:

- `bff/tests/selectionSenseiModal.validation.red.test.js` exited `0` and continues to prove forbidden prompt/provider/control keys, unknown keys, invalid actions, missing ask/follow-up fields, invalid transcript roles, oversized selected text, oversized user/follow-up questions, oversized action label, oversized initial response fields, transcript entry/count/aggregate caps, and total structured input cap are rejected with structured 400/413 responses.
- `__tests__/BffClient.test.ts`, `__tests__/MainScreen.selectionSenseiModalBridge.test.ts`, `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`, and `__tests__/selectionSensei.test.ts` all passed in the final root aggregate and prove client/RN/WebView transport stays structured without final prompt/provider-control fields.

### Runtime Routing Plan

Status: GREEN by TURN-20260605T222730Z for Selection Sensei modal runtime routing, including generated WebView bundle evidence

Desktop initial-action path:

1. `src/selectionSensei.ts:handleToolbarAction` builds a structured request from current UI state.
2. It calls a new `requestSelectionSenseiModalMessage` routing helper with `mode: 'toolbarAction'`.
3. The helper sees `isMobileWebView === false` and invokes local Core capability through `createBrowserCoreLlmClient(this.ai)`.
4. Core builds the toolbar prompt, calls `llm.callText(prompt, { task: 'selection_sensei_modal' })`, parses/normalizes the response, and returns a structured result.
5. WebView applies existing modal title/content/fallback behavior and stores bounded initial modal context for follow-up.

Desktop follow-up path:

1. `src/selectionSensei.ts:handleFollowupSubmit` keeps composer UI behavior and calls `dispatchFollowupToAI`.
2. `dispatchFollowupToAI` appends the user/loading bubbles as today, then builds a structured request with `mode: 'followUp'`, current question, selected text/context, initial response, and bounded modal transcript.
3. The routing helper uses browser Core client on desktop.
4. Core builds the follow-up prompt, calls `llm.callText(prompt, { task: 'selection_sensei_modal' })`, parses/normalizes the response, and returns structured result.
5. WebView formats/appends the follow-up answer as today.

Mobile initial-action path:

1. RN overlay action still sends `selectionSensei:invoke` to WebView so WebView can keep selected text/context snapshot ownership.
2. WebView `handleBridgeInvoke` calls `handleToolbarAction`.
3. `handleToolbarAction` builds the structured modal request and calls the routing helper.
4. The helper sees `window.__SENSEI_MOBILE_BUILD__ === true` and calls `requestSelectionSenseiModalMessageViaBridge`.
5. `requestSelectionSenseiModalMessageViaBridge` creates a request ID, registers resolver/timer, and sends Web-to-RN `selectionSensei:modalMessageRequest`.
6. `SenseiMobile/src/mobile/MainScreen.tsx` handles the request, calls `BffClient.runSelectionSenseiModalMessage`, and enqueues `selectionSensei:modalMessageResult`.
7. `BffClient` posts to `POST /sessions/:sessionId/selection-sensei/modal-message`.
8. BFF validates session/payload/rate limit, calls Core through `SelectionSenseiService`, and returns structured result.
9. WebView resolver receives result and updates modal.

Mobile follow-up path:

1. WebView follow-up uses the same `requestSelectionSenseiModalMessageViaBridge` helper with `mode: 'followUp'`.
2. RN/BFF/Core execute the same modal-message route with follow-up schema.
3. WebView appends or updates modal transcript with the normalized result.

Mobile bridge missing path:

1. In mobile build, if the native postMessage channel is unavailable or bridge send cannot be confirmed, reject the toolbar/follow-up request with a fail-closed error.
2. WebView displays a user-safe modal error.
3. Sentinel test proves the browser provider/local generator was not called.

TURN-20260605T215752Z runtime-routing implementation evidence:

- `src/mobile/webviewBridge.ts` returns a boolean send result; `src/mobile/webviewMessageRouter.ts` sends `selectionSensei:modalMessageRequest`, tracks request IDs/timeouts, and resolves/rejects `selectionSensei:modalMessageResult`.
- `src/selectionSenseiRouting.ts` selects bridge execution for mobile, local generation for desktop, rejects missing mobile bridge transport, and rejects non-LLM actions before any provider route.
- `src/selectionSensei.ts:handleToolbarAction` builds structured toolbar payloads for mobile and uses a pending request key to ignore duplicate rapid same-action requests while pending; desktop continues through the local generator.
- `src/selectionSensei.ts:dispatchFollowupToAI` builds structured follow-up payloads from explicit WebView-owned modal context and sends them through the same routing helper; it no longer calls the browser chat path in mobile bridge-present mode.
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` exits `0` and `__tests__/selectionSensei.test.ts` exits `0`, proving bridge-present routing, bridge-missing fail-closed behavior, public mobile direct-provider removal, and duplicate suppression.

TURN-20260605T221844Z runtime-routing correction evidence:

- `sendToNative` now clears stale cached sender state and returns `false` when a previously valid native bridge is removed or replaced by a non-callable channel.
- `requestSelectionSenseiModalMessageViaBridge` already rejects when `sendToNative` returns `false`; with the sender repair, actual transport loss cannot silently reuse an old bridge and cannot fall back to browser/provider execution.
- Public non-LLM WebView actions `addToNotepad`, `copy`, and `share` remain local and do not emit `selectionSensei:modalMessageRequest`.

TURN-20260605T222730Z final runtime-routing evidence:

- `npm run webview:bundle` exited `0` and left no tracked generated diff, indicating the embedded WebView bundle was already current with the WDG-009/009C source changes.
- Generated `index.js` contains `selectionSensei:modalMessageRequest`, `selectionSensei:modalMessageResult`, `requestSelectionSenseiModalMessage`, `requestSelectionSenseiModalMessageViaBridge`, and bridge-unavailable fail-closed text.
- Bounded generated snippets confirm `requestSelectionSenseiModalMessage` selects bridge execution when `isMobileWebView` is true and only invokes the local generator in the non-mobile branch.

TURN-20260605T190803Z runtime-routing red-test evidence:

- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` targets the future `requestSelectionSenseiModalMessage` helper for toolbar action, follow-up, bridge-missing fail-closed behavior, and desktop compatibility.
- `__tests__/BffClient.test.ts` targets the future `BffClient.runSelectionSenseiModalMessage` method and expected route `POST /sessions/:sessionId/selection-sensei/modal-message`.
- Current root Jest validation is red at the missing routing helper; BFF client tests are added but not reached under `--bail`.

TURN-20260605T203651Z runtime-routing status:

- Core/browser desktop task routing now has the Core seam needed by the planned desktop compatibility path: `createBrowserCoreLlmClient` maps `selection_sensei_modal` to Selection Sensei JSON config.
- No WebView routing helper, BFF client method, RN bridge message, BFF route/schema/service, or public mobile direct-provider removal was implemented in WDG-005. Runtime Routing Plan remains BLOCKED for mobile/BFF/WebView rows until later packets.

TURN-20260605T194731Z runtime-routing correction evidence:

- `__tests__/selectionSensei.test.ts` now covers the existing public mobile WebView path in addition to the future routing helper. The tests drive `initializeSelectionSensei`, mobile-build selection capture, and `invokeSelectionSenseiBridgeAction` for `explainSimpler` and `askQuestion`.
- The same file covers the current public follow-up composer path by opening a modal flow, setting `selection-sensei-composer-input`, clicking `selection-sensei-send-button`, and asserting no browser chat `sendMessage` occurs locally.
- The future route-helper tests remain necessary but are no longer the only mobile routing evidence.

TURN-20260605T200403Z runtime-routing validation evidence:

- Routing remains intentionally unimplemented in WDG-004. The combined command for `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` and `__tests__/BffClient.test.ts` exited `1` with the expected missing `../src/selectionSenseiRouting` failure before BffClient tests ran.
- Individual `__tests__/BffClient.test.ts` exited `1` with expected `client.runSelectionSenseiModalMessage is not a function`, with 6 existing tests passing first.
- BFF validation exited `1` with expected `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`.

TURN-20260605T210646Z runtime-routing update:

- Server route path exists at `POST /sessions/:sessionId/selection-sensei/modal-message` and is mounted by `bff/src/server.js`.
- BFF route calls Selection Sensei service, which calls Core modal capability through `CoreLlmAdapter`; server Gemini task `selection_sensei_modal` uses Selection Sensei JSON config.
- Client-side routing remains intentionally unimplemented. `__tests__/BffClient.test.ts` still exits `1` for missing `client.runSelectionSenseiModalMessage`, and `__tests__/selectionSensei.test.ts` still exits `1` for public mobile direct-provider and duplicate local-provider behavior.

TURN-20260605T212253Z runtime-routing update:

- `BffClient.runSelectionSenseiModalMessage` posts to `/sessions/:sessionId/selection-sensei/modal-message` and now makes the BffClient route-shape tests green.
- RN bridge message handling, MainScreen dispatch, WebView routing helper, public direct-provider removal, bridge-missing fail-closed, and duplicate route-call guard remain intentionally unimplemented and blocked for later packets.

TURN-20260605T213520Z runtime-routing update:

- RN bridge message contracts and MainScreen dispatch now exist for `selectionSensei:modalMessageRequest` -> `BffClient.runSelectionSenseiModalMessage` -> `selectionSensei:modalMessageResult`.
- WebView does not yet emit the new request message; `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` still exits `1` with expected missing `../src/selectionSenseiRouting`, and `__tests__/selectionSensei.test.ts` still exits `1` for expected public mobile direct-provider and duplicate local-provider behavior.
- TURN-20260605T214730Z runtime-routing correction: RN bridge message contracts and MainScreen dispatch remain unchanged in behavior after type ownership repair. No WebView routing helper, provider removal, duplicate/in-flight guard, generated bundle, trace/master-plan, commit, push, staging, reset, checkout, or cleanup was performed.

### Red-Test Gate

Status: PASS / GREEN by TURN-20260605T224420Z for deterministic Selection Sensei migration gates. Prompt/parser, Core capability, BFF route/schema/service, BffClient, RN bridge, WebView routing, bridge fail-closed behavior, generated bundle, final source/generated provider sweep, trace/master-plan status, and selected final validation are green. Live provider smoke was not run in WDG-010 and remains a release-policy caveat, not a blocker for deterministic WDG-010 acceptance.

Before or alongside implementation, add failing tests that prove the current behavior is unsafe or incomplete:

- Mobile routing gate sentinel for Selection Sensei modal initial action: mobile uses bridge and does not call local/browser provider.
- Mobile routing gate sentinel for Selection Sensei modal follow-up: mobile uses bridge and does not call local/browser provider.
- Mobile bridge missing sentinel: mobile build without bridge rejects/fails closed for both initial action and follow-up and does not call local/browser provider.
- BFF rejects payload containing `prompt`, `systemInstruction`, `instruction`, `model`, `temperature`, or arbitrary action.
- BFF rejects raw provider `history`, arbitrary modal transcript roles, and oversized modal transcript.
- BFF rejects `addToNotepad`, `copy`, and `share` action types for LLM route.
- BFF rejects oversized selected text, oversized original context, oversized user question, oversized generated-answer context, oversized transcript entries, aggregate modal-context overflow, and missing ask question.
- BFF rejects follow-up without current question and rejects follow-up without enough explicit modal context.
- BFF/Core/WebView tests cover Selection Sensei modal context larger than main Sensei's current `1000` chars per history entry cap, proving a roughly 2000-char modal answer can still preserve useful follow-up context.
- BFF/Core/WebView tests cover oversized modal context behavior, including whether entries are truncated or rejected, and prove the behavior is explicit and user-safe.
- Core parser handles fenced JSON and malformed JSON5/loose payloads with parity to current parser tests.
- Prompt parity tests fail until Selection Sensei prompts/action instructions are Core-owned and toolbar/follow-up prompt builders are present.

TURN-20260605T190803Z Red-Test Gate table:

| Required red test | File / test name | Status | Current expected failure or deferral |
|---|---|---|---|
| Prompt SHA/length golden fixtures | `__tests__/selectionSensei.prompts.test.ts`: three `keeps the old ... runtime SHA and length ...` tests | GREEN_BY_TURN-20260605T200403Z | WDG-004 prompt suite exit `0`: 8 tests passed |
| Core prompt destination | `__tests__/selectionSensei.prompts.test.ts`: `exposes Selection Sensei prompt builders from the future Core prompt owner` | GREEN_BY_TURN-20260605T200403Z | WDG-004 prompt suite exit `0`: Core prompt owner exists and matches facade output |
| Toolbar action instruction old-value custody | `__tests__/selectionSensei.prompts.test.ts`: `keeps exact old toolbar action instruction strings through the src prompt facade` | GREEN_BY_TURN-20260605T200403Z | WDG-004 prompt suite exit `0`: exact old action values are preserved through the source facade |
| Toolbar action instruction future Core custody | `__tests__/selectionSensei.prompts.test.ts`: `exposes exact toolbar action instructions from the future Core prompt owner` | GREEN_BY_TURN-20260605T200403Z | WDG-004 prompt suite exit `0`: Core action map and builder expose exact instruction values |
| Parser tolerant parity | `__tests__/selectionSenseiResponseParser.test.ts`: repaired JSON, freeform extraction, malformed output tests | GREEN_BY_TURN-20260605T200403Z | WDG-004 parser suite exit `0`: parser parity tests passed |
| Core parser destination and fenced support | `__tests__/selectionSenseiResponseParser.test.ts`: `exposes Selection Sensei parser from the future Core owner with fenced payload support` | GREEN_BY_TURN-20260605T200403Z | WDG-004 parser suite exit `0`: Core parser owner exists and handles fenced payload |
| Mobile toolbar route gate | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`: `mobile toolbar action uses bridge with structured domain payload and never calls local provider` | GREEN_BY_TURN-20260605T215752Z | WDG-009 routing-helper suite exit `0`: 6 tests passed |
| Mobile follow-up route gate | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`: `mobile follow-up uses bridge with explicit modal context and never calls local provider` | GREEN_BY_TURN-20260605T215752Z | WDG-009 routing-helper suite exit `0`: follow-up bridge route uses explicit modal context |
| Public mobile toolbar direct-provider sentinel | `__tests__/selectionSensei.test.ts`: `mobile bridge explainSimpler path does not create or use browser Selection Sensei chat` | GREEN_BY_TURN-20260605T215752Z | WDG-009 public Selection Sensei suite exit `0`: public mobile toolbar sends structured bridge request and does not create/use browser chat |
| Public mobile ask direct-provider sentinel | `__tests__/selectionSensei.test.ts`: `mobile bridge askQuestion path does not create or use browser Selection Sensei chat` | GREEN_BY_TURN-20260605T215752Z | WDG-009 public Selection Sensei suite exit `0`: public mobile ask sends structured bridge request with `userQuestion` and does not create/use browser chat |
| Public mobile follow-up direct-provider sentinel | `__tests__/selectionSensei.test.ts`: `mobile follow-up composer does not call browser Selection Sensei chat locally` | GREEN_BY_TURN-20260605T215752Z | WDG-009 public Selection Sensei suite exit `0`: follow-up composer sends structured follow-up bridge request after initial result |
| Duplicate rapid public toolbar invocation | `__tests__/selectionSensei.test.ts`: `duplicate rapid mobile toolbar actions do not duplicate local provider work while pending` | GREEN_BY_TURN-20260605T215752Z | WDG-009 public Selection Sensei suite exit `0`: duplicate rapid toolbar action emits one modal bridge request and no local provider call |
| Bridge missing fail-closed toolbar/follow-up | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`: two `mobile bridge missing fails closed ...` tests | GREEN_BY_TURN-20260605T215752Z | WDG-009 routing-helper suite exit `0`: missing bridge rejects and local generator is not called |
| Bridge-present structured payload excludes prompt/control fields | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`; `__tests__/BffClient.test.ts`; `__tests__/selectionSensei.test.ts` route-payload tests | GREEN_BY_TURN-20260605T215752Z | WDG-009 routing/public tests assert the full forbidden prompt/provider-control field set is absent from bridge payloads; BffClient route tests were already green by WDG-007 |
| BFF trust-boundary forbidden keys/actions/caps | `bff/tests/selectionSenseiModal.validation.red.test.js` | ADDED_RED | WDG-003C added missing cases for `instruction`, `temperature`, unknown key, raw `history`, invalid role, missing/empty ask/follow-up questions, missing follow-up context, and oversize user/action/initial-response fields; command still exits `1` on missing route 404 |
| Reload/retry path uses migrated route | No production retry seam exists yet for Selection Sensei modal route | DEFERRED | Add immediately in BFF client/RN bridge packet when route retry behavior is designed |
| Malformed provider response normalized by Core | Core parser module exists; Core provider/capability service seam does not yet exist | PARTIAL_GREEN_WITH_SERVICE_DEFERRAL_BY_TURN-20260605T200403Z | Core parser parity/fenced malformed handling is green; add service-level malformed-provider-output test when Core/BFF execution seam is authorized |
| Desktop compatibility uses Core path | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`: `desktop compatibility uses local Core path for toolbar action` | ADDED_RED | Root Jest exit 1: missing `../src/selectionSenseiRouting` |
| Provider failure does not echo learner text | No service/error seam exists yet | DEFERRED | Add in Core/BFF service packet with stub provider failure |
| Duplicate/in-flight behavior does not duplicate provider work | `__tests__/selectionSensei.test.ts`: public duplicate rapid toolbar test | GREEN_BY_TURN-20260605T215752Z | WDG-009 public test asserts duplicate rapid mobile toolbar invocation emits at most one `selectionSensei:modalMessageRequest` while pending and does not call the local provider. |

### Test Gate Ledger

Status: GREEN for the Selection Sensei modal migration by TURN-20260605T222730Z; generated bundle, final sweep/status, and selected final validation are complete

Planned tests:

- `__tests__/corePromptParity.test.ts`: add Selection Sensei prompt SHA/length parity for system prompt, standard user prompt, ask prompt, and all action instruction variants.
- `__tests__/selectionSensei.core.functional.test.ts`: Core modal capability builds correct toolbar and follow-up prompts, calls `llm.callText` with task `selection_sensei_modal`, parses result, and handles malformed/fenced responses.
- `__tests__/selectionSenseiResponseParser.test.ts`: move import to Core or keep WebView facade import that re-exports Core parser; preserve JSON5 embedded quote behavior.
- `__tests__/selectionSensei.mobileRoutingGate.sentinel.test.ts`: WebView routing helper selects bridge on mobile and local Core path on desktop for both toolbar action and follow-up; bridge-missing mobile path fails closed.
- `__tests__/selectionSensei.test.ts`: toolbar action and follow-up use routing helper, preserve modal loading/content/transcript behavior, and do not call direct chat path for the modal flow.
- `__tests__/SelectionOverlayController.test.ts`: keep current RN overlay invocation tests passing; add coverage only if bridge action metadata changes.
- `__tests__/BffClient.test.ts`: `runSelectionSenseiModalMessage` posts toolbar and follow-up requests to the correct session route, retries unknown session if matching existing patterns, validates response shape, and returns null/throws consistently with selected design.
- `bff/tests/selectionSenseiModal.deterministic.int.test.js`: BFF route validation, rate-limit, and deterministic service behavior for toolbar and follow-up with stubbed provider/gateway where possible.
- Optional live smoke: `bff/tests/selectionSenseiModal.int.test.js` only if current BFF integration style requires a live provider and credentials/quota are available.

Planned validation commands, with byte-capped output for verbose validation:

- `npm run core:build`
- `npm test -- --runInBand __tests__/corePromptParity.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSensei.mobileRoutingGate.sentinel.test.ts __tests__/selectionSensei.test.ts __tests__/BffClient.test.ts`
- `cd bff && node tests/selectionSenseiModal.deterministic.int.test.js`
- `cd bff && npm test` if deterministic route tests and existing BFF integrations are stable in the environment
- `npm run webview:bundle` after WebView/Core changes
- `cd SenseiMobile && npm test -- --runInBand` after RN contract/MainScreen/BffClient changes
- `npm run analysis:run -- --include selectionSensei,selectionSenseiRouting,webviewMessageRouter,SenseiMobile/src/mobile/MainScreen,SenseiMobile/src/mobile/network/BffClient,SenseiMobile/src/mobile/bridge/contracts,bff/src/routes/selectionSensei,bff/src/controllers/selectionSensei,bff/src/services/selectionSensei,core/selectionSensei,core/prompts/selectionSensei`
- Direct provider sweep command from this block after implementation, with generated bundles/reports excluded for authored-source classification
- `git diff --check`

TURN-20260605T190803Z Test Gate Ledger entries:

| Test file | Test names / coverage | Status in WDG-003 | Validation evidence |
|---|---|---|---|
| `__tests__/selectionSensei.prompts.test.ts` | Prompt SHA/length golden tests, src facade action-instruction old values, future Core prompt owner, future Core action map/builder custody | GREEN_BY_TURN-20260605T200403Z | WDG-004 prompt suite exit `0`: 8 passed |
| `__tests__/selectionSenseiResponseParser.test.ts` | Parser repaired JSON, freeform, malformed output parity, future Core parser owner, and fenced payload support | GREEN_BY_TURN-20260605T200403Z | WDG-004 parser suite exit `0`: 5 passed |
| `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` | Mobile toolbar/follow-up bridge routing, bridge missing fail-closed, desktop compatibility | STILL_RED_BY_TURN-20260605T200403Z | Combined WDG-004 routing/BffClient command exit `1`, expected missing `../src/selectionSenseiRouting` |
| `__tests__/BffClient.test.ts` | Future `runSelectionSenseiModalMessage` route shape and rejection surfacing | STILL_RED_BY_TURN-20260605T200403Z | Individual WDG-004 BffClient suite exit `1`: 6 passed, 2 failed by missing `client.runSelectionSenseiModalMessage` |
| `bff/tests/selectionSenseiModal.validation.red.test.js` | BFF prompt/control/action/unknown-key/history/role/missing-context/cap negative validation | STILL_RED_BY_TURN-20260605T200403Z | WDG-004 BFF node command exit `1`, expected missing route `404 Cannot POST` before schema implementation |
| `__tests__/selectionSensei.test.ts` | Public mobile `invokeSelectionSenseiBridgeAction` toolbar/ask direct-provider sentinels, follow-up composer direct-provider sentinel, duplicate rapid toolbar local-provider guard | STILL_RED_BY_TURN-20260605T200403Z | WDG-004 Selection Sensei suite exit `1`: four red tests fail for expected old direct-provider behavior; four existing tests pass and one todo remains |
| `__tests__/selectionSensei.test.ts` route-call de-duplication | Stronger assertion that duplicate rapid toolbar actions emit at most one bridge/BFF request | BLOCKED_UNTIL_ROUTING_SEAM | Add in WebView routing/refactor packet immediately after `src/selectionSenseiRouting.ts` or bridge request helper exists |
| Core capability/service tests | Core prompt/capability/provider parser tests | PARTIAL_GREEN_WITH_SERVICE_DEFERRAL_BY_TURN-20260605T200403Z | Core prompt/parser modules exist and custody tests pass; provider execution/service tests remain deferred until route/service seam packet |
| `__tests__/selectionSenseiCoreModal.test.ts` | Core modal capability/provider-boundary tests for toolbar, ask, follow-up explicit context, null LLM, non-LLM action rejection, forbidden prompt/provider-control rejection, malformed provider output normalization, and browser task config | GREEN_BY_TURN-20260605T203651Z | WDG-005 combined command exit `0`: prompt/parser/Core modal suites passed, 20 tests total |
| `__tests__/selectionSenseiCoreModal.test.ts` | WDG-005C correction coverage for provider-bound system instruction delivery, all declared forbidden/control fields, all non-LLM actions, and follow-up required context | GREEN_BY_TURN-20260605T205157Z | WDG-005C combined command exit `0`: prompt/parser/Core modal suites passed, 21 tests total |
| `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` | WebView routing helper bridge-present toolbar/follow-up, bridge-missing fail-closed, desktop local compatibility, forbidden prompt/provider-control omission, and non-LLM action rejection | GREEN_BY_TURN-20260605T215752Z | WDG-009 routing-helper suite exit `0`: 1 suite and 6 tests passed |
| `__tests__/selectionSensei.test.ts` | Public mobile toolbar/ask/follow-up bridge request/result handling, no browser chat use, structured payload shape, and duplicate rapid toolbar suppression | GREEN_BY_TURN-20260605T215752Z | WDG-009 public Selection Sensei suite exit `0`: 1 suite passed, 8 tests passed, 1 pre-existing todo |
| `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` | RN bridge/MainScreen contract regression after WebView result resolver changes | GREEN_BY_TURN-20260605T215752Z | WDG-009 focused RN bridge suite exit `0`: 1 suite and 3 tests passed |
| `__tests__/webviewBridge.failClosed.test.ts` | Actual WebView sender fail-closed behavior with no native bridge and with previously valid bridge removed/replaced by non-callable channel | GREEN_BY_TURN-20260605T221844Z | WDG-009C bridge fail-closed suite exit `0`: 1 suite and 2 tests passed |
| `__tests__/selectionSensei.test.ts` | Public non-LLM actions `addToNotepad`, `copy`, and `share` remain local and emit no modal LLM request | GREEN_BY_TURN-20260605T221844Z | WDG-009C public Selection Sensei suite exit `0`: 1 suite passed, 9 tests passed, 1 pre-existing todo |
| `bff/tests/selectionSenseiModal.validation.red.test.js` | BFF route rejects prompt/control fields, non-LLM/unsupported actions, unknown keys, invalid transcript role, missing ask/follow-up context, and all declared caps with structured `400`/`413` errors | GREEN_BY_TURN-20260605T210646Z | WDG-006 BFF validation command exit `0`; route now validates instead of returning `404` |
| `bff/tests/selectionSenseiModal.service.test.js` | Deterministic BFF controller/service/Core handoff and server Gemini task config evidence | GREEN_BY_TURN-20260605T210646Z | WDG-006 BFF service/model command exit `0`; fake service and fake provider prove structured success and `selection_sensei_modal` JSON config |
| `__tests__/BffClient.test.ts` | `BffClient.runSelectionSenseiModalMessage` posts toolbar/follow-up structured route payloads and surfaces BFF structured rejection details | GREEN_BY_TURN-20260605T212253Z | WDG-007 BffClient command exit `0`: 8 tests passed; Selection Sensei payload assertions exclude prompt/provider-control fields |
| `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` | RN bridge contracts and MainScreen dispatch for Selection Sensei modal messages; opaque payload passthrough; structured success/failure result; fixed safe error string | GREEN_BY_TURN-20260605T213520Z | WDG-008 focused RN bridge/MainScreen command exit `0`: 3 tests passed |
| `__tests__/MainScreen.selectionSenseiModalBridge.test.ts` | WDG-008C bridge-owned modal type assertion and no bridge -> network type import cycle | GREEN_BY_TURN-20260605T214730Z | WDG-008C focused RN bridge/MainScreen command exit `0`: 3 tests passed |

### Review Remediation Ledger

Status: NOT_STARTED

No review artifact exists for this ExecPlan. Future review findings must be entered here with:

- finding source
- file/line
- still valid or stale after comparison with current code
- remediation plan
- validation evidence

### Final Migration Evidence

Status: PASS for the unified Selection Sensei toolbar/follow-up modal LLM flow by TURN-20260605T222730Z.

Final completion evidence:

- Scope Lock covers both toolbar action and follow-up as one modal LLM flow.
- Prompt/action custody is Core-owned and prompt golden tests pass.
- Parser/normalizer custody is Core-owned and parser parity tests pass.
- Core modal capability/provider-boundary tests pass.
- BFF validation negative tests pass with structured 400/413 results.
- BFF deterministic service/model-routing tests pass.
- BffClient, RN bridge/MainScreen, WebView routing, bridge fail-closed, and public Selection Sensei modal tests pass.
- `npm run webview:bundle` exited `0`; generated WebView output contains the structured Selection Sensei modal bridge route and no tracked generated diff remained.
- Final source/generated direct-provider sweep found no blocking mobile Selection Sensei direct-provider route. `ensureSelectionChat`, browser `Chat`, and `chat.sendMessage` remain classified as desktop-local compatibility only.
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` and `docs/llm_entry_exit_traces.md` were updated only for the proven Selection Sensei modal flow status.
- `git diff --check` exited `0` and `git diff --cached --name-status` had no output.

Remaining risks outside this scoped row: enhancement, key takeaway enhancement, and pedagogical directive generation remain separate LLM backlog items with direct-provider surfaces. Live provider smoke was not run in WDG-010 because the packet required deterministic selected validation and did not require credentials/quota-dependent smoke testing.

## Protocol Coverage Ledger for `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`

### TURN-20260605T180334Z - WDG-001 protocol activation classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | Planning state keeps mobile prompt/provider execution out of WebView after migration, assigns prompts/parsers/contracts to Core, provider/secrets/validation/routes to BFF, transport to React Native, and UI/modal state to WebView. No implementation proof exists yet. | Future packets must prove the rule with code and negative tests. |
| Non-Negotiable Rules | PASS | The ExecPlan requires verbatim prompt migration, Core prompt custody, BFF no prompt bodies, structured mobile inputs, mobile fail-closed bridge behavior, prompt-rendered caps, and negative tests. | Future implementation packets must satisfy each rule with tests before final evidence. |
| Required Authority Stack | PASS | TURN-20260605T180334Z refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, and this ExecPlan. | Re-read packet-named files again if a future watchdog packet requires it. |
| ExecPlan Compliance Block | PASS | The active ExecPlan contains Scope Lock, capability/mode matrix, provider sweep classification, prompt custody, parser custody, boundary invariants, trust-boundary schema plan, runtime routing plan, red-test gate, test gate ledger, review remediation ledger, and final migration evidence block for the unified modal flow. | Keep block current as implementation evidence arrives. |
| Phase 0: Activation | PASS | Backlog row is unified Selection Sensei modal LLM flow: toolbar action plus follow-up. Current entries are `src/selectionSensei.ts:handleToolbarAction`, `src/selectionSensei.ts:handleFollowupSubmit`, `src/selectionSensei.ts:dispatchFollowupToAI`, and parser surface `src/selectionSenseiResponseParser.ts`. | Next packet should run current fresh provider sweep before code edits. |
| Phase 1: Scope Lock | PASS | Scope Lock identifies Core prompt file `core/prompts/selectionSensei.ts`, Core capability `core/selectionSensei.ts`, BFF route `POST /sessions/:sessionId/selection-sensei/modal-message`, RN bridge/client owners, WebView owners, parser owner, desktop path, mobile path, and out-of-scope non-LLM actions. | Revisit only if watchdog changes scope. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | Matrix represents toolbar action, follow-up, desktop, mobile bridge present, bridge missing, malformed provider output, duplicate/in-flight behavior, and UI-owned modal behavior. | Add exact test names and statuses as tests are implemented. |
| Phase 3: Direct Provider Authority Sweep | BLOCKED | Earlier planning sweep exists, but this packet did not authorize a fresh source sweep beyond required status/diff commands and allowed file reads. Current fresh sweep is therefore not recorded. | Next pre-implementation packet should authorize and run the direct-provider sweep, then update this ledger with every hit. |
| Phase 4: Prompt Custody Ledger | PASS | Planning ledger has old prompt owners, target `core/prompts/selectionSensei.ts`, runtime SHA/length baselines for existing Selection Sensei system/user/ask prompt fixtures, and parity-test requirements. Implementation is pending. | Add golden/parity tests and new Core prompt SHA evidence in Core packet. |
| Phase 5: Parser / Normalizer Custody Ledger | PASS | Parser ownership is clear: pure parser/normalizer moves from `src/selectionSenseiResponseParser.ts` to Core, while modal display formatting remains WebView-owned. `json5` parity decision is recorded. Implementation is pending. | Add parser parity tests and Core-owned parser implementation in parser/Core packet. |
| Phase 6: Boundary Invariant Ledger | PASS | Invariants include no mobile direct provider, no final prompt strings, fail-closed missing bridge, Core prompt construction, BFF provider execution, BFF prompt/control/size rejection, parser parity, desktop compatibility, WebView UI ownership, provider failure behavior, duplicate/in-flight behavior, and no BFF prompt bodies. | Convert invariant rows from planning to test evidence during implementation. |
| Phase 7: Trust-Boundary Schema Plan | PASS | Schema plan lists every modal-message field, discriminated request modes, forbidden prompt/provider keys, generous Selection Sensei-specific per-field/per-entry/aggregate caps, and explicit truncation/rejection testing requirements. | Final numeric caps and truncate/reject behavior must be decided before BFF schema source edits. |
| Phase 8: Runtime Routing Plan | PASS | Routing plan defines desktop Core/browser path, mobile WebView -> RN -> BFF -> Core -> provider path, and bridge-missing fail-closed path for toolbar and follow-up. | Implement bridge and sentinel tests in later bounded packets. |
| Phase 9: Red-Test Gate | BLOCKED | Packet forbids test edits. Red tests are planned but not added. | First implementation packet that allows tests must add failing/golden tests before route work or record an approved deferral. |
| Phase 10: Implementation Order | PASS | ExecPlan recommends next packet as Milestone 0 / pre-implementation gates, not feature code. Route wiring is explicitly after prompt/parser custody gates. | Watchdog should send a bounded Milestone 0 packet next. |
| Backlog-Specific Instructions - Selection Sensei | PASS | Scope aligns with Selection Sensei toolbar action, follow-up, parser, prompt surfaces, WebView modal state ownership, and Core/BFF/RN targets. | Re-check sibling paths in each bounded implementation packet. |
| Test Gate Ledger | BLOCKED | Test files and commands are planned, but this packet forbids adding/updating tests and forbids implementation suites. | Add tests only under a watchdog packet that authorizes test edits. |
| Review Remediation Mode | N/A | No review artifact or PR review packet exists for this turn. | Apply only if watchdog sends a review remediation packet. |
| Final Migration Evidence Block | BLOCKED | Final evidence is intentionally `NOT_STARTED`; there is no implementation, validation, bundle, or live provider smoke evidence. | Fill only after implementation and validation gates pass or approved deferrals are recorded. |
| Stop Conditions | PASS | No unclassified protocol section remains. No contradiction with unified Selection Sensei modal scope was found. Dirty tree is recorded and accepted, with pre-existing tracked changes outside this packet not touched. | Stop if later packet reveals stale compliance block, prompt/parser ambiguity, mobile provider fallback, or unexpected staged files. |
| Output Contract | PASS | Worker return must include Packet ID `WDG-001-protocol-activation-ledger` and Turn ID `TURN-20260605T180334Z` with files, sections, validation, blockers, dirty baseline, diff summary, and recommended next packet. | Final response must use the packet’s exact requested format. |

### TURN-20260605T182838Z - WDG-002 pre-implementation gate classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | TURN-20260605T182838Z performed pre-implementation gating only. No prompt/provider/source routing implementation edits were made, and the plan still routes mobile Selection Sensei modal execution through BFF/Core. | Prove with code and tests in later bounded packets. |
| Non-Negotiable Rules | PASS | No prompt/provider/parser/source/test edits occurred. Diff evidence will show only ExecPlan edits plus backup-generated artifacts and pre-existing dirty files. | Keep mobile prompt/provider execution out of WebView during implementation. |
| Required Authority Stack | PASS | TURN-20260605T182838Z refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, `docs/llm_entry_exit_traces.md`, and this ExecPlan. | Re-read packet-named files again if watchdog requires it. |
| ExecPlan Compliance Block | PASS | This packet updated Progress, Surprises & Discoveries, Decision Log, Direct Provider Authority Sweep, Protocol Coverage Ledger, Validation and Acceptance, Artifacts and Notes, and Revision Note with turn-stamped WDG-002 evidence. | Keep live updates before/after every future discovery, edit, command, and validation result. |
| Phase 0: Activation | PASS | Backlog row remains unified Selection Sensei modal LLM flow: toolbar action plus follow-up. Fresh sweep found no contradiction. | Proceed only to watchdog-authorized next gate. |
| Phase 1: Scope Lock | PASS | Current cells remain known: Core prompt/capability/parser target, BFF route/service target, RN bridge/client target, WebView modal/UI owner, out-of-scope non-LLM actions, and explicit stateless modal context. | Re-open only if a future packet discovers a true sibling/scope conflict. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | Matrix already represents toolbar action and follow-up across desktop, mobile bridge present, bridge missing, provider failure, malformed output, duplicate/in-flight, ask mode, and non-LLM actions. | Add concrete test statuses during implementation packets. |
| Phase 3: Direct Provider Authority Sweep | PASS | Fresh sweep command exited 0 with 14492 bytes / 178 lines captured under a 70000-byte cap and every hit classified in the Direct Provider Authority Sweep table. | Later implementation must remove in-scope `src/selectionSensei.ts` modal provider path and rerun sweep. |
| Phase 4: Prompt Custody Ledger | PASS | Prompt custody remains planned and ready: old WebView prompt/action-instruction owners, target `core/prompts/selectionSensei.ts`, parity baselines, and follow-up explicit-context prompt requirement are recorded. | Add prompt parity/red tests in the next authorized test packet. |
| Phase 5: Parser / Normalizer Custody Ledger | PASS | Parser custody remains planned and ready: WebView parser surfaces and Core target are recorded; `json5` parity decision remains in force. | Add parser parity tests and Core parser move only when authorized. |
| Phase 6: Boundary Invariant Ledger | PASS | Boundary invariants remain explicit, including no mobile direct provider, no prompt strings at BFF/RN/WebView boundaries, fail-closed mobile bridge missing path, BFF validation, safe logging, parser custody, and UI ownership. | Convert invariants into tests/evidence in implementation packets. |
| Phase 7: Trust-Boundary Schema Plan | PASS | Schema plan remains ready with strict structured fields, forbidden prompt/provider keys, non-LLM action rejection, and Selection Sensei-specific generous caps. | Finalize truncation/rejection behavior before BFF schema code edits. |
| Phase 8: Runtime Routing Plan | PASS | Desktop Core/browser and mobile WebView -> RN -> BFF -> Core routing plans remain current for both toolbar action and follow-up, including bridge-missing fail closed. | Implement only under bounded Core/BFF/RN/WebView packets after red tests. |
| Phase 9: Red-Test Gate | BLOCKED | Packet forbids test edits. Required red tests are planned but not added. | Recommended next packet should authorize Selection Sensei red/golden test creation. |
| Phase 10: Implementation Order | PASS | This packet completed pre-implementation backup/read/sweep gates and recommends red-test work before source implementation. | Watchdog should send a red-test packet next. |
| Backlog-Specific Instructions - Selection Sensei | PASS | `src/selectionSensei.ts:handleToolbarAction`, `src/selectionSensei.ts:dispatchFollowupToAI`, and `src/selectionSenseiResponseParser.ts` remain represented, with toolbar and follow-up handled as one modal flow. | Future packets must stay within allowed subsystem scope. |
| Test Gate Ledger | BLOCKED | Tests are planned but none were authorized, added, updated, or run in WDG-002. | Add required positive/negative tests in next authorized packet. |
| Review Remediation Mode | N/A | No review artifact or PR review remediation packet exists for WDG-002. | Apply only if watchdog sends a review remediation packet. |
| Final Migration Evidence Block | BLOCKED | No implementation, route, bridge, bundle, direct-provider-removal proof, or test validation exists yet. | Fill after implementation validation passes or approved deferrals are recorded. |
| Stop Conditions | PASS | Backup succeeded, TEST protocol was readable, provider sweep was classified, no unexpected staged files were present at initial baseline, and no source/test edit was required for this packet. | Stop after final status/diff baseline and packet return. |
| Output Contract | PASS | Final worker return must include Packet ID `WDG-002-milestone-0-preimplementation-gates`, Turn ID `TURN-20260605T182838Z`, gate classifications, validation, dirty baseline, diff summary, and recommended next packet. | Use the watchdog packet's exact requested sections. |

### TURN-20260605T183746Z - WDG-002C live-document repair classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| `docs/protocols/PLAN.md` live-document behavior | PASS | The missed WDG-002 failed patch/context mismatch is now recorded in `Progress` and `Surprises & Discoveries`, including what happened, why it happened, supporting chat evidence, recovery path, and what remains. The WDG-002C correction-patch context mismatch was also recorded immediately. | Continue updating this ExecPlan immediately after every future failed command, surprising output, discovery, decision, validation result, or stopping point. |
| ExecPlan Compliance Block | PASS | This correction changes only live-document evidence and does not mark implementation-dependent gates green or alter prompt/provider/parser/routing scope. | Keep implementation gates blocked until a watchdog packet authorizes tests/source work and evidence exists. |
| Phase 10: Implementation Order | PASS | Recommended next packet remains WDG-003 red-test/golden-test work after watchdog accepts this repair; no source implementation was started. | Wait for watchdog before any red-test or implementation work. |
| Stop Conditions | PASS | No source/test edit, staging, reset, checkout, cleanup, backup, analyzer, bundle, provider sweep, or implementation validation occurred; current staged diff remains empty. | Stop after final correction return. |
| Output Contract | PASS | Final worker return must include Packet ID `WDG-002C-plan-live-doc-repair`, Turn ID `TURN-20260605T183746Z`, files changed, correction made, validation, blockers, dirty baseline, diff summary, and recommended next packet. | Use the correction packet's exact requested sections. |

### TURN-20260605T190803Z - WDG-003 red/golden tests classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | WDG-003 changed tests only and added red tests that target Core prompt/parser ownership plus mobile provider prohibition. No production prompt/provider/source edits occurred. | Implement Core prompt/parser/capability only in the next authorized packet. |
| Non-Negotiable Rules | PASS | Red tests cover prompt custody, no mobile prompt/provider-control payloads, no mobile local-provider fallback, bridge-missing fail-closed behavior, and BFF prompt/control/cap rejection. | Turn red tests green without weakening assertions. |
| Required Authority Stack | PASS | Required authority files, TEST protocol, master plan, trace doc, active ExecPlan, git state, and existing test/source seams were refreshed before test edits. | Refresh packet-named files again before any future packet work. |
| ExecPlan Compliance Block | PASS | This turn updated Progress, discoveries, decisions, prompt/parser/boundary/schema/routing/red-test/test ledgers, validation, artifacts, protocol coverage, revision note, and turn ledger with WDG-003 evidence. | Continue live updates before and after every meaningful future event. |
| Phase 4: Prompt Custody Ledger | PASS | `__tests__/selectionSensei.prompts.test.ts` now includes old runtime SHA/length fixtures and future Core prompt destination red check. | Add Core prompt owner and broader action-instruction parity in implementation packet. |
| Phase 5: Parser / Normalizer Custody Ledger | PASS | `__tests__/selectionSenseiResponseParser.test.ts` now includes parser parity fixtures and future Core parser destination/fenced payload red check. | Add Core parser owner and facade/export in implementation packet. |
| Phase 6: Boundary Invariant Ledger | PASS | Mobile routing, fail-closed, structured payload, desktop compatibility, and BFF rejection red tests are mapped; provider failure and duplicate/in-flight checks are explicitly deferred until seams exist. | Add deferred tests when corresponding routing/service seams are created. |
| Phase 7: Trust-Boundary Schema Plan | PASS | `bff/tests/selectionSenseiModal.validation.red.test.js` covers forbidden prompt/provider keys, arbitrary/non-LLM actions, unknown keys, oversized selected text, transcript entry/array/aggregate, and overall cap. | Implement BFF route/schema so failures become validation failures, then passes. |
| Phase 8: Runtime Routing Plan | PASS | `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` covers toolbar/follow-up bridge routing, bridge missing fail-closed, and desktop local/Core compatibility; `__tests__/BffClient.test.ts` covers client route shape. | Add `src/selectionSenseiRouting`, bridge/client/route implementation in authorized packets. |
| Phase 9: Red-Test Gate | PASS | Required red/golden tests are added or explicitly deferred with exact later triggers. Validation produced expected red failures: missing routing helper and missing BFF route. | Next packet should begin prompt/parser custody implementation, not skip tests. |
| Phase 10: Implementation Order | PASS | WDG-003 stopped after tests/ExecPlan updates and recommends prompt/parser custody implementation next. No production source work started. | Watchdog should authorize bounded Core prompt/parser/capability work next. |
| Backlog-Specific Instructions - Selection Sensei | PASS | Test names cover `handleToolbarAction` and `dispatchFollowupToAI` through the future routing helper, parser custody via `src/selectionSenseiResponseParser.ts`, and BFF/mobile modal flow. | Later WebView refactor packet must add direct assertions against modal methods once routing seam exists. |
| Test Gate Ledger | PASS | WDG-003 ledger lists exact test files, names, statuses, expected failures, and deferred items. | Use this ledger to drive implementation and validation packets. |
| Review Remediation Mode | N/A | No review artifact or review remediation packet is active. | Apply only if watchdog sends review remediation. |
| Final Migration Evidence Block | BLOCKED | No production implementation, provider removal, bundle, final sweep, or green validation exists yet. | Fill after implementation and validation gates pass. |
| Stop Conditions | PASS | No new sibling path or scope contradiction was found; no production edits occurred; `git diff --check` passed; final staged diff is empty. | Stop after returning WDG-003 results. |
| Output Contract | PASS | Final worker return will include Packet ID, Turn ID, changed files, sections, tests, classifications, validation, expected red failures, blockers, diff/staged state, and recommended next packet. | Use watchdog packet's exact section headings. |

### TURN-20260605T194731Z - WDG-003C red-test completeness correction classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS / RED_TEST_ADDED | WDG-003C changed only allowed tests and ExecPlan. Added tests continue to enforce Core prompt/action ownership and prohibit mobile public path browser chat/provider execution. | Implement Core prompt/action ownership and routed mobile execution only after watchdog accepts this correction. |
| Non-Negotiable Rules | PASS / RED_TEST_ADDED | Added exact action-string custody tests, public mobile no-browser-chat tests, public follow-up no-local-send test, duplicate local-provider red test, and expanded BFF forbidden field/cap tests. | Turn these tests green through Core/BFF/RN/WebView implementation, not by weakening assertions. |
| ExecPlan Compliance Block | PASS | WDG-003C start, correction reason, discoveries, decisions, test edits, validation, ledgers, protocol classification, artifacts, and revision note are turn-stamped. WDG-003 prior PASS is now qualified by WDG-003C correction evidence. | Keep the ExecPlan live in the next packet. |
| Phase 4: Prompt Custody Ledger | RED_TEST_ADDED | `__tests__/selectionSensei.prompts.test.ts` now covers all five non-ask action instruction strings and requires future Core action instruction map/builder custody. | Add `core/prompts/selectionSensei.ts` and migrate action instructions verbatim in prompt custody packet. |
| Phase 6: Boundary Invariant Ledger | RED_TEST_ADDED | `__tests__/selectionSensei.test.ts` now covers current public mobile toolbar/ask/follow-up direct-provider behavior and duplicate rapid toolbar local-provider duplication. | Add route-call de-dup assertion when `src/selectionSenseiRouting.ts` or bridge request helper exists. |
| Phase 7: Trust-Boundary Schema Plan | RED_TEST_ADDED | `bff/tests/selectionSenseiModal.validation.red.test.js` now includes missing negative cases for `instruction`, `temperature`, unknown key, raw `history`, invalid role, missing/empty ask and follow-up questions, missing follow-up context, and oversize user/action/initial-response fields. | Implement BFF route/schema so failures become validation failures instead of 404. |
| Phase 8: Runtime Routing Plan | RED_TEST_ADDED | Current public mobile WebView bridge path is tested through `initializeSelectionSensei`, selection capture, and `invokeSelectionSenseiBridgeAction`, in addition to future routing-helper tests from WDG-003. | Add bridge/routing implementation and make both public and helper sentinels pass. |
| Phase 9: Red-Test Gate | PASS / RED_TEST_ADDED | All authorable WDG-003 audit gaps were added. Remaining deferrals are precise: route-call de-dup after routing seam; reload/retry after BFF client/RN bridge route exists; provider failure/malformed Core service tests after Core/BFF service seams. | Watchdog may authorize prompt/parser custody implementation after auditing WDG-003C. |
| Phase 10: Implementation Order | PASS | This packet stops after tests/ExecPlan correction and recommends prompt/parser custody implementation only after watchdog accepts correction. | Do not proceed to implementation in this turn. |
| Backlog-Specific Instructions - Selection Sensei | PASS | `handleToolbarAction` and ask path are covered through public `invokeSelectionSenseiBridgeAction`; follow-up composer path is covered through public DOM controls; prompt/parser unified scope remains unchanged. | Later WebView refactor must preserve toolbar/follow-up modal flow as one capability. |
| Test Gate Ledger | RED_TEST_ADDED | Test Gate Ledger now lists WDG-003C exact test names, statuses, validation output, and narrow blocked route-call de-dup trigger. | Use this ledger for the next implementation packet. |
| Final Migration Evidence Block | BLOCKED | No production implementation, final sweep, bundle, or green validation exists yet. | Fill after implementation and validation gates pass. |
| Stop Conditions | PASS | No new sibling path or contradiction found; no production files edited; `git diff --check` passed; final staged diff empty. | Stop after worker return. |
| Output Contract | PASS | Final return includes packet ID, turn ID, changed files, sections, tests, classifications, validation, expected red failures, blockers, diff/staged state, and next packet. | Use requested response headings. |

### TURN-20260605T202519Z - WDG-004C dependency and protocol-ledger correction classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | This correction keeps Core as the owner of Selection Sensei parser behavior and makes Core own the runtime `json5` dependency needed by `core/selectionSensei.ts`. No mobile prompt/provider ownership was added. | Continue to remove mobile direct-provider execution only in later bounded routing/BFF packets. |
| Non-Negotiable Rules | PASS | No prompt text, BFF prompt body, mobile prompt payload, provider fallback, or parser behavior changed. The correction only declares the runtime parser dependency and repairs ledger coverage. | Keep prompt/provider/schema non-negotiables enforced in later packets. |
| Required Authority Stack | PASS | WDG-004C refreshed `AGENTS.md`, `docs/protocols/PLAN.md`, the active skill, all of the LLM migration protocol, this ExecPlan, `core/package.json`, relevant lock metadata, current git baselines, and `core/selectionSensei.ts` import evidence before edits. | Refresh packet-named authority files again before the next packet. |
| ExecPlan Compliance Block | PASS | This turn updates the live plan with start state, audit findings, dependency correction evidence, protocol-ledger repair, validation, artifacts, revision note, and the watchdog turn row without marking implementation-dependent BFF/mobile gates green. | Keep live-document updates immediate in the next packet. |
| Phase 0: Activation | PASS | The active backlog row remains the unified Selection Sensei modal flow covering toolbar action plus follow-up; WDG-004C found no new sibling path or scope contradiction. | Re-open activation only if a future sweep discovers a new direct-provider sibling. |
| Phase 1: Scope Lock | PASS | Scope-lock cells remain known: Core prompt/parser owners are implemented for custody, BFF/RN/WebView owners remain planned, desktop/mobile paths remain distinct, and out-of-scope non-LLM actions remain unchanged. | Later packets must not widen scope without a turn-stamped decision. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | The matrix still represents toolbar action and follow-up across desktop, mobile bridge present, bridge missing, provider failure, malformed output, duplicate/in-flight, ask mode, and non-LLM actions. WDG-004C does not alter invocation paths. | Update concrete test statuses when routing/BFF seams are implemented. |
| Phase 3: Direct Provider Authority Sweep | PASS / UNCHANGED | WDG-004C was not authorized to rerun a provider sweep. The last fresh sweep remains TURN-20260605T182838Z and WDG-004 validation kept expected red direct-provider tests red. | Rerun sweep in the later packet that removes in-scope direct-provider calls and before final evidence. |
| Phase 4: Prompt Custody Ledger | GREEN / UNCHANGED | Prompt/action custody remains green from WDG-004; WDG-004C did not touch prompt files or tests. | Keep prompt custody tests passing in validation. |
| Phase 5: Parser / Normalizer Custody Ledger | GREEN | Parser custody remains green and now has explicit Core runtime dependency ownership for `json5` in `core/package.json` and linked Core lock metadata. | Keep parser tests passing and add service-level malformed-output tests when execution seam exists. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL | Dependency ownership strengthens Core parser invariant. Mobile direct-provider, BFF provider execution, bridge-missing fail-closed, duplicate route-call, and route validation invariants remain red/blocked for expected later-packet reasons. | Implement and validate those invariants in bounded route/BFF/RN/WebView packets. |
| Phase 7: Trust-Boundary Schema Plan | BLOCKED / UNCHANGED | WDG-004C did not implement BFF schema or validation. The existing schema plan and red tests remain the authority for forbidden fields, caps, unknown keys, and modal transcript limits. | BFF route/schema packet must turn red validation cases into passing validation failures. |
| Phase 8: Runtime Routing Plan | BLOCKED / UNCHANGED | WDG-004C did not add `src/selectionSenseiRouting`, BffClient methods, RN bridge messages, BFF route, or provider execution. | Next implementation packet must stay bounded to the watchdog-authorized subsystem. |
| Phase 9: Red-Test Gate | PASS / PARTIAL_GREEN | Prompt/action and parser custody rows remain green from WDG-004. Mobile/public direct-provider, BFF route/schema, BffClient, routing helper, retry/provider-failure/de-dup rows remain red/blocked. | Do not advance final migration evidence until remaining red rows are implemented and validated. |
| Phase 10: Implementation Order | PASS | WDG-004C only repairs dependency metadata and ledger coverage after prompt/parser custody. It does not start BFF/RN/WebView/provider implementation early. | Recommended next packet remains bounded BFF route/schema or routing work after watchdog acceptance. |
| Backlog-Specific Instructions - Selection Sensei | PASS | Scope still covers `handleToolbarAction`, `dispatchFollowupToAI`, and `src/selectionSenseiResponseParser.ts`; Core parser ownership now includes its runtime dependency. | Preserve the unified toolbar/follow-up modal flow in later packets. |
| Test Gate Ledger | PARTIAL_GREEN | Prompt/action and parser tests remained green after the dependency correction: prompt suite exit `0` with 8 tests passed, parser suite exit `0` with 5 tests passed. BFF/mobile/routing rows remain red/blocked. | Use later packets to turn remaining red rows green. |
| Review Remediation Mode | N/A | WDG-004C is a watchdog correction packet, not PR review remediation. No review artifact is active. | Apply only if watchdog sends a review remediation packet. |
| Final Migration Evidence Block | BLOCKED | Full migration evidence remains unavailable because BFF/mobile/provider routing is not implemented and final sweep/bundle/live evidence has not run. | Fill only after all implementation gates pass or approved deferrals exist. |
| Stop Conditions | PASS | No new sibling path or contradiction was found; edits stayed within allowed files; `git diff --check` exited `0`; final `git diff --cached --name-status` had no output. | Stop after WDG-004C return. |
| Output Contract | PASS | Final worker return must include WDG-004C packet ID, turn ID, changed files, sections, correction summary, repaired protocol classifications, validation, expected reds, blockers, diff/staged state, and next packet. | Use the watchdog-requested section headings. |

### TURN-20260605T203651Z - WDG-005 core modal capability/provider-boundary classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | Core now owns Selection Sensei modal request/result types, toolbar/ask/follow-up prompt construction, parser normalization, and provider-agnostic capability execution through injected `CoreLlmClient`. No mobile prompt/provider ownership was added. | Remove mobile direct-provider execution only in later WebView/RN/BFF packets. |
| Non-Negotiable Rules | PASS | WDG-005 keeps prompt text in Core, BFF still has no prompt bodies, mobile final-prompt payloads are rejected in Core tests, and no direct provider SDK call was introduced. | Later BFF/RN/WebView packets must preserve structured payloads and fail-closed behavior. |
| Required Authority Stack | PASS | Packet-authorized targeted refresh completed for active ExecPlan sections, Core files, current prompt/parser tests, Core patterns, and git baselines. Full authority stack was not reread because packet explicitly allowed using the stack already loaded unless drift appeared. | Refresh packet-named files in the next packet. |
| ExecPlan Compliance Block | PASS | WDG-005 updated turn ledger, progress, decisions, prompt/parser/boundary/routing/test ledgers, protocol coverage, validation, artifacts, and revision note without marking BFF/mobile gates green. | Continue live-document updates before and after future discoveries/edits/validation. |
| Phase 0: Activation | PASS | Backlog row remains unified Selection Sensei modal flow covering toolbar action plus follow-up; no sibling path or scope contradiction was found. | Re-open only if future sweep discovers a new direct-provider sibling. |
| Phase 1: Scope Lock | PASS | Core capability owner is now implemented; BFF/RN/WebView owners remain planned; desktop/mobile paths remain distinct; WebView modal UI ownership remains unchanged. | Later packets must implement only their authorized ownership cells. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS / PARTIAL_GREEN | Core toolbar, ask, follow-up, malformed provider output, missing provider, forbidden payload, and browser task-config rows now have focused tests. Mobile bridge/BFF/runtime rows remain red/blocked. | Update matrix row statuses when BFF/RN/WebView seams are implemented. |
| Phase 3: Direct Provider Authority Sweep | PASS / UNCHANGED | WDG-005 did not rerun a provider sweep by packet scope and did not remove or add direct provider paths. Public mobile direct-provider tests remain red for expected old behavior. | Rerun sweep in the packet that removes `src/selectionSensei.ts` direct provider calls and before final migration evidence. |
| Phase 4: Prompt Custody Ledger | GREEN | Core owns toolbar, ask, action-instruction, and follow-up prompt construction; combined prompt/parser/Core modal suite passed with 20 tests. | Keep prompt custody tests passing in later packets. |
| Phase 5: Parser / Normalizer Custody Ledger | GREEN | `runSelectionSenseiModalMessage` normalizes provider text through Core `parseSelectionSenseiResponsePayload`; malformed loose output test passed. | Add BFF service-level malformed provider response tests when BFF service exists. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL_GREEN | Core provider boundary is injected and provider-agnostic; Core rejects non-LLM actions and forbidden prompt/provider-control fields. Mobile direct-provider, bridge-missing, BFF provider execution, and route de-dup invariants remain red/blocked. | Implement remaining invariants in bounded route/bridge/WebView packets. |
| Phase 7: Trust-Boundary Schema Plan | BLOCKED / UNCHANGED | WDG-005 adds Core defensive rejection tests, but BFF schema/route validation is still not implemented and BFF red tests still fail by route `404`. | BFF route/schema packet must turn BFF validation reds green. |
| Phase 8: Runtime Routing Plan | BLOCKED / PARTIAL_GREEN | Browser Core task routing for `selection_sensei_modal` is implemented and tested; WebView routing helper, RN bridge, BffClient, and BFF route are untouched and remain blocked. | Next implementation packet should target one bounded routing/BFF subsystem after watchdog approval. |
| Phase 9: Red-Test Gate | PASS / PARTIAL_GREEN | Core capability rows are now green; public mobile direct-provider, BffClient, BFF route/schema, retry/provider-failure/de-dup rows remain red/blocked for expected reasons. | Do not mark final migration evidence green until remaining rows pass. |
| Phase 10: Implementation Order | PASS | WDG-005 performed Core capability/provider-boundary and desktop browser task routing after prompt/parser custody and before BFF/RN/WebView route work, matching protocol order. | Proceed only to a watchdog-authorized BFF or routing packet next. |
| Backlog-Specific Instructions - Selection Sensei | PASS | Core modal capability covers toolbar action and follow-up as one Selection Sensei modal flow; parser and prompt owners remain Core. | Later packets must preserve unified toolbar/follow-up modal flow. |
| Test Gate Ledger | PARTIAL_GREEN | Core build and combined prompt/parser/Core modal tests passed; public mobile, BffClient, and BFF route tests remain red for expected later-packet reasons. | Use remaining red rows to drive next packet. |
| Review Remediation Mode | N/A | WDG-005 is not PR review remediation and no review artifact is active. | Apply only if watchdog sends review remediation. |
| Final Migration Evidence Block | BLOCKED | Full migration evidence remains unavailable because BFF/RN/WebView/provider routing is not implemented, bundle not run, and final sweep not run. | Fill only after all implementation gates pass or approved deferrals exist. |
| Stop Conditions | PASS | Core capability did not require forbidden files; follow-up context is explicit/stateless; model config matched expected source; prompt/parser tests passed; expected red failure reasons did not drift; no staged files. | Stop after WDG-005 return. |
| Output Contract | PASS | Final worker return must include WDG-005 packet ID, turn ID, changed files, implementation summary, Core decisions, protocol classifications, validation, expected reds, blockers, diff/staged state, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T205157Z - WDG-005C core modal boundary correction classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | Core remains provider-agnostic and now owns the full provider-bound prompt string plus structured request/result types; no provider SDK import was added. | Continue to keep provider execution injected through Core/BFF seams. |
| Non-Negotiable Rules | PASS | Core tests prove the provider-bound string includes the Core-owned system instruction and mode prompt, and Core rejects prompt/provider-control payloads before LLM execution. | Later BFF/RN/WebView packets must preserve structured payload boundaries. |
| ExecPlan Compliance Block | PASS | WDG-005C finding, failed patch recovery, decisions, test updates, Core correction, validation, protocol classification, artifacts, and revision note are turn-stamped. | Keep future packet evidence concise unless detailed output is explicitly required. |
| Phase 4: Prompt Custody Ledger | GREEN | `runSelectionSenseiModalMessage` now sends `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` plus the mode prompt to `llm.callText`; Core modal tests fail if either is omitted. | Keep provider-bound prompt evidence green in later packets. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL_GREEN | Core rejects declared forbidden fields, non-LLM actions, and incomplete follow-up context before provider execution. Mobile direct-provider, bridge, BFF route, and route de-dup invariants remain red/blocked. | Implement remaining invariants in bounded BFF/RN/WebView packets. |
| Phase 7: Trust-Boundary Schema Plan | PASS / CORE_DEFENSE_ONLY | Core defensive validation now aligns with forbidden/control field intent, but final BFF schema remains blocked until BFF route work. | BFF schema packet must implement route-level caps and validation. |
| Phase 9: Red-Test Gate | PASS | Missing Core negative coverage from WDG-005 is now represented in `__tests__/selectionSenseiCoreModal.test.ts`; combined Core suite passes with 21 tests. | Keep later BFF/mobile reds until their packets. |
| Phase 10: Implementation Order | PASS | WDG-005C stayed Core-only and corrected the Core seam before BFF/RN/WebView routing. | Proceed only under watchdog-authorized BFF or routing packet. |
| Backlog-Specific Instructions | PASS | Toolbar and follow-up prompt execution remain in Core; modal UI state remains WebView-owned and untouched. | Preserve unified modal flow in later packets. |
| Test Gate Ledger | PARTIAL_GREEN | Core prompt/boundary tests pass; public mobile, BffClient, and BFF validation tests remain red for expected missing seams. | Use remaining red rows to drive next packet. |
| Final Migration Evidence Block | BLOCKED | Full migration evidence is unavailable until BFF/RN/WebView routing, provider removal, bundle, final sweep, and validation are complete. | Fill only after full migration gates pass. |
| Stop Conditions | PASS | No new sibling path or out-of-scope file need appeared; no staged files; validation did not drift unexpectedly. | Stop after WDG-005C return. |
| Output Contract | PASS | Final worker return includes packet ID, turn ID, changed files, protocol/final gates, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T210646Z - WDG-006 BFF route/schema/service classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | BFF service calls Core `runSelectionSenseiModalMessage` through `CoreLlmAdapter`; BFF does not import Selection Sensei prompt builders or contain Selection Sensei prompt bodies. | Keep client/mobile payloads structured in next packets. |
| Non-Negotiable Rules | PASS | BFF route accepts structured domain inputs only and rejects prompt/provider/control payloads, unknown keys, bad actions, missing context, and oversize fields with structured errors. | BffClient/RN/WebView must not send final prompts or provider controls. |
| ExecPlan Compliance Block | PASS | WDG-006 start, decisions, implementation checkpoint, failed validation, repair, validation results, ledgers, artifacts, and revision note are turn-stamped and concise. | Continue concise packet evidence. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL_GREEN | BFF provider execution and route validation invariants are green for the server seam; public mobile direct-provider, bridge fail-closed, BffClient, and de-dup invariants remain red/blocked. | Implement client/RN/WebView route transport next. |
| Phase 7: Trust-Boundary Schema Plan | PASS | Concrete BFF caps and strict schema are implemented and validated by `bff/tests/selectionSenseiModal.validation.red.test.js` exit `0`. | Preserve caps in BffClient/RN/WebView payload types. |
| Phase 8: Runtime Routing Plan | PASS / PARTIAL_GREEN | Server route exists at `POST /sessions/:sessionId/selection-sensei/modal-message`; BffClient/RN/WebView routing remains blocked and expected-red. | Add BffClient/RN/WebView transport under a later packet. |
| Phase 9: Red-Test Gate | PASS | Existing BFF validation red test is now green by validation semantics, not route absence. | Keep public mobile and BffClient reds until their packets. |
| Phase 10: Implementation Order | PASS | BFF route/schema/service followed Core capability and did not edit BffClient/RN/WebView routing. | Next packet may target BffClient/RN/WebView routing. |
| Backlog-Specific Instructions | PASS | BFF route covers the unified toolbar/follow-up modal flow and translates follow-up modal context without owning UI/modal state. | Preserve WebView modal-state ownership in routing packet. |
| Test Gate Ledger | PASS / PARTIAL_GREEN | BFF validation and deterministic service/model tests pass; BffClient and public mobile tests remain expected-red for missing later seams. | Turn those remaining red rows green later. |
| Final Migration Evidence Block | BLOCKED | Full migration remains incomplete until BffClient/RN/WebView routing, provider removal, bundle, final sweep, and validation pass. | Fill only at final migration packet. |
| Stop Conditions | PASS | No out-of-scope file edit was needed; no staged files; deterministic positive evidence did not require live provider access. | Stop after WDG-006 return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, protocol/final gates, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T212253Z - WDG-007 BffClient modal transport classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | Mobile client owns transport only and posts structured domain input to BFF; no prompt construction or provider execution was added. | RN bridge/WebView routing must preserve transport-only ownership. |
| Non-Negotiable Rules | PASS | `__tests__/BffClient.test.ts` exits `0` and asserts Selection Sensei posted bodies omit prompt/provider-control fields. | Keep prompt/provider controls out of RN/WebView messages. |
| ExecPlan Compliance Block | PASS | WDG-007 start, decision, implementation checkpoint, validation, ledgers, artifacts, and revision note are turn-stamped and concise. | Continue concise packet evidence. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL_GREEN | BffClient structured request invariant is green; RN bridge, WebView routing, bridge fail-closed, public direct-provider, and duplicate route-work invariants remain blocked/red. | Implement RN/WebView transport next. |
| Phase 7: Trust-Boundary Schema Plan | PASS | Client uses WDG-006 structured schema types and leaves validation ownership to BFF. | Preserve exact payload shape in bridge contracts. |
| Phase 8: Runtime Routing Plan | PASS / PARTIAL_GREEN | BffClient route path is implemented; RN/MainScreen/WebView routing remains untouched and blocked. | Add RN bridge and WebView routing helper under later packet. |
| Phase 9: Red-Test Gate | PASS | Existing BffClient red tests are green for transport semantics. | Keep public WebView direct-provider reds until routing/provider-removal packet. |
| Phase 10: Implementation Order | PASS | BffClient method follows BFF route/schema/service and precedes RN/WebView routing. | Next packet may target RN bridge or WebView routing. |
| Backlog-Specific Instructions | PASS | BffClient tests cover toolbar and follow-up payload shapes. | Preserve unified modal flow in RN/WebView bridge. |
| Test Gate Ledger | PASS / PARTIAL_GREEN | BffClient gate is green and BFF route remains green; public mobile direct-provider tests remain expected-red. | Turn public mobile and bridge fail-closed rows green later. |
| Final Migration Evidence Block | BLOCKED | Full migration still needs RN bridge, WebView routing, provider removal, bundle, sweep, and final validation. | Fill only at final migration packet. |
| Stop Conditions | PASS | No RN/WebView/BFF/Core/generated/trace/master-plan edit was required; no staged files. | Stop after WDG-007 return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, gates, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T213520Z - WDG-008 RN bridge modal transport classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | RN bridge/MainScreen owns transport only: it passes structured payload to `BffClient.runSelectionSenseiModalMessage` and enqueues structured result/error; no prompt/provider/parser/config logic was added. | WebView routing must call this bridge contract next without local provider fallback. |
| Non-Negotiable Rules | PASS | Focused test asserts the MainScreen branch does not own prompt/provider fields and failure result uses a fixed safe error string instead of arbitrary error text. | Keep prompt/provider controls out of WebView bridge payloads in the next packet. |
| ExecPlan Compliance Block | PASS | WDG-008 start, failed patch recovery, decisions, implementation checkpoint, test evidence, validation, ledgers, artifacts, and revision note are turn-stamped and concise. | Continue concise packet evidence. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL_GREEN | RN bridge structured request/result invariant is green; WebView routing, bridge-missing fail-closed, public direct-provider removal, and duplicate route-work remain red/blocked. | Implement WebView routing/helper and provider removal next. |
| Phase 7: Trust-Boundary Schema Plan | PASS | RN reuses the BffClient modal payload/result types and remains transport-only; BFF remains validation owner. | WebView must construct only structured domain payloads. |
| Phase 8: Runtime Routing Plan | PASS / PARTIAL_GREEN | Native bridge path exists for Selection Sensei modal messages; WebView request source remains blocked and expected-red. | Add WebView routing helper and bridge resolver in later packet. |
| Phase 9: Red-Test Gate | PASS | RN bridge/MainScreen focused test is green; WebView routing and public direct-provider red tests remain expected-red for later seams. | Turn WebView red tests green in the WebView routing packet. |
| Phase 10: Implementation Order | PASS | RN bridge follows BffClient and precedes WebView routing/provider removal; diff is limited to allowed RN/test/ExecPlan files plus pre-existing dirty files untouched. | Next packet should target WebView routing/provider-removal. |
| Backlog-Specific Instructions | PASS | Toolbar and follow-up shapes are transportable through the shared payload union without RN branching into prompt construction. | Preserve unified toolbar/follow-up modal flow in WebView. |
| Test Gate Ledger | PASS / PARTIAL_GREEN | RN bridge gate is green; BffClient and BFF remain green; WebView/direct-provider gates remain red. | Add WebView routing helper tests/implementation next. |
| Final Migration Evidence Block | BLOCKED | Full migration still needs WebView routing/helper, public provider removal, bundle, final sweep, and final validation. | Fill only at final migration packet. |
| Stop Conditions | PASS | No out-of-scope source, BFF/Core, WebView, generated, trace/master, staged, commit, push, reset, checkout, or cleanup work was required. | Stop after WDG-008 return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, gates, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T214730Z - WDG-008C RN type ownership and ExecPlan repair classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| ExecPlan Compliance Block | PASS | WDG-008C start, audit finding, type-location decision, type repair, stale `Outcomes & Retrospective` repair, validation, ledgers, artifacts, and revision note are turn-stamped. | Keep living sections current in the next WebView packet. |
| Phase 6: Boundary Invariant Ledger | PASS | Bridge contracts now own Selection Sensei modal bridge-facing types; network types import/re-export them, removing the bridge/network type cycle. | Preserve this ownership direction when WebView emits the request. |
| Phase 8: Runtime Routing Plan | PASS / PARTIAL_GREEN | RN bridge contract and MainScreen dispatch remain green; no WebView routing started. | Implement WebView routing/provider removal next. |
| Phase 10: Implementation Order | PASS | Correction occurred before WebView routing/provider removal and was limited to type ownership, focused tests, and ExecPlan. | Continue to WebView only after watchdog accepts this correction. |
| Test Gate Ledger | PASS | RN bridge focused test and BffClient suite both exit `0` after type repair. | Add WebView routing tests/implementation next. |
| Final Migration Evidence Block | BLOCKED | Full migration still needs WebView routing, provider removal, bundle, final sweep, and final validation. | Fill only at final migration packet. |
| Stop Conditions | PASS | No WebView/BFF/Core/generated/trace/master source edit was required; no staged files. | Stop after WDG-008C return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, classifications, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T215752Z - WDG-009 WebView Selection Sensei modal routing/provider removal classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| ExecPlan Compliance Block | PASS | WDG-009 start, routing decisions, patch recovery, boundary guard, test updates, validation, ledgers, artifacts, outcomes, revision note, and turn ledger are turn-stamped. | Keep final sweep/bundle/status packet updates concise and live. |
| Phase 3: Direct Provider Authority Sweep | PASS / PARTIAL_GREEN | Focused static check still finds browser `GoogleGenAI`/`Chat` in `src/selectionSensei.ts` for preserved desktop local compatibility, while mobile toolbar/follow-up route through `requestSelectionSenseiModalMessage` and `requestSelectionSenseiModalMessageViaBridge`; public tests prove mobile does not create/use browser chat. | Run the full direct-provider sweep in the final evidence packet and classify desktop compatibility separately. |
| Phase 6: Boundary Invariant Ledger | PASS | WebView mobile path constructs structured payloads only, bridge-missing fails closed, non-LLM actions remain local/rejected by helper, and duplicate rapid toolbar work emits one modal request while pending. | Generated bundle/final validation remains pending. |
| Phase 7: Trust-Boundary Schema Plan | PASS | WebView sends only WDG-006/RN/BffClient structured fields and tests assert prompt/provider-control keys are absent; BFF remains validation owner for caps and unknown-key rejection. | Preserve these fields when bundling and final sweeping. |
| Phase 8: Runtime Routing Plan | PASS | `selectionSensei:modalMessageRequest`/`selectionSensei:modalMessageResult` WebView routing is implemented for toolbar and follow-up; desktop compatibility remains local; missing bridge rejects. | Bundle embedded WebView and run final integration sweep when authorized. |
| Phase 9: Red-Test Gate | PASS | WDG-003/WDG-003C public mobile routing/direct-provider tests are green because behavior changed, not because assertions were weakened. | No additional WDG-009 red rows remain; final provider-failure/live smoke may be handled in final packet if authorized. |
| Phase 10: Implementation Order | PASS | WebView routing followed Core, BFF, BffClient, and RN seams; no generated bundle, trace/master-plan status, staging, commit, push, reset, checkout, or cleanup was performed. | Recommended next packet is bundle/final sweep/status. |
| Test Gate Ledger | PASS | Routing-helper, public Selection Sensei, and RN bridge regression suites all exited `0`. | Add final bundle/sweep validation rows in the next packet. |
| Final Migration Evidence Block | BLOCKED | Full migration still needs generated WebView bundle, final direct-provider sweep/classification, trace/master-plan status if authorized, and final validation. | Fill after final packet evidence exists. |
| Stop Conditions | PASS | No BFF/Core/RN/generated/trace/master edit was required, no staged files appeared, and no new sibling path or scope contradiction was discovered. | Stop after WDG-009 return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, classifications, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T221844Z - WDG-009C WebView bridge fail-closed test repair classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| ExecPlan Compliance Block | PASS | WDG-009C start, stale bridge cache finding, repair decision, code/test changes, validation, ledgers, artifacts, revision note, and turn ledger are turn-stamped. | Keep final bundle/sweep/status packet updates concise and live. |
| Phase 6: Boundary Invariant Ledger | PASS | WebView continues sending only structured modal LLM requests; public `addToNotepad`, `copy`, and `share` remain local and emit no modal LLM request. | Preserve local-only actions during bundling/final sweep. |
| Phase 8: Runtime Routing Plan | PASS | Actual `sendToNative` returns `false` for absent native bridge and after stale valid bridge removal/non-callable replacement; Selection Sensei bridge requests reject through this path with no provider fallback. | Bundle embedded WebView and run final integration/sweep when authorized. |
| Phase 9: Red-Test Gate | PASS | Focused bridge sender fail-closed tests and public non-LLM action tests are present and green. | No WDG-009C red rows remain. |
| Phase 10: Implementation Order | PASS | This correction repaired only WDG-009 WebView bridge/test behavior; no generated bundle, final sweep/status update, commit, push, staging, reset, checkout, or cleanup was performed. | Recommended next packet is bundle/final sweep/status. |
| Test Gate Ledger | PASS | Bridge fail-closed, routing-helper, and public Selection Sensei suites exited `0`; diff hygiene and staged-state checks passed. | Add bundle/final validation rows in the next packet. |
| Final Migration Evidence Block | BLOCKED | Full migration still needs generated WebView bundle, final direct-provider sweep/classification, trace/master-plan status if authorized, and final validation. | Fill after final packet evidence exists. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, classifications, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T222730Z - WDG-010 final bundle/sweep/status classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| ExecPlan Compliance Block | PASS | WDG-010 start, bundle result, final sweeps, validation, status-doc edits, failed patch-context recovery, ledger updates, artifacts, outcomes, and revision note are turn-stamped and current. | Watchdog audit may review; no implementation packet remains for this scoped row. |
| Phase 1: Scope Lock | PASS | Scope remains the unified Selection Sensei toolbar action plus follow-up modal LLM flow; final sweep found no new Selection Sensei sibling path. | Do not reopen scope unless a later audit finds a concrete new direct-provider sibling. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | Final status covers toolbar/follow-up, desktop compatibility, mobile bridge-present routing, bridge-missing fail-closed behavior, duplicate pending guard, and generated bundle evidence. | Keep matrix current if future status changes. |
| Phase 3: Direct Provider Authority Sweep | PASS | Final source/generated sweep classifies BFF `GeminiGateway` as server provider execution, Core `CoreLlmClient` as provider-agnostic boundary, Selection Sensei `ensureSelectionChat`/`Chat`/`chat.sendMessage` as desktop-local compatibility only, and generated bundle hits as accepted copies or unrelated backlog/debug surfaces. No blocking mobile Selection Sensei direct-provider route remains. | Future non-Selection-Sensei backlog rows need their own sweeps. |
| Phase 4: Prompt Custody Ledger | PASS | Final sweep confirms `core/prompts/selectionSensei.ts` owns prompt/action/follow-up prompt construction; source facade remains a re-export; generated prompt text is bundle output. | Preserve Core custody in future edits. |
| Phase 5: Parser / Normalizer Custody Ledger | PASS | Final sweep confirms `core/selectionSensei.ts` owns parser/normalizer behavior and `src/selectionSenseiResponseParser.ts` remains a facade; final tests include parser and Core modal suites. | Preserve Core parser ownership in future edits. |
| Phase 6: Boundary Invariant Ledger | PASS | Final validation proves structured payload routing, BFF provider ownership, no mobile local provider fallback, non-LLM local actions, and generated bundle route presence. | None for this scoped row. |
| Phase 7: Trust-Boundary Schema Plan | PASS | BFF validation test exits `0` for forbidden keys/actions/caps/aggregate limits; client/RN/WebView tests prove structured transport without prompt/provider-control fields. | None for this scoped row. |
| Phase 8: Runtime Routing Plan | PASS | Source and generated WebView route mobile toolbar/follow-up through `selectionSensei:modalMessageRequest`/`selectionSensei:modalMessageResult`; bridge-missing path fails closed; desktop remains local compatibility. | None for this scoped row. |
| Phase 9: Red-Test Gate | PASS | Previously red prompt/parser/Core/BFF/BffClient/RN/WebView/bridge fail-closed tests are green for implementation reasons; final root aggregate exits `0`. | None for this scoped row. |
| Phase 10: Implementation Order | PASS | Final bundle/sweep/status occurred after Core, BFF, BffClient, RN bridge, WebView routing, and bridge fail-closed packets. | Commit/review only if explicitly authorized. |
| Backlog-Specific Instructions | PASS | Toolbar action and follow-up were completed together as one Selection Sensei modal flow. | None for this scoped row. |
| Test Gate Ledger | PASS | Final selected validation commands all exited `0`: bundle, root aggregate, BFF validation, BFF service, Core build, diff check, and staged-state check. | None for this scoped row. |
| Final Migration Evidence Block | PASS | Bundle, final sweep, trace/master-plan status updates, selected validation, diff hygiene, and staged-state gates passed; generated bundle has no tracked diff. | Watchdog audit can decide whether to authorize commit/review. |
| Stop Conditions | PASS | No source/test repair was needed, no stale mobile direct-provider path was found, generated output contains the structured bridge path, and no staged files appeared. | Stop after WDG-010 return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, generated files changed, classifications, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T224420Z - WDG-010C ExecPlan final-state repair classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| ExecPlan Compliance Block | PASS | Top implementation status, Scope Lock, Capability Matrix, and Red-Test Gate current-state wording now agree with WDG-010 final evidence. | Watchdog audit may review; no runtime/source gate reopened. |
| Phase 1: Scope Lock | PASS | Near-top Scope Lock status now says PASS/GREEN for the unified Selection Sensei toolbar action plus follow-up modal LLM flow and notes no new sibling path was found. | None for this correction. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | Near-top matrix status now says PASS/GREEN and names the final routed/validated states, including generated bundle and validation evidence. | None for this correction. |
| Phase 9: Red-Test Gate | PASS | Red-Test Gate status no longer says bundle/final sweep/status/final provider evidence are pending; it preserves only the live provider smoke caveat as not run and non-blocking for deterministic WDG-010 acceptance. | None for this correction. |
| Final Migration Evidence Block | PASS | Existing WDG-010 final evidence remains PASS; this packet only repaired stale current-state headings. | None for this correction. |
| Stop Conditions | PASS | No code/test/status-doc/generated edits were required; staged state remained empty. | Stop after WDG-010C return. |
| Output Contract | PASS | Final worker return must include packet ID, turn ID, changed files, validation, blockers, diff summary, and next packet. | Use watchdog-requested headings. |

### TURN-20260605T200403Z - WDG-004 core prompt/parser custody classification

| Protocol section | Current classification | Evidence / rationale | Required next action |
|---|---|---|---|
| Core Rule | PASS | Core now owns Selection Sensei prompt bodies, toolbar action instruction strings, and pure parser/normalizer logic. WebView source files are facades/delegates for prompt/parser custody. | Route/provider custody is still blocked for later packets. |
| Non-Negotiable Rules | PASS | Prompt text and action strings moved verbatim first. BFF received no prompt bodies. `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` no longer retain duplicate migrated bodies. | Next packets must keep mobile payloads structured and remove browser provider execution. |
| Required Authority Stack | PASS | WDG-004 refreshed required authority docs, TEST protocol, master plan, trace doc, active ExecPlan, current git baselines, and directly named source/test files before edits. | Refresh packet-named files again in the next packet. |
| ExecPlan Compliance Block | PASS | WDG-004 updated Progress, Surprises & Discoveries, Decision Log, Prompt Custody Ledger, Parser/Normalizer Ledger, Boundary Invariant Ledger, Runtime Routing Plan, Red-Test Gate, Test Gate Ledger, Protocol Coverage Ledger, Validation and Acceptance, Artifacts and Notes, Revision Note, and Watchdog Turn Ledger with turn-stamped evidence. | Keep routing/BFF/mobile gates red until implementation evidence exists. |
| Phase 0: Activation | PASS | TURN-20260605T202519Z repair: WDG-004 operated under the already locked unified Selection Sensei modal backlog row and did not discover a new sibling path or scope contradiction. | Re-open only if a later sweep discovers a new direct-provider sibling. |
| Phase 1: Scope Lock | PASS | TURN-20260605T202519Z repair: WDG-004 preserved known ownership cells: Core prompt/parser owners, planned BFF/RN/WebView owners, desktop/mobile paths, and WebView modal UI ownership. | Keep scope unchanged unless a future watchdog packet explicitly revises it. |
| Phase 2: Capability x Mode x Lifecycle Matrix | PASS | TURN-20260605T202519Z repair: the matrix already covered toolbar action and follow-up modes; WDG-004 changed only prompt/action/parser custody and did not alter lifecycle routing rows. | Later route/BFF packets must update row-level test statuses. |
| Phase 3: Direct Provider Authority Sweep | PASS / UNCHANGED | TURN-20260605T202519Z repair: WDG-004 did not rerun the provider sweep, but validation intentionally kept mobile direct-provider red tests red, proving direct-provider removal was not falsely claimed. The last fresh classified sweep remains TURN-20260605T182838Z. | Rerun sweep in the packet that removes `src/selectionSensei.ts` direct provider calls and before final migration evidence. |
| Phase 4: Prompt Custody Ledger | GREEN | `core/prompts/selectionSensei.ts` owns prompt/action symbols, `src/prompts.ts` delegates to Core, `src/selectionSensei.ts` uses the Core-owned action helper, and `__tests__/selectionSensei.prompts.test.ts` passed with 8 tests. | Follow-up prompt execution/capability remains for a later Core/BFF route packet. |
| Phase 5: Parser / Normalizer Custody Ledger | GREEN | `core/selectionSensei.ts` owns parser/normalizer behavior, `src/selectionSenseiResponseParser.ts` is a facade, and `__tests__/selectionSenseiResponseParser.test.ts` passed with 5 tests. | Add service-level malformed provider output tests when Core/BFF execution seam exists. |
| Phase 6: Boundary Invariant Ledger | PASS / PARTIAL | Core ownership invariants are green. Mobile direct-provider, BFF provider execution, bridge missing fail-closed, and duplicate route-call invariants remain red/blocked with expected failures. | Implement routing/BFF/RN/WebView seams in later bounded packets. |
| Phase 7: Trust-Boundary Schema Plan | BLOCKED / UNCHANGED | TURN-20260605T202519Z repair: WDG-004 did not implement BFF schema or validation; existing red BFF tests still fail by missing route `404`, so schema gates remain blocked. | Implement BFF schema/route in a later bounded packet and turn schema red tests green. |
| Phase 8: Runtime Routing Plan | BLOCKED / UNCHANGED | WDG-004 did not implement `src/selectionSenseiRouting`, BffClient route methods, BFF routes, RN bridge wiring, or mobile routing. Expected red tests still fail for missing helper/method/route or public direct-provider behavior. | Next implementation packet should target a bounded BFF or routing subsystem after watchdog approval. |
| Phase 9: Red-Test Gate | PASS / PARTIAL_GREEN | Prompt/action and parser red rows are now green. Mobile/public direct-provider, BFF route/schema, BffClient, routing helper, retry/provider-failure/de-dup route rows remain red/blocked for expected reasons. | Do not mark final migration evidence green until those later rows pass. |
| Phase 10: Implementation Order | PASS | WDG-004 only implemented prompt/action and parser custody before route/BFF/RN/WebView wiring. | Continue with a bounded route/schema or routing packet only after watchdog acceptance. |
| Backlog-Specific Instructions - Selection Sensei | PASS | Prompt builders/action map live in `core/prompts/selectionSensei.ts`, parser lives in `core/selectionSensei.ts`, and modal rendering remains WebView-owned. | Later packets must keep toolbar/follow-up unified. |
| Test Gate Ledger | PARTIAL_GREEN | Prompt/action and parser rows are green; mobile/BFF/public direct-provider rows remain red with exact validation evidence. | Use current red rows to drive next packet. |
| Review Remediation Mode | N/A | TURN-20260605T202519Z repair: WDG-004 was not a PR review remediation packet and no review artifact was active. | Apply only if watchdog sends review remediation. |
| Final Migration Evidence Block | BLOCKED | This is not a full migration; BFF/mobile/provider/routing validation is not implemented. | Fill only after all migration gates pass or approved deferrals exist. |
| Stop Conditions | PASS | No new sibling path or scope contradiction was found. No staged files exist at this point. Final diff hygiene still pending after ledger edits. | Run final `git diff --check` and staged-state validation before return. |
| Output Contract | PASS | Worker return must include WDG-004 packet ID, turn ID, changed files, implementation summary, protocol classifications, validation, expected reds, blockers, diff/staged state, and recommended next packet. | Use the watchdog-requested section headings. |

## Plan of Work

### Milestone 0 - Pre-implementation protocol and backup

Update `Progress` with the current timestamp, then:

1. Confirm working branch and dirty tree. Do not revert unrelated changes.
2. Run `npm run backup:create -- --feature "selection_sensei_modal_llm_migration" --context "Migrating Selection Sensei toolbar action and follow-up modal LLM flow prompt/provider/parser paths to Core, BFF, and mobile bridge while keeping WebView modal UI ownership."`
3. Read `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md` before adding/modifying tests.
4. Review the Core Analysis Protocol evidence already captured in this ExecPlan, rerun scoped analysis if source drift or scope changes, and update this ExecPlan with fresh findings before editing code.
5. Re-run the direct provider sweep and update the Direct Provider Authority Sweep table.

### Milestone 1 - Core prompt, model usage, parser, and capability

Update `Progress` before starting. Then:

1. Add `core/prompts/selectionSensei.ts`.
2. Move/copy verbatim:
   - `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`
   - `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`
   - `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`
   - all allowed toolbar action instruction strings from `src/selectionSensei.ts:1644-1649`
3. Add typed action map and request/result types. Exclude `addToNotepad`, `copy`, and `share` from LLM action enum.
4. Add `core/selectionSensei.ts` with:
   - exports for modal-flow request/result types
   - parser/normalizer functions or Core-owned parser wrappers
   - `buildSelectionSenseiToolbarPrompt`
   - `buildSelectionSenseiFollowUpPrompt`
   - `runSelectionSenseiModalMessage(llm: CoreLlmClient | null, request: SelectionSenseiModalMessageRequest)`
5. Add Selection Sensei model config to `core/modelUsage.ts`, preserving `gemini-flash-latest`, temperature `0.5`, and `responseMimeType: "application/json"` unless implementation discovers a stronger source of truth.
6. Add `selection_sensei_modal` handling to `core/browserLlmClient.ts`.
7. Export new modules from `core/index.ts`, `core/prompts/index.ts`, and `core/package.json`.
8. Convert `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` to facades or imports from Core where needed, preserving current public imports until callers are updated.
9. Add/adjust Core prompt parity and parser tests.

Acceptance for this milestone:

- Core build passes.
- Prompt parity tests cover system prompt, toolbar prompt, ask prompt, follow-up prompt, and each action instruction.
- Parser tests pass against Core-owned parser.
- No BFF/RN/WebView implementation yet except facade adjustments needed for compile.

### Milestone 2 - BFF route, controller, service, config, and tests

Update `Progress` before starting. Then:

1. Add `bff/src/services/selectionSenseiService.js` using `CoreLlmAdapter` and Core `runSelectionSenseiModalMessage`.
2. Add `bff/src/controllers/selectionSenseiController.js` with strict Zod schema and session lookup.
3. Add `bff/src/routes/selectionSensei.js` with capability-specific rate limiting.
4. Add selection rate-limit config to `bff/src/config/index.js`, selection model config export to `bff/src/config/modelUsage.js`, and task routing in `bff/src/integration/geminiGateway.js`.
5. Wire the service/rate limiter in `bff/src/container.js`.
6. Register the route in `bff/src/server.js`.
7. Add deterministic route/controller/service tests, including all required negative tests from the compliance block.
8. Ensure logs include only safe metadata and lengths.

Acceptance for this milestone:

- BFF route rejects prompt strings/fragments, unknown keys, arbitrary actions, non-LLM actions, oversize fields, missing ask question, missing follow-up question, missing modal context, and unknown sessions.
- BFF service calls Core with a server-owned `CoreLlmAdapter`.
- BFF model/task config uses Selection Sensei JSON response config.
- BFF deterministic tests pass.

### Milestone 3 - RN/WebView bridge contracts and client transport

Update `Progress` before starting. Then:

1. Add Core Selection Sensei types into `SenseiMobile/src/mobile/bridge/contracts.ts` as type imports/aliases if needed.
2. Add Web-to-RN message `selectionSensei:modalMessageRequest` with `requestId` and structured payload.
3. Add RN-to-Web message `selectionSensei:modalMessageResult` with success/error and normalized result.
4. Add `BffClientLike.runSelectionSenseiModalMessage` and payload/result types in `SenseiMobile/src/mobile/network/types.ts`.
5. Add `BffClient.runSelectionSenseiModalMessage` posting to `/sessions/:sessionId/selection-sensei/modal-message`, following unary retry/error patterns.
6. Add `MainScreen` WebView message handling that calls the BFF client and enqueues result.
7. Add `requestSelectionSenseiModalMessageViaBridge` resolver in `src/mobile/webviewMessageRouter.ts`.
8. Add explicit bridge-missing behavior for mobile if current `sendToNative` cannot confirm delivery. This can be done through a send availability helper or through the routing helper, but it must be observable in a sentinel test.
9. Add RN/WebView bridge tests and `BffClient` tests.

Acceptance for this milestone:

- Mobile bridge request/result is typed end to end.
- Mobile bridge missing path fails closed.
- RN does not own prompt strings or provider calls.
- Existing bridge tests still pass.

### Milestone 4 - WebView modal-flow handler migration

Update `Progress` before starting. Then:

1. Add `src/selectionSenseiRouting.ts` following the teaching plan/learner analysis routing helper shape, with a discriminated request mode for `toolbarAction` and `followUp`.
2. Refactor `src/selectionSensei.ts:handleToolbarAction` to:
   - keep `resetModalState`, loading modal, token guard, toolbar hiding, and modal updates in WebView
   - build only a structured request
   - validate action type before routing or rely on Core/BFF with user-safe fallback
   - call desktop Core path through browser `CoreLlmClient` when not mobile
   - call bridge path when mobile
   - never call `ensureSelectionChat` or `chat.sendMessage` for the selected toolbar row
   - use Core parser result/fallback fields for modal content
3. Refactor `src/selectionSensei.ts:dispatchFollowupToAI` to:
   - keep modal user/loading/Sensei bubble rendering, token guard, `followupInFlight`, composer toggles, and markdown/code rendering in WebView
   - build only a structured `followUp` request containing current question and explicit bounded modal context
   - call desktop Core path through browser `CoreLlmClient` when not mobile
   - call bridge path when mobile
   - never call `ensureSelectionChat` or `chat.sendMessage` for follow-up
   - use Core parser result/fallback fields while preserving current follow-up display formatting
4. Replace the current hidden provider chat-history dependency with explicit modal-flow state owned by WebView and sent as structured context. At minimum the context must carry selected text, original Sensei context, initial action type, initial prompt mode metadata, initial parsed/raw response, bounded visible modal transcript, and current question. Do not switch to BFF-owned modal state in this migration unless the ExecPlan is revised first with a new user-approved scope and session-state validation model.
5. Keep `handleBridgeInvoke`, `activateAskMode`, `handleAddToNotepad`, `copy`, `share`, selected-text capture, and modal rendering behavior intact.
6. Update tests around modal behavior, toolbar route selection, follow-up route selection, explicit context preservation, and native overlay invocation.

Acceptance for this milestone:

- `handleToolbarAction` no longer builds final prompt strings in WebView.
- `dispatchFollowupToAI` no longer builds final follow-up prompt strings in WebView or relies on implicit provider chat history.
- `handleToolbarAction` and `dispatchFollowupToAI` no longer call direct provider for the modal flow.
- WebView modal behavior remains equivalent for parsed-full, explanation-only, raw fallback, empty response, provider failure, follow-up provider failure, duplicate follow-up submit, and stale conversation token cases.
- Add to Notepad/copy/share remain unaffected.

### Milestone 5 - Validation, bundle, and final evidence

Update `Progress` before starting. Then:

1. Run targeted unit tests and BFF deterministic tests with byte-capped output where needed.
2. Run `npm run core:build`.
3. Run `npm run webview:bundle` after WebView/Core changes.
4. Run scoped analysis and direct provider sweep after implementation.
5. Run broader relevant test suites if targeted tests pass.
6. Manually smoke desktop toolbar action and follow-up if feasible.
7. Manually smoke mobile bridge path if BFF/Metro/iOS runtime is available:
   - start BFF
   - start Metro
   - run iOS app
   - select text in embedded WebView
   - tap native Selection Sensei toolbar action
   - confirm modal loads and shows BFF/Core result
   - submit a modal follow-up question
   - confirm follow-up answer appends through BFF/Core result
   - confirm BFF logs selection modal route metadata without full prompt/selection text
8. Update `Validation and Acceptance`, `Final Migration Evidence`, and `Outcomes & Retrospective`.

## Concrete Steps

Commands listed here are intended for the future implementation agent. For validation/setup/build/test commands, preserve exit status and cap verbose output by bytes rather than streaming full logs.

1. Preflight:
   - `git status --short --branch`
   - `npm run backup:create -- --feature "selection_sensei_modal_llm_migration" --context "Migrating Selection Sensei toolbar action and follow-up modal LLM flow prompt/provider/parser paths to Core, BFF, and mobile bridge while preserving WebView modal UI ownership."`
2. Test protocol read:
   - Read `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`.
3. Analysis:
   - Run scoped Core Analysis Protocol per AGENTS and update this plan.
   - Re-run direct provider sweep and classify modal-flow hits.
4. Core edits:
   - Add `core/prompts/selectionSensei.ts`.
   - Add `core/selectionSensei.ts`.
   - Update `core/modelUsage.ts`, `core/browserLlmClient.ts`, `core/index.ts`, `core/prompts/index.ts`, and `core/package.json`.
   - Convert WebView prompt/parser files to Core facades if needed.
5. BFF edits:
   - Add selection route/controller/service.
   - Wire container/server/config/gateway.
6. RN/WebView bridge edits:
   - Update contracts, `BffClient`, `MainScreen`, `webviewMessageRouter`, and routing helper.
7. WebView controller edits:
   - Refactor `handleToolbarAction` and `dispatchFollowupToAI` to structured modal-message request routing.
   - Replace hidden provider chat history with explicit bounded modal context owned by WebView and validated by BFF.
8. Tests:
   - Add/adjust tests listed in Test Gate Ledger.
9. Validation:
   - Run commands listed in Test Gate Ledger.
10. Finalize:
   - Update this ExecPlan with exact evidence and remaining risks.

## Validation and Acceptance

No validation commands have been run for implementation because no implementation has been performed.

### TURN-20260605T180334Z - WDG-001 validation note

This watchdog packet is protocol activation and ExecPlan currency only. The only validation commands authorized and run in this turn were:

- `git status --short --branch`
- `git diff --name-status`
- `git diff --cached --name-status`

No implementation test suite, build, analyzer run, WebView bundle, backup, source edit, test edit, commit, push, or staging command was run in this packet. Implementation validation remains `NOT_STARTED` until a later watchdog packet authorizes scoped source/test work.

### TURN-20260605T182838Z - WDG-002 validation note

This watchdog packet is Milestone 0 pre-implementation gating only. `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md` was read before any future test edits. The required backup command was run and exited 0:

`npm run backup:create -- --feature "selection_sensei_modal_llm_migration" --context "Preparing Selection Sensei toolbar action and follow-up modal LLM migration by completing pre-implementation protocol gates before Core, BFF, RN, or WebView source edits."`

Output handling: command output was redirected to a temporary file, the exit status was preserved, and only the final 12000 bytes were printed. Output size was 941 bytes. The command refreshed `src/file-manifest.json`, refreshed `src/backup-file-manifest.json`, and created `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip`. No implementation tests, source edits, test edits, WebView bundle, commit, push, staging, reset, checkout, or cleanup command has been run in this packet.

The required fresh direct-provider sweep was run and exited 0:

`rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**'`

Output handling: command output was redirected to a temporary file, the exit status was preserved, and the full output was printed because it was below the 70000-byte cap. Output size was 14492 bytes / 178 lines. The only in-scope violating provider path remains `src/selectionSensei.ts`; all other hits are expected BFF/Core infrastructure, desktop compatibility, unrelated backlog rows, test-only mocks, ancillary/debug/manual provider surfaces, or false positives. No implementation validation was run.

Final dirty-tree validation commands for TURN-20260605T182838Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M src/backup-file-manifest.json
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

TURN-20260605T182838Z final validation result: no implementation tests were added, updated, or run; no source/test/BFF/RN/WebView/generated/master-plan/trace docs were edited manually; no staged files exist. The backup zip exists at `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip`.

### TURN-20260605T183746Z - WDG-002C validation note

This watchdog correction packet repaired a PLAN.md live-document omission only. It recorded the WDG-002 failed patch/context mismatch that had been left only in chat, and it also recorded this packet's own first correction-patch context mismatch immediately after it occurred. No source, tests, Core, BFF, React Native, WebView, generated bundle, trace doc, master plan, skill file, mission-state doc, backup file, manifest file, package file, commit, push, staging, reset, checkout, cleanup, backup command, analyzer, provider sweep, WebView bundle, or implementation validation was performed.

Required refresh for this correction:

- `docs/protocols/PLAN.md`
- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `git status --short --branch`
- `git diff --name-status`
- `git diff --cached --name-status`

Extra read:

- `.codex/skills/llm-migration-compliance/SKILL.md` was read because the active user/developer workflow requires the LLM migration compliance skill to remain active for this migration. No skill file was edited.

Current dirty-tree baseline for TURN-20260605T183746Z before this correction edit:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M src/backup-file-manifest.json
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

Final dirty-tree baseline for TURN-20260605T183746Z after this correction edit:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M src/backup-file-manifest.json
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

TURN-20260605T183746Z final validation result: only the active ExecPlan was edited by this correction packet; the staged diff is empty; existing dirty files outside the active ExecPlan are present but not touched.

### TURN-20260605T190803Z - WDG-003 red/golden validation note

This watchdog packet added red/golden tests only. No production source, Core source, BFF source, React Native source, WebView source, generated bundle, master plan, trace doc, skill file, mission-state doc, package file, backup command, analyzer, provider sweep, commit, push, staging, reset, checkout, cleanup, or full implementation validation was performed.

Required refresh for WDG-003 was completed before test edits:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- all of `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- this ExecPlan
- current `git status --short --branch`
- current `git diff --name-status`
- current `git diff --cached --name-status`
- existing authorized test files and source seams needed for test placement

Targeted root Jest command:

`npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `1902` bytes, output tail capped to `12000` bytes. Expected red failure: `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` cannot find module `../src/selectionSenseiRouting`; all five routing tests in that suite fail for the same missing future helper. Because `--bail` stopped on this suite, prompt/Core destination, parser/Core destination, and BFF client method tests were added but not reached by this command.

Additional individual targeted root Jest commands were run to validate the suites not reached by the combined `--bail` command:

- `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`: exit `1`, output size `811` bytes. Expected red failure: missing `@sensei/core/prompts/selectionSensei`; 5 tests passed first, including the prompt SHA/length golden checks.
- `npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`: exit `1`, output size `820` bytes. Expected red failure: missing `@sensei/core/selectionSensei`; 4 current parser parity tests passed first.
- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `1`, output size `820` bytes. Expected red failure: `client.runSelectionSenseiModalMessage is not a function`; 6 existing BFF client tests passed first.

The prompt and parser individual suite outputs also included the existing Jest reporter line `Temp folder not exist, means that attach Infos may append unsuccessful`. This did not prevent the expected red failure evidence and did not create a new source/test scope issue.

Targeted BFF command:

`cd bff && node tests/selectionSenseiModal.validation.red.test.js`

Result: exit `1`, output size `1222` bytes, output tail capped to `12000` bytes. Expected red failure: `POST /sessions/:sessionId/selection-sensei/modal-message` returns `404 Cannot POST` where the test expects structured schema rejection for the old prompt-string payload.

Whitespace validation:

`git diff --check`

Result: exit `0`, output size `0` bytes.

Final dirty-tree baseline for TURN-20260605T190803Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M __tests__/BffClient.test.ts
     M __tests__/selectionSensei.prompts.test.ts
     M __tests__/selectionSenseiResponseParser.test.ts
     M src/backup-file-manifest.json
    ?? __tests__/selectionSensei.mobileRoutingGate.red.test.ts
    ?? bff/tests/selectionSenseiModal.validation.red.test.js
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	__tests__/BffClient.test.ts
    M	__tests__/selectionSensei.prompts.test.ts
    M	__tests__/selectionSenseiResponseParser.test.ts
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

TURN-20260605T190803Z final validation result: red/golden tests were added with expected red failures; `git diff --check` passed; no staged files exist. Pre-existing dirty files outside WDG-003 scope remain present but not touched.

Post-ledger final recheck: after the WDG-003 ledger/classification/revision edits, `git diff --check` was run again and exited `0`; final `git diff --cached --name-status` remained empty.

### TURN-20260605T194731Z - WDG-003C red-test completeness correction validation note

This watchdog correction packet added red/golden coverage only. No production source, Core source, BFF source, React Native source, WebView implementation source, generated bundle, master plan, trace doc, skill file, mission-state doc, package file, backup command, analyzer, provider sweep, commit, push, staging, reset, checkout, cleanup, or full implementation validation was performed.

Required refresh for WDG-003C was completed before test edits:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- this ExecPlan
- current `git status --short --branch`
- current `git diff --name-status`
- current `git diff --cached --name-status`
- `src/prompts.ts`
- `src/selectionSensei.ts`
- `src/selectionSenseiResponseParser.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSensei.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`

Targeted prompt command:

`npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `988` bytes, output tail capped to `12000` bytes. Expected red failures: missing `@sensei/core/prompts/selectionSensei` for `exposes Selection Sensei prompt builders from the future Core prompt owner` and `exposes exact toolbar action instructions from the future Core prompt owner`. Six tests passed first, including old prompt SHA/length coverage and exact old inline toolbar action instruction coverage.

Targeted public WebView/mobile command:

`npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `7940` bytes, output tail capped to `12000` bytes. Expected red failures: mobile `explainSimpler` and `askQuestion` public bridge paths create browser Selection Sensei chat locally; public follow-up composer calls local browser `sendMessage`; duplicate rapid mobile toolbar actions call local provider twice while pending. Existing four tests passed and one todo remains.

Targeted BFF command:

`cd bff && node tests/selectionSenseiModal.validation.red.test.js`

Result: exit `1`, output size `1224` bytes, output tail capped to `12000` bytes. Expected red failure: `POST /sessions/:sessionId/selection-sensei/modal-message` returns `404 Cannot POST`, so the expanded schema cases are present in the file but still blocked behind missing route implementation.

Whitespace and staged-state validation:

- `git diff --check`: exit `0`, output size `0` bytes.
- `git diff --cached --name-status`: no output.

Final dirty-tree baseline for TURN-20260605T194731Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M __tests__/BffClient.test.ts
     M __tests__/selectionSensei.prompts.test.ts
     M __tests__/selectionSensei.test.ts
     M __tests__/selectionSenseiResponseParser.test.ts
     M src/backup-file-manifest.json
    ?? __tests__/selectionSensei.mobileRoutingGate.red.test.ts
    ?? bff/tests/selectionSenseiModal.validation.red.test.js
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	__tests__/BffClient.test.ts
    M	__tests__/selectionSensei.prompts.test.ts
    M	__tests__/selectionSensei.test.ts
    M	__tests__/selectionSenseiResponseParser.test.ts
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

TURN-20260605T194731Z final validation result: WDG-003C authorable red-test gaps were added with expected red failures; `git diff --check` passed; no staged files exist. Pre-existing dirty files outside WDG-003C scope remain present but not touched.

Post-ledger final recheck for TURN-20260605T194731Z: after updating the Watchdog Turn Ledger row from `IN_PROGRESS` to `COMPLETE`, `git diff --check` exited `0`, `git status --short --branch` matched the recorded dirty-tree baseline, `git diff --name-status` matched the recorded tracked-file baseline, and `git diff --cached --name-status` had no output.

### TURN-20260605T200403Z - WDG-004 core prompt/parser custody validation note

This watchdog packet implemented only Core prompt/action custody and Core parser/normalizer custody. It did not implement BFF routes, BFF schema, RN bridge wiring, WebView mobile routing, `BffClient.runSelectionSenseiModalMessage`, provider execution, generated WebView bundle, trace/master-plan updates, commits, pushes, staging, reset, checkout, cleanup, or direct-provider removal from toolbar/follow-up runtime.

Required refresh for WDG-004 was completed before source edits:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- this ExecPlan
- current `git status --short --branch`
- current `git diff --name-status`
- current `git diff --cached --name-status`
- `src/prompts.ts`
- `src/selectionSensei.ts`
- `src/selectionSenseiResponseParser.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- Core prompt/capability export patterns under `core/`
- package/export files needed to understand Core subpath resolution

Scoped Core build:

`npm run core:build`

Result: exit `0`, output size `127` bytes, output tail capped to `12000` bytes. This refreshed untracked Core `dist` files needed by package exports; `core/dist` is not tracked by git.

Prompt/action custody command:

`npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`

Result: exit `0`, output size `484` bytes, output tail capped to `12000` bytes. One suite passed; 8 tests passed.

Parser custody command:

`npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`

Result: exit `0`, output size `496` bytes, output tail capped to `12000` bytes. One suite passed; 5 tests passed.

Public Selection Sensei expected-red command:

`npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `7869` bytes, output tail capped to `12000` bytes. Expected red failures remain: public mobile toolbar/ask create browser Selection Sensei chat, public follow-up composer calls local `sendMessage`, and duplicate rapid mobile toolbar actions call local provider twice. Four existing tests passed and one todo remains.

Routing/BffClient combined expected-red command:

`npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `1812` bytes, output tail capped to `12000` bytes. Expected red failure remains: missing `../src/selectionSenseiRouting`.

Individual BffClient expected-red command:

`npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `821` bytes, output tail capped to `12000` bytes. Expected red failure remains: `client.runSelectionSenseiModalMessage is not a function`; 6 existing tests passed.

BFF validation expected-red command:

`node tests/selectionSenseiModal.validation.red.test.js` from `bff/`

Result: exit `1`, output size `1224` bytes, output tail capped to `12000` bytes. Expected red failure remains: missing route `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`.

Custody sanity search:

`rg -n "Explain the 'SELECTED TEXT'|Provide a clear and concise analogy|SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION|parseSelectionSenseiResponsePayload|repairLooseJson|normalizeJsonPayload" src core __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts`

Result: exit `0`. Evidence: exact action instruction strings appear in `core/prompts/selectionSensei.ts` and tests; `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` retain facade/import references only for the WDG-004 custody scope.

Whitespace and staged-state validation:

- `git diff --check`: exit `0`, output size `0` bytes.
- `git diff --cached --name-status`: no output.

Final dirty-tree baseline for TURN-20260605T200403Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M __tests__/BffClient.test.ts
     M __tests__/selectionSensei.prompts.test.ts
     M __tests__/selectionSensei.test.ts
     M __tests__/selectionSenseiResponseParser.test.ts
     M core/index.ts
     M core/package.json
     M core/prompts/index.ts
     M src/backup-file-manifest.json
     M src/prompts.ts
     M src/selectionSensei.ts
     M src/selectionSenseiResponseParser.ts
    ?? __tests__/selectionSensei.mobileRoutingGate.red.test.ts
    ?? bff/tests/selectionSenseiModal.validation.red.test.js
    ?? core/prompts/selectionSensei.ts
    ?? core/selectionSensei.ts
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	__tests__/BffClient.test.ts
    M	__tests__/selectionSensei.prompts.test.ts
    M	__tests__/selectionSensei.test.ts
    M	__tests__/selectionSenseiResponseParser.test.ts
    M	core/index.ts
    M	core/package.json
    M	core/prompts/index.ts
    M	src/backup-file-manifest.json
    M	src/prompts.ts
    M	src/selectionSensei.ts
    M	src/selectionSenseiResponseParser.ts

    $ git diff --cached --name-status
    [no output]

Post-ledger final recheck for TURN-20260605T200403Z: after updating the Watchdog Turn Ledger row to `COMPLETE`, `git diff --check` exited `0`, `git status --short --branch` matched the recorded dirty-tree baseline, `git diff --name-status` matched the recorded tracked-file baseline, and `git diff --cached --name-status` had no output.

### TURN-20260605T202519Z - WDG-004C dependency and protocol-ledger correction validation note

This watchdog correction packet repaired Core parser dependency ownership and full-protocol ledger coverage only. It did not implement BFF routes, BFF schema, RN bridge wiring, WebView mobile routing, `BffClient.runSelectionSenseiModalMessage`, provider execution, generated WebView bundle, trace/master-plan updates, commits, pushes, staging, reset, checkout, cleanup, direct-provider removal from toolbar/follow-up runtime, or test file changes.

Required refresh for WDG-004C was completed before edits:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- all of `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- this ExecPlan
- `core/package.json`
- relevant root `package-lock.json` metadata for the linked Core package
- relevant `bff/package-lock.json` metadata for the linked Core package
- current `git status --short --branch`
- current `git diff --name-status`
- current `git diff --cached --name-status`
- `core/selectionSensei.ts` only to confirm the `json5` import

Scoped Core build:

`npm run core:build`

Result: exit `0`, output size `127` bytes, output tail capped to `12000` bytes.

Core dependency check:

`node -e "const p=require('./core/package.json'); if(!p.dependencies || !p.dependencies.json5){ process.exit(2) }"`

Result: exit `0`, no output.

Root/BFF lock metadata check:

`node -e "const fs=require('fs'); const root=JSON.parse(fs.readFileSync('package-lock.json','utf8')); const bff=JSON.parse(fs.readFileSync('bff/package-lock.json','utf8')); const rootCore=root.packages&&root.packages.core; const bffCore=bff.packages&&bff.packages['../core']; if(!rootCore?.dependencies?.json5 || !bffCore?.dependencies?.json5){ console.error(JSON.stringify({root:rootCore&&rootCore.dependencies,bff:bffCore&&bffCore.dependencies})); process.exit(2); } console.log('root core json5', rootCore.dependencies.json5); console.log('bff core json5', bffCore.dependencies.json5);"`

Result: exit `0`, output confirmed root Core and BFF Core lock metadata both use `^2.2.3`.

Prompt/action custody command:

`npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`

Result: exit `0`, output size `484` bytes, output tail capped to `12000` bytes. One suite passed; 8 tests passed.

Parser custody command:

`npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`

Result: exit `0`, output size `496` bytes, output tail capped to `12000` bytes. One suite passed; 5 tests passed.

Whitespace and staged-state validation:

- `git diff --check`: exit `0`, output size `0` bytes.
- `git diff --cached --name-status`: no output.

Final dirty-tree baseline for TURN-20260605T202519Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M __tests__/BffClient.test.ts
     M __tests__/selectionSensei.prompts.test.ts
     M __tests__/selectionSensei.test.ts
     M __tests__/selectionSenseiResponseParser.test.ts
     M bff/package-lock.json
     M core/index.ts
     M core/package.json
     M core/prompts/index.ts
     M package-lock.json
     M src/backup-file-manifest.json
     M src/prompts.ts
     M src/selectionSensei.ts
     M src/selectionSenseiResponseParser.ts
    ?? __tests__/selectionSensei.mobileRoutingGate.red.test.ts
    ?? bff/tests/selectionSenseiModal.validation.red.test.js
    ?? core/prompts/selectionSensei.ts
    ?? core/selectionSensei.ts
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	__tests__/BffClient.test.ts
    M	__tests__/selectionSensei.prompts.test.ts
    M	__tests__/selectionSensei.test.ts
    M	__tests__/selectionSenseiResponseParser.test.ts
    M	bff/package-lock.json
    M	core/index.ts
    M	core/package.json
    M	core/prompts/index.ts
    M	package-lock.json
    M	src/backup-file-manifest.json
    M	src/prompts.ts
    M	src/selectionSensei.ts
    M	src/selectionSenseiResponseParser.ts

    $ git diff --cached --name-status
    [no output]

TURN-20260605T202519Z final validation result: Core dependency metadata and linked lock metadata now declare `json5`; prompt/action and parser custody validations still pass; `git diff --check` passed; no staged files exist. Pre-existing dirty files outside WDG-004C scope remain present but not touched.

Post-ledger final recheck for TURN-20260605T202519Z: after updating the Watchdog Turn Ledger row to `COMPLETE`, `git diff --check` exited `0`, `git diff --cached --name-status` had no output, and focused JSON parsing of `core/package.json`, root `package-lock.json`, and `bff/package-lock.json` succeeded. Focused diff summary for WDG-004C changed files shows tracked modifications to `bff/package-lock.json`, `core/package.json`, and `package-lock.json`; the active ExecPlan remains untracked and changed as the required live-document artifact.

### TURN-20260605T203651Z - WDG-005 core modal capability/provider-boundary validation note

This watchdog packet implemented only the Core Selection Sensei modal capability seam, Core follow-up prompt/context support, Selection Sensei model config, browser Core task routing, and focused Core tests. It did not implement BFF routes, BFF schema, RN bridge wiring, WebView mobile routing, `BffClient.runSelectionSenseiModalMessage`, generated WebView bundle, trace/master-plan updates, commits, pushes, staging, reset, checkout, cleanup, or direct-provider removal from toolbar/follow-up runtime.

Targeted refresh for WDG-005 was completed before edits:

- active ExecPlan sections for Milestone 1, Phase 10 implementation order, Test Gate Ledger, Runtime Routing Plan, and WDG-004C audit outcome
- `core/selectionSensei.ts`
- `core/prompts/selectionSensei.ts`
- `core/modelUsage.ts`
- `core/browserLlmClient.ts`
- `core/llmTypes.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- Core capability examples in `core/teachingPlan.ts`, `core/learnerAnalysis.ts`, `core/wrapUpAssessment.ts`, and `core/mermaidErrorRecovery.ts`
- current `git status --short --branch`
- current `git diff --name-status`
- current `git diff --cached --name-status`

Scoped Core build:

`npm run core:build`

Result: exit `0`, output size `127` bytes, output tail capped to `12000` bytes.

Combined Core prompt/parser/capability command:

`npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSenseiCoreModal.test.ts --silent --bail --noStackTrace`

Result: exit `0`, output size `678` bytes, output tail capped to `16000` bytes. Three suites passed; 20 tests passed.

Public Selection Sensei expected-red command:

`npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `7869` bytes, output tail capped to `16000` bytes. Expected red failures remain: public mobile toolbar/ask create browser Selection Sensei chat, public follow-up composer calls local `sendMessage`, and duplicate rapid mobile toolbar actions call local provider twice. Four existing tests passed and one todo remains.

BffClient expected-red command:

`npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`

Result: exit `1`, output size `821` bytes, output tail capped to `12000` bytes. Expected red failure remains: `client.runSelectionSenseiModalMessage is not a function`; 6 existing tests passed.

BFF validation expected-red command:

`node tests/selectionSenseiModal.validation.red.test.js` from `bff/`

Result: exit `1`, output size `1222` bytes, output tail capped to `12000` bytes. Expected red failure remains: missing route `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`.

Whitespace and staged-state validation:

- `git diff --check`: exit `0`, output size `0` bytes.
- `git diff --cached --name-status`: no output.

Final dirty-tree baseline for TURN-20260605T203651Z:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M __tests__/BffClient.test.ts
     M __tests__/selectionSensei.prompts.test.ts
     M __tests__/selectionSensei.test.ts
     M __tests__/selectionSenseiResponseParser.test.ts
     M bff/package-lock.json
     M core/browserLlmClient.ts
     M core/index.ts
     M core/modelUsage.ts
     M core/package.json
     M core/prompts/index.ts
     M package-lock.json
     M src/backup-file-manifest.json
     M src/prompts.ts
     M src/selectionSensei.ts
     M src/selectionSenseiResponseParser.ts
    ?? __tests__/selectionSensei.mobileRoutingGate.red.test.ts
    ?? __tests__/selectionSenseiCoreModal.test.ts
    ?? bff/tests/selectionSenseiModal.validation.red.test.js
    ?? core/prompts/selectionSensei.ts
    ?? core/selectionSensei.ts
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	__tests__/BffClient.test.ts
    M	__tests__/selectionSensei.prompts.test.ts
    M	__tests__/selectionSensei.test.ts
    M	__tests__/selectionSenseiResponseParser.test.ts
    M	bff/package-lock.json
    M	core/browserLlmClient.ts
    M	core/index.ts
    M	core/modelUsage.ts
    M	core/package.json
    M	core/prompts/index.ts
    M	package-lock.json
    M	src/backup-file-manifest.json
    M	src/prompts.ts
    M	src/selectionSensei.ts
    M	src/selectionSenseiResponseParser.ts

    $ git diff --cached --name-status
    [no output]

TURN-20260605T203651Z final validation result: Core modal capability/provider-boundary tests pass; prompt/parser custody tests still pass; public mobile/BffClient/BFF route tests remain red for expected later-packet reasons; `git diff --check` passed; no staged files exist. Pre-existing dirty files outside WDG-005 scope remain present but not touched.

Post-ledger final recheck for TURN-20260605T203651Z: after updating the Watchdog Turn Ledger row to `COMPLETE` and adding WDG-005 protocol/artifact/revision evidence, `git diff --check` exited `0` and `git diff --cached --name-status` had no output. Focused diff summary for WDG-005 tracked files shows modifications to `core/browserLlmClient.ts` and `core/modelUsage.ts`; `core/selectionSensei.ts`, `core/prompts/selectionSensei.ts`, `__tests__/selectionSenseiCoreModal.test.ts`, and the active ExecPlan are untracked live migration artifacts with WDG-005 changes layered on top of earlier packet work.

### TURN-20260605T205157Z - WDG-005C core modal boundary correction validation note

This correction repaired only the Core modal provider-bound prompt and defensive Core request boundary. It did not implement BFF routes, BFF schema, RN bridge wiring, WebView mobile routing, `BffClient.runSelectionSenseiModalMessage`, generated WebView bundle, trace/master-plan updates, commits, pushes, staging, reset, checkout, cleanup, or direct-provider removal from toolbar/follow-up runtime.

Validation summary:

- `npm run core:build`: exit `0`.
- `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSenseiCoreModal.test.ts --silent --bail --noStackTrace`: exit `0`; 3 suites passed; 21 tests passed.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `1`; expected public mobile direct-provider and duplicate local-provider failures remain.
- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `1`; expected missing `client.runSelectionSenseiModalMessage` remains.
- `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`: exit `1`; expected missing route `404` remains.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-005C touched only the active ExecPlan, `core/selectionSensei.ts`, and `__tests__/selectionSenseiCoreModal.test.ts`. Pre-existing dirty files outside this correction remain present but were not touched.

Post-ledger recheck for TURN-20260605T205157Z: after adding concise artifact and revision notes, `git diff --check` exited `0`, `git diff --cached --name-status` had no output, and focused status remained limited to active migration artifacts; `core/prompts/selectionSensei.ts` is a pre-existing untracked Core prompt artifact from earlier packets and was not edited by WDG-005C.

### TURN-20260605T210646Z - WDG-006 BFF route/schema/service validation note

This packet implemented only the BFF Selection Sensei modal route/schema/service and server Gemini task routing. It did not edit BffClient, RN bridge contracts, WebView routing helpers, `src/selectionSensei.ts`, generated WebView bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, or cleanup.

Validation summary:

- `npm run core:build`: exit `0`.
- `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSenseiCoreModal.test.ts --silent --bail --noStackTrace`: exit `0`; 3 suites passed; 21 tests passed.
- `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`: first exit `1` from a Zod schema construction issue, then exit `0` after switching to `z.union`.
- `node tests/selectionSenseiModal.service.test.js` from `bff/`: exit `0`.
- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `1`; expected missing `client.runSelectionSenseiModalMessage` remains.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `1`; expected public mobile direct-provider and duplicate local-provider failures remain.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-006 touched only the active ExecPlan, allowed BFF route/controller/service/config/gateway/server/container files, and the new focused BFF service/model test. The pre-existing `bff/tests/selectionSenseiModal.validation.red.test.js` untracked test file was executed but not edited in this packet.

Post-ledger recheck for TURN-20260605T210646Z: after adding WDG-006 ledger, artifact, validation, and revision notes, `git diff --check` exited `0`, `git diff --cached --name-status` had no output, and focused status showed only WDG-006-owned BFF/ExecPlan files plus the pre-existing untracked BFF validation test.

### TURN-20260605T212253Z - WDG-007 BffClient transport validation note

This packet implemented only the mobile network `BffClient` Selection Sensei modal transport seam. It did not edit RN bridge contracts, MainScreen, WebView routing helper, public direct-provider code, BFF/Core source, generated WebView bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, or cleanup.

Validation summary:

- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 8 tests passed.
- `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`: exit `0`.
- `node tests/selectionSenseiModal.service.test.js` from `bff/`: exit `0`.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `1`; expected public mobile direct-provider and duplicate local-provider failures remain.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-007 touched only the active ExecPlan, `SenseiMobile/src/mobile/network/BffClient.ts`, and `SenseiMobile/src/mobile/network/types.ts`. `__tests__/BffClient.test.ts` remains a pre-existing modified red-test file from earlier packets and was run but not edited in WDG-007.

Post-ledger recheck for TURN-20260605T212253Z: after adding WDG-007 ledger, artifact, validation, and revision notes, `git diff --check` exited `0`, `git diff --cached --name-status` had no output, and focused status showed WDG-007-owned network/ExecPlan files plus the pre-existing modified BffClient test file.

### TURN-20260605T213520Z - WDG-008 RN bridge transport validation note

This packet implemented only the RN bridge contract and MainScreen dispatch seam for Selection Sensei modal messages. It did not edit WebView routing helper, public direct-provider code, BFF/Core source, BffClient implementation, generated WebView bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, or cleanup.

Validation summary:

- `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 3 tests passed.
- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 8 tests passed.
- `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`: exit `0`.
- `node tests/selectionSenseiModal.service.test.js` from `bff/`: exit `0`.
- `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace`: exit `1`; expected missing `../src/selectionSenseiRouting` remains.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `1`; expected public mobile direct-provider and duplicate local-provider failures remain.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-008 touched only the active ExecPlan, `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, and new `__tests__/MainScreen.selectionSenseiModalBridge.test.ts`. `SenseiMobile/src/mobile/network/types.ts` remains a pre-existing WDG-007 modified file and was inspected/run against but not edited in WDG-008.

Post-ledger recheck for TURN-20260605T213520Z: after marking WDG-008 complete and adding ledger, artifact, validation, and revision notes, `git diff --check` exited `0`, `git diff --cached --name-status` had no output, and focused status showed only WDG-008-owned files plus the pre-existing WDG-007 `SenseiMobile/src/mobile/network/types.ts` diff.

### TURN-20260605T214730Z - WDG-008C RN type ownership correction validation note

This correction repaired only RN bridge/network Selection Sensei modal type ownership and stale ExecPlan outcome text. It did not edit MainScreen runtime behavior, WebView routing helper, public direct-provider code, BFF/Core source, BffClient implementation, generated WebView bundle, trace/master-plan status, commits, pushes, staging, reset, checkout, or cleanup.

Validation summary:

- `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 3 tests passed.
- `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 8 tests passed.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-008C touched the active ExecPlan, `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/network/types.ts`, and `__tests__/MainScreen.selectionSenseiModalBridge.test.ts`. `SenseiMobile/src/mobile/MainScreen.tsx` and `__tests__/BffClient.test.ts` remain pre-existing modified files from WDG-008/WDG-007 and were validated but not edited in WDG-008C.

Post-ledger recheck for TURN-20260605T214730Z: after marking WDG-008C complete and adding ledger, artifact, validation, and revision notes, `git diff --check` exited `0` and `git diff --cached --name-status` had no output. The first focused status recheck failed because the command used mistyped workdir `/Users/aligunes/Developer/Recursive_Sense_Mobile_Fresh`; this was a command invocation/path error, not repo validation failure. Rerun with the correct workspace path succeeded and showed WDG-008C-owned files plus pre-existing modified MainScreen/BffClient test files from earlier packets.

### TURN-20260605T215752Z - WDG-009 WebView routing/provider removal validation note

WDG-009 implemented only the WebView/mobile routing seam for Selection Sensei modal toolbar and follow-up LLM paths. It did not run WebView bundling, update trace/master-plan status, perform a full final provider sweep, commit, push, stage, reset, checkout, or cleanup.

Validation summary:

- First capped validation wrapper for `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace`: exit `1` before Jest because the wrapper assigned to zsh's read-only `status` variable; rerun used `rc` and no source/test repair was needed.
- `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 6 tests passed.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 8 tests passed; 1 pre-existing todo.
- `npm test -- --runTestsByPath __tests__/MainScreen.selectionSenseiModalBridge.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 3 tests passed.
- Focused static provider check for Selection Sensei WebView routing files: exit `0`; remaining browser provider hits are classified as preserved desktop compatibility while mobile calls route through the bridge helper.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-009 touched the active ExecPlan, `src/selectionSensei.ts`, new `src/selectionSenseiRouting.ts`, `src/mobile/webviewBridge.ts`, `src/mobile/webviewMessageRouter.ts`, `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`, and `__tests__/selectionSensei.test.ts`. The focused RN bridge test file was validated but not edited in WDG-009.

### TURN-20260605T221844Z - WDG-009C WebView bridge fail-closed repair validation note

WDG-009C repaired only stale cached WebView bridge sender fail-closed behavior and focused public non-LLM action coverage. It did not edit BFF/Core/RN source, WebView generated bundle, trace/master-plan status, final sweep evidence, commits, pushes, staging, reset, checkout, or cleanup.

Validation summary:

- `npm test -- --runTestsByPath __tests__/webviewBridge.failClosed.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 2 tests passed.
- `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 6 tests passed.
- `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`: exit `0`; 1 suite passed; 9 tests passed; 1 pre-existing todo.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-009C touched the active ExecPlan, `src/mobile/webviewBridge.ts`, `__tests__/selectionSensei.test.ts`, and new `__tests__/webviewBridge.failClosed.test.ts`. `src/mobile/webviewMessageRouter.ts` and `__tests__/selectionSensei.mobileRoutingGate.red.test.ts` were validated but not edited in this correction.

### TURN-20260605T222730Z - WDG-010 final bundle/sweep/status validation note

WDG-010 completed the final evidence pass for the unified Selection Sensei toolbar/follow-up modal LLM flow. It did not edit source or tests, stage files, commit, push, reset, checkout, clean up, or widen scope to unrelated LLM backlog rows.

Validation summary:

- `npm run webview:bundle`: exit `0`; generated bundle command completed and left no tracked generated diff under `SenseiMobile/app_web/webview_dist`.
- Final source/generated provider/routing sweeps: exit `0`; no blocking mobile Selection Sensei direct-provider route found; desktop-local compatibility and BFF provider execution classified.
- Focused root Jest aggregate over Selection Sensei prompt/parser/Core/BffClient/RN/WebView/bridge suites: exit `0`; 8 suites passed; 49 tests passed; 1 pre-existing todo.
- `node bff/tests/selectionSenseiModal.validation.red.test.js`: exit `0`; structured validation rejection evidence remains green.
- `node bff/tests/selectionSenseiModal.service.test.js`: exit `0`; deterministic service/model-routing evidence remains green.
- `npm run core:build`: exit `0`.
- `git diff --check`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-010 changed the active ExecPlan, `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, and `docs/llm_entry_exit_traces.md`. The WebView bundle command produced no tracked generated-file changes.

### TURN-20260605T224420Z - WDG-010C ExecPlan final-state repair validation note

WDG-010C repaired only stale current-state wording in the active ExecPlan. It did not edit source, tests, generated bundle, master plan, trace doc, package files, skills, audit logs, mission-state files, or the known-bugs doc.

Validation summary:

- Targeted stale-status scan for `BUNDLE_FINAL_SWEEP_STATUS_PENDING`, `Generated WebView bundle, trace/master-plan status, final provider sweep`, `Status: NOT_STARTED`, `final sweep/status`, and `remain pending`: exit `0`; remaining matches are historical WDG-009/WDG-009C records, WDG-010C's own repair description, Review Remediation `Status: NOT_STARTED` because no review artifact exists, or current positive wording that final sweep/status is complete.
- `git diff --check docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`: exit `0`.
- `git diff --cached --name-status`: no output.

WDG-010C changed only the active ExecPlan. A `docs/known_bugs/bounded_llm_history_context_limit.md` edit from the immediately prior user request is present in the working tree but was not touched during WDG-010C.

## Idempotence and Recovery

- This plan is doc-only and can be safely re-read or amended.
- Before future non-doc edits, create the required backup once for this feature.
- If implementation partially completes and validation fails, update `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Validation and Acceptance` with the exact failure before any repair.
- Do not revert unrelated dirty files. If unrelated changes appear, ignore them unless they affect the migration; if they affect the migration, document the conflict and work with the existing changes.
- If a route or bridge schema decision changes, update Scope Lock, Trust-Boundary Schema Plan, Runtime Routing Plan, and affected tests before editing code.
- If the modal context design changes from explicit stateless context to BFF-owned state, stop to update this ExecPlan's Scope Lock, Trust-Boundary Schema Plan, Runtime Routing Plan, test ledger, and security/session-expiration requirements before editing code.

## Artifacts and Notes

### TURN-20260605T222730Z - WDG-010 concise artifact note

WDG-010 evidence is summarized rather than dumping command output. WebView bundling passed and produced no tracked generated diff; final source/generated provider/routing sweeps classified Selection Sensei desktop-local provider hits separately from mobile bridge routing and BFF server provider execution; the focused root Jest aggregate passed all Selection Sensei migration-owned suites; BFF validation and service/model tests passed; Core build passed; diff hygiene passed; no files were staged. Status docs were updated only for the proven unified Selection Sensei toolbar/follow-up modal flow, leaving enhancement, key takeaway enhancement, and pedagogical directive generation as remaining backlog.

### TURN-20260605T224420Z - WDG-010C concise artifact note

WDG-010C evidence is summarized rather than dumping command output. Current-state contradictions identified by watchdog were repaired in the active ExecPlan only: top implementation status, Scope Lock status, Capability Matrix status, and Red-Test Gate status now agree with WDG-010 final evidence. The targeted stale-status scan found no remaining current contradiction; historical WDG-009/WDG-009C pending notes remain intentionally historical. Diff hygiene passed and no staged files were present.

### TURN-20260605T205157Z - WDG-005C concise artifact note

WDG-005C correction evidence is intentionally summarized rather than dumping command output. Core build passed, the combined prompt/parser/Core modal suite passed with 21 tests, expected later-seam red suites stayed red for public mobile direct-provider behavior, missing `BffClient.runSelectionSenseiModalMessage`, and missing BFF route `404`, `git diff --check` passed, and no staged files were present. Packet-owned changes were limited to the active ExecPlan, `core/selectionSensei.ts`, and `__tests__/selectionSenseiCoreModal.test.ts`; no BFF/RN/WebView/BffClient/generated/trace/master-plan files were edited by this correction.

### TURN-20260605T210646Z - WDG-006 concise artifact note

WDG-006 evidence is summarized rather than dumping command output. BFF validation now reaches the implemented route and passes by structured `400`/`413` rejection for the existing negative cases; deterministic BFF service/model-routing evidence passes without live provider access; Core build and Core prompt/parser/modal tests remain green; BffClient and public WebView Selection Sensei suites remain red for expected later seams; diff hygiene passed and no staged files were present.

### TURN-20260605T213520Z - WDG-008 concise artifact note

WDG-008 evidence is summarized rather than dumping command output. The new RN bridge/MainScreen test passes and proves the structured request/result contract, opaque payload passthrough, and safe fixed error behavior; BffClient and BFF route/service tests remain green; WebView routing and public Selection Sensei suites remain red for expected missing WebView routing helper and public direct-provider/duplicate local-provider behavior; diff hygiene passed and no staged files were present.

### TURN-20260605T214730Z - WDG-008C concise artifact note

WDG-008C evidence is summarized rather than dumping command output. Bridge contracts now own Selection Sensei modal payload/result types, network types re-export them, the focused RN bridge test proves no bridge import from `../network/types`, BffClient tests remain green through the network re-export, diff hygiene passed, and no staged files were present. The stale `Outcomes & Retrospective` text was updated to reflect implemented Core/BFF/BffClient/RN seams and remaining WebView/final gates.

### TURN-20260605T215752Z - WDG-009 concise artifact note

WDG-009 evidence is summarized rather than dumping command output. WebView mobile routing now sends structured `selectionSensei:modalMessageRequest` payloads and consumes `selectionSensei:modalMessageResult` for toolbar and follow-up; mobile bridge-missing behavior rejects without local provider fallback; duplicate rapid toolbar work is guarded while pending; public and helper tests pass; the RN bridge regression test remains green; diff hygiene passed; no files were staged. Generated WebView bundle, trace/master-plan status, final direct-provider sweep, final validation, commit, and push remain pending for a later authorized packet.

### TURN-20260605T221844Z - WDG-009C concise artifact note

WDG-009C evidence is summarized rather than dumping command output. WebView bridge sender cache invalidation is repaired, focused bridge fail-closed tests pass, public `addToNotepad`/`copy`/`share` actions remain local with no modal LLM request emission, routing-helper tests remain green, diff hygiene passed, and no files were staged. Generated WebView bundle, trace/master-plan status, final direct-provider sweep, final validation, commit, and push remain pending for a later authorized packet.

### TURN-20260605T212253Z - WDG-007 concise artifact note

WDG-007 evidence is summarized rather than dumping command output. BffClient transport tests now pass and prove structured toolbar/follow-up POST bodies plus structured rejection surfacing; WDG-006 BFF validation/service tests remain green; public WebView Selection Sensei tests remain red for expected direct-provider/duplicate local-provider behavior; diff hygiene passed and no staged files were present.

Documents read in full before plan authoring:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md`
- `docs/templates/llm_migration_compliance_block.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`

Source and tests inspected for this plan:

- `src/selectionSensei.ts`
- `src/prompts.ts`
- `src/selectionSenseiResponseParser.ts`
- `src/model_usage.ts`
- `src/mobile/webviewMessageRouter.ts`
- `src/mobile/webviewBridge.ts`
- `src/teachingPlanRouting.ts`
- `src/learnerAnalysisRouting.ts`
- `src/geminiService.ts`
- `src/ui.ts`
- `SenseiMobile/src/mobile/bridge/contracts.ts`
- `SenseiMobile/src/mobile/MainScreen.tsx`
- `SenseiMobile/src/mobile/network/BffClient.ts`
- `SenseiMobile/src/mobile/network/types.ts`
- `bff/src/container.js`
- `bff/src/server.js`
- `bff/src/controllers/teachingPlanController.js`
- `bff/src/services/teachingPlanService.js`
- `bff/src/routes/teachingPlan.js`
- `bff/src/controllers/analysisController.js`
- `bff/src/services/analysisService.js`
- `bff/src/controllers/sessionController.js`
- `bff/src/integration/coreLlmAdapter.js`
- `bff/src/integration/geminiGateway.js`
- `bff/src/config/index.js`
- `bff/src/config/modelUsage.js`
- `core/llmTypes.ts`
- `core/browserLlmClient.ts`
- `core/modelUsage.ts`
- `core/package.json`
- `core/index.ts`
- `core/prompts/index.ts`
- `package.json`
- `bff/package.json`
- `SenseiMobile/package.json`
- `__tests__/selectionSensei.test.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/SelectionOverlayController.test.ts`
- `__tests__/teachingPlan.mobileRoutingGate.sentinel.test.ts`
- `__tests__/learnerAnalysis.mobileRoutingGate.sentinel.test.ts`
- `__tests__/corePromptParity.test.ts`
- `__tests__/BffClient.test.ts`
- `bff/tests/analysis.int.test.js`
- `bff/tests/teachingPlan.int.test.js`
- `bff/tests/teachingPlanService.config.test.js`
- `bff/tests/llmStream.deterministic.int.test.js`

Generated or protocol artifacts created/refreshed during this planning pass:

- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `tmp/analysis/*` from baseline and focused analyzer runs
- `src/file-manifest.json` regenerated by `npm run analysis:run`

### TURN-20260605T190803Z - WDG-003 red/golden test evidence

Files changed by this packet:

- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`
- `__tests__/BffClient.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`

Command evidence:

- Root Jest command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output `1902` bytes; expected red failure missing `../src/selectionSenseiRouting`.
- Individual prompt suite: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `1`; output `811` bytes; expected red failure missing `@sensei/core/prompts/selectionSensei`.
- Individual parser suite: `npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`; exit `1`; output `820` bytes; expected red failure missing `@sensei/core/selectionSensei`.
- Individual BFF client suite: `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output `820` bytes; expected red failure missing `client.runSelectionSenseiModalMessage`.
- BFF command: `cd bff && node tests/selectionSenseiModal.validation.red.test.js`; exit `1`; output `1222` bytes; expected red failure route `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`.
- Whitespace command: `git diff --check`; exit `0`; output `0` bytes.
- Final staged state: `git diff --cached --name-status` had no output.

Present but not touched by this packet:

- `.codex/skills/llm-migration-compliance/SKILL.md`
- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `src/backup-file-manifest.json`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`
- `docs/prompts/`

### TURN-20260605T194731Z - WDG-003C red-test completeness correction evidence

Files changed by this packet:

- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSensei.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`

Command evidence:

- Prompt command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `1`; output `988` bytes; expected missing `@sensei/core/prompts/selectionSensei` after six old-golden tests passed.
- Public WebView/mobile command: `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`; exit `1`; output `7940` bytes; expected public mobile direct-provider and duplicate local-provider failures.
- BFF command: `cd bff && node tests/selectionSenseiModal.validation.red.test.js`; exit `1`; output `1224` bytes; expected missing route `404 Cannot POST /sessions/:sessionId/selection-sensei/modal-message`.
- Whitespace command: `git diff --check`; exit `0`; output `0` bytes.
- Final staged state: `git diff --cached --name-status` had no output.

Present but not touched by this packet:

- `.codex/skills/llm-migration-compliance/SKILL.md`
- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `__tests__/BffClient.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`
- `src/backup-file-manifest.json`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md`
- `docs/prompts/`

### TURN-20260605T200403Z - WDG-004 core prompt/parser custody evidence

Files changed by this packet:

- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `core/prompts/selectionSensei.ts`
- `core/selectionSensei.ts`
- `core/prompts/index.ts`
- `core/index.ts`
- `core/package.json`
- `src/prompts.ts`
- `src/selectionSenseiResponseParser.ts`
- `src/selectionSensei.ts`
- `__tests__/selectionSensei.prompts.test.ts`

Command evidence:

- Core build: `npm run core:build`; exit `0`; output `127` bytes.
- Prompt/action custody: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `0`; output `484` bytes; 8 tests passed.
- Parser custody: `npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`; exit `0`; output `496` bytes; 5 tests passed.
- Public Selection Sensei expected red: `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`; exit `1`; output `7869` bytes; expected mobile direct-provider and duplicate local-provider failures.
- Routing/BffClient expected red: `npm test -- --runTestsByPath __tests__/selectionSensei.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output `1812` bytes; expected missing `../src/selectionSenseiRouting`.
- Individual BffClient expected red: `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output `821` bytes; expected missing `client.runSelectionSenseiModalMessage`.
- BFF expected red: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output `1224` bytes; expected missing route `404`.
- Custody sanity search confirmed Selection Sensei prompt/action/parser bodies are Core-owned for this packet and WebView files are facades/delegates for prompt/parser custody.

Present but not touched by this packet:

- `.codex/skills/llm-migration-compliance/SKILL.md`
- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `__tests__/BffClient.test.ts`
- `__tests__/selectionSensei.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`
- `src/backup-file-manifest.json`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md`
- `docs/prompts/`

### TURN-20260605T202519Z - WDG-004C dependency and protocol-ledger correction evidence

Files changed by this packet:

- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `core/package.json`
- `package-lock.json`
- `bff/package-lock.json`

Package metadata evidence:

- `core/selectionSensei.ts` imports `json5` at runtime.
- `core/package.json` now declares `dependencies.json5` as `^2.2.3`, matching the existing root version range.
- Root `package-lock.json` linked Core package metadata `packages.core.dependencies.json5` is `^2.2.3`.
- BFF `package-lock.json` linked Core package metadata `packages["../core"].dependencies.json5` is `^2.2.3`.
- No package install command, lifecycle script, broad dependency update, or `core/package-lock.json` creation occurred.

Command evidence:

- Core build: `npm run core:build`; exit `0`; output `127` bytes.
- Core dependency check: `node -e "const p=require('./core/package.json'); if(!p.dependencies || !p.dependencies.json5){ process.exit(2) }"`; exit `0`; no output.
- Root/BFF lock metadata check: focused `node` check of `package-lock.json` `packages.core` and `bff/package-lock.json` `packages["../core"]`; exit `0`; output confirmed both `json5` ranges as `^2.2.3`.
- Prompt/action custody: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts --silent --bail --noStackTrace`; exit `0`; output `484` bytes; 8 tests passed.
- Parser custody: `npm test -- --runTestsByPath __tests__/selectionSenseiResponseParser.test.ts --silent --bail --noStackTrace`; exit `0`; output `496` bytes; 5 tests passed.
- Whitespace command: `git diff --check`; exit `0`; output `0` bytes.
- Final staged state: `git diff --cached --name-status` had no output.

Present but not touched by this packet:

- `.codex/skills/llm-migration-compliance/SKILL.md`
- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `__tests__/BffClient.test.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSensei.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`
- `core/index.ts`
- `core/prompts/index.ts`
- `core/prompts/selectionSensei.ts`
- `core/selectionSensei.ts`
- `src/backup-file-manifest.json`
- `src/prompts.ts`
- `src/selectionSensei.ts`
- `src/selectionSenseiResponseParser.ts`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md`
- `docs/prompts/`

### TURN-20260605T203651Z - WDG-005 core modal capability/provider-boundary evidence

Files changed by this packet:

- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
- `core/selectionSensei.ts`
- `core/prompts/selectionSensei.ts`
- `core/modelUsage.ts`
- `core/browserLlmClient.ts`
- `__tests__/selectionSenseiCoreModal.test.ts`

Implementation evidence:

- `core/selectionSensei.ts` exports `SelectionSenseiModalMessageRequest`, `SelectionSenseiToolbarActionRequest`, `SelectionSenseiFollowUpRequest`, `SelectionSenseiModalMessageResult`, and `runSelectionSenseiModalMessage`.
- `core/prompts/selectionSensei.ts` exports `buildSelectionSenseiFollowUpPrompt` and explicit modal-context prompt types.
- `core/modelUsage.ts` exports `SELECTION_SENSEI_MODAL_CONFIG` with model `gemini-flash-latest`, temperature `0.5`, and `responseMimeType: "application/json"`.
- `core/browserLlmClient.ts` maps task `selection_sensei_modal` to `SELECTION_SENSEI_MODAL_CONFIG`.
- `__tests__/selectionSenseiCoreModal.test.ts` proves toolbar, ask, follow-up, provider-boundary, forbidden payload, malformed output, and browser config behavior.

Command evidence:

- Core build: `npm run core:build`; exit `0`; output `127` bytes.
- Combined prompt/parser/Core modal command: `npm test -- --runTestsByPath __tests__/selectionSensei.prompts.test.ts __tests__/selectionSenseiResponseParser.test.ts __tests__/selectionSenseiCoreModal.test.ts --silent --bail --noStackTrace`; exit `0`; output `678` bytes; 3 suites and 20 tests passed.
- Public Selection Sensei expected red: `npm test -- --runTestsByPath __tests__/selectionSensei.test.ts --silent --bail --noStackTrace`; exit `1`; output `7869` bytes; expected public mobile direct-provider and duplicate local-provider failures.
- BffClient expected red: `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace`; exit `1`; output `821` bytes; expected missing `client.runSelectionSenseiModalMessage`.
- BFF expected red: `node tests/selectionSenseiModal.validation.red.test.js` from `bff/`; exit `1`; output `1222` bytes; expected missing route `404`.
- Whitespace command: `git diff --check`; exit `0`; output `0` bytes.
- Final staged state: `git diff --cached --name-status` had no output.

Present but not touched by this packet:

- `.codex/skills/llm-migration-compliance/SKILL.md`
- `.codex/skills/llm-migration-watchdog/SKILL.md`
- `__tests__/BffClient.test.ts`
- `__tests__/selectionSensei.prompts.test.ts`
- `__tests__/selectionSensei.test.ts`
- `__tests__/selectionSenseiResponseParser.test.ts`
- `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`
- `bff/tests/selectionSenseiModal.validation.red.test.js`
- `bff/package-lock.json`
- `core/index.ts`
- `core/package.json`
- `core/prompts/index.ts`
- `package-lock.json`
- `src/backup-file-manifest.json`
- `src/prompts.ts`
- `src/selectionSensei.ts`
- `src/selectionSenseiResponseParser.ts`
- `docs/known_bugs/bounded_llm_history_context_limit.md`
- `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`
- `docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md`
- `docs/prompts/`

### TURN-20260605T182838Z - WDG-002 command evidence

Required backup command evidence:

- Command: `npm run backup:create -- --feature "selection_sensei_modal_llm_migration" --context "Preparing Selection Sensei toolbar action and follow-up modal LLM migration by completing pre-implementation protocol gates before Core, BFF, RN, or WebView source edits."`
- Exit status: 0
- Output handling: redirected to a temporary file, preserved exit status, printed final 12000 bytes; output was 941 bytes.
- Generated/refreshed artifacts: `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip`, `src/file-manifest.json`, and `src/backup-file-manifest.json`.

Fresh direct-provider sweep evidence:

- Command: `rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**'`
- Exit status: 0
- Output handling: redirected to a temporary file, preserved exit status, printed all output under a 70000-byte cap; output was 14492 bytes / 178 lines.
- Classification summary: in-scope `src/selectionSensei.ts` violations remain planned; no new Selection Sensei sibling path or scope contradiction found.

TURN-20260605T182838Z final dirty-tree baseline:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M .codex/skills/llm-migration-watchdog/SKILL.md
     M src/backup-file-manifest.json
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	.codex/skills/llm-migration-watchdog/SKILL.md
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

TURN-20260605T182838Z dirty-tree handling:

- Touched by this packet: `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`.
- Generated/refreshed by required backup command: `backup/sensei_backup_selection_sensei_modal_llm_migration_20260605_212911.zip`, `src/file-manifest.json` with no final git diff, and `src/backup-file-manifest.json` with final tracked diff.
- Present but not touched manually: `.codex/skills/llm-migration-compliance/SKILL.md`, `.codex/skills/llm-migration-watchdog/SKILL.md`, `docs/known_bugs/bounded_llm_history_context_limit.md`, `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`, `docs/mission_state/mission_state_selection_sensei_watchdog_audit_20260605T182044Z.md`, and `docs/prompts/`.
- Staged files: none.

### TURN-20260605T183746Z - WDG-002C correction evidence

Correction purpose: watchdog found that WDG-002 had a chat-only failed patch/context mismatch event that was not recorded in this ExecPlan. This packet records that omitted event and reconfirms the final baseline.

Omitted WDG-002 event now recorded:

- Event: first WDG-002 patch attempt failed because the patch expected an assumed discovery-note anchor that was not present in the active ExecPlan.
- Why it happened: the patch context was based on an assumed line rather than the exact file content.
- Recovery: nearby anchors were inspected with `sed`, and the update was split into smaller anchored patches; WDG-002 then completed successfully.
- What remains: no scope, provider-sweep, or implementation-order change. The next packet remains WDG-003 red-test/golden-test work after watchdog accepts this repair.

Current WDG-002C event also recorded:

- Event: first WDG-002C correction patch failed because a progress-line anchor did not exactly match the active file.
- Recovery: inspected exact anchors and applied smaller patches.
- What remains: no source/test changes and no staged files; final status/diff/cached baseline is reconfirmed before return.

### TURN-20260605T180334Z - WDG-001 required refresh and dirty-tree baseline

Required authority refresh completed this turn:

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- `docs/llm_entry_exit_traces.md`
- `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`

Baseline command results before this packet's ExecPlan edit:

    $ git status --short --branch
    ## codex/selection-sensei-toolbar-llm-migration
     M .codex/skills/llm-migration-compliance/SKILL.md
     M src/backup-file-manifest.json
    ?? docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md
    ?? docs/known_bugs/bounded_llm_history_context_limit.md
    ?? docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md
    ?? docs/prompts/

    $ git diff --name-status
    M	.codex/skills/llm-migration-compliance/SKILL.md
    M	src/backup-file-manifest.json

    $ git diff --cached --name-status
    [no output]

Dirty-tree handling for this packet:

- Touched: `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`.
- Present but not touched: `.codex/skills/llm-migration-compliance/SKILL.md`, `src/backup-file-manifest.json`, `docs/known_bugs/bounded_llm_history_context_limit.md`, `docs/mission_state/mission_state_selection_sensei_modal_llm_flow_analysis_20260605T160352Z.md`, and `docs/prompts/`.
- Staged files: none at baseline.

## Interfaces and Dependencies

Proposed Core interface:

- Module: `@sensei/core/selectionSensei`
- Prompt module: `@sensei/core/prompts/selectionSensei`
- Task name: `selection_sensei_modal`
- Core exports:
  - `SelectionSenseiToolbarActionType`
  - `SelectionSenseiModalMessageMode`
  - `SelectionSenseiModalMessageRequest`
  - `SelectionSenseiToolbarActionRequest`
  - `SelectionSenseiFollowUpRequest`
  - `SelectionSenseiParsedResponse`
  - `SelectionSenseiModalMessageResult`
  - `buildSelectionSenseiToolbarPrompt`
  - `buildSelectionSenseiFollowUpPrompt`
  - `parseSelectionSenseiResponsePayload`
  - `runSelectionSenseiModalMessage`

Proposed BFF interface:

- Route: `POST /sessions/:sessionId/selection-sensei/modal-message`
- Request body: structured `SelectionSenseiModalMessageRequest` only, no prompt strings.
- Response: structured normalized result or structured error.

Proposed bridge interface:

- Web-to-RN:
  - `{ type: 'selectionSensei:modalMessageRequest', requestId: string, payload: SelectionSenseiModalMessageRequest }`
- RN-to-Web:
  - `{ type: 'selectionSensei:modalMessageResult', requestId: string, success: boolean, result?: SelectionSenseiModalMessageResult, error?: string, code?: string }`

Potential dependency updates:

- Keep `json5` support and usage for Selection Sensei parser parity. `json5` already exists at root and parser logic can continue to use it through Core if Core package access is valid. If Core currently lacks `json5` as its own dependency, add it to `core/package.json` rather than rewriting parser behavior during this migration. Parser simplification is out of scope until a later golden-test-backed cleanup.
- Core package exports must be updated because BFF and WebView import Core modules through package exports.
- BFF config/gateway must expose Selection Sensei model config and task model override if needed.

## Resolved Unknowns And Remaining Blockers

- Resolved: Selection Sensei follow-up will use explicit stateless modal context sent with each request. WebView remains modal state owner, and BFF-owned modal state is out of scope unless this ExecPlan is revised first with user-approved scope and validation requirements.
- Resolved: keep `json5` support and usage for exact Selection Sensei parser parity. If Core needs its own package dependency, add it rather than removing tolerant parsing in this migration.
- Resolved: use generous Selection Sensei-specific trusted-boundary caps, not the current main Sensei history caps. WDG-006 finalized exact numeric caps in the Decision Log and BFF schema, using structured rejection rather than truncation for oversize route inputs; WDG-010 final validation confirmed the BFF negative tests still pass.
- Live BFF/provider tests may require credentials/quota. Deterministic route/service tests should not depend on live provider access.
- Analyzer artifacts were refreshed in this planning pass by baseline and focused `npm run analysis:run` commands. Future implementation must rerun scoped analysis after source changes or if the scope changes again.

## Revision Note

### TURN-20260605T180334Z - WDG-001 protocol activation ledger

This revision added watchdog turn tracking, refreshed authority evidence, a full LLM Migration Compliance Protocol classification for the current planning-only state, validation/status baselines, and dirty-tree handling notes. The reason was watchdog packet `WDG-001-protocol-activation-ledger`, which required making the ExecPlan current before any bounded implementation packets. No feature implementation or files outside this ExecPlan were edited in this turn.

### TURN-20260605T182838Z - WDG-002 milestone 0 pre-implementation gates

This revision completed Milestone 0 pre-implementation gates for watchdog packet `WDG-002-milestone-0-preimplementation-gates`: required authority/test/master/trace/ExecPlan refresh, backup command, fresh direct-provider sweep, hit classifications, protocol coverage classifications, validation evidence, and final dirty-tree baseline. No feature source, tests, Core, BFF, RN, WebView, generated bundle, trace document, master-plan status, commit, push, staging, reset, checkout, cleanup, or implementation test suite was performed.

### TURN-20260605T183746Z - WDG-002C plan live-document repair

This revision repaired the watchdog audit finding that WDG-002's failed patch/context mismatch had been reported in chat but not preserved in the ExecPlan. It added a watchdog turn row, progress entry, surprise/discovery entries, protocol classification, validation note, artifact note, and this revision note. It also recorded the first WDG-002C correction patch's own context mismatch immediately after it occurred. No feature source, tests, Core, BFF, RN, WebView, generated bundle, trace document, master-plan status, skill file, mission-state doc, backup file, manifest file, package file, commit, push, staging, reset, checkout, cleanup, backup, analyzer, provider sweep, WebView bundle, or implementation test suite was performed.

### TURN-20260605T190803Z - WDG-003 red/golden tests

This revision added the Phase 9 red/golden test evidence for the unified Selection Sensei modal LLM flow. It updated prompt custody, parser custody, boundary invariants, trust-boundary schema, runtime routing, Red-Test Gate, Test Gate Ledger, Protocol Coverage Ledger, Validation and Acceptance, Artifacts and Notes, and this Revision Note. It added/updated only authorized focused tests and the active ExecPlan. Expected red failures were recorded for missing `src/selectionSenseiRouting`, missing future Core prompt/parser destinations, missing `BffClient.runSelectionSenseiModalMessage`, and missing BFF route/schema. `git diff --check` passed and no files were staged. No production source, Core source, BFF source, RN, WebView, generated bundle, package file, master plan, trace doc, skill file, mission-state doc, backup command, analyzer, provider sweep, commit, push, reset, checkout, cleanup, or full implementation validation was performed.

### TURN-20260605T194731Z - WDG-003C red-test completeness correction

This revision repaired the WDG-003 audit finding that several authorable red tests had been deferred too broadly. It added exact toolbar action-instruction old-value and future Core owner tests, current public mobile WebView bridge direct-provider tests for toolbar and ask actions, public follow-up composer local-provider red coverage, duplicate rapid toolbar local-provider red coverage, and missing BFF trust-boundary negative cases. It updated the Watchdog Turn Ledger, Progress, Surprises & Discoveries, Decision Log, Prompt Custody Ledger, Boundary Invariant Ledger, Trust-Boundary Schema Plan, Runtime Routing Plan, Red-Test Gate, Test Gate Ledger, Protocol Coverage Ledger, Validation and Acceptance, Artifacts and Notes, and this Revision Note. It changed only the active ExecPlan and the allowed focused test files. `git diff --check` passed and no files were staged. No production source, Core source, BFF source, RN, WebView implementation source, generated bundle, package file, master plan, trace doc, skill file, mission-state doc, backup command, analyzer, provider sweep, commit, push, reset, checkout, cleanup, or full implementation validation was performed.

### TURN-20260605T200403Z - WDG-004 core prompt/parser custody

This revision implemented only Selection Sensei Core prompt/action custody and Core parser/normalizer custody. It added `core/prompts/selectionSensei.ts` as the canonical prompt/action owner, added `core/selectionSensei.ts` as the canonical parser/normalizer owner, converted `src/prompts.ts` and `src/selectionSenseiResponseParser.ts` to facades, removed inline toolbar action instruction ownership from `src/selectionSensei.ts`, updated Core barrels and narrow Core package subpath exports, and adjusted the prompt custody test to assert exact action strings through the source facade and Core owner rather than the old inline WebView switch. Prompt/action and parser custody validations passed. Public mobile/BFF/routing red tests remain red for expected later-packet reasons. No BFF source, RN source, WebView routing helper, `BffClient` implementation, provider execution, generated WebView bundle, master plan, trace doc, skill file, mission-state doc, backup command, analyzer, provider sweep, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T202519Z - WDG-004C core dependency and protocol-ledger correction

This revision repaired the watchdog audit findings from WDG-004 without advancing feature behavior. It added `json5` as a runtime dependency of `@sensei/core` in `core/package.json`, mirrored that linked Core package dependency metadata into root `package-lock.json` and `bff/package-lock.json`, and repaired the WDG-004/WDG-004C Protocol Coverage Ledger so every full LLM migration protocol section is classified with evidence or rationale. It updated the Watchdog Turn Ledger, Progress, Surprises & Discoveries, Decision Log, Parser/Normalizer Ledger, Boundary Invariant Ledger, Protocol Coverage Ledger, Validation and Acceptance, Artifacts and Notes, and this Revision Note. Core build, dependency checks, prompt custody tests, parser custody tests, diff hygiene, and staged-state validation passed. No BFF source, RN source, WebView routing helper, `BffClient` implementation, provider execution, generated WebView bundle, master plan, trace doc, skill file, mission-state doc, backup command, analyzer, provider sweep, commit, push, reset, checkout, cleanup, staging, or test file edit was performed.

### TURN-20260605T203651Z - WDG-005 core modal capability/provider-boundary

This revision implemented the next protocol-ordered Core seam only. It added the structured Selection Sensei modal request/result types and `runSelectionSenseiModalMessage` to `core/selectionSensei.ts`, added explicit stateless follow-up prompt/context support to `core/prompts/selectionSensei.ts`, added `SELECTION_SENSEI_MODAL_CONFIG` to `core/modelUsage.ts`, routed browser Core task `selection_sensei_modal` in `core/browserLlmClient.ts`, and added `__tests__/selectionSenseiCoreModal.test.ts` for Core capability/provider-boundary coverage. Core build and combined prompt/parser/Core modal tests passed. Public mobile, BffClient, and BFF validation tests remain red for expected later-packet reasons. No BFF source, BFF tests, RN source, WebView routing helper, `BffClient` implementation, `src/selectionSensei.ts` provider removal, generated WebView bundle, master plan, trace doc, skill file, mission-state doc, backup command, analyzer, provider sweep, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T205157Z - WDG-005C core modal boundary correction

This revision repaired the WDG-005 Core modal boundary evidence without advancing BFF/RN/WebView routing. It made the provider-bound Core prompt include the Core-owned Selection Sensei system instruction plus the mode-specific user prompt, expanded Core forbidden-field validation for prompt strings, provider controls, history/chat/transport-shaped fields, covered all non-LLM actions, and tightened follow-up required-context validation for explicit initial action metadata and initial response content. `__tests__/selectionSenseiCoreModal.test.ts` now proves these cases before any LLM call. Core build and combined prompt/parser/Core modal tests passed; public mobile, BffClient, and BFF validation tests remain red for expected later-packet reasons. No BFF source, BFF tests, RN source, WebView routing helper, `BffClient` implementation, generated WebView bundle, trace document, master-plan status, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T210646Z - WDG-006 BFF Selection Sensei modal route/schema/service

This revision implemented only the BFF Selection Sensei modal-message server seam. It added the BFF route, controller, service, strict structured schema with concrete caps, Core service invocation through `CoreLlmAdapter`, BFF Selection Sensei modal model config, Gemini task routing for `selection_sensei_modal`, and deterministic BFF service/model-routing evidence. The existing BFF validation red test now passes by structured validation responses instead of missing-route `404`. Core build and Core prompt/parser/modal tests remain green; BffClient and public WebView Selection Sensei tests remain red for expected later-packet reasons. No BffClient, RN, WebView routing helper, `src/selectionSensei.ts` direct-provider removal, generated WebView bundle, trace document, master-plan status, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T212253Z - WDG-007 BffClient Selection Sensei modal transport

This revision implemented only the mobile network `BffClient` transport seam for Selection Sensei modal messages. It added structured Selection Sensei modal payload/result network types, added `BffClientLike.runSelectionSenseiModalMessage`, and implemented `BffClient.runSelectionSenseiModalMessage` as a unary JSON POST to the WDG-006 BFF route with existing unknown-session retry and structured error surfacing. BffClient tests now pass; BFF route/service tests remain green; public WebView Selection Sensei tests remain red for expected later-packet reasons. No RN bridge contracts, MainScreen, WebView routing helper, `src/selectionSensei.ts` direct-provider removal, BFF/Core source, generated WebView bundle, trace document, master-plan status, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T213520Z - WDG-008 RN bridge Selection Sensei modal transport

This revision implemented only the React Native bridge transport seam for Selection Sensei modal messages. It added structured `selectionSensei:modalMessageRequest` and `selectionSensei:modalMessageResult` bridge contract variants, added MainScreen dispatch to `BffClient.runSelectionSenseiModalMessage`, enqueues same-request structured success/failure messages, and added focused RN bridge/MainScreen tests. BffClient and BFF route/service tests remain green; WebView routing and public Selection Sensei tests remain red for expected later-packet reasons. No WebView routing helper, public direct-provider removal, BFF/Core source, BffClient implementation, generated WebView bundle, trace document, master-plan status, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T214730Z - WDG-008C RN type ownership and ExecPlan repair

This revision repaired WDG-008 compliance without adding feature behavior. It moved Selection Sensei modal payload/result type ownership into `SenseiMobile/src/mobile/bridge/contracts.ts`, made `SenseiMobile/src/mobile/network/types.ts` import/re-export those types for BffClient, adjusted the focused RN bridge test to prove the ownership direction and absence of a bridge -> network type import, and updated stale `Outcomes & Retrospective` text. Focused RN bridge and BffClient tests passed; diff hygiene and staged-state validation passed. No WebView routing helper, public direct-provider removal, BFF/Core source, BffClient implementation, generated WebView bundle, trace document, master-plan status, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T215752Z - WDG-009 WebView Selection Sensei modal routing/provider removal

This revision implemented only the WebView/mobile routing seam for Selection Sensei modal toolbar and follow-up LLM paths. It added `src/selectionSenseiRouting.ts`, updated WebView bridge send/result handling, changed `src/selectionSensei.ts` so mobile toolbar and follow-up use structured bridge requests/results instead of browser chat, added bridge-missing fail-closed behavior, added helper-level non-LLM action rejection, and added a duplicate rapid toolbar guard. Focused routing-helper, public Selection Sensei, and RN bridge regression tests passed; diff hygiene passed; no files were staged. Generated WebView bundle, trace/master-plan status, final provider sweep, final validation, commit, push, reset, checkout, cleanup, and staging were not performed.

### TURN-20260605T221844Z - WDG-009C WebView bridge fail-closed test repair

This revision repaired WDG-009 without advancing final migration work. It changed `src/mobile/webviewBridge.ts` so stale cached native transport is cleared when the current `window.ReactNativeWebView?.postMessage` is missing or not callable, added `__tests__/webviewBridge.failClosed.test.ts`, and strengthened `__tests__/selectionSensei.test.ts` so `addToNotepad`, `copy`, and `share` remain local and emit no Selection Sensei modal LLM request. Bridge fail-closed, routing-helper, and public Selection Sensei tests passed; diff hygiene passed; no files were staged. No BFF/Core/RN source, generated WebView bundle, trace document, master-plan status, final provider sweep, commit, push, reset, checkout, cleanup, or staging was performed.

### TURN-20260605T222730Z - WDG-010 final bundle/sweep/status

This revision completed the final evidence packet for the unified Selection Sensei toolbar/follow-up modal LLM flow. It ran the embedded WebView bundle command, performed final source/generated provider and routing sweeps, classified remaining Selection Sensei provider hits as desktop-local compatibility or BFF/Core-owned execution rather than mobile direct-provider routes, updated the master plan and trace doc to the proven status, and recorded final validation. The focused root Jest aggregate, BFF validation, BFF service/model routing, Core build, diff hygiene, and staged-state checks passed. No source or test edits, generated tracked diffs, commit, push, staging, reset, checkout, cleanup, or unrelated backlog status updates were performed.

### TURN-20260605T224420Z - WDG-010C ExecPlan final-state repair

This revision repaired WDG-010 live-document contradictions in the active ExecPlan only. It updated the top implementation status, Scope Lock status, Capability Matrix status, and Red-Test Gate status so the near-top current-state fields match WDG-010 final evidence. It added WDG-010C protocol classification, validation, artifact, and revision notes. The targeted stale-status scan classified remaining hits as historical packet notes, Review Remediation not-started state, WDG-010C repair-description text, or positive completed final-sweep wording. No source, tests, generated bundle, master plan, trace doc, package files, skill files, audit logs, mission-state files, known-bugs doc, commit, push, staging, reset, checkout, or cleanup was performed.

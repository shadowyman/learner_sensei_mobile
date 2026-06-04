# Module Introduction and Main Sensei Streaming Core/BFF Migration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/protocols/PLAN.md` and the repository protocols in `docs/protocols/*.md`. It is written for the fresh checkout at `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`, but all file paths below are repository-relative so the plan remains portable. Before implementation, the executor must read `AGENTS.md`, rerun the required analyzer protocols in the active checkout, and update this plan if fresh analyzer output changes any dependency or file list.

This plan is subordinate to `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, the authoritative Phase 1 mobile LLM migration master plan. It also uses `docs/llm_entry_exit_traces.md` as the entry/exit preservation map for direct LLM call sites. If this ExecPlan ever conflicts with the master plan, the master plan wins and this ExecPlan must be revised before implementation continues.

## Purpose / Big Picture

After this change, the iOS React Native app can request the same streaming Recursive Sensei responses that the WebView currently generates, but mobile will no longer call Gemini or carry migrated prompt bodies inside the bundled WebView. A learner should still see module introductions and ordinary Sensei replies appear progressively in the chat bubble, chunk by chunk, with the same markdown rendering and key-takeaway enhancer hooks preserved. The difference is architectural: for these two capabilities, mobile sends structured context to the Backend-for-Frontend, the BFF builds the prompt through Core, Gemini streams from the server, and React Native forwards chunks back to the WebView.

The two scoped functions are `src/interactionHelpers.ts::streamModuleIntroduction` and `src/interactionHelpers.ts::streamMainSenseiResponse`. They currently mix prompt finalization, provider streaming, and UI chunk updates. This migration keeps their UI-facing role but moves mobile prompt construction and provider execution behind Core and BFF.

## Progress

- [x] (2026-06-04 00:00Z) Scope narrowed to `streamModuleIntroduction` and `streamMainSenseiResponse`.
- [x] (2026-06-04 00:00Z) Existing behavior analyzed: both functions call `chat.sendMessageStream`, accumulate streamed chunks, call `updateMessageStream`, and preserve optional `KeyTakeawayEnhancerController` hooks.
- [x] (2026-06-04 00:00Z) Prompt-builder dependency surface identified: module introduction context is built upstream in `src/moduleSelectionHandler.ts`, and both scoped functions rely on prompt constants/builders from `src/prompts.ts`, `src/interactionHelpers.ts`, and `src/curriculum.ts`.
- [x] (2026-06-04 00:00Z) Transport decision made: use WebSocket streaming for mobile, not HTTP `fetch` streaming, because the React Native runtime did not expose `response.body.getReader()`.
- [x] (2026-06-04 00:00Z) API shape selected: `POST /sessions/:sessionId/llm-stream` returns `{ requestId, streamUrl }`; React Native then opens `ws://.../sessions/:sessionId/llm-stream?requestId=...`.
- [x] (2026-06-04 00:00Z) Decision made to reuse and refactor the existing BFF WebSocket scaffold instead of forcing the old generic `/sessions/:sessionId/turns` abstraction onto these capabilities.
- [x] (2026-06-04 00:00Z) Initial ExecPlan created in `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`.
- [x] (2026-06-04 20:36Z) Fresh BFF dependency tree verified in `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff`; `require('zod')` and `require('./src/server')` completed without hanging.
- [x] (2026-06-04 20:36Z) Mandatory Core Analysis analyzer work completed from the fresh checkout: baseline analyzer, focused traces for both scoped stream functions, scoped DOM-index pass, `brief.md`/`brief.json` drilldowns, source inspection, and mission-state checkpoint.
- [x] (2026-06-04 20:36Z) Core Analysis checkpoint created at `docs/mission_state/mission_state_llm_streaming_core_analysis_20260604T203636Z.md`.
- [x] (2026-06-04 20:36Z) Current production caller map confirmed: module introduction streams from `ModuleSelectionHandler.executePhaseSelection` and reloads; main Sensei response streams from `generateNextSenseiResponse`, Socratic system messages, and reloads.
- [x] (2026-06-04 20:36Z) Current test posture mapped: root Jest already has interaction-helper, BffClient, Core prompt parity, and mobile-routing sentinel patterns; BFF integration tests are plain Node scripts run by default `bff npm test`.
- [x] (2026-06-04 20:48Z) `docs/protocols/PLAN.md` reread and execution discipline corrected: this ExecPlan must be the active running log, updated at every stopping point, discovery, and design decision before proceeding to the next milestone.
- [x] (2026-06-04 20:56Z) Comprehensive Impact Analysis completed from analyzer-first evidence and targeted authored-source inspection. The change is classified as Risk 5 mixed interface/control/data/state/configuration work because it changes LLM prompt ownership, server transport, mobile bridge contracts, WebSocket lifecycle, and real-provider test behavior across WebView, RN, BFF, and Core.
- [x] (2026-06-04 21:08Z) Architectural Synthesis Steps 0-5 completed and recorded here. Recommended architecture is the additive capability-stream route: Core builds prompts from structured requests, BFF owns provider streaming and strict fallback behavior, RN owns transport/WebSocket forwarding, and WebView owns UI streaming and teaching state.
- [x] (2026-06-04 21:20Z) Master plan alignment rechecked against `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` and `docs/llm_entry_exit_traces.md`. Direction is aligned; this plan was tightened to explicitly preserve the master-plan Core capability boundary and trace/status update requirement.
- [x] (2026-06-05 00:00Z) Architectural Synthesis Step 6 approval gate passed. User approved proceeding with the recorded additive capability-stream architecture.
- [x] (2026-06-05 00:00Z) Architectural Synthesis Step 7 transition completed: "Architectural blueprint approved. I will now proceed with the PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL."
- [x] (2026-06-05 00:04Z) Feature Implementation and Test Implementation protocols read. Feature requirements, risk mitigations, validation-log plan, and functional-test policy alignment recorded before non-doc project edits.
- [x] (2026-06-05 00:05Z) Required backup created before non-doc project edits: `backup/sensei_backup_module_intro_main_sensei_streaming_core_bff_migration_20260605_000521.zip`.
- [x] (2026-06-05 00:20Z) Moved prompt text and prompt builders for module introduction and main Sensei response into Core.
- [x] (2026-06-05 00:20Z) Added Core capability modules for module introduction and main Sensei response, including Socratic mode under `mainSenseiResponse`.
- [x] (2026-06-05 00:20Z) Added BFF `llm-stream` request creation and WebSocket streaming path.
- [x] (2026-06-05 00:20Z) Added React Native BFF client and bridge support for capability streams.
- [x] (2026-06-05 00:20Z) Updated WebView wrappers to use BFF-backed streaming on mobile while preserving desktop direct streaming.
- [x] (2026-06-05 23:29Z) Added parity, deterministic transport, real Gemini stream smoke, bridge, sentinel, fallback, and capability-payload negative tests for the migrated stream paths.
- [ ] Run manual simulator validation showing progressive chunks in the chat UI for the post-Socratic-fix path; standard module-introduction and standard main-response manual evidence has already been collected, but a fresh Socratic turn still needs user-provided simulator evidence when provider quota allows.

## Surprises & Discoveries

- Observation: `streamModuleIntroduction` does not merely send `Let's begin ...`. It receives a prebuilt `introContext` from `src/moduleSelectionHandler.ts`, appends `Let's begin ${moduleTitleForPrompt}.`, and streams that combined prompt to Gemini.
  Evidence: the upstream `executePhaseSelection` path builds curriculum focus instruction, task template text, and dynamic Sensei system instruction before calling `streamModuleIntroduction`.

- Observation: `streamMainSenseiResponse` receives a prebuilt `dynamicContext`, inserts the current user input by replacing `USER_LAST_INPUT_PLACEHOLDER` when present, and otherwise appends `User: ${currentUserInput}` before streaming.
  Evidence: this function currently depends on prompt-building work performed before it is called from the main response path in `src/index.tsx`.

- Observation: the key-takeaway enhancer is LLM-facing elsewhere, but this pass must not migrate or disable it.
  Evidence: the scoped stream functions only call `enhancerController.onChunk`, `enhancerController.finalize`, and `enhancerController.getLatestText`; the enhancer’s own direct provider call is a separate backlog item.

- Observation: React Native `fetch` HTTP streaming was probed and did not expose browser-style streaming.
  Evidence: the simulator-side probe reported `hasBody: false` and `hasGetReader: "undefined"` after the server finished streaming real Gemini chunks.

- Observation: local BFF/Jest/Gemini SDK tests were unreliable while the repository lived under `Documents` because dependency files under `node_modules` were partially `compressed,dataless`.
  Evidence: `require('zod')` hung when `bff/node_modules/zod/index.cjs` was dataless. This ExecPlan is intentionally written in the fresh non-iCloud checkout path.

- Observation: Existing BFF integration tests for teaching-plan and wrap-up are real server endpoint tests included in the default `bff` `npm test` script, and their success paths go through `CoreLlmAdapter` into `GeminiGateway` rather than a test-level mock.
  Evidence: `bff/tests/teachingPlan.int.test.js` and `bff/tests/wrapUp.int.test.js` start `startServer({ host: '127.0.0.1', port: 0 })`, create sessions with `POST /sessions`, call their feature endpoints, and assert model-shaped payload invariants. `bff/src/services/teachingPlanService.js` and `bff/src/services/wrapUpService.js` construct `CoreLlmAdapter` over `GeminiGateway`.

- Observation: Fresh Core Analysis confirmed both scoped stream functions share the same downstream UI and enhancer contract.
  Evidence: `tmp/analysis/focused_trace_module_intro.txt` and `tmp/analysis/focused_trace_main_sensei_response.txt` show calls to `logSenseiPromptValidation`, `KeyTakeawayEnhancerController.onChunk`, `updateMessageStream`, `KeyTakeawayEnhancerController.finalize`, and `KeyTakeawayEnhancerController.getLatestText`.

- Observation: `src/ui.ts::updateMessageStream` sends native `render:progress` events while updating DOM markdown, code blocks, and streaming text state.
  Evidence: source inspection of `src/ui.ts` shows `sendToNative({ type: 'render:progress', messageId, chars, elapsedMs: 0 })` inside `updateMessageStream`. The migrated BFF stream must still feed chunks through WebView wrapper functions so this UI/native progress behavior is preserved.

- Observation: Existing RN `BffClient` already has a reusable async-iterable WebSocket queue, but it is currently shaped around `turnId` and old `/sessions/:sessionId/turns` responses.
  Evidence: `SenseiMobile/src/mobile/network/BffClient.ts::createStream` opens the provided WebSocket URL, parses `chunk`, `status`, `wrapUp`, and `error`, and closes the queue on socket close. `submitTurn` posts to `/sessions/:sessionId/turns` and derives `messageId` from `turnId`.

- Observation: Current WebView chat production path still does not use `BffClient.submitTurn` or the BFF `/turns` route for the scoped stream functions.
  Evidence: analyzer call map shows `streamModuleIntroduction` and `streamMainSenseiResponse` are called from WebView `src/moduleSelectionHandler.ts` and `src/index.tsx`, where they receive `mainSenseiChat` and call browser `chat.sendMessageStream`. `rg` found `/turns` production code in BFF/RN scaffold plus tests/docs, but not in the WebView streaming call path.

- Observation: `GeminiGateway.streamMainResponse` currently catches provider errors and emits deterministic fallback chunks.
  Evidence: source inspection of `bff/src/integration/geminiGateway.js` shows a `catch` block yielding `Sensei (fallback) response to: ...`. The real Gemini smoke test must disable or detect this fallback to prove provider streaming.

- Observation: Core package exports are explicit and will need updates for new prompt and capability modules.
  Evidence: `core/package.json` exposes individual `./wrapUpAssessment`, `./teachingPlan`, and `./prompts/*` subpaths; `core/index.ts` and `core/prompts/index.ts` re-export existing modules.

- Observation: Comprehensive Impact Analysis confirmed that this is not only a BFF client addition; it must add a WebView-to-RN stream request and RN-to-Web chunk result path.
  Evidence: `SenseiMobile/src/mobile/MainScreen.tsx::handleSubmit` currently enqueues `{ type: 'chat:userInput' }` into the WebView and releases the native turn guard when the WebView later sends `{ type: 'chat:turnComplete' }`. `src/mobile/webviewMessageRouter.ts` already handles `chat:update` and `chat:completeMessage` messages from RN to WebView, but no authored WebView message currently requests an LLM capability stream from RN.

- Observation: Authored-source search narrowed old `/turns` consumers to the RN/BFF scaffold, tests, and historical docs; generated web bundles and report files are not primary evidence.
  Evidence: targeted `rg` excluding `SenseiMobile/app_web/webview_dist/**`, `**/node_modules/**`, and `__tests__/reports/**` found `submitTurn` in `SenseiMobile/src/mobile/network/BffClient.ts`, its tests, BFF session/stream files, and docs. It did not find a current WebView production caller for the two scoped stream functions.

- Observation: Existing bridge request patterns should be reused for shape and timeout discipline.
  Evidence: `src/mobile/webviewMessageRouter.ts` has request/resolver maps for mermaid recovery, teaching plan generation, and learner analysis; `SenseiMobile/src/mobile/MainScreen.tsx` handles those Web-to-RN messages by calling `bffClient` methods and enqueuing RN-to-Web result messages.

- Observation: Architectural Synthesis confirms the repository uses a hub-and-spoke teaching workflow with centralized WebView orchestration, not a distributed state model.
  Evidence: `docs/sensei_teaching_workflow_architecture.md` names initialization, module selection, teaching loop, and advancement as the main workflow phases and identifies `index.tsx` as the orchestrator. Analyzer `tmp/analysis/summary.txt` corroborates this with `src/index.tsx` as top fan-out at 31, `src/moduleSelectionHandler.ts` as fan-out 17, and `src/ui.ts` plus `src/curriculum.ts` among high fan-in/risk files.

- Observation: The existing BFF architecture is controller/service/gateway driven with dependency assembly in `bff/src/container.js`.
  Evidence: analyzer entry candidates include `bff/index.js`, while fan-out identifies `bff/src/container.js` and `bff/src/server.js` as server integration hubs. Existing services such as `teachingPlanService`, `wrapUpService`, `analysisService`, and `mermaidService` use `CoreLlmAdapter` and `GeminiGateway` instead of embedding provider code in routes.

- Observation: Master-plan alignment is correct in ownership direction, but the ExecPlan must be explicit that these are Core capabilities, not only detached prompt-builder helpers.
  Evidence: `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` says every migrated capability needs canonical prompt builders in `core/prompts/<capability>.ts`, a Core capability function with structured inputs and provider-agnostic execution boundary, a BFF mobile route, a React Native bridge route, desktop behavior preservation, and parity validation. The same document's streaming-specific section says Core owns prompt builders, request types, and parser/normalization helpers; BFF owns mobile provider streaming; React Native forwards stream chunks; WebView owns rendering and teaching-state mutation.

## Decision Log

- Decision: Migrate only `streamModuleIntroduction` and `streamMainSenseiResponse` in this pass.
  Rationale: The master plan lists these as remaining LLM-facing streaming rows, and the user explicitly scoped this session to these two functions. Selection Sensei, enhancement request, key-takeaway enhancement internals, and pedagogical directive generation remain separate backlog rows.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Use WebSocket streaming for mobile.
  Rationale: The app needs progressive chunk delivery, and React Native `fetch` did not expose `response.body.getReader()` in the iOS simulator runtime. WebSocket is already supported by React Native and the repo already has a BFF WebSocket scaffold.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Use a two-step stream API: `POST /sessions/:sessionId/llm-stream` followed by a WebSocket connection to the returned `streamUrl`.
  Rationale: The `POST` can carry structured JSON payload, validate session, rate-limit, and create a short-lived pending request. Query parameters are not suitable for large structured prompt context. The WebSocket should carry only stream lifecycle events and chunks.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Do not use the existing `/sessions/:sessionId/turns` abstraction for these migrated capabilities.
  Rationale: Module introduction is not a user chat turn, and main Sensei response needs richer structured context than `{ input.text }`. Reusing the low-level WebSocket server/service pattern is useful, but preserving the `turnId` model would encode the wrong domain abstraction.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Keep desktop web direct streaming for Phase 1, but gate mobile away from browser provider execution.
  Rationale: The Phase 1 mobile proxy plan requires mobile server-owned LLM execution. Desktop web can continue browser-provider execution through Core-backed wrappers during Phase 1 unless a later plan explicitly migrates desktop transport too.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Move prompt wording and prompt builders to Core, while leaving WebView teaching state and UI rendering in WebView.
  Rationale: Mobile must not send final prompt text from the WebView for migrated capabilities. However, curriculum state, transcript rendering, DOM updates, and teaching-state mutation remain WebView responsibilities under the master plan.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Preserve key-takeaway enhancer hooks but do not migrate enhancer internals.
  Rationale: The enhancer is a separate LLM-facing backlog row. Disabling it would risk behavior drift, while migrating it would expand scope beyond the two selected stream functions.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Include a real Gemini WebSocket smoke integration test for the new `llm-stream` path in the default `bff` `npm test` script, matching the existing teaching-plan and wrap-up BFF integration-test posture.
  Rationale: The user wants the BFF test suite itself to prove that the migrated streaming path can reach real Gemini and receive live chunks, not only that the route works with a stubbed gateway. The real smoke test must fail if the gateway falls back to deterministic local text, otherwise a provider outage or credential failure could masquerade as a passed stream test.
  Date/Author: 2026-06-04 / Coding agent at user direction.

- Decision: Treat the old `/sessions/:sessionId/turns` plus `/stream?turnId=...` path as scaffold to evaluate during Impact Analysis, not as the default production path for this migration.
  Rationale: Fresh source inspection confirms the current WebView streaming call path still uses WebView-local Gemini chat and does not depend on `submitTurn`. The capability-specific `llm-stream` route better models module introductions and main Sensei responses. The old path should be kept, deprecated, or removed only after the formal Impact Analysis maps tests, docs, and any remaining scaffold dependencies.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Treat this ExecPlan as the live execution memory, not as a final report.
  Rationale: `docs/protocols/PLAN.md` requires an implementing agent to proceed to the next milestone without prompting for next steps, keep every living section current, and record progress, discoveries, and decisions as they happen. Future continuation must be possible from only this ExecPlan, so observations from protocols and implementation must be entered here immediately before moving on.
  Date/Author: 2026-06-04 / Coding agent at user correction.

- Decision: Keep the old `/sessions/:sessionId/turns` route and `BffClient.submitTurn` method during this implementation unless a later implementation-specific blocker proves removal is safer.
  Rationale: Comprehensive Impact Analysis found old `/turns` is not the production path for the scoped WebView stream functions, but it is still covered by RN client tests, BFF route code, historical mission-state docs, and the existing mobile scaffold. Additive implementation reduces regression risk and lets existing tests continue proving the old scaffold while the new capability-specific path is introduced.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Add capability-stream bridge messages rather than trying to reuse `chat:userInput` for module introduction and main Sensei response streams.
  Rationale: `chat:userInput` represents native submission of learner text into the WebView and is guarded by `chat:turnComplete`; module introductions and reloads are WebView-originated LLM requests tied to existing Sensei message bubbles. A new request shape can carry `requestId`, `messageId`, `capability`, and structured payload while RN forwards returned chunks through the existing `chat:update` and `chat:completeMessage` rendering path.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Select the additive capability-stream route as the architecture for implementation, pending user approval at the protocol gate.
  Rationale: This approach keeps domain boundaries clean: WebView derives teaching state and owns UI updates; Core owns prompt construction from structured capability requests; BFF owns validation, request storage, provider transport, and secrets; RN owns native transport and bridge forwarding. It preserves the existing `/turns` scaffold and desktop direct streaming while adding the mobile BFF-backed path required by the migration.
  Date/Author: 2026-06-04 / Coding agent.

- Decision: Implement `core/moduleIntroduction.ts` and `core/mainSenseiResponse.ts` as capability boundaries, not just prompt-builder containers.
  Rationale: The master plan requires a Core capability for each migrated row. For streaming rows, BFF may own the WebSocket/provider streaming loop, but Core must still expose structured request types, prompt construction, and any provider-agnostic capability metadata or normalization needed to make the route a real Core-owned capability rather than a BFF prompt shortcut.
  Date/Author: 2026-06-04 / Coding agent after master-plan alignment check.

- Decision: Proceed to implementation using the additive capability-stream architecture.
  Rationale: The user approved the recorded architecture after the master-plan alignment check. The next required action is to execute the Feature Implementation protocol, then create the required backup before non-doc project edits.
  Date/Author: 2026-06-05 / Coding agent at user approval.

## Outcomes & Retrospective

Implementation setup has started. Environment verification, Mandatory Core Analysis, Comprehensive Impact Analysis, Architectural Synthesis Steps 0-6, Feature Implementation planning, Test Implementation planning, and the required backup have completed in the fresh checkout. The Core Analysis findings are recorded in `docs/mission_state/mission_state_llm_streaming_core_analysis_20260604T203636Z.md`, and the backup is `backup/sensei_backup_module_intro_main_sensei_streaming_core_bff_migration_20260605_000521.zip`. The execution process has been corrected after rereading `docs/protocols/PLAN.md`: this file must be updated continuously as work proceeds, including during protocol execution, instead of being updated only after a milestone has finished. Impact Analysis raised the migration to Risk 5 because it crosses prompt ownership, LLM secrets, mobile bridge contracts, WebSocket transport, UI streaming, and the default BFF real-provider test suite. The recommended additive capability-stream architecture has user approval. The expected final outcome remains that mobile module introductions and ordinary Sensei responses stream through BFF WebSocket transport using Core-built prompts, while the chat UI continues to display progressive chunks exactly as before. At completion, this section must be updated with the files changed, tests run, manual simulator evidence, and any remaining gaps.

## Comprehensive Impact Analysis

The change classification is mixed Data, Control, Interface, State, and Configuration. It is a data change because mobile must send structured capability payloads instead of final prompt strings. It is a control-flow change because mobile WebView execution must branch away from `chat.sendMessageStream` and route through the native bridge, BFF, and WebSocket stream. It is an interface change because Core exports, BFF routes, WebSocket frames, RN client methods, bridge message unions, and tests all gain new shapes. It is a state change because BFF must track pending `llm-stream` requests by `requestId` and WebView/RN must correlate chunks to `messageId`. It is a configuration change because the BFF real Gemini smoke test needs strict provider behavior and because model/task selection must remain server-side. The overall risk level is 5 out of 5 due to the number of runtime boundaries and the possibility of silently falling back to local deterministic text instead of real provider streaming.

Analyzer fan-in and fan-out identify the highest blast-radius files. `src/index.tsx` has the top fan-out count at 31 and owns main Sensei response orchestration, mobile build setup, and WebView bridge initialization. `src/moduleSelectionHandler.ts` has fan-out 17 and owns module-introduction prompt context construction. `src/ui.ts` has high fan-in and the second-highest change-risk score because it owns message rendering and native `render:progress`. `core/index.ts`, `core/package.json`, and `core/prompts/index.ts` are export surfaces for new Core modules. `bff/src/container.js`, `bff/src/server.js`, `bff/src/routes/sessions.js`, `bff/src/stream/streamServer.js`, `bff/src/services/streamingService.js`, and `bff/src/integration/geminiGateway.js` are the server-side transport and provider surfaces. `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts`, `SenseiMobile/src/mobile/bridge/contracts.ts`, `src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, and `src/mobile/webviewMessageRouter.ts` are the native/WebView transport surfaces.

The technical impact score is 9 out of 10. The implementation must keep `streamModuleIntroduction` and `streamMainSenseiResponse` stable as UI-facing wrappers, preserve `updateMessageStream`, preserve enhancer hooks, add Core prompt builders with no DOM/RN/server imports, add a BFF capability request store, add a new WebSocket path, and add RN/WebView stream bridge correlation. The business impact score is 8 out of 10 because learner-visible streaming must remain progressive and reloadable; a failure would make mobile chat appear stuck or silently stop producing Sensei responses. The security impact score is 8 out of 10 because prompt construction and provider calls move toward the server boundary, reducing mobile key exposure for migrated paths, while structured payload validation must prevent oversized or malformed context. The operational impact score is 7 out of 10 because logs and tests need enough request identity to debug real-provider WebSocket streams, including `requestId`, `messageId`, `capability`, and fallback/provenance status. The maintenance impact score is 8 out of 10 because the work introduces a reusable capability stream pattern that future migrations will likely copy; duplicate client or route abstractions would create long-term drift.

Direct code consumers are the WebView callers in `src/moduleSelectionHandler.ts` and `src/index.tsx`, the UI renderer in `src/ui.ts`, the enhancer controller in `src/keyTakeawayEnhancerController.ts`, RN bridge handling in `SenseiMobile/src/mobile/MainScreen.tsx`, RN networking in `SenseiMobile/src/mobile/network/BffClient.ts`, BFF session and streaming services, and default BFF integration tests. System integrators are React Native WebSocket, `WKWebView` `postMessage`, Express routes, the BFF in-memory session/request stores, and Gemini through `bff/src/integration/geminiGateway.js`. End-user impact centers on iOS learners seeing module introductions, Socratic follow-up messages, reloads, and ordinary responses stream into the correct Sensei bubble. Operational impact centers on keeping errors visible instead of leaving a loading bubble, proving the BFF can reach real Gemini, and keeping fallback behavior explicit. Future developers need a self-contained capability-stream contract with named request and event types instead of copying the old generic `turnId` abstraction.

Immediate ripple risks are TypeScript/Jest compile errors from Core package exports and bridge type unions, BFF route registration mistakes, WebSocket URL parsing mistakes, and existing `/turns` tests breaking if shared stream helpers change too broadly. Short-term risks are duplicate chunks, missing `chat:completeMessage`, stuck native turn guards, missing `render:progress`, and provider fallback passing the real smoke test. Medium-term risks are accepting final prompt strings from mobile, thereby failing the architecture goal, or adding a second non-reusable stream abstraction that future LLM migrations cannot share. Long-term risks are stale prompt parity, uncontrolled request payload growth, and ambiguous provider provenance.

Validation must include root Jest for Core prompt parity and WebView/RN bridge behavior, BFF `npm test` including deterministic route coverage and a real Gemini WebSocket smoke test, and `npm run webview:bundle` after WebView code changes. The root sentinel test must fail if mobile module introduction or main Sensei response calls browser `chat.sendMessageStream`, browser Gemini, or browser `CoreLlmClient`. BFF tests must prove invalid session/payload rejection, started/chunk/completed frames for a deterministic gateway, and at least one real non-empty Gemini chunk with fallback disabled or detected. RN tests must prove `submitLlmStream` posts to `/sessions/:sessionId/llm-stream`, opens the returned WebSocket URL, preserves `requestId`, `messageId`, and `capability`, and yields parsed events. Manual simulator validation must show progressive chunks in the correct Sensei bubble for both a module introduction and an ordinary Sensei response while mobile is using the BFF-backed path. Rollback is additive: keep the old `/turns` route and desktop direct streaming path intact, gate mobile behavior behind `window.__SENSEI_MOBILE_BUILD__`, and revert the new capability route/bridge path if validation fails without removing the old scaffold.

## Architectural Synthesis

The system follows a hub-and-spoke architecture for teaching behavior. `src/index.tsx` is the main WebView orchestrator for initialization, user input, teaching-loop progression, response generation, and bridge setup. `src/moduleSelectionHandler.ts` is the module/phase-selection orchestrator. `src/curriculum.ts`, `src/adaptiveEngine.ts`, and prompt helpers provide domain decisions. `src/ui.ts` owns DOM rendering, streamed markdown, Mermaid handling, and native render-progress notifications. This matches `docs/sensei_teaching_workflow_architecture.md`, which describes Initialization, Module Selection, Teaching Loop, and Advancement phases centered around `index.tsx`; analyzer fan-out and risk data corroborate the same hubs.

The Core package is the provider-neutral capability layer. Its existing exported tools such as wrap-up assessment, teaching plan, learner analysis, and mermaid recovery define reusable logic and prompt contracts without importing DOM, React Native, Express, or server secrets. For these streaming rows, Core must expose real capability boundaries: structured request types, canonical prompt builders, and any provider-agnostic metadata or normalization needed by BFF. The BFF is the server-side adapter layer. It wires dependencies in `bff/src/container.js`, registers HTTP routes in `bff/src/server.js`, and delegates provider calls through `GeminiGateway` and `CoreLlmAdapter`. React Native is a shell and transport adapter. It hosts `WKWebView`, owns `BffClient`, and forwards messages between native services and WebView via explicit bridge contracts. Therefore the correct architecture keeps teaching state and UI rendering in WebView, moves prompt construction and capability contracts into Core, moves provider streaming into BFF, and uses RN only to carry structured requests and stream events.

The implementation principles are Separation of Concerns, DRY, KISS, Stable Contracts, Additive Migration, and Fail-Fast Observability. Separation of Concerns matters because prompt building, provider execution, native transport, and DOM rendering are separate responsibilities in this migration. DRY matters because existing BFF service/gateway, WebView bridge resolver, and RN WebSocket queue patterns should be reused rather than rebuilt. KISS matters because the first migration should add one capability-stream path, not a generalized orchestration framework. Stable Contracts matter because existing exports and tests depend on `streamModuleIntroduction`, `streamMainSenseiResponse`, `/turns`, and bridge message unions. Additive Migration matters because the existing desktop and old scaffold behavior should continue passing while mobile gains the new path. Fail-Fast Observability matters because a real Gemini smoke test must fail on provider fallback, not pass on deterministic local text.

The useful patterns are Adapter, Gateway, Controller-Service-Store, Message Bridge, Request/Resolver Map, and Async Iterable Stream. `CoreLlmAdapter` adapts `GeminiGateway` to Core LLM interfaces. `GeminiGateway` is the provider gateway. BFF routes/controllers/services/stores should mirror the existing teaching-plan, analysis, wrap-up, and streaming structure. `src/mobile/webviewMessageRouter.ts` uses a request/resolver map for asynchronous bridge calls, which should shape the new WebView stream request. `BffClient.createStream` already implements an async iterable queue over WebSocket events. Anti-patterns to avoid are sending final prompt strings from mobile, overloading the old generic `turnId` abstraction for capability-specific streams, duplicating provider SDK calls in WebView/RN, silently accepting fallback provider text in the real smoke test, bypassing `updateMessageStream`, manually editing generated web bundles instead of rebuilding them, and expanding `src/index.tsx` or `MainScreen.tsx` with unrelated orchestration.

Three approaches were considered. The recommended approach is the additive capability-stream route. It adds Core prompt builders and capability request types, a BFF `POST /sessions/:sessionId/llm-stream` plus `WS /sessions/:sessionId/llm-stream?requestId=...`, RN `submitLlmStream`, and explicit WebView bridge stream request/result messages. This scores best on boundary ownership, testability, mobile security, and future reuse. It costs more implementation work than overloading `/turns`, but avoids encoding wrong domain semantics.

The second approach is to reuse the old `/sessions/:sessionId/turns` and `/stream?turnId=...` route with a richer body. This is faster and reuses more existing code, but it conflates module introductions and reloads with user turns, ties message identity to `turnId`, and encourages final prompt compatibility strings. It performs worse on maintainability and architecture alignment.

The third approach is to move full stream orchestration into RN, where RN would create or own Sensei bubbles and send direct `chat:update` messages without keeping `streamModuleIntroduction` and `streamMainSenseiResponse` as WebView wrappers. This might reduce WebView provider code, but it conflicts with the current hub-and-spoke teaching state model, risks duplicated UI state, and would bypass established WebView reload/enhancer behavior. It is rejected for this milestone.

The recommended blueprint creates or modifies these components. In Core, create `core/prompts/moduleIntroduction.ts`, `core/prompts/mainSenseiResponse.ts`, `core/moduleIntroduction.ts`, and `core/mainSenseiResponse.ts`, then update `core/index.ts`, `core/prompts/index.ts`, and `core/package.json` exports. In BFF, create `bff/src/services/llmStreamRequestStore.js`, `bff/src/controllers/llmStreamController.js`, and `bff/src/routes/llmStream.js`; update `bff/src/container.js`, `bff/src/server.js`, `bff/src/stream/streamServer.js`, `bff/src/services/streamingService.js`, and `bff/src/integration/geminiGateway.js`. In RN/WebView contracts, update `SenseiMobile/src/mobile/network/types.ts`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/bridge/contracts.ts`, `src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, and `src/mobile/webviewMessageRouter.ts`. In WebView teaching code, update `src/interactionHelpers.ts`, `src/moduleSelectionHandler.ts`, `src/index.tsx`, and prompt compatibility exports in `src/prompts.ts` only as needed. Tests must cover Core parity, BFF deterministic and real Gemini streams, RN WebSocket parsing, and mobile routing sentinel behavior.

The data flow is as follows. A WebView teaching flow creates a Sensei message bubble and calls `streamModuleIntroduction` or `streamMainSenseiResponse`. On desktop, those wrappers preserve direct `chat.sendMessageStream`. On mobile, the wrapper builds a structured capability payload, creates a bridge `requestId`, and sends a Web-to-RN request with `requestId`, `messageId`, `capability`, and payload. RN `MainScreen` receives that message, calls `BffClient.submitLlmStream`, and opens the returned WebSocket. BFF validates the session and payload, stores a pending request under `requestId`, and returns a WebSocket URL. When RN connects, BFF verifies `sessionId` and `requestId`, calls the matching Core prompt builder to produce the final prompt server-side, streams from Gemini, and sends `started`, `chunk`, `completed`, or `error` frames with `requestId`, `messageId`, and `capability`. RN forwards chunks back to WebView, and the WebView wrapper feeds the chunk text through `enhancerController.onChunk` when present and `updateMessageStream(messageId, accumulatedText)`. On completion, the wrapper finalizes the enhancer and returns the final text exactly as the current callers expect.

The Core API contract should include `buildModuleIntroductionPrompt(request: ModuleIntroductionPromptRequest): string` and `buildMainSenseiResponsePrompt(request: MainSenseiResponsePromptRequest): string`, plus exported capability request types and a small provider-agnostic capability resolver if implementation needs a single BFF dispatch surface, for example `buildLlmStreamPrompt({ capability, payload })`. The BFF may call GeminiGateway directly for streaming, but it must obtain prompt text and capability semantics from Core, never from BFF-local prompt bodies or final prompt strings sent by mobile. The BFF HTTP contract is `POST /sessions/:sessionId/llm-stream` with `{ capability, messageId, payload, metadata }` and response `{ requestId, streamUrl }`. The BFF WebSocket contract is status/chunk/error frames carrying `requestId`, `messageId`, and `capability`. The RN API contract is `submitLlmStream(payload: SubmitLlmStreamPayload): Promise<LlmStreamHandle>`, where the handle contains `requestId`, `messageId`, `capability`, and an async iterable stream. The WebView bridge contract should expose a helper such as `requestLlmStreamViaBridge({ capability, messageId, payload, onChunk })`, with resolver cleanup on completion/error/timeout. Exact names may change during implementation if source context shows a better local convention, but the responsibilities and identity fields must not change without updating this plan first.

## Feature Implementation Protocol Plan

Functional requirements are grounded in the Core Analysis checkpoint `docs/mission_state/mission_state_llm_streaming_core_analysis_20260604T203636Z.md` and analyzer artifacts under `tmp/analysis/`. Mobile module introduction and main Sensei response streams must route through BFF, not browser Gemini or browser `CoreLlmClient`. The WebView must send structured inputs, not final prompt strings, for migrated mobile runtime. Core must own canonical prompt bodies in `core/prompts/moduleIntroduction.ts` and `core/prompts/mainSenseiResponse.ts`, plus capability boundaries in `core/moduleIntroduction.ts` and `core/mainSenseiResponse.ts`. BFF must validate and store short-lived stream requests, build prompts through Core, stream real provider chunks through GeminiGateway, and emit correlated WebSocket events. RN must expose a BFF client method and bridge forwarding path. WebView wrappers must preserve existing exported function signatures, chunk accumulation, `KeyTakeawayEnhancerController` hooks, `updateMessageStream`, reload behavior, and desktop direct streaming behavior.

Non-functional requirements are security, parity, observability, low drift, and minimal blast radius. Security means mobile provider execution and provider secrets stay server-owned for migrated capabilities. Parity means prompt text is copied verbatim first and golden or old/new parity tests prevent accidental wording drift. Observability means request logs carry `requestId`, `messageId`, and `capability`, and the real Gemini smoke cannot pass on fallback text. Low drift means `src/prompts.ts` becomes a compatibility facade for migrated prompt bodies. Minimal blast radius means the old `/turns` scaffold and desktop direct streaming path remain additive and passing unless a specific implementation blocker appears.

The approved architectural blueprint from Architectural Synthesis is the implementation blueprint. The user approved proceeding on 2026-06-05. No separate approach matrix is needed inside Feature Implementation because Architectural Synthesis already compared the additive capability-stream route, old `/turns` overloading, and RN-owned stream orchestration, and selected the additive capability-stream route.

Primary risks and mitigations are as follows. First, prompt drift could change teaching behavior; mitigation is verbatim prompt migration plus Core prompt parity tests before runtime routing changes. Second, mobile could accidentally keep calling browser `chat.sendMessageStream` or browser `CoreLlmClient`; mitigation is a mobile-routing sentinel covering both scoped wrappers and a bridge test that asserts the mobile path sends a capability stream request. Third, BFF real-provider smoke could pass on fallback text; mitigation is a strict no-fallback path or provider-provenance assertion in BFF tests. Fourth, WebView rendering could break or lose progress events; mitigation is keeping chunk application in the wrappers through `updateMessageStream` and testing chunk order/completion. Fifth, the old `/turns` scaffold could regress; mitigation is additive stream helper reuse and preserving existing BffClient tests.

Implementation tasks and validation logs:

- Task 1: Add Core prompt and capability modules for module introduction and main Sensei response. Validation log: use existing prompt parity test output, not runtime logs, to prove exact prompt construction; no permanent code log is required in Core because prompt builders are pure.
- Task 2: Update `src/prompts.ts` and WebView compatibility wrappers so canonical prompt bodies move to Core without duplicate prompt bodies. Validation log: root Jest prompt parity test must identify both migrated capability prompts.
- Task 3: Add BFF `llm-stream` request store, controller, route, and server/container wiring. Validation log: `logger.info('[LLM_STREAM_MIGRATION] request-created', { requestId, sessionId, capability, messageId })`.
- Task 4: Extend BFF WebSocket handling and streaming service for capability streams while preserving `/stream?turnId=...`. Retained milestone logs: `logger.info('[LLM_STREAM_MIGRATION] stream-started', { requestId, capability, messageId })` and `logger.info('[LLM_STREAM_MIGRATION] stream-completed', { requestId, capability, messageId, chunks })`. Per-chunk migration logs were useful during Step 8 validation but must not remain after cleanup.
- Task 5: Add strict real-provider smoke support so fallback text cannot satisfy the real Gemini BFF test. Validation log: `logger.info('[LLM_STREAM_MIGRATION] provider-stream', { requestId, capability, provider: 'gemini', allowFallback: false })` or equivalent test-visible provenance if implementation chooses a metadata field instead.
- Task 6: Add RN `BffClient.submitLlmStream` and shared stream event types. Validation log: `logger.info('[LLM_STREAM_MIGRATION] mobile-stream-requested', { requestId, capability, messageId })`.
- Task 7: Add bridge contracts and WebView bridge helper for capability stream requests. Validation logs: `logger.info('[LLM_STREAM_MIGRATION] bridge-request', { requestId, capability, messageId })` and `logger.info('[LLM_STREAM_MIGRATION] bridge-complete', { requestId, capability, messageId })`.
- Task 8: Update `streamModuleIntroduction` and `streamMainSenseiResponse` mobile branches to route through the bridge while desktop keeps current direct streaming. Validation logs: `logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-start', { requestId, capability, messageId })` and `logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-complete', { requestId, capability, messageId, chars })`.
- Task 9: Add and update tests. Validation is deterministic test output for Core parity, BFF route/WS events, RN WebSocket parsing, WebView routing sentinel, and default BFF real Gemini smoke.
- Task 10: Run `npm run webview:bundle` after WebView source changes, then run required analyzer/test/build commands with capped output and record results here.

Functional test policy alignment: tests must import production modules and exercise real seams. Core prompt tests should import Core prompt builders plus old compatibility exports or golden fixtures; they must not duplicate prompt-building logic in the test. BFF deterministic tests should start the real BFF server or construct production services with only the external Gemini gateway stubbed; they must cover invalid sessions, malformed payloads, bad capability names, missing `messageId`, WebSocket unknown `requestId`, started/chunk/completed, and error frames. The real Gemini smoke should use actual BFF server startup and real `GeminiGateway`, and must fail on fallback. RN tests should use the existing `FakeWebSocket` pattern and production `BffClient`. WebView/mobile routing tests should import production wrappers or routing helpers, set `window.__SENSEI_MOBILE_BUILD__`, and assert bridge routing without calling direct provider streams. All new mocks must be created in, reused from, or improve existing `__mocks__` assets; internal collaborators should remain real unless they represent external provider/network seams. Validation runs for affected Jest tests must use `--silent --bail --noStackTrace` as required by the Test Implementation Protocol.

## Context and Orientation

This repository has four relevant areas.

The `src/` directory contains the WebView web app. The WebView is the HTML/JavaScript app rendered inside React Native on mobile and in the browser on desktop. It owns the visible chat transcript, markdown rendering, curriculum state, module and phase selection UI, and functions such as `updateMessageStream` that mutate the DOM as streamed text arrives.

The `core/` directory is the shared TypeScript package published inside the repo as `@sensei/core`. Core is where migrated prompt text, prompt builders, capability request types, and provider-agnostic execution helpers belong. Core must not import DOM APIs, React Native APIs, or server-only secrets.

The `bff/` directory is the Backend-for-Frontend. A BFF is a local server layer used by the mobile app so the mobile bundle does not contain provider SDK calls or API keys. BFF owns session validation, rate limiting, request storage, server-side Gemini transport, and stream delivery.

The `SenseiMobile/` directory contains the React Native shell. It hosts a `WKWebView`, owns the native bridge between RN and WebView, and already contains `SenseiMobile/src/mobile/network/BffClient.ts`, which has a WebSocket async-iterator helper for the old `/turns` stream scaffold.

The two scoped WebView functions are in `src/interactionHelpers.ts`.

`streamModuleIntroduction(chat, introContext, moduleTitleForPrompt, senseiMessageId, options?)` currently builds a final message by combining `introContext` with `Let's begin ${moduleTitleForPrompt}.`, calls `chat.sendMessageStream({ message })`, loops over Gemini chunks, appends each chunk to accumulated text, optionally sends each chunk through `KeyTakeawayEnhancerController`, and calls `updateMessageStream` so the chat bubble updates progressively. The full `introContext` is built before this function is called.

`streamMainSenseiResponse(chat, dynamicContext, currentUserInput, senseiMessageId, options?)` currently inserts the user input into `dynamicContext` by replacing `USER_LAST_INPUT_PLACEHOLDER`, or appends `User: ${currentUserInput}` if no placeholder exists. It then calls `chat.sendMessageStream({ message })`, tracks chunk count and first chunk latency, passes chunks through the optional enhancer hook, and calls `updateMessageStream`.

The upstream module-introduction call path is in `src/moduleSelectionHandler.ts`. The `executePhaseSelection` flow builds curriculum focus data, creates a module introduction task template using `MODULE_INTRODUCTION_TASK_TEMPLATE`, calls `buildSenseiDynamicSystemInstruction`, creates `introContext`, and then calls `streamModuleIntroduction`.

The main response path is primarily in `src/index.tsx`, where the app gathers current curriculum state, transcript history, user input, and pedagogical context before calling `streamMainSenseiResponse`.

The prompt constants and builders currently involved include `MODULE_INTRODUCTION_TASK_TEMPLATE`, `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`, `MANDATORY_TEACHING_STRUCTURE`, `PEDAGOGICAL_GUIDANCE_PLACEHOLDER`, `USER_LAST_INPUT_PLACEHOLDER`, curriculum focus prompt templates, `buildSenseiDynamicSystemInstruction`, `buildSocraticExecutionInstruction`, `buildEarlyReturnInstruction`, `getCurriculumFocusInstruction`, `calculateFocusPoints`, `resolveFocusPoints`, `buildPrimaryActionInstruction`, `buildSupportingContextBlock`, and `buildContextualInstruction`.

The current BFF stream scaffold is useful but too generic. `bff/src/routes/sessions.js` exposes `POST /sessions/:sessionId/turns`. `bff/src/controllers/sessionController.js` creates a turn and returns `/sessions/:sessionId/stream?turnId=...`. `bff/src/stream/streamServer.js` accepts that WebSocket path. `bff/src/services/streamingService.js` looks up the turn, calls `senseiCoreAdapter.buildPrompt(context)`, streams from `geminiGateway.streamMainResponse(prompt, { context })`, and emits WebSocket events. `bff/src/integration/senseiCoreAdapter.js` currently builds a stub-like prompt and should not become the long-term home for these capability prompts.

The migration must preserve the existing UI streaming path. In particular, `src/ui.ts::updateMessageStream` should remain the function that applies text chunks to the DOM, updates raw stream text maps, sanitizes and renders markdown, updates native render progress, and attaches code-block interactions. The implementation should call it as before from the WebView wrappers after each received chunk.

## Plan of Work

Start by stabilizing the environment in the fresh checkout. The implementation should happen from `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`, not the previous `Documents` checkout. Run dependency installation in the fresh location and confirm `require('zod')`, BFF server import, and the relevant tests no longer hang. If any dependency import still hangs, stop implementation and fix the local install before editing application code.

Before changing non-doc project files, run the required backup command from the fresh checkout. Because this ExecPlan only creates a document, no backup was required to draft it. Implementation will modify `src/`, `core/`, `bff/`, and `SenseiMobile/`, so a backup is required before that work begins.

Run the MANDATORY CORE ANALYSIS PROTOCOL in the fresh checkout and update this plan if the analyzer output differs from the earlier discovery. At minimum, run a baseline `npm run analysis:run`, then focused traces for `src/interactionHelpers.ts::streamModuleIntroduction` and `src/interactionHelpers.ts::streamMainSenseiResponse`. Read `tmp/analysis/brief.md`, `tmp/analysis/functions.json`, and the focused trace files before editing. The earlier discovery found that both functions call `logSenseiPromptValidation`, `updateMessageStream`, and optional `KeyTakeawayEnhancerController` methods; fresh output must confirm this.

After Core Analysis, run the COMPREHENSIVE IMPACT ANALYSIS PROTOCOL because this migration modifies existing shared code paths across WebView, Core, BFF, and RN. For architecture work, run MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL before implementation. The synthesis should reaffirm the separation of responsibilities: Core builds prompts and capability contracts, BFF owns provider transport and secrets, RN owns native transport/bridge, and WebView owns UI and teaching state.

Create Core prompt modules. Add `core/prompts/moduleIntroduction.ts` to own module-introduction prompt text and builder functions. Add `core/prompts/mainSenseiResponse.ts` to own main Sensei response prompt text and builder functions. Move prompt wording out of `src/prompts.ts` for the migrated mobile capabilities. Existing web imports may remain through compatibility wrappers during the transition, but the canonical prompt text for these two capabilities must live in Core.

Create Core capability modules. Add `core/moduleIntroduction.ts` and `core/mainSenseiResponse.ts`. These modules must define structured request types, exported capability names, and functions that build the exact final prompt string from structured inputs. They should not call Gemini directly unless they use an existing provider-agnostic Core LLM interface already established in this repo. For the mobile streaming route, the BFF can call a Core function to resolve the capability and build the prompt, then call `GeminiGateway` to stream text. This satisfies the master-plan streaming rule that Core owns the capability contract and prompt construction while BFF owns provider streaming for mobile. Export the new modules from `core/index.ts`.

Design structured inputs so the WebView does not send final prompt text to mobile BFF. For module introduction, the payload should include enough structured data for Core to reproduce the old `introContext`: module title, module goal or current curriculum item summary when available, phase name, curriculum focus data, focus point snapshot, current pedagogical guidance if applicable, and any Socratic execution settings. For main Sensei response, the payload should include current user input, recent transcript or response history needed by the old prompt, curriculum state summary, current phase, current module/concept/chunk metadata, focus data, and any pedagogical guidance. If a field is difficult to structure cleanly, document the reason in this plan before using a temporary compatibility string. Temporary compatibility strings must not contain full prompt bodies in the mobile WebView bundle for the migrated capability.

Split curriculum prompt wording from curriculum state derivation. If `src/curriculum.ts` currently calculates both focus state and prompt-language instructions in the same function, extract or duplicate only the prompt-language builder into Core and leave state calculation in WebView. `getCurriculumFocusInstruction` and helper builders such as `buildPrimaryActionInstruction`, `buildSupportingContextBlock`, and `buildContextualInstruction` should either move to Core or be replaced by Core functions that accept structured focus data. The WebView can continue calculating which focus points apply.

Add BFF request storage. Create `bff/src/services/llmStreamRequestStore.js` as a short-lived in-memory store keyed by `requestId`. It should store `sessionId`, `capability`, `messageId`, structured payload, creation time, and any metadata needed for logging/rate limiting. It should expire entries after a short window so abandoned POST requests do not leak memory. It does not need database persistence for Phase 1.

Add a BFF controller and route. Create `bff/src/controllers/llmStreamController.js` and `bff/src/routes/llmStream.js`. The route is `POST /sessions/:sessionId/llm-stream`. It validates the session, validates the JSON payload with explicit allowed capabilities, rate-limits expensive stream requests, creates a request in `llmStreamRequestStore`, derives a WebSocket URL from the incoming request host/protocol, and returns `{ requestId, streamUrl }`. Register the route in `bff/src/server.js` and wire the store/controller dependencies in `bff/src/container.js`.

Refactor the BFF WebSocket server to support the new path. Update `bff/src/stream/streamServer.js` to recognize `/sessions/:sessionId/llm-stream?requestId=...` in addition to the existing `/sessions/:sessionId/stream?turnId=...` route if that old route is still needed by tests. Do not remove `/turns` unless impact analysis proves it is unused. New capability streams should call a new method on `StreamingService`, such as `handleLlmStreamConnection({ ws, sessionId, requestId })`.

Refactor `bff/src/services/streamingService.js` so capability streams do not depend on `turnId`. The new handler should look up the pending request, verify the `sessionId` matches, send `{ type: 'status', phase: 'started', requestId, messageId, capability }`, build the prompt through the appropriate Core capability module, call `geminiGateway.streamMainResponse(prompt, { context })`, and send chunks as `{ type: 'chunk', requestId, messageId, capability, text }`. On completion, send `{ type: 'status', phase: 'completed', requestId, messageId, capability }` and close the WebSocket. On failure, send `{ type: 'error', requestId, messageId, capability, code, message }` and close the socket.

Keep `bff/src/integration/geminiGateway.js` as the server-side provider streaming adapter. If its current `streamMainResponse` method name is too narrow, add a capability-neutral wrapper such as `streamText(prompt, { task, context })` while preserving existing callers. Do not place prompt-building logic in `GeminiGateway`; it should receive a final prompt string and model/task configuration only.

Add React Native client support. Update `SenseiMobile/src/mobile/network/types.ts` with request and stream event types for LLM capability streaming. Update `SenseiMobile/src/mobile/network/BffClient.ts` with a method such as `submitLlmStream(payload)`. This method should call `POST /sessions/:sessionId/llm-stream`, parse `{ requestId, streamUrl }`, and then reuse the existing WebSocket async-queue pattern to yield chunk/status/error events. Preserve the existing `submitTurn` path unless impact analysis proves it can be retired.

Add bridge contracts. Update `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, and `src/mobile/webviewMessageRouter.ts` so the WebView can request a migrated stream and receive streamed events. The WebView request should include `requestId`, `capability`, `messageId`, and structured payload. In `src/mobile/webviewMessageRouter.ts`, add a request/resolver helper for mobile LLM streaming that follows the existing teaching-plan and learner-analysis resolver pattern, but streams multiple chunk events instead of resolving only once. In `SenseiMobile/src/mobile/MainScreen.tsx`, handle the WebView request by calling `BffClient.submitLlmStream`, forwarding chunks back into the WebView with the correct `messageId`, and sending completion or error events. Do not reuse `chat:userInput` for these streams because that message represents a native user submission into the WebView and is tied to the native turn guard.

Update `src/interactionHelpers.ts`. Keep the exported functions `streamModuleIntroduction` and `streamMainSenseiResponse` as stable UI-facing wrappers. On desktop web, preserve the current `chat.sendMessageStream` path or call through a Core browser client if an existing pattern supports that without widening scope. On mobile, detect `window.__SENSEI_MOBILE_BUILD__` and route through the native bridge/BFF stream instead of using the browser provider `chat`. Both branches must preserve `updateMessageStream`, `enhancerController.onChunk`, `enhancerController.finalize`, and `enhancerController.getLatestText`.

Update `src/moduleSelectionHandler.ts` and `src/index.tsx` so mobile calls pass structured capability inputs rather than final prompt text. Where desktop still needs current direct prompt behavior, keep compatibility wrappers, but do not let mobile use browser provider execution or bundled prompt bodies for the migrated capabilities. After implementation, update `docs/llm_entry_exit_traces.md` or the project migration status as required by the master plan so the old entry point, Core capability, Core prompt file, BFF route, mobile bridge message, and remaining compatibility wrapper are all recorded.

Add the Mobile Routing Gate milestone. This is mandatory for any ExecPlan that migrates or introduces an LLM tool. The implementation must wire the mobile WebView build to the BFF-backed path for both module introduction and main Sensei response, gate desktop-only local SDK paths with `window.__SENSEI_MOBILE_BUILD__`, and add a sentinel test that fails if the mobile path uses a browser `CoreLlmClient` or direct Gemini chat for these two capabilities.

Add tests incrementally. Core prompt parity tests should prove that the new Core prompt builders produce the same final prompt strings as the old builders for representative module introduction and main response scenarios. BFF tests should include both deterministic transport coverage and a real Gemini smoke integration test. The deterministic BFF test should prove `POST /sessions/:sessionId/llm-stream` rejects invalid sessions/payloads, creates a request, returns a WebSocket URL, and that the WebSocket handler emits started/chunk/completed events when `GeminiGateway` is stubbed with a deterministic async iterator. The real Gemini BFF smoke test should follow the existing `bff/tests/teachingPlan.int.test.js` and `bff/tests/wrapUp.int.test.js` pattern: start the actual BFF with `startServer({ host: '127.0.0.1', port: 0 })`, create a session through `POST /sessions`, submit a tiny valid `mainSenseiResponse` capability request to `POST /sessions/:sessionId/llm-stream`, open the returned WebSocket URL, assert a `started` event, assert at least one non-empty real provider chunk, and assert `completed`. This real smoke test must be added to the default `bff` `npm test` script. Because `GeminiGateway.streamMainResponse` has historically fallen back to deterministic text on provider errors, the implementation must add a strict test path, provider provenance field, or equivalent assertion surface so the real smoke test fails when fallback text is used. RN tests should prove `BffClient.submitLlmStream` opens the returned WebSocket URL and yields parsed events. WebView tests should prove the mobile path sends a bridge request and does not call `chat.sendMessageStream`.

Manual validation should happen last. Start BFF, Metro, and the iOS simulator from the fresh checkout. Trigger a module introduction and a normal Sensei response. Confirm that chunks appear progressively in the chat bubble, the final rendered markdown is correct, and the BFF logs show server-side stream start/chunk/completion for the matching `requestId`.

## Concrete Steps

All commands in this section assume the working directory is `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh` unless stated otherwise.

First, verify the fresh checkout dependency tree is healthy:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff
    node -e "console.log('zod start'); require('zod'); console.log('zod done')"
    node -e "console.log('server start'); require('./src/server'); console.log('server done')"

Expected output:

    zod start
    zod done
    server start
    server done

If either command hangs, do not implement this plan. Reinstall dependencies in the fresh non-iCloud checkout and retry.

Run the required analyzer protocols before implementation. Use capped output for commands that may be verbose, but do not truncate source files or protocol docs when reading them:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh
    npm run analysis:run
    npm run analysis:run -- --entry src/interactionHelpers.ts::streamModuleIntroduction --maxDepth 5
    cp tmp/analysis/focused_trace.txt tmp/analysis/focused_trace_module_intro.txt
    npm run analysis:run -- --entry src/interactionHelpers.ts::streamMainSenseiResponse --maxDepth 5
    cp tmp/analysis/focused_trace.txt tmp/analysis/focused_trace_main_sensei_response.txt

Read `tmp/analysis/brief.md`, `tmp/analysis/focused_trace_module_intro.txt`, and `tmp/analysis/focused_trace_main_sensei_response.txt`. Update this ExecPlan if fresh traces show different dependencies.

Before modifying non-doc files, run the required backup:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh
    npm run backup:create -- --feature "module_intro_main_sensei_streaming_core_bff_migration" --context "Migrate module introduction and main Sensei response streaming to Core-built prompts and BFF WebSocket transport for mobile while preserving WebView streaming UI behavior."

Then implement in this order:

1. Add Core prompt and capability modules.
2. Add Core exports and prompt parity tests.
3. Add BFF `llm-stream` request route, request store, and WebSocket handler.
4. Add BFF tests with a stubbed streaming gateway and a real Gemini WebSocket smoke test that is included in default `bff` `npm test`.
5. Add RN `BffClient` method and bridge contracts.
6. Update WebView mobile routing wrappers and sentinel tests.
7. Run automated tests and manual simulator validation.

Suggested validation commands after implementation:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh
    npm test -- --runInBand
    npm run analysis:run

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff
    npm test

The `bff` `npm test` command must include the real Gemini stream smoke test by default, in the same style as the existing teaching-plan and wrap-up BFF integration tests. The smoke test should be a plain Node integration script such as `bff/tests/llmStream.realGemini.int.test.js`, and `bff/package.json` should sequence it with the other integration scripts. It must use the BFF's configured Gemini credentials and model settings, open the returned WebSocket stream, and fail if no real provider chunk is observed or if the stream falls back to deterministic local text.

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/SenseiMobile
    npm test

For manual iOS validation:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff
    npm start

In another terminal:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/SenseiMobile
    npm start

Then run the app through Xcode or:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/SenseiMobile
    npm run ios

Expected manual behavior: when selecting a module phase that triggers `streamModuleIntroduction`, the Sensei message appears progressively. When sending a normal user message that triggers `streamMainSenseiResponse`, the reply also appears progressively. BFF logs should include a matching `requestId`, stream start, one or more chunks, and completion.

## Validation and Acceptance

The migration is accepted only when all of the following are true.

Core prompt parity is demonstrated. Representative tests prove that Core builders for module introduction and main response produce the same prompt text as the old code for controlled inputs. If a prompt must intentionally differ, document the difference in `Decision Log` and add a test that locks the approved behavior.

Mobile routing is server-owned. A sentinel test fails if the mobile WebView path for `streamModuleIntroduction` or `streamMainSenseiResponse` calls a browser `CoreLlmClient`, `chat.sendMessageStream`, or direct Gemini browser SDK path. The mobile path must use the bridge and BFF stream.

Desktop web still works. In non-mobile builds, the two stream functions still produce streamed responses through the existing desktop path unless a later plan explicitly changes desktop transport.

BFF API works. `POST /sessions/:sessionId/llm-stream` returns `{ requestId, streamUrl }` for a valid session and valid capability payload. It rejects unknown sessions, unknown capabilities, malformed payloads, and oversized payloads with clear error bodies. The WebSocket URL streams `started`, `chunk`, and `completed` events for a stubbed deterministic gateway in tests.

BFF real Gemini smoke works in the default test suite. Running `cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff && npm test` must include a real Gemini WebSocket smoke integration test for the new `llm-stream` endpoint. The test must start the real BFF server, create a real session, submit a small `mainSenseiResponse` capability request, open the returned WebSocket URL, receive `started`, at least one non-empty chunk from Gemini, and `completed`, and fail if the stream uses deterministic fallback text instead of real provider output.

React Native client works. `BffClient.submitLlmStream` creates a session if needed, posts the capability request, opens the returned WebSocket URL, parses `chunk`, `status`, and `error` frames, and yields them through the existing async iterable style.

WebView UI behavior is preserved. The functions still call `updateMessageStream` per chunk, return final accumulated text, preserve enhancer hooks, and leave message rendering, markdown parsing, and DOM behavior in WebView.

Manual simulator behavior is observable. On iOS simulator, a module introduction and a normal Sensei response both stream progressively into the chat bubble. The BFF log contains matching request IDs and chunk events. The app must not wait for the full Gemini response before updating the chat bubble.

## Idempotence and Recovery

The implementation should be additive until tests pass. Keep the old `/sessions/:sessionId/turns` route and old `submitTurn` client method unless impact analysis proves they are unused. This reduces migration risk and lets old tests continue passing while the new capability stream route is introduced.

The BFF request store should expire pending requests so abandoned WebSocket connections do not leak memory. Repeated `POST /llm-stream` calls should create independent request IDs. A WebSocket connection with an unknown, expired, or mismatched request ID should receive a structured error and close cleanly.

If prompt parity tests fail, do not adjust tests to fit the new output until the difference is understood. Either fix the Core prompt builder to match old behavior or record an intentional behavior decision in the `Decision Log`.

If mobile stream wiring fails, use the BFF stubbed stream test and RN fake WebSocket test before debugging Gemini. Provider calls should not be needed to prove transport correctness. If the real Gemini smoke test fails but deterministic transport tests pass, separate provider configuration, credentials, model availability, timeout, and network errors from application routing defects before editing stream logic.

If local dependencies hang again, check for `compressed,dataless` files under dependency folders and reinstall in the fresh non-iCloud checkout. Do not diagnose application behavior from a partially hydrated dependency tree.

## Artifacts and Notes

Earlier discovery created a mission-state snapshot in the previous checkout: `docs/mission_state/mission_state_streaming_llm_migration_scope_20260604T181747+0300.md`. If this file exists in the fresh checkout, use it as supporting evidence. If it is absent, rerun the analyzer commands in this plan and update this section with fresh evidence.

Useful static trace summary from discovery:

    streamModuleIntroduction
      builds messageWithContext from introContext + "Let's begin ..."
      calls chat.sendMessageStream
      for each chunk: enhancerController.onChunk if present, updateMessageStream
      after stream: enhancerController.finalize/getLatestText if present

    streamMainSenseiResponse
      builds message by replacing USER_LAST_INPUT_PLACEHOLDER or appending User: ...
      calls chat.sendMessageStream
      tracks chunk count and first chunk latency
      for each chunk: enhancerController.onChunk if present, updateMessageStream
      after stream: enhancerController.finalize/getLatestText if present

React Native HTTP streaming probe summary:

    BFF/server wrote real Gemini chunks over HTTP NDJSON.
    RN fetch response reported hasBody false and hasGetReader undefined.
    Decision: use WebSocket for Phase 1 mobile streaming.

Change note for initial draft: This ExecPlan was created to capture the agreed implementation roadmap before code migration begins. It records the scoped functions, WebSocket API decision, Core/BFF/RN/WebView responsibilities, expected file touch points, validation gates, and unresolved-risk handling so a future implementer can proceed from this document alone.

Fresh Core Analysis checkpoint:

    docs/mission_state/mission_state_llm_streaming_core_analysis_20260604T203636Z.md

Fresh analyzer artifacts created or refreshed during Core Analysis:

    tmp/analysis/brief.md
    tmp/analysis/brief.json
    tmp/analysis/functions.json
    tmp/analysis/calls.json
    tmp/analysis/fan_in.json
    tmp/analysis/fan_out.json
    tmp/analysis/focused_trace_module_intro.txt
    tmp/analysis/focused_trace_main_sensei_response.txt
    tmp/analysis/brief_streaming_dom_scope.md
    tmp/analysis/domsuite_index_streaming_scope.json
    tmp/analysis/domsuite_handlers_streaming_scope.json
    tmp/analysis/domsuite_templates_streaming_scope.json

## Interfaces and Dependencies

Core should expose stable capability names:

    moduleIntroduction
    mainSenseiResponse

Create `core/prompts/moduleIntroduction.ts` and `core/prompts/mainSenseiResponse.ts` for prompt wording and prompt builders. Create `core/moduleIntroduction.ts` and `core/mainSenseiResponse.ts` for capability request types and final prompt construction. Export public functions and types from `core/index.ts`.

The Core module-introduction capability should expose a function similar to:

    buildModuleIntroductionPrompt(request: ModuleIntroductionPromptRequest): string

The Core main response capability should expose a function similar to:

    buildMainSenseiResponsePrompt(request: MainSenseiResponsePromptRequest): string

The exact request type names may change during implementation, but they must be explicit, exported, and tested. They must accept structured data rather than a final WebView-built prompt string.

BFF should expose:

    POST /sessions/:sessionId/llm-stream

Request body:

    {
      "capability": "moduleIntroduction" | "mainSenseiResponse",
      "messageId": "msg-...",
      "payload": { structured capability-specific data },
      "metadata": { "source": "mobile", "appVersion": "..." }
    }

Response body:

    {
      "requestId": "llmreq_...",
      "streamUrl": "ws://host/sessions/:sessionId/llm-stream?requestId=llmreq_..."
    }

WebSocket events:

    { "type": "status", "phase": "started", "requestId": "...", "messageId": "...", "capability": "..." }
    { "type": "chunk", "requestId": "...", "messageId": "...", "capability": "...", "text": "..." }
    { "type": "status", "phase": "completed", "requestId": "...", "messageId": "...", "capability": "..." }
    { "type": "error", "requestId": "...", "messageId": "...", "capability": "...", "code": "...", "message": "..." }

The BFF streaming implementation must also expose enough internal test evidence to distinguish real Gemini chunks from deterministic fallback chunks in `bff/tests/llmStream.realGemini.int.test.js`. A strict `allowFallback: false` or `requireRealProvider: true` option on the BFF streaming path is preferred for the smoke test because it keeps the public WebSocket event contract simple while making provider failures fail the default BFF test suite. If implementation chooses a provider provenance field instead, keep it server-test-oriented and avoid adding user-facing WebView behavior around it.

React Native should expose one transport-level method in `SenseiMobile/src/mobile/network/BffClient.ts`, such as:

    submitLlmStream(payload: SubmitLlmStreamPayload): Promise<LlmStreamHandle>

The handle should include the `requestId`, `messageId`, and an `AsyncIterable` of stream events, following the current `createStream` pattern.

WebView should continue exporting:

    streamModuleIntroduction(...)
    streamMainSenseiResponse(...)

These functions remain the integration points for UI streaming. On mobile they should delegate provider execution to the native bridge and BFF stream. On desktop they may keep the existing direct stream path for Phase 1. Both branches must return the final text and preserve enhancer behavior.

Plan revision notes (2026-06-04):

- Revised the BFF testing requirement to include a real Gemini WebSocket smoke integration test in the default `bff` `npm test` script, matching the existing teaching-plan and wrap-up BFF integration-test posture.
- Added an explicit anti-fallback requirement for that smoke test so it proves live provider streaming instead of passing on deterministic local fallback text.
- Added fresh Core Analysis findings from the fresh checkout, including verified BFF dependency imports, analyzer/focused trace completion, confirmed WebView callers, current `/turns` scaffold status, BffClient WebSocket queue reuse, `updateMessageStream` native progress behavior, Core export implications, and the mission-state checkpoint path.
- Reread `docs/protocols/PLAN.md` and recorded the process correction that the ExecPlan is the live execution memory. Going forward, every protocol finding, implementation discovery, design decision, and stopping point must be entered in this file immediately before proceeding.
- Added Comprehensive Impact Analysis results: Risk 5 mixed interface/control/data/state/configuration classification, analyzer blast-radius files, dimension scores, stakeholder map, temporal ripple risks, validation requirements, rollback stance, and the decision to add explicit capability-stream bridge messages instead of reusing `chat:userInput`.
- Rechecked this plan against the authoritative `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` and `docs/llm_entry_exit_traces.md`. The direction was aligned, and this revision tightened the language so `core/moduleIntroduction.ts` and `core/mainSenseiResponse.ts` are treated as Core capability boundaries, not only prompt-builder files, and added the required trace/status update step.
- Recorded user approval for Architectural Synthesis Step 6 and the transition toward Feature Implementation protocol. Implementation still has not started; the required backup must be created before non-doc project edits.
- Recorded required backup creation before non-doc project edits: `backup/sensei_backup_module_intro_main_sensei_streaming_core_bff_migration_20260605_000521.zip`.
- Began Feature Implementation Step 7 with the Core prompt extraction milestone. Existing parity coverage is concentrated in `__tests__/corePromptParity.test.ts`; `__tests__/prompts.test.ts` only asserts key main-response substrings, so the Core extraction must extend the parity fixture for both migrated prompt builders while keeping the older root prompt facade behavior intact.
- Implementation discovery: `streamMainSenseiResponse` is a shared streaming wrapper for both standard turns and Socratic turns. Standard turns pass through `buildSenseiDynamicSystemInstruction` and the migrated `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`; Socratic turns pass a separate Socratic dynamic instruction into the same stream wrapper. The Core `mainSenseiResponse` boundary created in Step 7 therefore owns the standard migrated prompt assembly first; BFF/RN routing must either preserve a compatibility branch for Socratic dynamic instructions or expand the Core Socratic instruction builder in a later sub-step before forcing every main-response turn through the standard payload shape.
- Added Core prompt/capability files for the first implementation milestone: `core/prompts/moduleIntroduction.ts`, `core/prompts/mainSenseiResponse.ts`, `core/moduleIntroduction.ts`, and `core/mainSenseiResponse.ts`. The capability functions build final provider prompts inside Core from typed request fields; they do not ask BFF to concatenate provider prompt strings.
- Rewired `src/prompts.ts` so the migrated module-introduction and main-response prompt symbols are imported from Core and re-exported for existing web callers. Removed the duplicated local main-response mandatory teaching-structure body so `core/prompts/mainSenseiResponse.ts` is the canonical source.
- Core build and focused root prompt validation passed. Commands: `npm run core:build`; `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/prompts.test.ts --silent --bail --noStackTrace`. Result: 2 suites passed, 9 tests passed, 1 todo. This confirms the new Core prompt/capability exports and the legacy root prompt facade are currently compatible.
- Added the first BFF capability-stream implementation: `POST /sessions/:sessionId/llm-stream` validates session/rate/body, creates an `llmreq_*` request, and returns `{ requestId, streamUrl }`; `/sessions/:sessionId/llm-stream?requestId=...` streams WebSocket `status`, `chunk`, and `error` events carrying `requestId`, `messageId`, and `capability`.
- Added Core-backed BFF prompt construction in `bff/src/integration/senseiCoreAdapter.js` for `moduleIntroduction` and `mainSenseiResponse`, and added an `allowFallback` option to `GeminiGateway.streamMainResponse`. Existing `/turns` streaming keeps fallback behavior by default; the new LLM stream smoke can set `requireRealProvider: true` so provider failure fails the test.
- Added `bff/tests/llmStream.int.test.js` and inserted it into the default `bff/package.json` `npm test` chain. The test starts the real server, checks bad session and invalid payload failures, submits a module-introduction capability stream with `requireRealProvider: true`, opens the returned WebSocket, requires started/completed statuses plus at least one non-empty chunk, verifies request/message/capability identity on events, and rejects fallback-marked text.
- Targeted real-Gemini BFF stream smoke passed. Command: `node tests/llmStream.int.test.js` from `bff/`. Result: exit 0; server accepted `llmreq_*`, `allowFallback:false`; WebSocket emitted started/completed and Gemini chunks; test printed `llm stream real Gemini integration test passed`.
- Added RN/WebView capability-stream transport: `SenseiMobile/src/mobile/network/BffClient.ts` now exposes `submitLlmStream`, posts to `/sessions/:sessionId/llm-stream`, opens the returned WebSocket, and preserves `requestId`, `messageId`, and `capability` on stream events. Bridge contracts now include `llmStream:request`, `llmStream:status`, `llmStream:chunk`, and `llmStream:error`.
- Added WebView request/response routing in `src/mobile/webviewMessageRouter.ts`, and `SenseiMobile/src/mobile/MainScreen.tsx` now forwards WebView LLM stream requests to `BffClient.submitLlmStream` and bridges each stream event back to WebView. `src/interactionHelpers.ts` routes `streamModuleIntroduction` and standard `streamMainSenseiResponse` through native capability streaming only when the native bridge is available and a structured Core request object is provided; desktop direct Gemini behavior remains the fallback path.
- Updated call sites: module introduction now passes structured Core fields from `ModuleSelectionHandler`; standard main-response turns now pass `MainSenseiResponsePromptRequest` from `src/index.tsx`. Socratic main-response turns still use the compatibility direct dynamic-context stream path because their separate Socratic instruction builder is not yet migrated into Core in this sub-step.
- Added focused transport tests: `__tests__/BffClient.test.ts` covers `submitLlmStream` POST/WebSocket identity preservation; `__tests__/interactionHelpers.test.ts` covers mobile native routing for module introduction and asserts browser `chat.sendMessageStream` is skipped on the native path.
- Focused root validation passed after RN/WebView work. Command: `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/prompts.test.ts __tests__/BffClient.test.ts __tests__/interactionHelpers.test.ts --silent --bail --noStackTrace`. Result: 4 suites passed, 15 tests passed, 1 todo.
- Required WebView bundle validation passed after web-code changes. Command: `npm run webview:bundle`. Result: Core build passed, protocol build passed, esbuild produced `SenseiMobile/app_web/webview_dist/index.js`, `.map`, `index.css`, `index.html`, and `Modules.txt`.
- Default BFF validation passed with the new real-Gemini smoke in the test chain. Command: `cd bff && npm test`. Result: exit 0; existing JSON body, Mermaid, wrap-up, teaching-plan config, teaching-plan, and analysis tests passed; new `llmStream.int.test.js` passed with `allowFallback:false`, WebSocket Gemini chunks, and `llm stream real Gemini integration test passed`.
- Post-implementation scoped analyzer passed. Command: `npm run analysis:run -- --include core/prompts/moduleIntroduction,core/prompts/mainSenseiResponse,core/moduleIntroduction,core/mainSenseiResponse,bff/src,src/mobile/webviewMessageRouter,src/interactionHelpers,src/moduleSelectionHandler,src/index.tsx,SenseiMobile/src/mobile/network/BffClient,SenseiMobile/src/mobile/MainScreen,SenseiMobile/src/mobile/bridge/contracts`. Result: exit 0; entry candidates are `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`, `bff/src/server.js`, and `src/index.tsx`; expected bridge files include BFF/Core adapter, WebView router, interaction helpers, and RN BffClient.
- Mobile TypeScript validation was attempted. Command: `npx tsc --noEmit -p SenseiMobile/tsconfig.json`. First run showed a `theme:update` Web-to-native contract mismatch in the bridge contract touched by this work plus two existing `MainScreen` prop-type issues. The contract mismatch was fixed by adding `theme:update` to `WebToRNMessage`; rerun now fails only on unrelated existing `MainScreen.tsx` prop drift: `SenseiHeaderProps` lacks `onBrandPress`, and `react-native-webview` props lack `setBackgroundColor`.
- Mobile Jest validation passed. Command: `cd SenseiMobile && npm test -- --runInBand`. Result: 2 suites passed, 5 tests passed.
- Root default Jest validation passed. Command: `npm test`. Result: 37 suites passed, 263 tests passed, 4 todo.
- Corrected Feature Protocol Step 7 validation-log implementation gap. The approved Step 5 plan named exact `[LLM_STREAM_MIGRATION]` logs; the first implementation pass had general stream logs but not the planned tags. Added the planned validation logs now: BFF `request-created`, `stream-started`, `provider-stream`, `stream-chunk`, `stream-completed`; RN `mobile-stream-requested`; WebView router `bridge-request` and `bridge-complete`; WebView stream helpers `webview-mobile-stream-start` and `webview-mobile-stream-complete`.
- Revalidated after adding the exact Step 5 validation logs. Commands: `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/interactionHelpers.test.ts --silent --bail --noStackTrace` passed with 2 suites and 6 tests; `npm run webview:bundle` passed; `cd bff && node tests/llmStream.int.test.js` passed with real Gemini and showed `[LLM_STREAM_MIGRATION] request-created`, `stream-started`, `provider-stream` with strict fallback disabled, two `stream-chunk` entries, and `stream-completed`.
- Current protocol position: Feature Implementation Step 8 user-driven log capture gate. Do not advance to Step 9, RCI, feature documentation, or commit/push until the user runs the feature end-to-end and confirms `./logs/console_logs.log` has been updated.
- Step 8 evidence clarification: `logs/console_logs.log` is not automatically populated by an iOS Simulator/Xcode app run. The web logger stores logs in the WebView runtime and can export them through the in-app debug console. BFF logs are emitted to the BFF terminal, and RN/native bridge logs are emitted to Metro/Xcode console output. For Step 9, accept a user-provided evidence bundle containing: exported WebView debug-console logs, BFF terminal output for the run, and Metro/Xcode/native console output for the run. If the user also writes the exported WebView log into `logs/console_logs.log`, use that file plus the provided BFF/native logs for validation.
- Step 8 WebView log collection instructions confirmed from source: open the in-app debug modal via the header debug/bug control, select the `Console Logs` tab, and use `Download Logs` to export `sensei_logs_<timestamp>.log`. If WKWebView download is unavailable, use Safari Web Inspector against the iOS Simulator WebView (`webviewDebuggingEnabled` is enabled on iOS), filter the console for `[LLM_STREAM_MIGRATION]`, and copy or screenshot the `bridge-request`, `webview-mobile-stream-start`, `bridge-complete`, and `webview-mobile-stream-complete` lines.
- Step 8 user-run failure observed: after module/phase/concept selection, WebView logs show `teachingPlan:request` sent to native, then `TEACHING_PLAN_GENERATION_FAILED` with `teaching plan bridge timeout` and `PHASE_JUMP_FAILURE`. The BFF terminal only shows server startup on `0.0.0.0:8787` and no `/sessions` or `/teaching-plan` request, so the failure is before BFF routing/handler execution, likely RN native transport not reaching the configured BFF base URL or bridge forwarding not firing for `teachingPlan:request` in this simulator run.
- Root cause found for the Step 8 teaching-plan timeout: `SenseiMobile/App.tsx` hardcoded `BFF_BASE_URL = 'http://MacBook-Pro.local:8787'`, while the current machine local hostname is `Alicans-MacBook-Pro.local`. Because RN native fetch targeted the stale host, the BFF saw zero `/sessions` or `/teaching-plan` traffic. Changed the BFF base URL to simulator-safe loopback: iOS uses `http://127.0.0.1:8787`; Android emulator uses `http://10.0.2.2:8787`.
- Validation after BFF URL fix passed. Commands: `cd SenseiMobile && npm test -- --runInBand` passed with 2 suites and 5 tests; `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/interactionHelpers.test.ts --silent --bail --noStackTrace` passed with 2 suites and 6 tests.
- Step 8 startup observation from Xcode: Simulator startup logs include WebKit/network/accessibility warnings such as failed host network app id resolution, `Could not register system wide server: -25204`, duplicate accessibility element cache, and `Unable to hide query parameters from script`. User reports no visible simulator issue. Treat these as non-blocking startup noise unless they correlate with WebView load failure, bridge errors, missing BFF traffic, or visible UI breakage.
- Step 8 manual evidence drop folder created: `tmp/llm_stream_migration_manual_logs/`. Expected filenames are `bff.log`, `webview.log`, optional `xcode_or_metro.log`, and optional `notes.md`. User currently has BFF and WebView logs but no Metro logs.
- Step 8 user-provided manual evidence was pasted into `tmp/llm_stream_migration_manual_logs/README.md` rather than split into the placeholder filenames. The evidence now shows the earlier BFF URL issue is fixed: WebView sent `teachingPlan:request`, received `teachingPlan:result`, validated the teaching plan, then started the migrated `moduleIntroduction` stream through the native bridge. WebView logs include `[LLM_STREAM_MIGRATION] webview-mobile-stream-start`, `bridge-request`, `bridge-complete`, and `webview-mobile-stream-complete` for `moduleIntroduction` with `messageId:"msg-7"` and `chars:13169`; BFF logs include `POST /sessions/.../llm-stream`, WebSocket connection, Core capability prompt build, Gemini stream start/chunks/end, and `[LLM_STREAM_MIGRATION] stream-completed` with `chunks:123`; native/Xcode evidence includes `llm stream status` and repeated `llmStream:chunk` bridge dispatches, then `phase:'closed'`.
- Step 8 manual evidence also shows the migrated `mainSenseiResponse` path works after a follow-up turn. BFF logs include analysis completion, `POST /sessions/.../llm-stream`, WebSocket connection, Core capability prompt build for `mainSenseiResponse`, Gemini stream start/chunks/end, and `[LLM_STREAM_MIGRATION] stream-completed` with `chunks:177`; native/Xcode evidence includes `llm stream status` for `mainSenseiResponse`, repeated `llmStream:chunk` bridge dispatches, then `phase:'closed'`.
- Step 8 observability reservation before the follow-up fix: the BFF `[LLM_STREAM_MIGRATION] provider-stream` log emitted `fallback: request.allowFallback`. In normal mobile runtime this appeared as `fallback:true`, but source inspection showed this meant deterministic fallback was allowed, not that fallback text was used. The same user run contained `GEMINI_GATEWAY stream start`, many Gemini `chunk` logs, and `stream end`, so the stream did use Gemini. This log field name was ambiguous and conflicted with the earlier anti-fallback validation wording.
- Step 8 follow-up fix started for the observability reservation. Planned patch: change BFF `provider-stream` metadata from `fallback` to `allowFallback`, and add a distinct `[LLM_STREAM_MIGRATION] provider-fallback-used` warning only inside the actual Gemini fallback branch. This preserves the normal mobile runtime fallback policy while making evidence distinguish "fallback is allowed" from "fallback was used".
- Step 8 observability reservation fix implemented. `bff/src/services/streamingService.js` now logs `[LLM_STREAM_MIGRATION] provider-stream` with `provider:"gemini"` and `allowFallback:<boolean>` instead of `fallback:<boolean>`. `bff/src/integration/geminiGateway.js` now logs `[LLM_STREAM_MIGRATION] provider-fallback-used` only from the actual fallback branch, carrying `requestId`, `capability`, and `messageId` when available.
- Validation after the observability fix: `node tests/llmStream.int.test.js` from `bff/` reached the corrected log line (`provider:"gemini","allowFallback":false`) but Gemini returned `429 RESOURCE_EXHAUSTED` before chunks. Because this strict test has fallback disabled, the stream failed instead of passing on fallback text, which preserves the anti-fallback guard. Non-provider validation passed: `node --check bff/src/services/streamingService.js`, `node --check bff/src/integration/geminiGateway.js`, and `node -e "require('./src/services/streamingService'); require('./src/integration/geminiGateway'); console.log('bff log modules import ok')"` from `bff/`.
- Step 8 product behavior reservation from user: when Gemini quota was exhausted in normal runtime, the user observed the app displaying `Sensei (fallback) response to: I don’t understand problem decomposition`. Source check confirms this is the existing `GeminiGateway.streamMainResponse` fallback branch: when provider streaming throws and `allowFallback` is true, it yields deterministic text built from `context.turn.input.text`. This is not real Gemini output; it is a legacy/stub resilience path. For migrated mobile LLM streams, decide whether normal runtime should keep this degraded fallback, disable it so provider errors surface to UI, or replace it with a non-misleading service-unavailable message.
- Step 8 fallback product decision: replace the user-input echo fallback with a non-misleading service-degraded message: `Sensei services are currently degraded. We're working on this issue, and if this issue persists, please report it to us using the Feedback button in the header menu.` Add focused coverage so provider errors with `allowFallback:true` do not leak or echo the learner's prompt.
- Step 8 fallback product decision implemented. `bff/src/integration/geminiGateway.js` now emits the service-degraded message instead of `Sensei (fallback) response to: <learner prompt>` when provider streaming fails and fallback is allowed. Added `bff/tests/geminiGatewayFallback.test.js` to exercise the production `GeminiGateway.streamMainResponse` fallback branch with the external provider seam stubbed; it asserts the exact degraded-service message, asserts the learner prompt is not echoed, and asserts `allowFallback:false` still throws the provider error. Added this test to the default BFF `npm test` chain before the live `llmStream.int.test.js`.
- Validation after fallback-message implementation passed: `node tests/geminiGatewayFallback.test.js` from `bff/`, `node --check bff/src/integration/geminiGateway.js`, and `node --check bff/tests/geminiGatewayFallback.test.js`. Full default BFF `npm test` was not rerun in this sub-step because the previous strict live Gemini smoke in this same Step 8 hit `429 RESOURCE_EXHAUSTED`; rerun the full default BFF suite after Gemini quota recovers.
- Step 8 validation-log cleanup started per Feature Implementation protocol and user direction. Scope: remove per-chunk `[LLM_STREAM_MIGRATION]` logs and any overly detailed temporary validation telemetry, leaving only milestone/provenance logs needed to diagnose request creation, stream start, provider choice/fallback use, completion, and bridge start/complete. User explicitly requested not to rerun the broader targeted/root/mobile/BFF validation stack after this cleanup because the feature behavior has already been proven.
- Step 8 validation-log cleanup implemented. Removed the per-chunk BFF `[LLM_STREAM_MIGRATION] stream-chunk` log, removed the provider-level per-chunk `GEMINI_GATEWAY chunk` log to keep BFF terminal output readable during long streams, removed redundant `sessionId` from migration `request-created` and `stream-started` logs, and removed final character counts from WebView `webview-mobile-stream-complete` logs. Retained milestone/provenance logs are now BFF `request-created`, `stream-started`, `provider-stream`, `stream-completed`, and `provider-fallback-used`; RN `mobile-stream-requested`; WebView router `bridge-request` and `bridge-complete`; and WebView helper `webview-mobile-stream-start` and `webview-mobile-stream-complete`.
- Required WebView asset regeneration after the `src/interactionHelpers.ts` logging cleanup passed. Command: `npm run webview:bundle`. Result: exit 0; Core and protocol builds passed and `SenseiMobile/app_web/webview_dist/index.js` was regenerated. Per user direction, no broader targeted/root/mobile/BFF validation suites were rerun for this log-cleanup-only sub-step. Lightweight grep sanity confirmed no `stream-chunk` migration log remains in BFF source.
- Step 8 master-plan alignment concern raised by user: Socratic turns are a relevant dependency of the scoped `streamMainSenseiResponse` capability. Fresh source recheck confirms `src/index.tsx` builds Socratic turn prompts through `buildSocraticExecutionInstruction(...)`, then still calls `streamMainSenseiResponse(...)`; the migrated mobile branch only activates when a structured `MainSenseiResponsePromptRequest` is supplied. Therefore Socratic turns can still fall through to the old browser `chat.sendMessageStream` path on mobile. The original omission was a conservative compatibility choice made after discovering Socratic uses a separate dynamic instruction shape, but it is not a valid completion state under `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` because the master plan treats `streamMainSenseiResponse` as the capability boundary and requires every relevant mobile provider execution path for migrated capabilities to route through BFF/Core. This must be resolved before marking the ExecPlan complete.
- Socratic migration implementation plan: treat Socratic as a mode of the existing `mainSenseiResponse` capability, not a new route. Move the Socratic instruction builders used by `buildSocraticExecutionInstruction(...)` into Core prompt ownership under `core/prompts/mainSenseiResponse.ts` and expose them through `core/mainSenseiResponse.ts` as a discriminated structured request, preserving prompt text verbatim. Extend the BFF/Core adapter to build Socratic prompts through the same `mainSenseiResponse` capability stream. Update `src/index.tsx` so Socratic turns pass structured Socratic fields to `streamMainSenseiResponse(...)` on mobile instead of relying on WebView-built final prompt text. Keep WebView UI streaming, enhancer hooks, completion detection, and desktop direct behavior unchanged. Add focused tests proving Socratic mobile routing uses the bridge/BFF path and that the Core Socratic prompt builder matches the existing WebView builder output for representative initial/subsequent cases.
- Socratic migration implemented. `core/prompts/mainSenseiResponse.ts` now owns `buildSocraticInitialInstruction(...)` and `buildSocraticExecutionInstruction(...)` prompt construction. `core/mainSenseiResponse.ts` now models `MainSenseiResponsePromptRequest` as a standard-or-Socratic discriminated request and builds final Socratic prompts server-side through the same `mainSenseiResponse` capability. `src/prompts.ts` re-exports the Core Socratic initial instruction instead of retaining the prompt body, and `src/interactionHelpers.ts` keeps the public WebView `buildSocraticExecutionInstruction(...)` compatibility wrapper while delegating prompt construction to Core.
- Socratic mobile routing implemented for both Socratic follow-up turns and Socratic phase initialization. `src/index.tsx` now creates a structured `{ mode: 'socratic', teachingPlan, pedagogicalGuidance, isSystemInitialization:false, currentUserInput, navigationContext? }` request when the active phase is Socratic. `src/moduleSelectionHandler.ts` now creates a structured `{ mode: 'socratic', teachingPlan, pedagogicalGuidance, isSystemInitialization:true, conceptContext, currentUserInput:'' }` request for the initial Socratic system message. `src/ui.ts` reload context now carries an optional `llmStreamRequest`, and main-response reloads pass it back into `streamMainSenseiResponse(...)`, closing the main-response reload direct-provider gap for structured requests.
- Socratic focused validation passed. `npm run webview:bundle` passed after Core/WebView changes, including `core:build` and `protocol:build`. Focused Jest passed with `npm test -- --runTestsByPath __tests__/interactionHelpers.test.ts __tests__/moduleSelectionHandler.test.ts __tests__/moduleSelectionHandler.enhancer.test.ts --silent --bail --noStackTrace`: 3 suites passed, 13 tests passed, 1 todo. Added tests prove the Core Socratic prompt output matches the WebView compatibility wrapper plus user input insertion, and that structured Socratic `mainSenseiResponse` on mobile uses the native bridge without calling `chat.sendMessageStream`.
- Socratic closure sanity check: `rg "SOCRATIC DIALOGUE MODE|RecursiveSensei Task & Checklist|LEETCODE COLLABORATION PROTOCOL|Pinnacle of Leetcode Protocol" src core __tests__` now finds Socratic prompt bodies only under `core/prompts/mainSenseiResponse.ts`. `rg "streamMainSenseiResponse\\(" src __tests__` shows production callers in `src/index.tsx` and `src/moduleSelectionHandler.ts`; both now pass structured `llmStreamRequest` objects for the migrated mobile path.
- Step 8 testing sufficiency review after Socratic migration: current coverage is not yet sufficient for the stricter standard of positive and negative integration tests across regular main response, Socratic main response, and module introduction. Existing positive evidence covers module-introduction mobile bridge routing, RN `submitLlmStream` transport for module introduction, real-Gemini BFF smoke for module introduction when quota is available, standard main-response manual simulator evidence, and Socratic WebView mobile bridge routing. Existing negative evidence covers BFF unknown-session and unknown-capability failures, strict no-fallback provider failure behavior, fallback message non-echo behavior, and mobile sentinels that reject direct browser streaming in focused paths.
- Remaining testing gaps before this plan can be called complete: add deterministic BFF integration coverage for `moduleIntroduction`, standard `mainSenseiResponse`, and Socratic `mainSenseiResponse` through the same `/llm-stream` route and WebSocket events; add capability-specific negative payload tests for missing `messageId`, malformed payloads, and malformed Socratic payloads; extend RN `BffClient` transport coverage beyond module introduction to standard and Socratic `mainSenseiResponse` payloads; add an explicit module-selection test proving the initial Socratic system message passes a structured `llmStreamRequest`; add golden or historical parity coverage for Socratic initial/subsequent prompt shapes instead of relying only on Core-vs-wrapper delegation; rerun the default BFF suite once Gemini quota recovers; and collect fresh simulator evidence for a Socratic mobile turn after the Socratic fix.
- Step 8 test-completion milestone started after rereading `docs/protocols/PLAN.md` and `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`. Implementation direction: close the deterministic coverage gaps without adding new production behavior beyond capability-specific validation where tests expose weak contracts. Use production BFF server/service/WebSocket modules and production RN/WebView functions; stub only the external provider seam for deterministic BFF tests; keep the existing real-Gemini BFF smoke as the default-suite live provider proof.
- BFF deterministic integration coverage added. `bff/src/controllers/sessionController.js` now validates capability-specific payload shapes for `moduleIntroduction`, standard `mainSenseiResponse`, and Socratic `mainSenseiResponse` before storing an LLM stream request. `bff/tests/llmStream.deterministic.int.test.js` starts the production BFF server, patches only the external `container.geminiGateway.streamMainResponse` provider seam, rejects missing `messageId`, malformed module-introduction payloads, malformed standard main-response payloads, and malformed Socratic payloads, then verifies started/chunk/completed WebSocket identity for all three valid capability payloads. `bff/package.json` now runs the deterministic test before the existing real Gemini `llmStream.int.test.js` in default `npm test`.
- Root test coverage expanded for the remaining migration seams. `__tests__/corePromptParity.test.ts` now locks Socratic initial, Socratic subsequent, final Socratic prompt-with-user-input, and Socratic MUST_OBEY prompt hashes at the Core boundary. `__tests__/BffClient.test.ts` now submits both standard and Socratic `mainSenseiResponse` structured payloads and checks preserved stream identity/error events. `__tests__/moduleSelectionHandler.test.ts` now drives `handlePhaseSelection('Socratic')` through the public handler and asserts the initial Socratic system message calls `streamMainSenseiResponse` with a structured `llmStreamRequest` and persists it into reload context.
- Payload-validation hardening during test completion: the Socratic BFF schema now validates the teaching point fields Core immediately reads (`text`, `interactionGuidance.expectedTurns`, `interactionGuidance.completionTriggers`, and `interactionGuidance.turnManagement`) instead of merely accepting nested arrays. This prevents malformed Socratic payloads from being accepted at POST time and failing later during prompt construction.
- Validation update for test-completion milestone: `node --check bff/src/controllers/sessionController.js` and `node --check bff/tests/llmStream.deterministic.int.test.js` passed. `node tests/llmStream.deterministic.int.test.js` from `bff/` passed, proving malformed-payload rejections and positive deterministic streams for module introduction, standard main response, and Socratic main response. Focused root Jest passed with `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/BffClient.test.ts __tests__/interactionHelpers.test.ts __tests__/moduleSelectionHandler.test.ts __tests__/moduleSelectionHandler.enhancer.test.ts --silent --bail --noStackTrace`: 5 suites passed, 24 tests passed, 1 todo.
- Default BFF validation attempted after adding the deterministic test to the default chain. Command: `cd bff && npm test`. Result: failed before reaching `geminiGatewayFallback.test.js`, `llmStream.deterministic.int.test.js`, or `llmStream.int.test.js` because the existing `tests/mermaidRecover.int.test.js` returned `{fixed:false}` and threw `Expected fixed=true`. This is a live Mermaid repair/provider behavior blocker in the pre-existing default chain, not a failure of the new deterministic LLM stream test, which passed when run directly.
- Direct live LLM stream smoke rerun after deterministic coverage failed with provider quota, not application routing. Command: `cd bff && node tests/llmStream.int.test.js`. The route accepted the request, opened WebSocket, built the Core `moduleIntroduction` capability prompt, logged `provider-stream` with `allowFallback:false`, then Gemini returned `429 RESOURCE_EXHAUSTED` for free-tier generate requests. Because strict mode disables fallback, the test failed closed instead of accepting degraded fallback text.
- Post-hardening validation update: after tightening the Socratic teaching-plan payload schema, `node --check bff/src/controllers/sessionController.js` passed again and `cd bff && node tests/llmStream.deterministic.int.test.js` passed again. `cd bff && node tests/geminiGatewayFallback.test.js` also passed directly. Full root Jest passed with `npm test -- --silent --bail --noStackTrace`: 37 suites passed, 268 tests passed, 4 todo. `git diff --check` passed.
- Validation wrapper surprise: the first capped `node --check` commands used a shell variable named `status`, which is readonly in zsh, so the wrapper failed before the actual Node checks ran. Rerun validation with a different variable name such as `cmd_status`.
- Review remediation milestone started for three code-review findings. Fix scope: serialize asynchronous WebView stream chunk rendering before resolving completion, make RN `BffClient` emit an error when an LLM WebSocket closes before a terminal completed/error frame, and expire unclaimed BFF `llmStreamRequests` when POST succeeds but the WebSocket is never opened. Analyzer was rerun during the review over the affected Core/BFF/RN/WebView files, and the relevant hot modules are `src/mobile/webviewMessageRouter.ts`, `SenseiMobile/src/mobile/network/BffClient.ts`, and `bff/src/services/streamingService.js`.
- Review remediation implemented. `src/mobile/webviewMessageRouter.ts` now chains asynchronous `onText` work per stream request, refreshes the bridge timeout on incoming stream events, and waits for the pending text update before resolving a completed stream. `SenseiMobile/src/mobile/network/BffClient.ts` now tracks whether an LLM stream received a terminal completed/error frame and emits `DOWNSTREAM_UNAVAILABLE` when the socket closes before completion. `bff/src/services/streamingService.js` now attaches an unclaimed-request timeout to every accepted LLM stream request and clears it once the WebSocket is claimed or the stream is cleaned up. Regression coverage was added in `__tests__/interactionHelpers.test.ts`, `__tests__/BffClient.test.ts`, and `bff/tests/llmStream.deterministic.int.test.js`.
- Review remediation validation passed. Commands: `node --check bff/src/services/streamingService.js`; `node --check bff/tests/llmStream.deterministic.int.test.js`; `npm test -- --runTestsByPath __tests__/interactionHelpers.test.ts __tests__/BffClient.test.ts --silent --bail --noStackTrace`; `cd bff && node tests/llmStream.deterministic.int.test.js`; `npm run webview:bundle`; `npm test -- --silent --bail --noStackTrace`; `cd SenseiMobile && npm test -- --runInBand`; `git diff --check`; and `npm run analysis:run -- --include src/mobile/webviewMessageRouter,SenseiMobile/src/mobile/network/BffClient,bff/src/services/streamingService`. Results: focused Jest 2 suites/11 tests passed; deterministic BFF stream integration passed including unclaimed request expiry; WebView bundle passed; full root Jest passed 37 suites/270 tests with 4 todo; mobile Jest passed 2 suites/5 tests; analyzer completed.

# Mission State: Streaming LLM Migration Scope

Timestamp: 2026-06-04T18:17:47+0300

## Scope

This checkpoint maps the upcoming Phase 1 mobile LLM proxy work for:

- `src/interactionHelpers.ts:streamModuleIntroduction`
- `src/interactionHelpers.ts:streamMainSenseiResponse`

The analysis is discovery and scope definition only. No runtime code was changed.

## Protocol And Analyzer Evidence

- Read `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md`.
- Ran baseline `npm run analysis:run`.
- Read `tmp/analysis/brief.md` and used `tmp/analysis/brief.json`, `tmp/analysis/functions.json`, `tmp/analysis/calls.json`, and `tmp/analysis/imports.json`.
- Ran focused analyzer traces:
  - `npm run analysis:run -- --entry src/interactionHelpers.ts::streamModuleIntroduction --maxDepth 5`
  - `npm run analysis:run -- --entry src/interactionHelpers.ts::streamMainSenseiResponse --maxDepth 5`

Hot modules from analyzer and source inspection:

- `src/interactionHelpers.ts`
- `src/moduleSelectionHandler.ts`
- `src/index.tsx`
- `src/curriculum.ts`
- `src/prompts.ts`
- `src/ui.ts`
- `src/keyTakeawayEnhancerController.ts`
- `bff/src/services/streamingService.js`
- `bff/src/integration/senseiCoreAdapter.js`
- `bff/src/integration/geminiGateway.js`
- `bff/src/controllers/sessionController.js`
- `SenseiMobile/src/mobile/network/BffClient.ts`
- `SenseiMobile/src/mobile/bridge/contracts.ts`
- `SenseiMobile/src/mobile/MainScreen.tsx`
- `src/mobile/webviewMessageRouter.ts`

## Static Execution Trace

### Module Introduction

1. `ModuleSelectionHandler.executePhaseSelection`
2. `getCurriculumFocusInstruction`
3. `getCurriculumFocusInstructionImpl`
4. `buildEarlyReturnInstruction`
5. `resolveFocusPoints`
6. `calculateFocusPoints`
7. `buildPrimaryActionInstruction`
8. `buildContextualInstruction`
9. `buildSupportingContextBlock`
10. `buildSenseiDynamicSystemInstruction`
11. `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`
12. `MODULE_INTRODUCTION_TASK_TEMPLATE`
13. `buildPrimaryActionBlockForKeyTakeaway`
14. `computeKeyTakeawayEnhancerPromptHash`
15. `hasKeyTakeawayEnhancerCacheEntry`
16. `KeyTakeawayEnhancerController.start`
17. `streamModuleIntroduction`
18. `logSenseiPromptValidation`
19. `chat.sendMessageStream`
20. `KeyTakeawayEnhancerController.onChunk`
21. `updateMessageStream`
22. `KeyTakeawayEnhancerController.finalize`
23. `KeyTakeawayEnhancerController.getLatestText`
24. `ModuleSelectionHandler.updateResponseHistory`
25. `displayMessage`

### Main Sensei Response

1. `generateNextSenseiResponse`
2. `calculateFocusStrategy`
3. `calculateFocusPoints`
4. `getCurriculumFocusInstruction`
5. `getCurriculumFocusInstructionImpl`
6. `buildEarlyReturnInstruction`
7. `resolveFocusPoints`
8. `buildPrimaryActionInstruction`
9. `buildContextualInstruction`
10. `buildSupportingContextBlock`
11. `buildSocraticExecutionInstruction`
12. `buildSocraticInitialInstruction`
13. `buildSenseiDynamicSystemInstruction`
14. `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`
15. `buildPrimaryActionBlockForKeyTakeaway`
16. `computeKeyTakeawayEnhancerPromptHash`
17. `hasKeyTakeawayEnhancerCacheEntry`
18. `KeyTakeawayEnhancerController.start`
19. `streamMainSenseiResponse`
20. `logSenseiPromptValidation`
21. `chat.sendMessageStream`
22. `KeyTakeawayEnhancerController.onChunk`
23. `updateMessageStream`
24. `KeyTakeawayEnhancerController.finalize`
25. `KeyTakeawayEnhancerController.getLatestText`
26. `checkForSocraticCompletion`
27. `updateResponseHistory`
28. `displayMessage`
29. `handleReloadSenseiMessage`

### Existing Mobile/BFF Stream Path

1. `BffClient.submitTurn`
2. `BffClient.postTurnWithRetry`
3. `SessionController.submitTurn`
4. `TurnService.createOrGetTurn`
5. `BffClient.createStream`
6. `initStreamServer`
7. `StreamingService.handleConnection`
8. `SenseiCoreAdapter.buildPrompt`
9. `GeminiGateway.streamMainResponse`

This existing stream path is not yet compliant for these two capabilities because `SenseiCoreAdapter.buildPrompt` currently builds a generic stub prompt, not the Core-owned module-introduction or main-response prompt.

## Function Work Snapshot

### Move Or Create In Core Prompt Modules

- `MODULE_INTRODUCTION_TASK_TEMPLATE`: move verbatim to `core/prompts/moduleIntroduction.ts`; keep `src/prompts.ts` as facade if needed.
- `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`: move verbatim to `core/prompts/mainSenseiResponse.ts`; keep facade export if needed.
- `MANDATORY_TEACHING_STRUCTURE`: move canonical prompt body to `core/prompts/mainSenseiResponse.ts`.
- `PEDAGOGICAL_GUIDANCE_PLACEHOLDER`: move or re-export from Core because curriculum prompt builders and main-response builders share it.
- `USER_LAST_INPUT_PLACEHOLDER`: move or re-export from Core because main response inserts user input through this placeholder.
- `CURRICULUM_COMPLETED_FOCUS_INSTRUCTION`: move or re-export from Core if used by migrated main-response prompt construction.
- `GENERAL_INTERACTION_FOCUS_INSTRUCTION`: move or re-export from Core if used by migrated main-response prompt construction.
- `REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE`: move verbatim to Core prompt surface used by main-response/module-intro focus building.
- `REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE`: move verbatim to Core prompt surface used by main-response/module-intro focus building.
- `TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE`: move verbatim to Core prompt surface used by main-response/module-intro focus building.
- `REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE`: move verbatim to Core prompt surface used by main-response/module-intro focus building.
- `GENERAL_ENGAGEMENT_PROMPT_TEMPLATE`: move verbatim to Core prompt surface used by main-response/module-intro focus building.
- `buildSocraticInitialInstruction`: move prompt-builder body to `core/prompts/mainSenseiResponse.ts` or a Socratic prompt module imported by it.

### Extract Or Rehome Prompt Builders

- `buildSenseiDynamicSystemInstruction`: move canonical builder to Core prompt module; leave `src/interactionHelpers.ts` wrapper delegating to Core for desktop compatibility.
- `buildSocraticExecutionInstruction`: move canonical builder to Core prompt module; leave `src/interactionHelpers.ts` wrapper delegating to Core for desktop compatibility.
- `buildEarlyReturnInstruction`: split prompt-returning behavior into Core-compatible focus builder; keep curriculum state decisions in WebView if needed.
- `resolveFocusPoints`: likely keep as domain-state helper in WebView/Core-compatible shared helper; no prompt text, but its output feeds Core prompt builders.
- `calculateFocusPoints`: likely keep or duplicate as structured domain calculation, not an LLM prompt body; must be validated because output drives prompt parity.
- `buildPrimaryActionInstruction`: move prompt-template selection to Core because it returns prompt fragments.
- `buildSupportingContextBlock`: move or reproduce as Core prompt builder because it returns prompt text from structured curriculum item data.
- `buildContextualInstruction`: move to Core prompt builder because it assembles final prompt sections.
- `getCurriculumFocusInstruction` / `getCurriculumFocusInstructionImpl`: convert mobile migrated path away from sending this finished string; Core should produce it from structured inputs.
- `buildPrimaryActionBlockForKeyTakeaway`: preserve for current enhancer behavior, but do not treat as part of stream migration unless key-takeaway row is included.

### Create Or Update Core Capability Modules

- Create `core/mainSenseiResponse.ts` with request types and stream-capability function.
- Create `core/moduleIntroduction.ts` with request types and stream-capability function.
- Export the new capabilities from `core/index.ts`.
- Add prompt parity fixtures proving old prompt builders and new Core builders produce identical text.

### Update Existing Web Stream Wrappers

- `streamModuleIntroduction`: preserve WebView UI accumulation and enhancer hooks; replace direct mobile provider path with bridge/BFF stream path; keep desktop fallback through Core/browser stream.
- `streamMainSenseiResponse`: preserve WebView UI accumulation, first-chunk latency logging, enhancer hooks, and return behavior; replace direct mobile provider path with bridge/BFF stream path; keep desktop fallback through Core/browser stream.
- `logSenseiPromptValidation`: keep as WebView logging or move prompt-length logging to Core/BFF as needed; do not expose prompt bodies unnecessarily in mobile logs.

### BFF And Server Work

- Replace or extend `SenseiCoreAdapter.buildPrompt` so it delegates to the new Core prompt/capability rather than generic stub text.
- Extend `StreamingService.handleConnection` or add capability-specific stream dispatch so it can stream `moduleIntroduction` and `mainSenseiResponse`.
- Ensure `GeminiGateway.streamMainResponse` supports task/model selection for both stream capabilities.
- Update `SessionController.submitTurn` payload schema or add new endpoint/service to accept structured capability input rather than `input.text` only.
- Preserve server-side secrets and provider adapter ownership.

### React Native And WebView Bridge Work

- Add stream request/result message contracts in `SenseiMobile/src/mobile/bridge/contracts.ts`.
- Add BFF client methods in `SenseiMobile/src/mobile/network/BffClient.ts` for structured module-intro and main-response stream requests, or extend `submitTurn` payload safely.
- Add WebView request helpers in `src/mobile/webviewMessageRouter.ts`.
- Add `MainScreen` handling for new WebView stream requests and stream event forwarding.
- Ensure WebView receives chunk/completion/error events and continues to call `updateMessageStream`.

### Preserve In WebView

- `updateMessageStream`
- `displayMessage`
- `ModuleSelectionHandler.updateResponseHistory`
- `updateResponseHistory`
- `checkForSocraticCompletion`
- reload/fallback/final-display behavior
- DOM/message bubble state
- key-takeaway enhancer chunk insertion hooks

## Dependency And Side-Effect Table

| Function | Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `streamModuleIntroduction` | `logSenseiPromptValidation`, `chat.sendMessageStream`, `KeyTakeawayEnhancerController`, `updateMessageStream` | Direct remote LLM stream, UI stream updates | High cost, high mobile compliance risk |
| `streamMainSenseiResponse` | `USER_LAST_INPUT_PLACEHOLDER`, `chat.sendMessageStream`, enhancer, `updateMessageStream`, `performance.now` | Direct remote LLM stream, UI stream updates, timing logs | High cost, high mobile compliance risk |
| `buildSenseiDynamicSystemInstruction` | `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`, guidance parsing | Prompt text assembly | High prompt-ownership risk |
| `buildSocraticExecutionInstruction` | `buildSocraticInitialInstruction`, teaching plan, guidance | Prompt text assembly | High prompt-ownership risk |
| `getCurriculumFocusInstruction` | `getCurriculumFocusInstructionImpl` | Prompt fragment returned from curriculum state | High prompt-ownership risk |
| `buildPrimaryActionInstruction` | prompt templates in `src/prompts.ts` | Prompt fragment selection | High prompt-ownership risk |
| `buildContextualInstruction` | placeholders, supporting context | Prompt section assembly | High prompt-ownership risk |
| `calculateFocusPoints` | `CurriculumState` sets and teaching plan chunks | None detected; reads state | Medium parity risk |
| `buildPrimaryActionBlockForKeyTakeaway` | focus points, prompt templates | Generates enhancer prompt fragment | Medium scope-coupling risk; separate backlog row |
| `KeyTakeawayEnhancerController.start` | `GoogleGenAI`, prompt hash/cache | Direct remote LLM call, cache writes | High external I/O, but separate backlog row |
| `KeyTakeawayEnhancerController.onChunk/finalize` | placeholder detection/insertion, timers | State writes, timer, UI update callback | Medium concurrency/UI risk |
| `updateMessageStream` | markdown sanitizers, native render progress, DOM | DOM writes, native message, markdown/highlight work | High UI blast radius |
| `StreamingService.handleConnection` | turn lookup, prompt builder, Gemini stream, WS | WebSocket output, timers, provider stream | High server streaming risk |
| `SenseiCoreAdapter.buildPrompt` | turn input text | Builds stub prompt | High correctness gap |
| `GeminiGateway.streamMainResponse` | provider SDK stream | Server-side provider stream | High external I/O |
| `BffClient.createStream` | WebSocket, bridge queue | Native stream event queue | Medium mobile transport risk |
| `MainScreen.handleWebViewMessage` | BffClient, bridge enqueue | Native state updates and async BFF calls | Medium mobile bridge risk |

## Risk Register

- Mobile still sends or builds final prompt strings for migrated runtime. Verification: sentinel tests must assert mobile structured payload contains no final prompt body and BFF/Core builds prompt.
- Prompt parity breaks when moving `src/prompts.ts` and `src/curriculum.ts` prompt assembly to Core. Verification: golden prompt tests for module intro, standard main response, must-obey main response, Socratic initial response, Socratic subsequent response.
- Existing BFF generic stream path uses stub prompt. Verification: BFF service tests assert `SenseiCoreAdapter` or replacement invokes new Core capability builders.
- Key-takeaway enhancer is an optional direct provider call inside these flows but is a separate backlog row. Verification: stream migration tests must preserve enhancer hooks while not claiming key-takeaway is migrated.
- WebView UI behavior can regress if chunk order/completion/error semantics change. Verification: routing sentinel plus stream chunk order tests around `updateMessageStream`, `finalize`, completion, and error handling.
- Reload context currently stores prompt strings. Verification: migrated mobile reload should store structured inputs or a route-safe replay object, not final prompt bodies.

## Unknowns Register

- Unknown: Whether to reuse the existing `/sessions/:id/turns` plus WebSocket stream or add capability-specific streaming endpoints. Impact: High. Verification plan: run Comprehensive Impact Analysis before implementation and compare route compatibility, request body shape, and existing mobile stream tests.
- Unknown: Whether `calculateFocusPoints` should remain only in WebView or move to Core as shared domain calculation. Impact: Medium. Verification plan: prompt parity fixtures for structured focus input versus current `getCurriculumFocusInstruction`.
- Unknown: Whether key-takeaway enhancer should remain untouched in this stream row or be disabled/routed separately for mobile. Impact: High. Verification plan: confirm with user before expanding scope; master plan lists key-takeaway as separate backlog.
- Unknown: Whether desktop web should use browser `Chat` compatibility or a new Core browser stream client. Impact: Medium. Verification plan: inspect existing `core/browserLlmClient.ts` and define in Architecture Synthesis.

## Coverage Checklist

- Prompt parity: module introduction prompt.
- Prompt parity: main response standard prompt.
- Prompt parity: main response must-obey prompt.
- Prompt parity: Socratic initial prompt.
- Prompt parity: Socratic subsequent prompt.
- Mobile routing sentinel: module introduction uses BFF stream.
- Mobile routing sentinel: main response uses BFF stream.
- Stream behavior: chunk order preserved.
- Stream behavior: completion event resolves final text.
- Stream behavior: error event preserves fallback behavior.
- UI behavior: `updateMessageStream` receives accumulated text.
- Enhancer behavior: `onChunk`, `finalize`, and `getLatestText` are still invoked when controller is present.
- Reload behavior: module intro and main response reloads do not require final prompt strings for mobile.
- BFF service: Core prompt builder called server-side.
- BFF service: provider stream called server-side.
- RN bridge: stream chunks and terminal events forwarded to WebView.
- WebView bundle: run `npm run webview:bundle` after web source changes.

## Next Protocol

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Comprehensive Impact Analysis Protocol before implementation planning or code changes.

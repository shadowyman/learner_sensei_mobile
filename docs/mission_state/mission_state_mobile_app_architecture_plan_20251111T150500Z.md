# Mission State – Mobile App Architecture Plan (Core Analysis – Nov 11, 2025)

## Scope & Entry Points
- **Primary boot sequence**: `src/index.tsx::loadCurriculumAndGreet#821cd217d3c5` drives UI initialization, enhancement tools, Save/Load controls, manifest ingestion, Google GenAI boot, Selection Sensei wiring, and first curriculum greeting. Analyzer fan-out confirms this file orchestrates 20 modules, making it the highest fan-out surface.
- **Interactive entry**: `src/index.tsx::handleUserInput#4f7cff31e8db` is bound to both form submit and Enter keypress, routing every learner utterance (plus module navigation commands) into `generateNextSenseiResponse`.
- **Hot modules (fan-in/out)**: `src/logger.ts` (fan-in 22), `src/model_usage.ts` (12), `src/adaptiveEngine.ts` (10), `src/curriculum.ts` (10), `src/ui.ts` (8), `src/moduleSelectionHandler.ts` (11 fan-out) and `src/interactionHelpers.ts` (6 fan-out) dominate dependency gravity and must inform any refactor plan.
- **Supporting subsystems**: `ModuleSelectionHandler`, `SaveLoadProgressManager`, `KeyTakeawayEnhancerController`, and `geminiService` act as service layers but are invoked imperatively from `index.tsx`, reinforcing the need for a clearer platform boundary before mobile work begins.

## Static Execution Trace
### Flow A – Boot & Curriculum Load
1. `loadCurriculumAndGreet` → kicks off UI setup, enhancement manager initialization, Save/Load wiring, manifest loading, Google AI bootstrap, Selection Sensei hooks, and curriculum greeting.
2. `initializeUI` → configures DOM controls, font/theme toggles, textarea autosize, and exports mermaid helpers globally.
3. `initializeSaveLoadUI` → binds header buttons + keyboard shortcuts to `SaveLoadProgressManager` and logs validation events.
4. `loadProjectFileManifestAndPaths` → fetches `file-manifest.json`, seeds `projectFileContents`, and falls back to hard-coded lists when offline.
5. `initializeGoogleAI` → instantiates `GoogleGenAI`, persistent chat, `PedagogicalProfiler`, Debug Mode hooks, and exposes `ai` globally.

### Flow B – Conversational Turn & Streaming
1. `handleUserInput` → validates readiness, records history, echoes the user bubble, handles special commands (`mskip`), and toggles loading state.
2. `generateNextSenseiResponse` → synchronizes module-selection state, guarantees teaching-plan readiness, coordinates analytics + pedagogy logic, and renders Sensei responses.
3. `ensureTeachingPlanExists` → lazily generates `curriculumState.teachingPlanForPhase` via `generateTeachingPlanForPhase` + planner callbacks.
4. `getAnalysisFromGemini` → sends the comprehensive analysis prompt to Google GenAI and parses JSON guidance.
5. `updateLearnerModel` → mutates the learner profile, affective state, SRL indicators, knowledge components, and curriculum coverage sets.
6. `advanceCurriculumState` → checks chunk completion, advances phases, and logs gating/transition metrics.
7. `calculateFocusStrategy` → derives focus points + upcoming action items from `curriculumState`.
8. `PedagogicalProfiler.getDirective` → builds a meta prompt from last three turns and fetches guidance from GenAI.
9. `buildSenseiDynamicSystemInstruction` / `buildSocraticExecutionInstruction` → stitches curriculum focus, guidance, and navigation context into the final system prompt.
10. `streamMainSenseiResponse` → streams chat completions, updates message bubbles, and hands chunks to the Key Takeaway enhancer.
11. `KeyTakeawayEnhancerController.start` → optionally spawns a secondary model run and manages cached enhancer text before finalizing the response bubble.

## Dependency & Side-Effect Table
| # | Function (file:line) | Key dependencies (per analyzer) | Side effects / notes | Risk |
|---|----------------------|---------------------------------|----------------------|------|
|1|`loadCurriculumAndGreet` (`src/index.tsx:1308`)|`initializeUI`, `initializeCodeEditorModal`, `initializeEnhancementManager`, `initializeSaveLoadUI`, `loadProjectFileManifestAndPaths`, `initializeGoogleAI`, `runTestSuite`, `setupFullscreenToggle`, `initializeSelectionSensei`, `fetch` → `Modules.txt`, `parseModulesTxt`, `setCurriculum`, `notepad.initialize`, `ModuleSelectionHandler`, `displayMessage`, `updateCurriculumDisplay`, `updateFooter`|Registers numerous window globals, mutates `learnerModel` defaults, triggers network fetches, and schedules `ChatWindowController` via `setTimeout`. Failure leaves UI unusable. |High|
|2|`initializeUI` (`src/ui.ts:3207`)|`renderIcons`, `setupFontSizeControls`, `setupThemePalette`, `setupHeaderEllipsisAnimation`, `setupControlsRevealPersistence`, `setupMermaidThemeControls`, `setupTextareaAutosize`, `setupLiquidMetalButton`, `setupCollapsibleFooter`, overlay helpers|Performs direct DOM queries, attaches multiple event listeners, and exposes mermaid helpers on `window`. Tight coupling to DOM IDs complicates mobile rendering. |Medium|
|3|`initializeSaveLoadUI` (`src/index.tsx:1257`)|`logSaveloadValidation`, `SaveLoadProgressManager.save/load`, document keydown listener|Binds click + keyboard handlers, accesses hidden file input, and directly calls async save/load APIs. Relies on browser file picker semantics that do not exist on native mobile. |Medium|
|4|`loadProjectFileManifestAndPaths` (`src/index.tsx:338`)|`fetch('file-manifest.json')`, `JSON.parse`, `logManifestValidation`, fallback manifest list|Performs unauthenticated network IO, writes to `projectFileContents`, and sets `availableProjectFilePaths`. Lack of retries/caching could stall mobile startup offline. |High|
|5|`initializeGoogleAI` (`src/index.tsx:382`)|`GoogleGenAI`, `ai.chats.create`, `logAiInitialization`, `PedagogicalProfiler`, `initializeDebugMode`|Creates `ai` + `mainSenseiChat`, stores API key client-side, and exposes `ai` globally for other modules. Any mobile build must proxy this through a secure backend. |High|
|6|`handleUserInput` (`src/index.tsx:959`)|`displayMessage`, `processMermaidBlocks`, `setupTextareaAutosize`, `getCurrentCurriculumItem`, `createLLMPlannerCallback`, `advanceCurriculumState`, `generateNextSenseiResponse`, `handleInitialModuleSelectionInternal`|Mutates `userInputHistory`, manipulates DOM textarea, conditionally awards KC via `mskip`, toggles loading, and can recursively trigger more turns. Latency or double-submit will corrupt state. |High|
|7|`generateNextSenseiResponse` (`src/index.tsx:581`)|`ModuleSelectionHandler.updateState`, `ensureTeachingPlanExists`, `getAnalysisFromGemini`, `updateLearnerModel`, `updateFooter`, `advanceCurriculumState`, `notepad.setActiveCurriculumContext`, `updateCurriculumDisplay`, `updateKCProgressBar`, wrap-up helpers, `calculateFocusStrategy`, `PedagogicalProfiler.getDirective`, `getCurriculumFocusInstruction`, instruction builders, Key Takeaway helpers, `displayMessage`, `streamMainSenseiResponse`, `processMermaidBlocks`|Writes to nearly every global store (`learnerModel`, `curriculumState`, `notepad`, `reloadContext`), drives UI updates, and coordinates multiple async LLM calls. Single-function monolith is the highest blast radius in the system. |Critical|
|8|`ensureTeachingPlanExists` (`src/index.tsx:546`)|`generateTeachingPlanForPhase`, `createLLMPlannerCallback`|Replaces `curriculumState.teachingPlanForPhase`, resets chunk indices, and clears learner KC awards. Errors leave curriculum stuck. |Medium|
|9|`getAnalysisFromGemini` (`src/geminiService.ts:290`)|`GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION`, `ai.models.generateContent`, `parseGeminiJsonResponse`|Outbound GenAI call with JSON parsing; errors degrade learner-model updates and guidance. Needs server-side proxy + retry budget for mobile. |High|
|10|`updateLearnerModel` (`src/adaptiveEngine.ts:382`)|`mapAnalysisValue`, `dynamicCategoricalUpdate`, `normalizeHelpSeekingStyle`, `updateMisconception`, `updateKC`, `logAdaptiveValidation`|Copies model, then writes dozens of nested properties plus curriculum coverage sets. Race conditions or partial writes corrupt personalization data. |High|
|11|`advanceCurriculumState` (`src/curriculum.ts:1352`)|`logAdvanceValidation`, `handleSocraticPhase`, `getCurrentCurriculumItem`, `handlePhaseCompletion`|Mutates teaching-plan indices, resets coverage, toggles completion flags, and increments interaction counters. Invoked per turn; must stay deterministic for cross-device sync. |High|
|12|`calculateFocusStrategy` (`src/index.tsx:532`)|`calculateFocusPoints`|Pure function returning focus items, but upstream data quality drives UI prompts. |Low|
|13|`PedagogicalProfiler.getDirective` (`src/pedagogicalProfiler.ts:246`)|`_identifyActiveFlags`, `generateDirectiveFromMetaPrompt`, history sanitization utilities|Assembles recent turns + flags, then calls GenAI again. Latency cascades directly into user turn time. Requires throttling/cache for mobile. |Medium-High|
|14|Instruction builders (`src/interactionHelpers.ts:81` & `:131`)|`logSenseiPromptValidation`, `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`, `buildSocraticInitialInstruction`|Produce system prompts (Socratic vs general). Errors yield low-quality responses; instrumentation needed for prompt diffing in mobile pipeline. |Medium|
|15|`streamMainSenseiResponse` (`src/interactionHelpers.ts:236`)|`chat.sendMessageStream`, `KeyTakeawayEnhancerController.onChunk/finalize`, `updateMessageStream`|Streams LLM output, tracks latency, and pushes incremental text into UI/enhancer. Requires backpressure + instrumentation when moving to native streaming APIs. |High|
|16|`KeyTakeawayEnhancerController.start` (`src/keyTakeawayEnhancerController.ts:64`)|`ai.chats.create`, enhancer cache, `handleEnhancerReady`|Spawns a second model call, manages cache hits, and manipulates enhancer timers. Needs worker queue on backend to avoid mobile resource strain. |Medium|

## Risk Register
1. **Monolithic `generateNextSenseiResponse`**: mixes pedagogy, curriculum, analytics, and rendering side effects; any exception leaves UI mid-flight. Mitigation: break into service layers (conversation controller, pedagogy service, UI adapter) before mobile port.
2. **Client-held API keys (`initializeGoogleAI`, `getAnalysisFromGemini`, `KeyTakeawayEnhancerController`)**: current approach cannot ship to mobile app stores. Mitigation: introduce authenticated backend proxy issuing short-lived tokens.
3. **Save/Load via DOM (`initializeSaveLoadUI`)**: relies on `<input type="file">` and keyboard shortcuts; mobile will need native document APIs and cloud persistence. Mitigation: define storage API abstraction before refactor.
4. **Curriculum advancement consistency (`advanceCurriculumState`, `ensureTeachingPlanExists`)**: stateful Sets/reset logic assumes single session; multi-device sync could double-advance modules. Mitigation: persist authoritative curriculum state server-side and gate with optimistic locking.
5. **Streaming UX (`streamMainSenseiResponse` + enhancer)**: uses browser-specific streaming & animation libs; mobile requires native streaming and cancellation controls to prevent hung sessions. Mitigation: design unified streaming bus with timeout + telemetry hooks.

## Unknowns Register
| Issue | Impact | Verification plan | Owner & target |
|-------|--------|-------------------|----------------|
|Target mobile stack (React Native vs Flutter vs native shells) is undefined.|High – dictates UI abstraction strategy and whether existing React/DOM code can be shared.|Product/engineering decision workshop; spike prototypes of UI shell options.|Mobile platform lead – before architectural design freeze (Nov 18, 2025).|
|Authentication & user identity model (currently single API key) is unspecified.|High – mobile apps cannot embed shared API keys; impacts backend roadmap.|Security review + backend design session to define OAuth/session issuance & revocation list.|Platform security + backend team – authorization design doc by Nov 22, 2025.|
|Persistent Save/Load expectations for mobile (local-only vs cloud sync) unclear.|Medium-High – determines whether SaveLoadProgressManager integrates with cloud storage or device filesystem.|Interview stakeholders + learners; prototype storage abstraction with mocked backend.|Learning experience PM – requirements sign-off by Dec 2, 2025.|
|LLM budget and rate-limit constraints for dual-model flows (main + enhancer) are unknown for mobile scale.|Medium – cost/performance envelope may require batching or pruning features.|Collect current usage metrics, project mobile MAU, and run load test through planned proxy.|Applied AI team – capacity report by Nov 25, 2025.|

## Coverage Checklist (function stable IDs & planned validation)
- `src/index.tsx::loadCurriculumAndGreet#821cd217d3c5` – add end-to-end smoke test that bootstraps without DOM, ensuring manifest/API fallbacks are covered.
- `src/ui.ts::initializeUI#a73a17b8d81e` – plan DOM harness (or component-level tests once ported) to verify control bindings.
- `src/index.tsx::initializeSaveLoadUI#f2a9139f692f` – create automated test simulating Save/Load button interactions via a mocked storage adapter.
- `src/index.tsx::loadProjectFileManifestAndPaths#71cb088faf34` – add unit test with mocked `fetch` to validate fallback + logging.
- `src/index.tsx::initializeGoogleAI#2c32a66bda0a` – integration test once backend proxy exists to ensure token refresh + debug hooks behave.
- `src/index.tsx::handleUserInput#4f7cff31e8db` – instrumented test verifying `mskip` path and double-submit prevention.
- `src/index.tsx::generateNextSenseiResponse#039b3847325d` – scenario test covering pedagogical guidance + wrap-up overlay triggers.
- `src/index.tsx::ensureTeachingPlanExists#2e2b235c9703` – deterministic test using canned `TeachingPoint` data to ensure caching works.
- `src/geminiService.ts::getAnalysisFromGemini#7e56f02c9909` – contract test hitting stubbed GenAI proxy to validate JSON parsing.
- `src/adaptiveEngine.ts::updateLearnerModel#f98a68f6d5a0` – already partially covered by `tests/adaptiveEngine.functional.test.ts`; expand to include SRL + KC awarding.
- `src/curriculum.ts::advanceCurriculumState#028992e18b4c` – ensure `tests/teachingInvariantsValidation.ts` exercises chunk/phase transitions, then port to backend service.
- `src/index.tsx::calculateFocusStrategy#a6ab2461c975` – lightweight unit test verifying empty vs populated state outputs.
- `src/pedagogicalProfiler.ts::PedagogicalProfiler.getDirective#9a63e7937726` – mock AI dependency to ensure prompt assembly/responses.
- `src/interactionHelpers.ts::buildSenseiDynamicSystemInstruction#a7178d22e0be` & `buildSocraticExecutionInstruction#75c345164a40` – snapshot tests covering MUST_OBEY + navigation contexts.
- `src/interactionHelpers.ts::streamMainSenseiResponse#32a6057a27e0` – streaming test with mocked chat to validate chunk handling + enhancer hooks.
- `src/keyTakeawayEnhancerController.ts::KeyTakeawayEnhancerController.start#9de07b776cae` – unit test for cache hits/misses and error handling.

## Key Architectural Insights
- `src/index.tsx` remains a 1.5k+ line orchestrator coupling UI, curriculum, LLM orchestration, and DOM state; mobile viability hinges on breaking this into platform-neutral services plus presentation adapters.
- There is no true backend today—API keys and manifests live client-side. A secure proxy/service mesh is prerequisite before distributing binaries.
- Save/Load flows rely on browser file inputs and sessionStorage flags; we need a persistence interface that can be implemented via mobile-specific storage or cloud sync.
- UI rendering is imperative DOM manipulation (no React components despite React dependency). A mobile-first refactor could leverage React Native or a shared render tree while isolating DOM-only helpers.

## Next Protocol
Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. Next step: **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** (pending clarifications in Step 6) to shape the mobile app roadmap.

## Functional Test Traceability
- `tests/adaptiveEngine.functional.test.ts` → `src/adaptiveEngine.ts::updateLearnerModel#f98a68f6d5a0` (ensures learner-model math remains correct after service extraction).
- `tests/teachingInvariantsValidation.ts` → `src/curriculum.ts::advanceCurriculumState#028992e18b4c` (guards curriculum transitions; extend to cover teaching-plan regeneration APIs before mobile release).
- Proposed integration suite (new) should import `src/index.tsx` via a platform-agnostic controller to simulate `handleUserInput` + `generateNextSenseiResponse` loops.
- Proposed streaming harness (new) should integrate `src/interactionHelpers.ts::streamMainSenseiResponse#32a6057a27e0` and the enhancer controller to measure latency budgets for mobile.
- Analyzer-driven guardrails (existing `npm run analysis:run`) must be part of CI so the refactor keeps `fan_in/fan_out` trends visible during the mobile migration.

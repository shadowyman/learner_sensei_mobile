# LLM Entry and Exit Traces (Web App)

_Notation: functions that make a direct call to `GoogleGenAI`/`Chat` APIs are marked with an asterisk._

Phase‑1 routing invariant: these traces list desktop/web LLM entry points. For mobile WebView builds (`window.__SENSEI_MOBILE_BUILD__`), every traced tool must be wired to a BFF‑backed path (bridge request or mobile `CoreLlmClient` proxy), and any direct `GoogleGenAI`/`Chat` usage must be gated to desktop only. When updating this document for a migration, record the mobile transport choice and confirm the routing gate and sentinel test are complete.

## Phase 1 Scoped Migration Status

As of 2026-06-05, the table includes completed Phase 1 scoped migrations, including the module-introduction and main-response stream migration recorded in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

| Capability | Canonical prompt file | Core capability | Mobile bridge message | BFF route/service | Desktop/web compatibility |
| --- | --- | --- | --- | --- | --- |
| Wrap-up assessment planner | `core/prompts/wrapUpAssessment.ts` | `core/wrapUpAssessment.ts:generateWrapUpAssessment` | `wrapup:requestShow` / `wrapup:result` | `POST /sessions/:sessionId/wrapup` -> `bff/src/services/wrapUpService.js` -> Core | `src/geminiService.ts:generateWrapUpAssessment` delegates to Core; primary web Solidify paths also use Core directly |
| Teaching plan generation | `core/prompts/teachingPlan.ts` | `core/teachingPlan.ts:extractAndPlanTeachingOrder` | `teachingPlan:request` / `teachingPlan:result` | `POST /sessions/:sessionId/teaching-plan` -> `bff/src/services/teachingPlanService.js` -> Core | `src/geminiService.ts:llmExtractAndPlanTeachingOrder` delegates to Core |
| Learner analysis | `core/prompts/learnerAnalysis.ts` | `core/learnerAnalysis.ts:getComprehensiveAnalysis` | `analysis:request` / `analysis:result` | `POST /sessions/:sessionId/analysis` -> `bff/src/services/analysisService.js` -> Core | `src/geminiService.ts:getAnalysisFromGemini` delegates to Core |
| Mermaid error repair | `core/prompts/mermaidRepair.ts` | `core/mermaidErrorRecovery.ts:attemptMermaidFix` and `runMermaidRecovery` | `mermaid:recover` / `mermaid:recoverResult` | `POST /mermaid/recover` -> `bff/src/services/mermaidService.js` -> Core | `src/mermaidErrorRecovery.ts` re-exports Core |
| Module introduction stream | `core/prompts/moduleIntroduction.ts` | `core/moduleIntroduction.ts:buildModuleIntroductionPrompt` | `llmStream:request` / `llmStream:status` / `llmStream:chunk` / `llmStream:error` with `capability:"moduleIntroduction"` | `POST /sessions/:sessionId/llm-stream` plus `WS /sessions/:sessionId/llm-stream?requestId=...` -> `bff/src/services/streamingService.js` -> Core | `src/interactionHelpers.ts:streamModuleIntroduction` keeps the desktop direct stream branch; mobile uses structured Core request payloads and BFF WebSocket chunks |
| Main Sensei response stream | `core/prompts/mainSenseiResponse.ts` | `core/mainSenseiResponse.ts:buildMainSenseiResponsePrompt` | `llmStream:request` / `llmStream:status` / `llmStream:chunk` / `llmStream:error` with `capability:"mainSenseiResponse"` | `POST /sessions/:sessionId/llm-stream` plus `WS /sessions/:sessionId/llm-stream?requestId=...` -> `bff/src/services/streamingService.js` -> Core | `src/interactionHelpers.ts:streamMainSenseiResponse` keeps the desktop direct stream branch; mobile routes standard and Socratic structured payloads through BFF/Core |
| Selection Sensei modal flow (toolbar action + follow-up) | `core/prompts/selectionSensei.ts` | `core/selectionSensei.ts:runSelectionSenseiModalMessage` | `selectionSensei:modalMessageRequest` / `selectionSensei:modalMessageResult` | `POST /sessions/:sessionId/selection-sensei/modal-message` -> `bff/src/services/selectionSenseiService.js` -> Core | `src/selectionSensei.ts` keeps desktop-local compatibility; mobile toolbar/follow-up route through bridge/BFF/Core and fail closed when the native bridge is unavailable |
| Legacy wrap-up wrapper | `core/prompts/wrapUpAssessment.ts` | `core/wrapUpAssessment.ts:generateWrapUpAssessment` | Same wrap-up route when mobile needs server execution | Same wrap-up route | Compatibility wrapper only; do not reintroduce prompt, tool schema, parser, or normalizer bodies into `src/geminiService.ts` |

Prompt parity is covered by `__tests__/corePromptParity.test.ts` and Selection Sensei-specific prompt golden tests. Representative Core/parser/routing coverage is covered by the capability Core tests and mobile routing sentinel tests, including `__tests__/mermaidErrorRecovery.core.functional.test.ts`, `__tests__/mermaidRecovery.mobileRoutingGate.sentinel.test.ts`, `__tests__/interactionHelpers.test.ts`, `__tests__/BffClient.test.ts`, `__tests__/moduleSelectionHandler.test.ts`, `__tests__/selectionSensei.prompts.test.ts`, `__tests__/selectionSenseiResponseParser.test.ts`, `__tests__/selectionSenseiCoreModal.test.ts`, `__tests__/selectionSensei.mobileRoutingGate.red.test.ts`, `__tests__/webviewBridge.failClosed.test.ts`, `__tests__/selectionSensei.test.ts`, `bff/tests/selectionSenseiModal.validation.red.test.js`, `bff/tests/selectionSenseiModal.service.test.js`, and `bff/tests/llmStream.deterministic.int.test.js`.

## src/index.tsx

1. `createLLMPlannerCallback` → `core/generateWrapUpAssessment` (via `CoreLlmClient`, task `'wrap_up_assessment'`) → `validateWrapUpAssessmentQuestions` → `createLLMPlannerCallback`
   - Solidify-phase planning. The Core tool builds the prompt, parses/normalizes 15 questions, and returns the result for web-side validation and overlay rendering.
2. `createLLMPlannerCallback` → `requestTeachingPlan` (routing gate)
   - Mobile WebView: `requestTeachingPlanViaBridge` → bridge `teachingPlan:request`/`teachingPlan:result` → RN → BFF `POST /sessions/:sessionId/teaching-plan` → Core `extractAndPlanTeachingOrder` (task `'teaching_plan'`).
   - Desktop: `llmExtractAndPlanTeachingOrder` (wrapper) → Core `extractAndPlanTeachingOrder` (task `'teaching_plan'`).
3. `generateNextSenseiResponse` → `requestLearnerAnalysis` (routing gate)
   - Mobile WebView: `requestLearnerAnalysisViaBridge` → bridge `analysis:request`/`analysis:result` → RN → BFF `POST /sessions/:sessionId/analysis` → Core `getComprehensiveAnalysis` (task `'comprehensive_analysis'`).
   - Desktop: `getAnalysisFromGemini` (wrapper) → Core `getComprehensiveAnalysis` (task `'comprehensive_analysis'`).
   - On success (`ComprehensiveAnalysisResultType`), the loop calls `updateLearnerModel` and then updates UI/footer; on failure it treats analysis as `null` and continues (best-effort).

## src/moduleSelectionHandler.ts

1. `executePhaseSelection` → planner closure → `requestTeachingPlan` (routing gate) → planner closure → `executePhaseSelection`
   - Handles IntroIllustrate/Socratic transitions. Mobile uses the bridge+BFF path; desktop uses the local Core browser client path.
2. `executePhaseSelection` → `createSolidifyTeachingPlan` → `core/generateWrapUpAssessment` (via `CoreLlmClient`, task `'wrap_up_assessment'`) → `validateWrapUpAssessmentQuestions` → `createSolidifyTeachingPlan` → `executePhaseSelection`
   - Solidify jump path; the handler stores overlay payloads before yielding the stub plan.

## src/interactionHelpers.ts

1. `streamModuleIntroduction` (routing gate) → mobile native bridge `llmStream:request` when `window.__SENSEI_MOBILE_BUILD__` has a structured Core request → React Native `BffClient.submitLlmStream` → BFF `POST /sessions/:sessionId/llm-stream` → BFF WebSocket stream → Core `buildModuleIntroductionPrompt` → Gemini stream → WebView `llmStream:chunk` handling → `KeyTakeawayEnhancerController.onChunk` (optional) → `KeyTakeawayEnhancerController.finalize/getLatestText` (optional) → `streamModuleIntroduction`
   - Mobile sends structured module, phase, curriculum-focus, guidance, and history payloads; Core owns prompt assembly. Desktop/web compatibility may still use the direct `Chat.sendMessageStream` branch.
2. `streamMainSenseiResponse` (routing gate) → mobile native bridge `llmStream:request` when `window.__SENSEI_MOBILE_BUILD__` has a structured Core request → React Native `BffClient.submitLlmStream` → BFF `POST /sessions/:sessionId/llm-stream` → BFF WebSocket stream → Core `buildMainSenseiResponsePrompt` → Gemini stream → WebView `llmStream:chunk` handling → `KeyTakeawayEnhancerController.onChunk` (optional) → `KeyTakeawayEnhancerController.finalize/getLatestText` (optional) → `streamMainSenseiResponse`
   - Mobile standard turns send structured `curriculumFocus`, bounded chronological `conversationHistory`, and `currentUserInput`; mobile Socratic turns send structured Socratic execution state under the same `mainSenseiResponse` capability. Desktop/web compatibility may still use the direct `Chat.sendMessageStream` branch.

## src/selectionSensei.ts

1. `dispatchFollowupToAI` (routing gate) -> `requestSelectionSenseiModalMessage` -> modal result formatting -> `dispatchFollowupToAI`
   - Mobile WebView: builds structured explicit modal context, calls `requestSelectionSenseiModalMessageViaBridge`, sends `selectionSensei:modalMessageRequest`, receives `selectionSensei:modalMessageResult`, and appends the formatted follow-up bubble. BFF executes `POST /sessions/:sessionId/selection-sensei/modal-message` and calls Core `runSelectionSenseiModalMessage`.
   - Desktop/web compatibility: uses the local Selection Sensei generator path with Core-owned prompt/parser facades.
2. `handleToolbarAction` (routing gate) -> `requestSelectionSenseiModalMessage` -> modal title/content handling -> `handleToolbarAction`
   - Mobile WebView: sends structured toolbar payloads for LLM actions, consumes `selectionSensei:modalMessageResult`, fails closed when the native bridge is unavailable, and suppresses duplicate rapid toolbar requests while one matching request is pending.
   - Desktop/web compatibility: uses the local Selection Sensei generator path with Core-owned toolbar/ask prompt builders and parser facade.
3. *`ensureSelectionChat`
   - Desktop-local compatibility helper only. Final WDG-010 sweep and mobile routing tests classify this as not reachable by the mobile toolbar/follow-up modal route.

## src/enhancementManager.ts

1. `toggleEnhancement` → *`requestSenseiEnhancement` → `applyEnhancementSequence/applyEnhancements` → `toggleEnhancement`
   - When enhancements are toggled on for a message, this path requests LLM-generated enhancement payloads, applies them to the markdown, and updates the per-message enhancement state.

## src/keyTakeawayEnhancerController.ts

1. *`KeyTakeawayEnhancerController.start` → `handleEnhancerReady` (or `finalize` fallback) → `findPlaceholderIndex`/`insertEnhancerText` → `KeyTakeawayEnhancerController.start`
   - Starts the dedicated chat, caches results, and injects the enhancer payload once available.

## src/mermaidErrorRecovery.ts

1. `src/mermaidErrorRecovery.ts` → Core re-export → `core/mermaidErrorRecovery.ts:attemptMermaidFix` → deterministic helpers → Core LLM fallback → JSON parsing helpers → `attemptMermaidFix`
   - Web source no longer owns the Mermaid prompt or fallback implementation. Core performs deterministic fixes first, then calls the injected LLM client when needed before returning the structured fix payload.

## src/geminiService.ts

1. `llmExtractAndPlanTeachingOrder` (wrapper) → Core `extractAndPlanTeachingOrder` (task `'teaching_plan'`) → `llmExtractAndPlanTeachingOrder`
2. `getAnalysisFromGemini` (wrapper) → Core `getComprehensiveAnalysis` (task `'comprehensive_analysis'`) → `getAnalysisFromGemini`
3. *`generateDirectiveFromMetaPrompt` → fallback logic → `generateDirectiveFromMetaPrompt`
4. `generateWrapUpAssessment` (legacy wrapper) → Core `generateWrapUpAssessment` → Core prompt/tool schema/parsing helpers → `generateWrapUpAssessment`
   - Legacy path retained for tests and desktop fallback; it must remain a compatibility wrapper only. Primary Solidify flows call the Core tool directly.
5. *`requestSenseiEnhancement` → `stripJsonFence` → `normalizeEnhancementEntries` → `requestSenseiEnhancement`

## src/pedagogicalProfiler.ts

1. `PedagogicalProfiler.getDirective` → `_identifyActiveFlags` → *`generateDirectiveFromMetaPrompt` → `PedagogicalProfiler.getDirective`
   - Given learner model state and recent conversation context, this path composes a meta-prompt, invokes the directive generator, and returns the guidance string used to shape subsequent Sensei responses.

---

## Proposed LLM Abstraction Layer (World-Class Design)

### Goals

- Concentrate all `@google/genai` usage and API-shape knowledge in a single, well-typed gateway file.
- Keep UI/curriculum logic free of SDK details, error-shape quirks, and retry behavior.
- Make it easy to swap providers or add safety/telemetry (rate limiting, tracing) in one place.

### Proposed File

- New module: `src/llmGateway.ts`
  - Sole owner of `GoogleGenAI`, `Chat`, and `models.generateContent` calls.
  - Exposes low-level primitives (e.g., `callJsonModel`, `callTextModel`, `streamChat`) that take a model name, config, and prompt/message.
  - Has no knowledge of Sensei’s prompts or domain types.

### Functions / Responsibilities Using the Gateway

Below, `*` marks operations that will call into `llmGateway.ts` (direct SDK calls live only in the gateway), while keeping prompt construction and parsing in their current domain modules.

#### 1. Curriculum & Pedagogy (primarily `src/geminiService.ts`)

- *`llmExtractAndPlanTeachingOrder`  
  - Remains a domain adapter that:
    - Calls `prompts.ts` to build the teaching-plan prompt from phase, text, and metadata.
    - Calls `llmGateway` (e.g., `callJsonModel`) with the prompt and `TEACHING_PLAN_GENERATION_CONFIG`.
    - Normalizes the JSON payload into `TeachingPoint[][]`.
- *`getAnalysisFromGemini`  
  - Remains responsible for:
    - Building the analysis prompt via `core/learnerAnalysis.ts::buildComprehensiveAnalysisPrompt`.
    - Calling `llmGateway` with `COMPREHENSIVE_ANALYSIS_CONFIG`.
    - Passing the raw text through `core/learnerAnalysis.ts::parseComprehensiveAnalysisJson` to return `ComprehensiveAnalysisResultType`.
- *`generateDirectiveFromMetaPrompt`  
  - Stays as the meta-prompt adapter that:
    - Builds the meta-prompt string.
    - Calls `llmGateway` to execute the directive model.
    - Applies empty-response fallback policy.
- *`generateWrapUpAssessment`  
  - Continues to:
    - Build the wrap-up prompt via `buildWrapUpAssessmentPrompt`.
    - Call `llmGateway` with `WRAP_UP_ASSESSMENT_GENERATION_CONFIG` (and tools).
    - Use `extractFunctionCall` / `extractQuestionsFromToolCode`.
    - `normalizeWrapUpAssessmentQuestions` and `reorderWrapUpAssessmentQuestions`.
- *`requestSenseiEnhancement`  
  - Continues to:
    - Build the enhancement prompt via `buildSenseiEnhancementPrompt`.
    - Call `llmGateway` with `ENHANCEMENT_REQUEST_CONFIG`.
    - Strip JSON fences, parse, and normalize `EnhancementPayload`.

Rationale: these functions are already “LLM service layer” and do not touch the DOM. Refactoring them to use `llmGateway` (instead of direct SDK calls) cleanly separates domain prompts+parsing from provider plumbing, and gives a single place to harden error handling and telemetry for core pedagogy flows.

#### 2. Teaching Session Streaming Channels

These functions are today mixed with UI responsibilities. Under the gateway design:

- *Streaming primitives live in `llmGateway.ts` (e.g., `streamChat`).
- UI/domain-layer functions remain in their current files but depend on these primitives instead of calling `Chat.sendMessageStream`/`sendMessage` directly.

Specifically:

- `src/interactionHelpers.ts`
  - *`streamModuleIntroduction`  
    - Uses `llmGateway.streamChat(...)` with the intro model config (from `model_usage.ts`):
      - Builds `messageWithContext`.
      - Subscribes to the gateway’s stream to accumulate text and invoke `KeyTakeawayEnhancerController.onChunk`.
  - *`streamMainSenseiResponse`  
    - Uses `llmGateway.streamChat(...)` with the main response model config:
      - Keeps prompt-building and enhancer wiring.
      - Delegates all LLM I/O to the gateway.

- `src/selectionSensei.ts`
  - *`dispatchFollowupToAI`  
    - Calls `llmGateway` (single-turn text call) with the built user prompt.
    - Stays responsible for modal state and formatting (`formatFollowupAnswer`), but no longer uses `Chat` directly.
  - *`handleToolbarAction`  
    - Continues to:
      - Build userPrompt via templates.
      - Call `llmGateway` with the prompt and selection model config.
      - Interpret JSON-ish or freeform responses via `extractContentWithRegex`.

- `src/keyTakeawayEnhancerController.ts`
  - *`KeyTakeawayEnhancerController.start`  
    - Calls `llmGateway` (single-turn text call) with the precomputed key-takeaway prompt and model config.
    - Controller keeps placeholder detection, streaming integration, and cache, but it no longer creates a `Chat` instance directly.

Rationale: the gateway owns transport-level concerns (how to talk to Gemini, retries, timeouts, token accounting), while UI modules focus purely on orchestration, message formatting, and DOM updates.

#### 3. Tooling / Diagram Repair

- `src/mermaidErrorRecovery.ts`
  - *`attemptMermaidFix` (LLM branch only)  
    - Builds the mermaid-fix prompt locally.
    - Calls `llmGateway` with the prompt and `MERMAID_ERROR_RECOVERY_CONFIG`.
    - Parses the JSON result and returns the fix response.

Rationale: diagram repair is an independent “tool” consumer of the LLM. Refactoring it to use `llmGateway` lets us monitor cost and performance for mermaid-specific traffic without coupling the diagram module to the provider SDK.

### Higher-Level Callers That Stay Outside the Gateway

The following functions orchestrate LLM calls but should remain in their current files, using the new gateway instead of `@google/genai` directly:

- `createLLMPlannerCallback` (src/index.tsx:472)  
  - Continues to decide when to request teaching plans vs Solidify, but delegates to gateway methods (`fetchTeachingPlan`, `fetchWrapUpAssessment`).
- `executePhaseSelection` / `createSolidifyTeachingPlan` (src/moduleSelectionHandler.ts:289, 696)  
  - Maintain UI-driven phase selection and teaching-flow decisions; wrap gateway calls rather than importing `GoogleGenAI`.
- `generateNextSenseiResponse` (src/index.tsx:602)  
  - Continues to drive the lesson loop and learner model; calls the learner-analysis routing gate (`requestLearnerAnalysis`) instead of calling a provider SDK directly.

This preserves a clear layering:

- UI / curriculum orchestration (index/moduleSelection/selectionSensei/interactionHelpers).
- Domain services (pedagogy/mermaid/enhancement managers).
- *LLM gateway* (`src/llmGateway.ts`) as the only place that knows about `@google/genai`, model names, and SDK I/O patterns.

### Migration Strategy (Incremental)

1. Introduce `src/llmGateway.ts` with a minimal, prompt-agnostic interface (e.g., `callJsonModel`, `callTextModel`, `streamChat`) and have the `*` functions call these primitives instead of `@google/genai` directly.  
2. Refactor streaming functions (`streamModuleIntroduction`, `streamMainSenseiResponse`, `dispatchFollowupToAI`, `handleToolbarAction`, `KeyTakeawayEnhancerController.start`, mermaid LLM fallback) to use `llmGateway` primitives, without changing their external signatures.  
3. Once all direct SDK calls are centralized, enforce “no `@google/genai` imports outside `llmGateway.ts`” via linting or a simple code search gate.  
4. Optionally, enhance the gateway with cross-cutting concerns (structured logging, observability tags per task, retries/backoff, quota tracking, or multi-provider routing) without touching any UI or domain code.

This proposal yields a robust, testable, and provider-agnostic LLM integration surface while preserving existing domain boundaries and keeping migration risk low.

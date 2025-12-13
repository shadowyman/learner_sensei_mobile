# LLM Entry and Exit Traces (Web App)

_Notation: functions that make a direct call to `GoogleGenAI`/`Chat` APIs are marked with an asterisk._

Phase‑1 routing invariant: these traces list desktop/web LLM entry points. For mobile WebView builds (`window.__SENSEI_MOBILE_BUILD__`), every traced tool must be wired to a BFF‑backed path (bridge request or mobile `CoreLlmClient` proxy), and any direct `GoogleGenAI`/`Chat` usage must be gated to desktop only. When updating this document for a migration, record the mobile transport choice and confirm the routing gate and sentinel test are complete.

## src/index.tsx

1. `createLLMPlannerCallback` → `core/generateWrapUpAssessment` (via `CoreLlmClient`, task `'wrap_up_assessment'`) → `validateWrapUpAssessmentQuestions` → `createLLMPlannerCallback`
   - Solidify-phase planning. The Core tool builds the prompt, parses/normalizes 15 questions, and returns the result for web-side validation and overlay rendering.
2. `createLLMPlannerCallback` → *`llmExtractAndPlanTeachingOrder` → `createLLMPlannerCallback`
   - Intro/Socratic planning. Prompt assembly and Gemini parsing stay inside the service, and the normalized TeachingPoint[][] is returned to the callback.
3. `generateNextSenseiResponse` → *`getAnalysisFromGemini` → `parseGeminiJsonResponse` → `generateNextSenseiResponse`
   - Learner analysis path. The main loop awaits the Gemini analysis, normalizes it, then updates learner model + UI once control returns.

## src/moduleSelectionHandler.ts

1. `executePhaseSelection` → planner closure → *`llmExtractAndPlanTeachingOrder` → planner closure → `executePhaseSelection`
   - Handles IntroIllustrate/Socratic transitions via the callback created inline.
2. `executePhaseSelection` → `createSolidifyTeachingPlan` → `core/generateWrapUpAssessment` (via `CoreLlmClient`, task `'wrap_up_assessment'`) → `validateWrapUpAssessmentQuestions` → `createSolidifyTeachingPlan` → `executePhaseSelection`
   - Solidify jump path; the handler stores overlay payloads before yielding the stub plan.

## src/interactionHelpers.ts

1. *`streamModuleIntroduction` → `KeyTakeawayEnhancerController.onChunk` (optional) → `KeyTakeawayEnhancerController.finalize/getLatestText` (optional) → `streamModuleIntroduction`
   - Streams the intro chat; enhancer hooks may splice in Key Takeaways before the final text returns.
2. *`streamMainSenseiResponse` → `KeyTakeawayEnhancerController.onChunk` (optional) → `KeyTakeawayEnhancerController.finalize/getLatestText` (optional) → `streamMainSenseiResponse`
   - Main turn streaming follows the same structure, ending when the accumulated response is ready for consumers.

## src/selectionSensei.ts

1. *`dispatchFollowupToAI` → `formatFollowupAnswer` → `extractContentWithRegex` → `dispatchFollowupToAI`
   - Handles the composer-driven follow-up message before handing formatted text to the modal.
2. *`handleToolbarAction` → `extractContentWithRegex` → `handleToolbarAction`
   - Selected-text actions invoke Gemini directly, then parse titles/explanations for the response modal.

## src/enhancementManager.ts

1. `toggleEnhancement` → *`requestSenseiEnhancement` → `applyEnhancementSequence/applyEnhancements` → `toggleEnhancement`
   - When enhancements are toggled on for a message, this path requests LLM-generated enhancement payloads, applies them to the markdown, and updates the per-message enhancement state.

## src/keyTakeawayEnhancerController.ts

1. *`KeyTakeawayEnhancerController.start` → `handleEnhancerReady` (or `finalize` fallback) → `findPlaceholderIndex`/`insertEnhancerText` → `KeyTakeawayEnhancerController.start`
   - Starts the dedicated chat, caches results, and injects the enhancer payload once available.

## src/mermaidErrorRecovery.ts

1. `attemptMermaidFix` → (rule-based helpers) → *`attemptMermaidFix` (Gemini fallback block) → JSON parsing helpers → `attemptMermaidFix`
   - The same function performs deterministic fixes first, then calls Gemini when needed before returning the structured fix payload.

## src/geminiService.ts

1. *`llmExtractAndPlanTeachingOrder` → Socratic metadata/JSON normalization helpers → `llmExtractAndPlanTeachingOrder`
2. *`getAnalysisFromGemini` → `parseGeminiJsonResponse` → `getAnalysisFromGemini`
3. *`generateDirectiveFromMetaPrompt` → fallback logic → `generateDirectiveFromMetaPrompt`
4. *`generateWrapUpAssessment` (legacy wrapper) → Core parsing helpers → `generateWrapUpAssessment`
   - Legacy path retained for tests and desktop fallback; primary Solidify flows call the Core tool directly.
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
    - Building the analysis prompt via `GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION`.
    - Calling `llmGateway` with `COMPREHENSIVE_ANALYSIS_CONFIG`.
    - Passing the raw text through `parseGeminiJsonResponse` to return `ComprehensiveAnalysisResultType`.
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
  - Continues to drive the lesson loop and learner model; calls `llmGateway.fetchLearnerAnalysis` instead of `getAnalysisFromGemini` directly.

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

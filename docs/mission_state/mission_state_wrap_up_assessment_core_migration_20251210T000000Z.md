# Mission State – Wrap-Up Assessment Core/BFF Migration (2025-12-10)

## Scope and Entry Points

This mission state document captures the analysis for migrating the wrap-up assessment LLM tool from the web-only `src` implementation into the shared Core + BFF architecture, while preserving existing web behavior and enabling mobile parity.

Primary files and functions in scope (based on `tmp/analysis/summary.txt`, `functions.json`, and repository docs):

- `src/geminiService.ts`
  - `generateWrapUpAssessment` (LLM tool entry; async, pure prompt/parse/normalize).
  - Helper functions: `normalizeWrapUpAssessmentQuestions`, `stripJsonFence`, `extractFunctionCall`, `extractQuestionsFromToolCode`, `reorderWrapUpAssessmentQuestions`, `buildDebugAssessment`, `isWrapUpDebugEnabled`, `coerceString`.
- `src/wrapUpAssessment.ts`
  - Validation and UI overlay:
    - `validateWrapUpAssessmentQuestions`
    - `showWrapUpAssessmentOverlay`
    - `isWrapUpAssessmentActive`
    - `unlockWrapUpChatControls`, `disableChatControls`, `applyCodeBlockEnhancements`, `setMarkdown`.
- `src/index.tsx`
  - Teaching pipeline orchestration:
    - `createLLMPlannerCallback` (Solidify phase).
    - `generateNextSenseiResponse` (teaching loop).
    - Handling of `wrapup:show` bridge messages for mobile.
- `src/moduleSelectionHandler.ts`
  - `executePhaseSelection`
  - `createSolidifyTeachingPlan`
  - These paths invoke `generateWrapUpAssessment` and stash overlay data before yielding a stub teaching plan.
- `bff/src/services/wrapUpService.js`
  - `WrapUpService.maybeGenerateWrapUp` (currently a stub that logs and returns `null`).
  - Used by `bff/src/services/streamingService.js` to optionally emit `wrapUp` WS frames.
- `bff/src/services/streamingService.js`
  - `StreamingService.handleConnection`:
    - Calls `this.wrapUpService.maybeGenerateWrapUp(context)` and emits `wrapUp` frames when a payload is present.
- Core package (`core/`)
  - Existing modules: `llmTypes.ts`, `modelUsage.ts`, `mermaidErrorRecovery.ts`, `browserLlmClient.ts`.
  - Not yet present: `core/wrapUpAssessment.ts` (to be introduced by this mission).

External reference documents used:

- `docs/architecture_mobile_sensei_phase1.md`
- `docs/bff_implementation_walkthrough.md` (notably Steps 4 and 6).
- `docs/llm_entry_exit_traces.md`
- `docs/architecture_mobile_llm_tools_migration_plan.md` (§1.3, §6).
- `docs/protocols/PLAN.md`

## Static Execution Trace (High-Level)

Desktop/web Solidify wrap-up flow:

1. User progresses a module into the Solidify phase.
2. `src/index.tsx::createLLMPlannerCallback` (entry candidate from analyzer) decides that a wrap-up assessment is required.
3. `createLLMPlannerCallback` calls `src/geminiService.ts::generateWrapUpAssessment` with:
   - `GoogleGenAI` instance.
   - `moduleId` and `WrapUpAssessmentPromptContext` (module title, goal, content, and concept summaries).
4. `generateWrapUpAssessment`:
   - Uses configuration (wrap-up tools and model config) to call the Gemini API.
   - Parses JSON or tool-code results via:
     - `stripJsonFence`
     - `extractFunctionCall`
     - `extractQuestionsFromToolCode`
     - `normalizeWrapUpAssessmentQuestions`
     - `reorderWrapUpAssessmentQuestions`
   - Optionally uses `buildDebugAssessment` when debug is enabled.
   - Returns a `WrapUpAssessmentGenerationResult | null`.
5. Caller validates the generated questions via `src/wrapUpAssessment.ts::validateWrapUpAssessmentQuestions`.
6. Overlay rendering:
   - `showWrapUpAssessmentOverlay` constructs DOM for the overlay shell, header, grid of questions, and footer, then disables chat controls via `disableChatControls`.
   - When the overlay is dismissed, `unlockWrapUpChatControls` restores chat input and buttons.

Mobile/BFF flow (current and target):

- Current:
  - `WrapUpService.maybeGenerateWrapUp` is called from `StreamingService.handleConnection` but always returns `null`, so no wrap-up payload is sent over the WebSocket.
  - There is no dedicated HTTP route for `/sessions/:sessionId/wrapup`.
  - Mobile currently does not receive real LLM-generated wrap-up overlays from BFF.
- Target (per architecture docs and BFF walkthrough Steps 4 and 6):
  - Core will expose `generateWrapUpAssessment(llm: CoreLlmClient, moduleId: string, context: WrapUpAssessmentPromptContext)`.
  - BFF will implement `CoreLlmClient` via `CoreLlmAdapter` + `GeminiGateway.callText`.
  - BFF will expose `/sessions/:sessionId/wrapup` that:
    - Validates `moduleId` and `promptContext`.
    - Looks up the session in `SessionStore`.
    - Calls `wrapUpService.generateWrapUp`, which delegates to Core.
    - Returns a `WrapUpAssessmentOverlayData` payload.
  - `SenseiMobile` `BffClient.generateWrapUp` will:
    - Ensure a session.
    - Call the wrap-up endpoint.
    - Enqueue a bridge message `{ type: 'wrapup:show', data: overlay }`.
  - WebView will handle `wrapup:show` via `showWrapUpAssessmentOverlay`, preserving the existing UI behavior.

## Dependency and Side-Effect Analysis (DSE Summary)

Key functions and their notable dependencies/side effects (from `functions.json` and direct source inspection):

- `src/geminiService.ts::generateWrapUpAssessment`
  - Dependencies:
    - Internal helpers: `isWrapUpDebugEnabled`, `buildDebugAssessment`, `stripJsonFence`, `extractFunctionCall`, `extractQuestionsFromToolCode`, `normalizeWrapUpAssessmentQuestions`, `reorderWrapUpAssessmentQuestions`.
    - External: `GoogleGenAI`/Gemini SDK, wrap-up model configuration, wrap-up tools definition.
  - Side Effects:
    - Analyzer marks no direct side effects; function is pure in terms of program state and DOM. All effects are through return values.
  - Risk:
    - High semantic importance (determines final questions learner sees).
    - Moderate blast radius: outputs feed into overlay, but function itself is pure and testable.

- `src/wrapUpAssessment.ts::validateWrapUpAssessmentQuestions`
  - Dependencies:
    - `assertNonEmptyString`, `optionalString`, and inline mappers to ensure each question has valid text, code, and snippet flags.
  - Side Effects:
    - None (pure validation). Analyzer corroborates this.
  - Risk:
    - Medium: incorrect validation would allow malformed overlays or reject valid payloads.

- `src/wrapUpAssessment.ts::showWrapUpAssessmentOverlay`
  - Dependencies:
    - Validation helper, render preparation (`prepareRenderQuestions`), chat control helpers, and code-block enhancement utilities.
  - Side Effects (from analyzer):
    - Extensive DOM operations: `document.getElementById`, `document.createElement`, `appendChild`, `className`, `setAttribute`, textContent manipulation.
    - Timer: `requestAnimationFrame` for CTA state updates.
  - Risk:
    - High UI blast radius: misbehavior can block the chat input, break keyboard navigation, or corrupt overlay rendering.
    - DOM-only; no LLM or network side effects.

- `bff/src/services/wrapUpService.js::maybeGenerateWrapUp`
  - Dependencies:
    - BFF `logger` only.
  - Side Effects:
    - Logging; no external calls beyond telemetry.
  - Risk:
    - Currently low: it always returns `null` and never talks to LLM or Core. After migration, risk will increase as this service will orchestrate Core + `GeminiGateway`.

- `bff/src/services/streamingService.js::handleConnection`
  - Dependencies:
    - `SessionService`, `TurnService`, `SenseiCoreAdapter`, `GeminiGateway`, `WrapUpService`.
  - Side Effects:
    - Networking: WebSocket messages (`status`, `chunk`, `wrapUp`, `error`).
    - LLM streaming via `GeminiGateway.streamMainResponse`.
  - Risk:
    - High: primary streaming control path for mobile; any misbehavior could break main teaching turns.
    - Wrap-up payload integration is optional and currently guarded by `maybeGenerateWrapUp`.

## Risk Register (Initial)

- High:
  - Coupling between wrap-up question generation and overlay rendering: if Core migration changes the shape of questions or their counts, `showWrapUpAssessmentOverlay` may render incorrectly or fail validation.
  - Mobile/BFF path correctness: new Core/BFF integration must not regress desktop behavior while enabling mobile wrap-up.
- Medium:
  - Validation logic drift: differences between existing `normalizeWrapUpAssessmentQuestions` and the migrated Core implementation could alter question distribution or snippet ratios.
  - StreamingService behavior when `wrapUpService` starts returning real payloads (ordering and timing of `wrapUp` frames relative to final `status`).
- Low:
  - Logging schemas around wrap-up; changes to log fields may affect observability but not runtime behavior.

## Coverage Checklist (Functions to Validate After Migration)

After implementing Core + BFF wrap-up, validation should explicitly exercise:

- `src/geminiService.ts`
  - New state: no direct `generateWrapUpAssessment` LLM call; callers must use Core instead.
  - If a thin wrapper remains, ensure it delegates to Core correctly.
- `core/wrapUpAssessment.ts` (to be introduced)
  - `generateWrapUpAssessment(llm: CoreLlmClient, moduleId: string, context: WrapUpAssessmentPromptContext)`.
  - JSON parsing helpers for wrap-up payloads.
- `src/wrapUpAssessment.ts`
  - `validateWrapUpAssessmentQuestions` behavior unchanged (question counts, required fields).
  - `showWrapUpAssessmentOverlay` renders same overlay for a given `WrapUpAssessmentOverlayData`.
- `src/index.tsx`
  - `createLLMPlannerCallback` uses Core-based wrap-up generator and still triggers overlay via existing pathways.
  - Handling of `wrapup:show` messages for mobile remains correct.
- `src/moduleSelectionHandler.ts`
  - `createSolidifyTeachingPlan` continues to store overlay payloads and integrate them with the planner.
- `bff/src/services/wrapUpService.js`
  - New `generateWrapUp` method using Core + `CoreLlmAdapter`.
  - `maybeGenerateWrapUp` behavior for both HTTP and WebSocket-triggered flows.
- `SenseiMobile/src/mobile/network/BffClient.ts`
  - New `generateWrapUp` method correctly calls `/sessions/:sessionId/wrapup` and enqueues `wrapup:show` bridge messages.

## Assumptions and Unknowns

- Assumptions:
  - `WrapUpAssessmentPromptContext` and `WrapUpAssessmentOverlayData` types are stable and will be re-used by Core and BFF.
  - Existing web path is the source of truth for expected wrap-up UX (15 questions, 5 snippet items, Solidify phase entry conditions).
  - No external persistence (database) is introduced as part of this migration; `SessionStore` remains in-memory for BFF.
- Unknowns (to be resolved during implementation):
  - Exact shape and location of wrap-up model configuration and tools on the BFF side (likely parallels existing web constants).
  - Final decision on using HTTP-only wrap-up vs also emitting `wrapUp` frames on the WebSocket stream in Phase 1.
  - Whether any test suites currently assert on wrap-up content; if so, they must be updated to target Core instead of `src/geminiService.ts`.

## Triggering Protocols and Next Steps

- Triggering protocols based on this mission:
  - COMPREHENSIVE IMPACT ANALYSIS PROTOCOL (executed at a high level here; detailed validation plan will live in the ExecPlan).
  - MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL (for the non-trivial introduction of `core/wrapUpAssessment.ts` and BFF endpoint design).
  - MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL (to be followed when implementing the ExecPlan).
- This mission state document serves as the Core Analysis checkpoint required by `MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)` and should be updated if the scope or risk profile changes during implementation.

## Implementation Summary (2025-12-12)

- Core tool implemented in `core/wrapUpAssessment.ts`, exported from `@sensei/core`, and configured via `WRAP_UP_ASSESSMENT_GENERATION_CONFIG`.
- Web/WebView Solidify flows now call the Core tool through a browser `CoreLlmClient`; `src/geminiService.ts::generateWrapUpAssessment` remains as a legacy wrapper for tests/fallback and reuses Core parsing.
- BFF now routes `task: 'wrap_up_assessment'` in `GeminiGateway`, implements `WrapUpService.generateWrapUp`, and exposes `POST /sessions/:sessionId/wrapup` returning `WrapUpAssessmentOverlayData`.
- Mobile `BffClient.generateWrapUp` posts to the wrap-up endpoint and enqueues a `wrapup:show` bridge event for WebView.
- Automated validation: Root Jest suite passes and BFF integration tests (mermaid + wrap-up) pass when run with local server/network permissions.

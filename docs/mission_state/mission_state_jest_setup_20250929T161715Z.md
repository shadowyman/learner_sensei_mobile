# Mission State: Jest Setup (2025-09-29)

## Scope & Entry Points
- Target modules requiring immediate Jest coverage: `adaptiveEngine.ts`, `curriculum.ts`, `geminiService.ts`, `interactionHelpers.ts`, `moduleSelectionHandler.ts`, `selectionSensei.ts`, `ui.ts`, `prompts.ts`, and the existing Node analyzer integration in `tests/analyzer.integration.ts`.
- Analyzer entry candidates: `index.tsx`, `scripts/analyze.ts`. High fan-in modules influencing blast radius: `curriculum.ts` (11), `adaptiveEngine.ts` (10), `model_usage.ts` (8), `prompts.ts` (7), `ui.ts` (7).
- High fan-out orchestrators relevant to the test harness: `index.tsx` (18), `ui.ts` (8), `moduleSelectionHandler.ts` (8), `selectionSensei.ts` (8), `geminiService.ts` (5), `interactionHelpers.ts` (5).

## Static Execution Trace Summary
- `ModuleSelectionHandler.handlePhaseSelection@7561` → invokes `geminiService.llmExtractAndPlanTeachingOrder@2169`, streams UI updates via `ui.displayMessage@46373` and `ui.processMermaidBlocks@78133`, and updates history through `ModuleSelectionHandler.updateResponseHistory@22657`.
- `geminiService.llmExtractAndPlanTeachingOrder@2169` → prepares prompts with `prompts.GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT@38165`, logs via `logger`, branches into async handlers (`__anon4`-`__anon12`), and parses responses through `parseGeminiJsonResponse@1478` when invoked from planner flows.
- `interactionHelpers.streamMainSenseiResponse@7636` → logs prompt validation, pushes deltas to `ui.updateMessageStream@68016`, and coordinates with prompt templates (`prompts.MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION@23977`).
- `adaptiveEngine.updateLearnerModel@13937` → maps analysis values, applies categorical updates, writes affective/cognitive states, mutates curriculum coverage, and logs via `logAdaptiveValidation@374`.
- `curriculum.generateTeachingPlanForPhase@13100` → consumes `adaptiveEngine` outputs and prompt builders to assemble phase plans used by module selection flows.
- `selectionSensei.initializeSelectionSensei@55764` → builds DOM/tooling via `SelectionSensei.initialize@4076`, registers listeners, depends on `ui.createMessageRegistry@6676`, and updates toolbar state during drag operations.
- `ui.sanitizeCodeFences@2351`, `ui.createMessageRegistry@6676`, `ui.updateMessageStream@68016` → orchestrate DOM sanitization, stateful message registries, and streaming updates consumed by the handlers above.
- `prompts` exports (e.g., `buildSenseiEnhancementPrompt@61417`, `GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION@51919`) supply deterministic string templates consumed by `geminiService` and `interactionHelpers`.

## Dependency & Side-Effect Table
| Function ID | Key Dependencies | Side Effects / Operations | Risk |
| --- | --- | --- | --- |
| `adaptiveEngine.ts::initializeLearnerModel@6177` | Internal defaults, `logger` | Initializes learner model object (in-memory) | Medium |
| `adaptiveEngine.ts::updateLearnerModel@13937` | `mapAnalysisValue`, `dynamicCategoricalUpdate`, curriculum state | Writes to learner affective state, KC mastery, coverage, window progress bars | High |
| `curriculum.ts::generateTeachingPlanForPhase@13100` | `prompts` generators, `adaptiveEngine` outputs | Pure computation of plan structure | Medium |
| `curriculum.ts::advanceCurriculumState@46054` | Learner model state, `logger` | Mutates curriculum progression, learner trajectory counters | High |
| `geminiService.ts::parseGeminiJsonResponse@1478` | `logger` | Error logging on malformed JSON | Medium |
| `geminiService.ts::llmExtractAndPlanTeachingOrder@2169` | `prompts.GET_SOCRATIC...`, Google GenAI client | External LLM call, streaming handlers, logger error paths | High |
| `interactionHelpers.ts::buildSenseiDynamicSystemInstruction@1969` | `prompts.MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION` | Constructs prompt strings | Medium |
| `interactionHelpers.ts::streamMainSenseiResponse@7636` | `ui.updateMessageStream`, logger | DOM streaming via UI helper | High |
| `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection@7561` | `geminiService.llmExtractAndPlanTeachingOrder`, `ui` helpers, timers | DOM mutations, interval timers, history state writes | High |
| `moduleSelectionHandler.ts::ModuleSelectionHandler.handleClickedModuleSelection@5413` | `ui.displayMessage`, DOM queries | Reads/writes selection DOM, user input state | Medium |
| `selectionSensei.ts::initializeSelectionSensei@55764` | `SelectionSensei.initialize`, `ui.createMessageRegistry` | Registers DOM listeners, manipulates toolbar elements | High |
| `selectionSensei.ts::reinitializeSelectionSensei@56181` | `logSelectionSenseiValidation`, `initializeSelectionSensei` | DOM refresh, event re-binding | High |
| `ui.ts::sanitizeCodeFences@2351` | none | Pure string sanitation | Low |
| `ui.ts::createMessageRegistry@6676` | `document` access | Initializes registry structures, minor DOM references | Medium |
| `ui.ts::updateMessageStream@68016` | DOM APIs, animation timers | Mutates DOM nodes, schedules updates | High |
| `prompts.ts::buildSenseiEnhancementPrompt@61417` | prompt fragments | Pure string assembly | Low |
| `prompts.ts::GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT@38165` | Socratic templates | Pure string assembly | Low |

## Risk Register
- **High** – `adaptiveEngine.updateLearnerModel@13937`: large state surface (affective, cognitive, curriculum) demands smoke assertions that model mutations occur without throwing. Mitigation: placeholder test verifying mutation of mock learner state and coverage counters.
- **High** – `geminiService.llmExtractAndPlanTeachingOrder@2169`: external dependency on Google GenAI and streaming branches. Mitigation: manual Jest mock for `@google/genai` covering both streaming iterator and simple responses.
- **High** – `moduleSelectionHandler.handlePhaseSelection@7561`: heavy DOM/timer interactions likely to fail without jsdom shims. Mitigation: jsdom default environment plus targeted smoke test to ensure state callback invoked.
- **High** – `selectionSensei.initializeSelectionSensei@55764`: attaches numerous DOM listeners; risk of missing globals (ResizeObserver, localStorage). Mitigation: expand `jest.setup.ts` to polyfill required browser APIs and add minimal toolbar lifecycle test.
- **Medium** – `interactionHelpers.streamMainSenseiResponse@7636`: relies on streaming timers and DOM; mitigate with fake timers smoke test ensuring at least one update tick.
- **Medium** – `ui.updateMessageStream@68016`: DOM mutation chain needs sanitized environment. Mitigation: include DOMRect/matchMedia shims and placeholder test that DOM node count increments.

## Coverage Checklist (from analyzer IDs)
- `adaptiveEngine.ts::initializeLearnerModel@6177`
- `adaptiveEngine.ts::updateLearnerModel@13937`
- `curriculum.ts::generateTeachingPlanForPhase@13100`
- `curriculum.ts::advanceCurriculumState@46054`
- `geminiService.ts::parseGeminiJsonResponse@1478`
- `geminiService.ts::llmExtractAndPlanTeachingOrder@2169`
- `interactionHelpers.ts::buildSenseiDynamicSystemInstruction@1969`
- `interactionHelpers.ts::streamMainSenseiResponse@7636`
- `moduleSelectionHandler.ts::ModuleSelectionHandler.handleClickedModuleSelection@5413`
- `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection@7561`
- `selectionSensei.ts::initializeSelectionSensei@55764`
- `selectionSensei.ts::reinitializeSelectionSensei@56181`
- `ui.ts::sanitizeCodeFences@2351`
- `ui.ts::createMessageRegistry@6676`
- `ui.ts::updateMessageStream@68016`
- `prompts.ts::buildSenseiEnhancementPrompt@61417`
- `prompts.ts::GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT@38165`
- `tests/analyzer.integration.ts` ported suite (Node env) – preserve existing assertions under Jest.

## Unknowns Register
| Unknown & Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Accurate simulation of `@google/genai` streaming iterator semantics for Socratic planning | High | Build manual Jest mock with configurable async iterator; exercise in `geminiService.test.ts` | Self / During Jest implementation |
| Availability of browser globals (`ResizeObserver`, `IntersectionObserver`, `DOMRect`, `matchMedia`) in jsdom | Medium | Add shims in `jest.setup.ts`; validate via `selectionSensei` and `ui` smoke tests | Self / During Jest setup |
| Presence of `TextEncoder`/`TextDecoder` and `crypto.randomUUID` in Node 18 test runtime | Medium | Polyfill in `jest.setup.ts`; confirm via `adaptiveEngine` smoke test | Self / During Jest setup |
| `window.ai`, `hljs`, `anime` globals referenced by UI helpers | Medium | Provide stub objects in `jest.setup.ts`; confirm via `ui.test.ts` | Self / During Jest setup |
| Local storage dependencies (`localStorage`, `sessionStorage`) for UI history | Medium | Implement simple in-memory storage shims; verify via module selection smoke test | Self / During Jest setup |

## Key Architectural Insights
- The adaptive pipeline hinges on `moduleSelectionHandler` orchestrating LLM planning (`geminiService`) and DOM updates (`ui`). Tests must reflect this coordination.
- `selectionSensei` acts as a DOM-heavy subsystem with tight coupling to `ui` registries; reliable tests require comprehensive jsdom shims.
- Prompt construction lives in `prompts.ts` and is pure; snapshot testing will give low-effort regression coverage for template drift.
- Analyzer data confirms `logger.ts` as a cross-cutting dependency; Jest setup must mock or allow logging without polluting output.

## Next Protocol
- Proceed to **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** (non-trivial feature setup) followed by **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** once architecture is approved.

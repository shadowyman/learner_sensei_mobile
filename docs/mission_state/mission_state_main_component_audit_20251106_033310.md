# Mission State: Main Component Audit

## Scope & Entry Points
- Primary entry: `src/index.tsx::loadCurriculumAndGreet`
- Supporting orchestration: `src/index.tsx::initializeGoogleAI`, `src/index.tsx::loadProjectFileManifestAndPaths`
- Interactive flows: `src/index.tsx::handleUserInput`, `src/index.tsx::generateNextSenseiResponse`, navigation handlers, save/load UI bootstrap
- Hot modules from analyzer fan-in/out: `src/logger.ts`, `src/model_usage.ts`, `src/adaptiveEngine.ts`, `src/curriculum.ts`, `src/ui.ts`, `src/geminiService.ts`, `src/moduleSelectionHandler.ts`

## Static Execution Trace
1. `loadCurriculumAndGreet` → `initializeUI` → `initializeCodeEditorModal` → `initializeEnhancementManager` → `initializeSaveLoadUI`
2. `loadCurriculumAndGreet` → `loadProjectFileManifestAndPaths` → manifest fallback handling
3. `loadCurriculumAndGreet` → `initializeGoogleAI` → `initializeDebugMode` → expose `(window as any).ai`
4. `loadCurriculumAndGreet` → curriculum fetch/parsing → `ModuleSelectionHandler` instantiation → initial `displayMessage`
5. `handleUserInput` → `displayMessage` → `generateNextSenseiResponse`
6. `generateNextSenseiResponse` → `getAnalysisFromGemini` → `updateLearnerModel` → `advanceCurriculumState` → `streamMainSenseiResponse`
7. Navigation: `handleConceptNavigation`/`handleChunkNavigation` → `navigateToConcept`/`window.switchToChunk` → `generateNextSenseiResponse('', true)`
8. Progress/UI feedback: `updateKCProgressBar`, `updateConceptNavigationArrows`, `displayMessage`
9. Recovery flows: `handleReloadSenseiMessage` → `streamMainSenseiResponse`/`streamModuleIntroduction`

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Side-Effect Risk |
| --- | --- | --- | --- |
| `loadProjectFileManifestAndPaths` | `fetch`, `logManifestValidation`, `logger.warn`, `projectFileContents` | Network fetch, mutate `availableProjectFilePaths`, stash manifest copies | High (network + global state) |
| `initializeGoogleAI` | `GoogleGenAI`, `updateCurriculumDisplay`, `logAiInitialization`, `initializeDebugMode` | Instantiate AI client, set globals `ai`, `mainSenseiChat`, expose `window.ai`, create `profiler` | Medium-High (global state + external service) |
| `loadCurriculumAndGreet` | UI initializers, `loadProjectFileManifestAndPaths`, `initializeGoogleAI`, `fetch('Modules.txt')`, `ModuleSelectionHandler`, `displayMessage` | Binds numerous globals, runs curriculum fetch, sets learner model defaults, schedules timers | High (multiple globals + network) |
| `initializeSaveLoadUI` | DOM query, `SaveLoadProgressManager`, `logger` | Register button handlers, keyboard shortcut, interact with `document` | Medium (DOM binding) |
| `handleUserInput` | `displayMessage`, `processMermaidBlocks`, `createLLMPlannerCallback`, `advanceCurriculumState`, `generateNextSenseiResponse` | Mutate learner model skip path, DOM edits, history management | Medium-High (state + DOM) |
| `generateNextSenseiResponse` | `ModuleSelectionHandler`, `ensureTeachingPlanExists`, `getAnalysisFromGemini`, `updateLearnerModel`, `advanceCurriculumState`, `streamMainSenseiResponse` | Mutates `learnerModel`, `curriculumState`, triggers LLM calls, UI updates | High (stateful + LLM) |
| `handleReloadSenseiMessage` | `displayMessage`, `streamMainSenseiResponse`, `streamModuleIntroduction` | Streams replacements, mutates `lastSenseiResponses`, DOM updates | Medium (LLM retry) |
| `handlePhaseSelection` | `moduleSelectionHandler.updateState`, `.handlePhaseSelection`, `.getState` | Copies handler state back into globals | Medium (shared state sync) |
| `handleConceptNavigation` | `createLLMPlannerCallback`, dynamic `navigateToConcept`, `updateCurriculumDisplay`, `generateNextSenseiResponse` | Resets histories, mutates curriculum indices, triggers AI planner | Medium-High (state + async) |
| `handleChunkNavigation` | `window.switchToChunk`, `updateConceptNavigationArrows` | Calls exposed chunk switcher, relies on global hook | Medium (indirect async + DOM) |
| `calculateFocusStrategy` | `calculateFocusPoints` | Pure calculation, returns strategy object; no direct mutations | Low |
| `updateKCProgressBar` | `document.getElementById`, `logger` | Mutates DOM styles/attributes, timers for animation reset | Medium (DOM timing) |

## Risk Register
- High: Manifest/network bootstrap (`loadProjectFileManifestAndPaths`) — improper parsing or missing files cascades into AI debug tooling and curriculum availability.
- High: Response orchestration (`generateNextSenseiResponse`) — simultaneous learner model mutations and LLM calls can desync state if awaited flows short-circuit.
- High: App bootstrap (`loadCurriculumAndGreet`) — failure in any chained initializer leaves globals partially configured (window handlers, save/load integration, curriculum load).
- Medium-High: Concept navigation pipeline (`handleConceptNavigation`) — relies on dynamic import plus planner-driven state resets.
- Medium: Global AI exposure (`initializeGoogleAI`) — stale `window.ai` may mislead consumers if initialization fails midway.

## Coverage Checklist
- `src/index.tsx::loadProjectFileManifestAndPaths`
- `src/index.tsx::initializeGoogleAI`
- `src/index.tsx::loadCurriculumAndGreet`
- `src/index.tsx::initializeSaveLoadUI`
- `src/index.tsx::handleUserInput`
- `src/index.tsx::generateNextSenseiResponse`
- `src/index.tsx::handleReloadSenseiMessage`
- `src/index.tsx::handlePhaseSelection`
- `src/index.tsx::handleConceptNavigation`
- `src/index.tsx::handleChunkNavigation`
- `src/index.tsx::calculateFocusStrategy`
- `src/index.tsx::updateKCProgressBar`

## Assumptions & Unknowns Register
- None (post-review; all high-impact flows have explicit observation plans via direct source inspection and analyzer cross-checks).

## Key Architectural Insights
- `src/index.tsx` is the orchestration nexus, exposing critical state via `window` for save/load, chunk navigation, and enhancement controls.
- Curriculum progression and learner modeling hinge on tightly sequenced async operations (`generateNextSenseiResponse` → `advanceCurriculumState` → UI refresh), making error handling pivotal.
- Bootstrap path chains multiple external dependencies (fetch, GoogleGenAI, DOM wiring); partial failures must short-circuit cleanly to avoid inconsistent globals.

## Triggering Protocol To Execute Next
- Pending: user requested broad bug audit without a specific symptom; awaiting confirmation whether to proceed under the Adaptive Root Cause Analysis protocol or a bespoke audit pathway.

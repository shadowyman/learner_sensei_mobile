# Mission State – Module Concept Selection Flow (2025-11-10 16:10:09)

## Scope & Entry Points
- **Primary entry:** `src/index.tsx::loadCurriculumAndGreet` bootstraps globals, instantiates `ModuleSelectionHandler`, and emits the “Available Modules” bubble.
- **Interactive path:** `ModuleSelectionHandler.handleClickedModuleSelection` → `handleInitialModuleSelectionInternal` → `displayMessage` (phase buttons) when the learner selects a module.
- **Phase execution:** `ModuleSelectionHandler.handlePhaseSelection` orchestrates loading spinners, `jumpToPhase`, `llmExtractAndPlanTeachingOrder`, `updateCurriculumDisplay`, notepad sync, and intro streaming.
- **Curriculum mechanics:** `curriculum.jumpToPhase`, `curriculum.navigateToConcept`, `curriculum.getCurrentCurriculumItem` govern state/plan generation; `geminiService.llmExtractAndPlanTeachingOrder` drives the LLM plan.
- **UI surfaces:** `ui.displayMessage` renders module lists / phase selectors; `ui.updateCurriculumDisplay` mirrors the active concept/phase in the header.
- **Hot modules from analyzer:** `src/index.tsx`, `src/moduleSelectionHandler.ts`, `src/curriculum.ts`, `src/ui.ts`, `src/geminiService.ts`.

## Static Execution Trace
1. `loadCurriculumAndGreet` fetches `Modules.txt`, parses curriculum, instantiates `ModuleSelectionHandler`, registers `window.handleModuleClick/handlePhaseSelection`, and posts the Sensei bubble listing modules (`displayMessage`).
2. A module click triggers `handleClickedModuleSelection`, which mirrors a user message, clears the textarea, and calls `handleInitialModuleSelectionInternal`.
3. `handleInitialModuleSelectionInternal` resolves the module index, caches it in `pendingModuleSelection`, and emits a new Sensei bubble flagged with `phaseSelectionEnabled=true`.
4. `displayMessage` detects `phaseSelectionEnabled`, injects Teaching/Exploration/Wrap Up buttons, and wires them to `window.handlePhaseSelection`.
5. Selecting a phase invokes `handlePhaseSelection`, which spins up loading animations, calls `jumpToPhase` with an inline planner (Intro/Exploration) or `createSolidifyTeachingPlan` (Wrap Up), and waits for `curriculumState`.
6. `jumpToPhase` builds a `CurriculumItem`, generates a teaching plan via `generateTeachingPlanForPhase`/`llmExtractAndPlanTeachingOrder`, and returns a fresh `CurriculumState` (Intro always starts at concept index `0` today).
7. Once state arrives, `handlePhaseSelection` updates `learnerModel` IDs/KCs, syncs the Notepad, calls `updateCurriculumDisplay`, prunes the phase-selection bubbles, and for Intro renders a streamed module-intro via `streamModuleIntroduction`.
8. Downstream practice continues through existing response streaming / KC tracking loops.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects & Risk Notes |
| --- | --- | --- |
| `loadCurriculumAndGreet` (`src/index.tsx`) | `initializeUI`, `fetch('Modules.txt')`, `parseModulesTxt`, `setCurriculum`, `displayMessage`, `ModuleSelectionHandler` ctor | High: network + DOM bootstrap + global window handlers; failures leave chat unusable. |
| `ModuleSelectionHandler.handleClickedModuleSelection` | `displayMessage`, `processMermaidBlocks`, `setupTextareaAutosize`, `handleInitialModuleSelectionInternal` | Medium: Injects synthetic user bubble, clears textarea, mutates `pendingModuleSelection`; DOM mistakes duplicate input or misfire events. |
| `ModuleSelectionHandler.handleInitialModuleSelectionInternal` | Curriculum list, `displayMessage` | Medium: Sets `pendingModuleSelection`, emits `phaseSelectionEnabled` bubble; mis-parsing input leaves user stuck. |
| `ModuleSelectionHandler.handlePhaseSelection` | DOM queries, `jumpToPhase`, `llmExtractAndPlanTeachingOrder`, `createSolidifyTeachingPlan`, `getCurrentCurriculumItem`, `notepad`, `updateCurriculumDisplay`, `streamModuleIntroduction`, timers | High: Async spinner intervals, LLM calls, learner-model resets, DOM removal; race conditions or stale `pendingModuleSelection` corrupt state. |
| `curriculum.jumpToPhase` | Curriculum data, `generateTeachingPlanForPhase`, logger | High: Generates fresh `CurriculumState`, always assumes Intro starts at concept 0; wrong inputs duplicate expensive LLM calls or corrupt path IDs. |
| `curriculum.navigateToConcept` | `generateTeachingPlanForPhase`, `learnerModel`, logger | High: Resets concept index and KC tracking; only valid in Intro. Needed if we refocus to arbitrary concept. |
| `curriculum.getCurrentCurriculumItem` | `curriculumState`, `curriculum` | Low: read-only, but null guards drive UI fallback text. |
| `ui.displayMessage` | Markdown pipeline, DOM builders, `window.handleModuleClick/handlePhaseSelection` | High: Renders module + phase controls, stores raw text map; new concept selector must hook here and into save/load state. |
| `ui.updateCurriculumDisplay` | Header DOM nodes, `curriculumState` | Medium: Reflects module/concept/chunk info; errors mislead learner about active concept. |
| `geminiService.llmExtractAndPlanTeachingOrder` | Google AI SDK, prompts, logger | High: External network/latency cost driver; plan caching must remain valid when we alter concept selection inputs. |

## Risk Register
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Intro phase always forces concept index 0 inside `jumpToPhase`; injecting concept choice without extending this API would require duplicate `navigateToConcept` calls, doubling LLM cost. | High | Extend `jumpToPhase` (and tests) to accept an optional `targetConceptIndex` for IntroIllustrate so only one plan is generated, and guard inputs. |
| `handlePhaseSelection` currently assumes phase button click leads directly to plan execution; adding a concept-selection step could leave spinner/intervals orphaned or drop `pendingModuleSelection`. | High | Split logic into “phase decision” vs “phase execution” helper, track `pendingPhaseSelection`, and ensure cleanup of any loading DOM fragments before emitting the concept bubble. |
| Save/Load only records `phaseSelectionEnabled`; introducing concept-selection bubbles without persisting new metadata means restored sessions will lose interactive controls. | Medium | Extend `Message`/serializer to capture a `conceptSelectionPayload` (module id, concept indices) and teach `displayMessage` to rebuild those buttons during restoration. |

## Coverage Checklist (functions / behaviors to exercise post-change)
- `ModuleSelectionHandler.handlePhaseSelection` for Intro vs Socratic/Solidify, ensuring Intro defers to concept chooser.
- New concept-selection handler (planned) covering module buttons, re-entry, and concurrent clicks.
- `ui.displayMessage` rendering of concept buttons + wiring to `window.handleConceptSelection`; verify `saveloadProgressManager` persistence.
- `curriculum.jumpToPhase` with optional concept index plus regression for Socratic/Solidify.
- `curriculum.navigateToConcept` fallback (should still guard non-Intro phases and accept direct jumps if invoked elsewhere).
- `geminiService.llmExtractAndPlanTeachingOrder` invocation inputs (module metadata should match selected concept).
- Integration smoke: module selection → Teaching → concept selection → ensures `updateCurriculumDisplay` shows chosen concept.

## Unknowns Register
| Unknown | Impact | Verification Plan | Owner | Target |
| --- | --- | --- | --- | --- |
| Should learners have a “start with first concept” shortcut if they don’t pick from the concept list (e.g., timeout or explicit “begin at start” button)? | Medium | Ask user whether a default option is desired or if concept-choice is mandatory; adjust UI accordingly. | Codex | Before implementation begins. |
| Do we need to support typed commands that specify both module and concept (e.g., “start module 2 concept recursion”), bypassing the new UI? | Medium | Clarify with user; if required, extend `handleInitialModuleSelectionInternal` parsing to detect concept keywords. | Codex | Before implementation begins. |

## Assumptions & Key Architectural Insights
- Module concepts are already parsed and cached (`curriculum.modules[i].concepts`) so the new UI can reuse that data without extra fetches.
- `ModuleSelectionHandler` is the single orchestrator for module/phase UX; keeping concept selection there avoids cross-file event drift.
- `jumpToPhase` is the right choke point to teach about arbitrary concept indices, preventing redundant `navigateToConcept` calls.
- Save/Load restoration must remain authoritative for any new message metadata (module selection and concept selection), so UI flags must be serializable.

## Next Protocol
- Proceed to **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** to enumerate blast radius before editing `index.tsx`, `moduleSelectionHandler.ts`, `curriculum.ts`, `ui.ts`, and persistence helpers.

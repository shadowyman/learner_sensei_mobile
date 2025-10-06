# Mission State: Wrap Up Overlay Integration — Core Analysis (2025-10-06)

## Scope & Entry Points
- Primary trigger: `index.tsx::handlePhaseSelection` (async) invoked via `window.handlePhaseSelection` from phase button clicks in `ui.ts`.
- Downstream coordinator: `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection` plus inline spinner callbacks (`__anon3`, `__anon4`, `__anon5`, `__anon6`).
- Supporting modules: `curriculum.ts` (phase transition + plan generation), `interactionHelpers.ts` (intro streaming/system instructions), `ui.ts` (message rendering, phase UI, mermaid post-processing), `notepad.ts` (context sync), `geminiService.ts` (LLM teaching-plan planner), `prompts.ts` (phase intro prompt fabric), `logger.ts` utilities.

## Static Execution Trace (Wrap-Up Phase Selection)
1. `index.tsx::handlePhaseSelection` updates handler state and dispatches to `ModuleSelectionHandler`.
2. `ModuleSelectionHandler.updateState` captures latest curriculum/chat/learner state.
3. `ModuleSelectionHandler.handlePhaseSelection`:
   - Validates readiness → locates phase selection bubble → installs loading spinner (`__anon3`/`__anon4`).
   - Initiates `jumpToPhase` with async plan generator (`__anon5` → `geminiService.ts::llmExtractAndPlanTeachingOrder`).
   - Registers cleanup callback (`__anon6`) to clear intervals/remove bubble.
   - On success, surfaces curriculum item, updates notepad + learner model, refreshes UI display, and either:
     - For Socratic: `sendSystemSocraticMessage` (streams via `streamMainSenseiResponse`).
     - Else: builds intro prompt (`getCurriculumFocusInstruction` → `buildSenseiDynamicSystemInstruction` + `MODULE_INTRODUCTION_TASK_TEMPLATE`) and streams `streamModuleIntroduction`.
   - Finalizes message bubble with `displayMessage`, runs `processMermaidBlocks`, updates KC progress.
4. `curriculum.ts::jumpToPhase` writes new curriculum state after teaching plan from `generateTeachingPlanForPhase` (calls cache helpers, plan validator, external LLM via injected planner).
5. UI side effects propagate through `ui.ts::updateCurriculumDisplay`, `ui.ts::displayMessage`, `ui.ts::processMermaidBlocks`, and DOM queries for removal/placeholder updates; notepad context updated via `Notepad.setActiveCurriculumContext`.

## Dependency & Side-Effect Table (abridged)
| Function (File) | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `index.tsx::handlePhaseSelection` | ModuleSelectionHandler (`updateState`, `handlePhaseSelection`, `getState`) | None directly | Low: orchestrator; intercept point for new overlay trigger. |
| `ModuleSelectionHandler.updateState` | — | Mutates internal handler state | Low: must keep state in sync before/after overlay. |
| `ModuleSelectionHandler.handlePhaseSelection` | `jumpToPhase`, `displayMessage`, `getCurrentCurriculumItem`, `Notepad.setActiveCurriculumContext`, `updateCurriculumDisplay`, `updateKCProgressBar`, `sendSystemSocraticMessage`, `streamModuleIntroduction`, `processMermaidBlocks`, `buildSenseiDynamicSystemInstruction`, `MODULE_INTRODUCTION_TASK_TEMPLATE`, `getCurriculumFocusInstruction` | Extensive DOM mutations (spinners, bubble removal), timers (`setInterval`), learner model writes, placeholder updates | **High**: Core blast zone. New overlay must bypass legacy path for Wrap Up without disrupting other phases. |
| `ModuleSelectionHandler.handlePhaseSelection__anon3/4` | — | Update loading text/dots via DOM | Medium: timers continue until cleared. Must avoid orphaned intervals when overlay short-circuits flow. |
| `ModuleSelectionHandler.handlePhaseSelection__anon5` | `geminiService.llmExtractAndPlanTeachingOrder` | External LLM call | High: Legacy plan generation we intend to skip for Wrap Up overlay (prevent unnecessary LLM spend). |
| `ModuleSelectionHandler.handlePhaseSelection__anon6` | `clearInterval` | Removes spinner, deletes bubble | Medium: ensure overlay path cleans up or avoids creating spinners. |
| `curriculum.jumpToPhase` | `logAdvanceValidation`, `generateTeachingPlanForPhase` | Writes curriculum state, teaching plan | High: Should not fire when overlay replaces Wrap Up; avoid inconsistent state. |
| `curriculum.generateTeachingPlanForPhase` | Cache helpers, validator, planner | LLM planner via injected callback | High: avoid double planning when overlay fully manages Wrap Up. |
| `ModuleSelectionHandler.sendSystemSocraticMessage` | `buildSocraticExecutionInstruction`, `displayMessage`, `streamMainSenseiResponse` | DOM writes, streaming, reload context | Medium: unaffected if overlay short-circuits only Solidify branch. |
| `ui.displayMessage` | `sanitizeCodeFences`, numerous UI helpers | Creates/updates bubbles, attaches listeners, manipulates scroll | Medium: overlay insertion must coexist with message stack ordering. |
| `ui.processMermaidBlocks` | Mermaid libs | DOM replacements | Low for overlay (unless overlay includes Markdown). |
| `interactionHelpers.streamModuleIntroduction` | `updateMessageStream` | Streams partial text | Medium: ensure not invoked for Wrap Up overlay. |
| `ModuleSelectionHandler.updateKCProgressBar` | `document.getElementById`, timers | DOM progress animation | Medium: may skip when overlay used; confirm desired behavior. |
| `Notepad.setActiveCurriculumContext` | Internal state | Notepad context writes | Medium: determine if overlay should still sync context. |

## Risk Register (High-Impact)
- **R1 – Legacy flow interference:** If overlay path still calls `jumpToPhase`, we trigger costly LLM planning and alter curriculum state prematurely (impact: High, blast radius: curriculum progression). Mitigation: gate wrap-up branch before `jumpToPhase`.
- **R2 – Spinner interval leaks:** Short-circuiting without clearing animations leaves orphaned `setInterval` timers (impact: Medium, concurrency risk: Medium). Mitigation: ensure overlay path skips spinner creation or manually clears intervals.
- **R3 – Transcript DOM conflicts:** Overlay injection must coexist with `displayMessage` bubble stack; wrong container selection could break scrolling or future message rendering (impact: High). Mitigation: mount overlay within `#message-area` using dedicated wrapper that does not hijack `.message-bubble` semantics.
- **R4 – State sync gaps:** Bypassing `updateCurriculumDisplay`/notepad updates might desync learner model for subsequent phases (impact: Medium). Mitigation: decide whether overlay path still updates these systems or defers until assessment completion; document and validate.

## Coverage Checklist / Validation Targets
- `index.tsx::handlePhaseSelection` intercept path for `phaseName === 'Solidify'` (wrap-up) toggles overlay.
- Ensure `ModuleSelectionHandler.handlePhaseSelection` legacy path remains intact for other phases (IntroIllustrate, Socratic).
- Verify spinner/timer callbacks (`__anon3`–`__anon6`) are not invoked in overlay flow.
- Confirm no `jumpToPhase`/LLM planner call when overlay is shown.
- Overlay rendering entry ensures elements inserted into `#message-area` without breaking `displayMessage` updates.
- Placeholder text / input locking behavior validated when overlay visible.

## Unknowns Register
| Item | Impact | Verification Plan | Owner | Target |
| --- | --- | --- | --- | --- |
| U1: Best DOM mount point for React-style overlay within current vanilla JS UI. | High | Inspect `ui.ts` message construction; prototype mounting within `#message-area` using dedicated container. | Assistant | Before implementation start |
| U2: Should wrap-up overlay still update curriculum/notepad state immediately, or defer until assessment completion? | Medium | Clarify expectation with user; review downstream dependencies on `curriculumState` during Solidify. | Assistant/User | Pre-implementation |
| U3: Data source for assessment questions (static vs generated). | Medium | Confirm with user whether initial integration uses static fixture from spec or placeholder. | Assistant/User | Pre-implementation |
| U4: Input locking requirements during overlay (currently handled by legacy Solidify?). | Medium | Audit existing lock mechanism in `moduleSelectionHandler` or `ui`; determine if overlay must replicate. | Assistant | During design phase |

## Architectural Insights
- Phase selection UI is built via DOM templates in `ui.ts`; selections call global handlers exported from `index.tsx`.
- Legacy Solidify path relies on LLM-generated teaching plan via curriculum engine; new overlay must decouple Wrap Up from that pipeline while leaving Socratic/Intro intact.
- Message transcript uses dynamically created `.message-bubble` nodes; overlays that diverge from this structure should use separate container to avoid being cleaned up by bubble removal routines.
- Timers for loading animations are stored on bubble elements; bypassing spinner creation prevents timer leaks.

## Next Protocol
Intended follow-up: **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** (once clarifications resolved).

## Traceability for Validation
- Production modules touched: `index.tsx`, `moduleSelectionHandler.ts`, `ui.ts`, potential new overlay module under `docs/functional_spec` guidance.
- Planned tests should cover module selection flow (likely via existing integration harness or new unit mocks targeting handler logic).


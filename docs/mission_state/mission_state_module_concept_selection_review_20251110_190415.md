# Mission State – Module Concept Selection Review (2025-11-10 19:04:15)

**Context:** Deep-dive review for HTML artifact `code_review/review_module_concept_selection_flow_codex_v3.html`. Goal: validate module concept selection flow before shipping.

## Analyzer Snapshot (Step 0.5)
- `npm run analysis:run` executed 2025-11-10 19:04:15 local; artifacts in `tmp/analysis/`.
- Entry candidates surfaced: `scripts/analyze.ts`, `scripts/createBackup.ts`, `scripts/generateReview.ts`, `scripts/reviewEdit.ts`, `scripts/review_mediator.ts`, `scripts/review_mediator/worker.ts`, `scripts/vetUnusedExports.ts`, `src/index.tsx`.
- Hot modules (fan-in/out) to monitor downstream: `src/logger.ts` (22), `src/model_usage.ts` (12), `src/adaptiveEngine.ts` (10), `src/curriculum.ts` (10), `src/ui.ts` (8), `src/moduleSelectionHandler.ts` (fan-out 11), `src/interactionHelpers.ts` (6), `src/selectionSensei.ts` (6).
- Analyzer artifacts consulted: `summary.txt`, `fan_in.json`, `fan_out.json`, `imports.json`, `functions.json`, `calls.json` (filters around concept-selection functions).

## Entry Points & Scope (Step 1)
- `src/index.tsx::handlePhaseSelection` & `handleConceptSelection` (lines 1120-1251) invoked via `window.handlePhaseSelection/handleConceptSelection`.
- `src/moduleSelectionHandler.ts`: `handlePhaseSelection` (line 211), `showConceptSelectionBubble` (636), `handleConceptSelection` (245), `executePhaseSelection` (282), `clearConceptSelectionBubble` (669), `removePhaseSelectionBubble` (680).
- `src/ui.ts::displayMessage` (1892-2105) concept branch renders `.concept-selection-buttons` and attaches `window.handleConceptSelection`.
- `src/saveloadProgressManager.ts`: `collectSessionData`, `collectUIState`, `restoreSessionData` (199-610) persist/rehydrate `conceptSelectionPayload` plus `pendingConceptSelectionBubbleId`.
- Supporting dependencies touched indirectly: `src/curriculum.ts`, `src/geminiService.ts`, `src/adaptiveEngine.ts`, `llmExtractAndPlanTeachingOrder`, `jumpToPhase`, `displayMessage` helpers.

## Static Execution Trace (Step 2)
1. `window.handlePhaseSelection` delegates to `handlePhaseSelection` (index) which updates ModuleSelectionHandler state and, for `IntroIllustrate`, calls `showConceptSelectionBubble`.
2. `showConceptSelectionBubble` composes payload `{ moduleId, moduleTitle, concepts[] }`, increments `currentMessageId`, emits Sensei prompt via `displayMessage`, records `pendingConceptSelectionBubbleId`.
3. `displayMessage` detects `conceptSelectionPayload`, renders `.concept-selection-buttons`, encodes payload into dataset (`bubble.dataset.conceptSelectionPayload` + `conceptContainer.dataset.conceptPayload`), and wires button clicks to `window.handleConceptSelection`.
4. When user clicks a concept button, `window.handleConceptSelection` calls `handleConceptSelection` (index), which rehydrates ModuleSelectionHandler state and awaits `handler.handleConceptSelection(moduleId, conceptIndex)`.
5. `ModuleSelectionHandler.handleConceptSelection` validates `pendingPhaseSelection === 'IntroIllustrate'`, logs on mismatch, sets `pendingConceptSelectionIndex`, dispatches a user confirmation `displayMessage`, clears concept/phase bubbles, then triggers `executePhaseSelection(moduleIndex, 'IntroIllustrate', conceptIndex)`.
6. `executePhaseSelection` disables phase buttons, optionally shows loading spinner bubble, delegates to `jumpToPhase`/`llmExtractAndPlanTeachingOrder` (or `createSolidifyTeachingPlan`), updates `curriculumState`, and emits sensei responses (which may include additional phase selection prompts or socratic follow-ups).
7. Save/Load surfaces: `collectUIState` scrapes `.concept-selection-buttons` datasets into JSON, and `restoreSessionData` replays each message via `displayMessage`, so restored concept buttons regain click handlers.

## Dependency & Side-Effect Table (Step 3)

| Function (file:line) | Key Dependencies | Notable Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `handleConceptSelection` (`src/index.tsx:1218`) | `moduleSelectionHandler.updateState/getState/handleConceptSelection`, globals (`curriculum`, `learnerModel`, etc.) | Mutates global refs after handler returns; relies on handler to advance `currentMessageId`. | Medium: incorrect copy order desyncs ModuleSelectionHandler state vs globals, breaking future selections.
| `ModuleSelectionHandler.handlePhaseSelection` (`src/moduleSelectionHandler.ts:211`) | `logger`, `showConceptSelectionBubble`, `executePhaseSelection`, `this.state.curriculum` | Writes `pendingPhaseSelection`, clears `pendingConceptSelectionIndex`, early returns for invalid modules/phases. | Medium: gating errors could expose concept UI during wrong phase or leave stale `pendingModuleSelection`.
| `ModuleSelectionHandler.showConceptSelectionBubble` (`src/moduleSelectionHandler.ts:636`) | `displayMessage`, `this.state.curriculum.modules` | Increments `currentMessageId`, writes `pendingConceptSelectionBubbleId`, emits message with serialized payload. | High: mis-synced payload schema or message id collisions duplicate DOM nodes and break save/load.
| `ModuleSelectionHandler.handleConceptSelection` (`src/moduleSelectionHandler.ts:245`) | `displayMessage`, `clearConceptSelectionBubble`, `removePhaseSelectionBubble`, `executePhaseSelection` | Writes `pendingConceptSelectionIndex`, emits user confirmation, clears concept and phase UI bubbles. | High: guards must ensure `pendingPhaseSelection === 'IntroIllustrate'`; failure allows selecting concept without phase context.
| `ModuleSelectionHandler.executePhaseSelection` (`src/moduleSelectionHandler.ts:282`) | DOM APIs, `llmExtractAndPlanTeachingOrder`, `jumpToPhase`, `displayMessage`, `createSolidifyTeachingPlan` | Disables buttons, spawns loading UI, schedules timers, updates `curriculumState`, possibly resets module selection state. | High: asynchronous cleanup & DOM manipulation easily regresses, plus interacts with LLM planner.
| `displayMessage` concept branch (`src/ui.ts:1892-2105`) | DOM APIs, `resetEnhancementState`, markdown parsing helpers, `window.handleConceptSelection` | Rebuilds bubble DOM, attaches click listeners, stores payload JSON in dataset, updates `streamingMessagesRawText`. | High: inaccurate dataset formatting or handler wiring breaks UI/SaveLoad; XSS risk if payload unsanitized.
| `collectUIState`/`restoreSessionData` (`src/saveloadProgressManager.ts:400-610`) | DOM queries, JSON parsing/stringify, `displayMessage`, `w.streamingMessagesRawText` | Serializes each message (including concept payload) and replays via `displayMessage`; maintains `pendingConceptSelectionBubbleId`. | Medium: parsing errors currently swallowed; schema drift will silently drop payloads.

### Unknowns Register

| Statement & Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Save/Load rehydration relies on `window.handleConceptSelection` existing before `displayMessage` replays payload buttons; bootstrap order after restore is unclear. | High | Inspect restore sequence in `src/index.tsx` & review artifact to ensure handlers are registered before invoking `SaveLoadProgressManager.restoreSession`. | Code review – confirm in diff |
| `pendingConceptSelectionBubbleId` is persisted via `SessionData.applicationState`, but ModuleSelectionHandler only syncs state when `updateState` is called. Need confirmation that globals restored prior to any handler usage after load. | Medium | Trace initialization path in `src/index.tsx` (lines 180-444) and ensure review changes keep assignment order; flag hunks touching save/load or handler state. | Code review – confirm |
| Accessibility of `.concept-button` (keyboard/focus) may regress if review alters DOM/CSS; no explicit tests cover it. | Medium | Examine artifact for DOM/style updates to concept buttons; ensure `aria-label` and focus affordances remain. | Code review – targeted inspection |

### Risk Register (High-cost Side Effects)

| Function | Side Effect | Risk Mitigation |
| --- | --- | --- |
| `displayMessage` | Direct DOM creation & payload-driven event binding; saves JSON for persistence. | Verify review sanitizes payload, retains dataset contract, and avoids duplicate listeners. |
| `ModuleSelectionHandler.executePhaseSelection` | Mixes DOM timers with async LLM planning; failure leaves spinners or stale state. | Ensure review preserves cleanup (clearing timers, removing loaders) and maintains await ordering. |
| `collectUIState`/`restoreSessionData` | Serializes arbitrary DOM attributes; JSON.parse failures currently swallowed. | Confirm review either validates payload schema or logs errors; ensure new fields included consistently. |

### Coverage Checklist
- `src/index.tsx:1120-1251` (`handlePhaseSelection`, `handleConceptSelection`, `window.handleConceptSelection`).
- `src/moduleSelectionHandler.ts:211-310` (`handlePhaseSelection`, `handleConceptSelection`).
- `src/moduleSelectionHandler.ts:636-690` (`show/clear concept selection bubble`).
- `src/moduleSelectionHandler.ts:282-520` (`executePhaseSelection`, `jumpToPhase`, DOM loaders).
- `src/ui.ts:1892-2165` (`displayMessage` concept branch & button wiring).
- `src/saveloadProgressManager.ts:400-610` (`collectUIState`, `restoreSessionData`).
- `__tests__/moduleSelectionHandler*.test.ts` (concept selection expectations) if touched by review.

### Source Grounding Notes (Step 3.5)
- Reviewed `src/index.tsx:1200-1365` for handler wiring and state synchronization.
- Reviewed `src/moduleSelectionHandler.ts:211-420` and `636-690` for guard clauses, DOM updates, and payload emission.
- Reviewed `src/ui.ts:1892-2165` for concept button creation, dataset usage, and event handlers.
- Reviewed `src/saveloadProgressManager.ts:400-620` for serialization logic and replay order.

### Key Architectural Insights / Assumptions
- Concept selection is only valid while `pendingPhaseSelection === 'IntroIllustrate'`; handler logs and returns otherwise.
- Payload schema duplicates information in both `bubble.dataset.conceptSelectionPayload` and inner `conceptContainer.dataset.conceptPayload`; serializer/deserializer must stay aligned.
- Save/Load replays every message through `displayMessage`, so any change that bypasses this entry point will break concept-button restoration.

### Pending Clarifications Before Review (Step 6 Prep)
- Confirm whether persistence/resume scenarios are in-scope for this review or if we should focus strictly on live conversation flows.
- Determine if there is an associated functional spec or test plan we must cross-check while reviewing the HTML artifact.

### Step 4 Declaration
Core analysis complete. Execution trace, dependencies, side effects, and risks for the concept-selection path are mapped; prepared to proceed with the mandated code-review workflow for the HTML artifact.

### Step 7 Decision
Proceed directly to the specialized code-review flow (`npm run review:edit` commands) per request; no additional feature/bug protocol is triggered beyond this code review.

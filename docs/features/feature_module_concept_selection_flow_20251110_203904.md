# Feature: Module Concept Selection Flow

## Summary
Learners can now choose a specific concept within a module before starting the Teaching phase. The new flow inserts a Sensei-driven concept bubble, enforces concept selection via handler state, and propagates that choice through jumpToPhase so the first teaching plan chunk aligns with the selected concept. UI styling mirrors module buttons while saving/loading preserves pending concept picks.

## Rationale
Module selection alone forced Teaching to start at concept index 0, reducing learner agency. By adding a concept gate:
- Sensei can adapt Teaching kickoff to the learner’s interest or prior progress.
- Users gain parity with module selection (buttons, hover cues, ARIA labels), improving discoverability.
- Save/Load sessions stay coherent when paused mid-selection.

## Key Code Changes
1. `src/moduleSelectionHandler.ts`
   - Added `pendingPhaseSelection`, `pendingConceptSelectionIndex`, `pendingConceptSelectionBubbleId` to track the new workflow.
   - Introduced `showConceptSelectionBubble`, `handleConceptSelection`, and `removePhaseSelectionBubble` helpers.
   - Updated `handlePhaseSelection` / `executePhaseSelection` to gate Teaching, render loaders, and pass `{ targetConceptIndex }` into `jumpToPhase`.
2. `src/curriculum.ts`
   - `jumpToPhase` accepts an optional `targetConceptIndex` for IntroIllustrate phases and validates bounds.
3. `src/index.tsx`
   - Registered `window.handleConceptSelection`, synced new handler state fields back to globals, and wired state handoffs.
4. `src/ui.ts`
   - `displayMessage` now understands `conceptSelectionPayload`, building module-like buttons with number prefixes and stylized labels.
5. `src/index.css`
   - Added `.concept-selection-buttons` and `.concept-button` styles (pastel purple theme + hover glow), including label spans.
6. `src/saveloadProgressManager.ts`
   - Persisted pending phase/concept state and concept-bubble payload so restored sessions keep selection context.
7. Tests
   - `__tests__/moduleSelectionHandler*.test.ts` cover happy path + guard clauses (phase mismatch, invalid index) and enhancer flows.

## Behavior and UX Changes
- After clicking “Teaching,” Sensei shows a concept bubble listing each concept ("Concept N: Title") and waits for a click before generating a plan.
- Concept buttons mimic module button layout, include ARIA labels, and use the requested pastel/hover cues.
- When a concept is chosen, a user bubble echoes the choice, then the spinner bubble appears before plan generation.
- Save/Load restores any in-progress selection so users can pick up where they left off.

## Validation Evidence
- Manual run captured `[CONCEPT_SELECT] Bubble rendered/User chose concept/Jumping to concept` plus `TEACHING_PLAN_VALIDATION` entries (see `logs/console_logs.log`).
- `npm run test -- moduleSelectionHandler` covers new handler logic and enhancer integration.
- `code_review/review_module_concept_selection_flow_codex.html` documents peer review of the touched files.

## Backup and Review Artifacts
- Backup: `backup/sensei_backup_module_concept_selection_flow_20251110_163120.zip`
- Review Artifact: `code_review/review_module_concept_selection_flow_codex.html`

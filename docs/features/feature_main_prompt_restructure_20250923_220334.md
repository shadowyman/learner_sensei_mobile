# Feature: Main Sensei Prompt Restructure

- Updated the dynamic system instruction to open with the execution-directive block and to splice in the reorganized curriculum sections (`src/prompts.ts:447-490`).
- Rebuilt curriculum focus assembly so every turn still emits the `## Curriculum Focus` through `## SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE` layout, with the primary-action block and pedagogical-guidance placeholder separated ahead of those sections (`src/curriculum.ts:1538-1565`).
- Consolidation prompts follow the same section hierarchy and separator pattern (`src/consolidationManager.ts:230-253`).
- `Teaching Points` remains the active heading across prompt handling, and the check-for-understanding block is emitted separately from the chunk template body (`src/prompts.ts:261-278`, `src/curriculum.ts:1552-1556`, `src/curriculum.ts:1676-1680`).
- The pedagogical-guidance checklist input currently lives in the Socratic follow-up instruction block instead of the old prompt anchor locations (`src/interactionHelpers.ts:196-211`).

## Validation
- Static anchor verification across `src/prompts.ts`, `src/curriculum.ts`, `src/consolidationManager.ts`, and `src/interactionHelpers.ts`.
- Current `npx tsc --noEmit` is no longer a passing validation step for this repo; it now fails with broader TypeScript issues outside this document's scope.

# Item-Based Teaching Plan Prompt – Core Analysis Checkpoint (2025-10-05T18:17:48Z)

## Scope & Entry Points
- User action: `ModuleSelectionHandler.handlePhaseSelection` (moduleSelectionHandler.ts:197) when a phase is selected.
- LLM pipeline: `jumpToPhase` → `generateTeachingPlanForPhase` → `buildCombinedContentText` → inline `llmPlanner` → `llmExtractAndPlanTeachingOrder`.
- Phase advancement: `advanceCurriculumState` → `handlePhaseCompletion` → `determinePhaseTransition` (flag-gated branch for IntroIllustrate).

## Static Execution Trace (IntroIllustrate focus)
1. `ModuleSelectionHandler.handlePhaseSelection` assembles loading UI, prepares `llmPlanner`, and calls `jumpToPhase` with the selected module/phase.
2. `jumpToPhase` builds a `CurriculumItem`, computes path ID, and invokes `generateTeachingPlanForPhase`.
3. `generateTeachingPlanForPhase` pulls cached plans, then calls `buildCombinedContentText` for educational text and dispatches the inline `llmPlanner` (LLM call).
4. `buildCombinedContentText`
   - Flag **off**: includes only the active concept (`Concept Title` block).
   - Flag **on**: emits module title/goal plus a numbered `Concepts` section covering every concept.
5. Inline planner executes `llmExtractAndPlanTeachingOrder`:
   - Flag **off**: uses `GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION`.
   - Flag **on**: switches to `GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION`.
6. Returned plan is validated via `validateAndProcessTeachingPlan`, cached, and stored in curriculum state.
7. During playback, `advanceCurriculumState` tracks chunk completion; on final chunk, `handlePhaseCompletion` calls `determinePhaseTransition`.
8. `determinePhaseTransition`
   - Flag **off**: increments `currentConceptIndex` until all concepts are covered, then moves to module-wide phases.
   - Flag **on** and phase IntroIllustrate: skips concept increment and jumps straight to Socratic phase (single-shot module).

## Dependency & Side-Effect Highlights
- `ModuleSelectionHandler.handlePhaseSelection`
  - Depends on `jumpToPhase`, `llmExtractAndPlanTeachingOrder`, UI helpers, and learner-model updates.
  - Side effects: DOM mutation for loading UI, learner model/task state writes.
- `jumpToPhase`
  - Depends on `generateTeachingPlanForPhase`; writes interim curriculum item metadata.
- `generateTeachingPlanForPhase`
  - Depends on cache helpers, `buildCombinedContentText`, and inline planner (LLM call).
  - Side effects: cache writes via `setCachedTeachingPlan`.
- `buildCombinedContentText`
  - Reads curriculum/module data; new flag path aggregates all concepts in IntroIllustrate.
- `llmExtractAndPlanTeachingOrder`
  - Chooses between item-based vs archetype prompt; performs external LLM call; logs telemetry.
- `advanceCurriculumState` & `handlePhaseCompletion`
  - Mutate curriculum/learner model state while coordinating consolidation.
- `determinePhaseTransition`
  - Performs flag-aware phase/concept transitions (state writes logged via `logAdvanceValidation`).

## Risk Register & Verification Plans
| Risk | Impact | Plan |
| --- | --- | --- |
| Aggregated IntroIllustrate text may exceed model limits for modules with many/large concepts. | Medium | Construct a high-concept module scenario with flag on; ensure prompt length stays within Gemini limits and teaching plan returns valid chunks. |
| Skipping concept index advancement might break UI concept navigation or highlighting expectations. | Medium | Run module selection end-to-end with flag on; confirm UI, notepad, and progress bars behave (single concept highlighted, no navigation errors). |
| Consolidation/phase re-entry still functions with flag on. | Medium | Drive a session to completion (consume all Intro chunks, trigger advance); verify Socratic/Solidify phases initialize correctly. |

## Coverage Checklist (functions to exercise)
- moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection#b7e2eed9015f
- curriculum.ts::jumpToPhase#911293db911c
- curriculum.ts::generateTeachingPlanForPhase#be7b010f0565
- curriculum.ts::buildCombinedContentText#0944785b8a9c
- geminiService.ts::llmExtractAndPlanTeachingOrder#73a93cc254bb
- curriculum.ts::validateAndProcessTeachingPlan#460bec35bee6
- curriculum.ts::advanceCurriculumState#c830f1b134a2
- curriculum.ts::handlePhaseCompletion#819e64f1dbc1
- curriculum.ts::determinePhaseTransition#ef3546b0e9d7

## Unknowns & Assumptions
- UI flows do not invoke `navigateToConcept` when flag is active (assumed; verify during UI run-through).
- Gemini output adheres to 20-word action item requirement in item-based prompt (depends on prompt compliance; monitor logs).

## Next Protocol
- No additional protocol triggered yet; ready to resume mission with updated understanding.

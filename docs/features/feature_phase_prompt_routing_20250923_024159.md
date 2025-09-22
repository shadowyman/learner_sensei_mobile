# Phase Prompt Routing Refactor

## Summary
- Teach plan generation now consumes the explicit curriculum phase chosen in the UI, eliminating string heuristics that previously probed prompt text.
- Socratic requests always receive the dedicated Socratic prompt; every other phase defaults to the archetype planner.

## Rationale
- Phase routing is decided in the UI; carrying that signal through the planner removes brittle text scanning and ensures deterministic behaviour across phases.

## Code Changes
- `geminiService.ts:47` – `llmExtractAndPlanTeachingOrder` now requires a `phase` parameter and branches solely on that explicit value.
- `curriculum.ts:275` – `generateTeachingPlanForPhase` forwards `(phase, text)` to planner callbacks after constructing combined content.
- `moduleSelectionHandler.ts:272` – Phase selection passes the chosen phase into `llmExtractAndPlanTeachingOrder`.
- `index.tsx:395` – `createLLMPlannerCallback` now accepts `phase` and relays it to the teaching-plan extractor.

## Validation
- Verified that IntroIllustrate routes to the archetype prompt and Socratic routes to the Socratic prompt; see `logs/console_logs.log` entries at 2025-09-23 02:36:59 and 2025-09-23 02:39:16 respectively.

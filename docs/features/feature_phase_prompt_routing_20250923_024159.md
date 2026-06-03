# Phase Prompt Routing Refactor

## Summary
- Teach plan generation now consumes the explicit curriculum phase chosen in the UI, eliminating string heuristics that previously probed prompt text.
- Socratic requests always receive the dedicated Socratic prompt; every other phase defaults to the archetype planner.

## Rationale
- Phase routing is decided in the UI; carrying that signal through the planner removes brittle text scanning and ensures deterministic behaviour across phases.

## Code Changes
- `src/geminiService.ts:60-89` – `llmExtractAndPlanTeachingOrder` requires a `phase` parameter and branches on that explicit value.
- `src/moduleSelectionHandler.ts:431-442` – phase selection forwards the chosen phase into the routed teaching-plan request.
- `src/index.tsx:476-568` – `createLLMPlannerCallback` accepts `phase` and relays it into the teaching-plan extractor.
- `src/curriculum.ts:162-190` – phase-specific curriculum content is still assembled before the planner is called.

## Validation
- Current static verification confirms explicit phase plumbing across `src/geminiService.ts`, `src/moduleSelectionHandler.ts`, `src/index.tsx`, and `src/curriculum.ts`.
- The specific 2025-09-23 log timestamps cited in the original note are not present in the current `logs/console_logs.log`, but current logs still show `TEACHING_PLAN_VALIDATION` activity for IntroIllustrate flows.

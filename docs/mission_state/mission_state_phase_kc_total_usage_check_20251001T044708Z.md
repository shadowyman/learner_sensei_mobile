# Mission State – PHASE_KC_TOTAL usage check (2025-10-01 04:47:08Z)

## Analysis Scope & Entry Points
- Entry flow: `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection#5c51ca0bd43d` → inline callback `ModuleSelectionHandler.handlePhaseSelection__anon5#380a3dcb3fbe` → `geminiService.ts::llmExtractAndPlanTeachingOrder#03e82489c291`
- Normalization hot spot: inline callbacks `llmExtractAndPlanTeachingOrder__anon7#515a359c701c`, `llmExtractAndPlanTeachingOrder__anon7__anon11#5b4bb55f5f1d`, `llmExtractAndPlanTeachingOrder__anon8#fb31ba74eb9a`, `llmExtractAndPlanTeachingOrder__anon8__anon12#8ca83759c6b6`
- Supporting context: `curriculum.ts` validation pipeline (`validateAndProcessTeachingPlan`) enforces KC totals after planner returns

## Static Execution Trace
1. User selects a phase → `ModuleSelectionHandler.handlePhaseSelection` orchestrates UI state and invokes `jumpToPhase`
2. `jumpToPhase` calls `generateTeachingPlanForPhase`, which delegates to passed `llmPlanner`
3. `ModuleSelectionHandler.handlePhaseSelection__anon5` supplies `llmExtractAndPlanTeachingOrder` as planner, awaiting the LLM response
4. `llmExtractAndPlanTeachingOrder` builds prompt, calls Gemini (`ai.models.generateContent`), parses JSON, and forks on phase type
5. Non-Socratic branch maps `parsed.teaching_plan` to `transformedPlan`, computing `uniformKcValue = PHASE_KC_TOTAL / totalNumPoints`
6. Titles stripped: outer `forEach` keeps titles, inner `forEach` zeroes title KC and assigns `adjustedKcValue = PHASE_KC_TOTAL / numNonTitlePoints` to teaching points
7. The transformed plan returns to `generateTeachingPlanForPhase`, passes validation, and populates curriculum state

## Dependency & Side-Effect Table
| Function (stable id) | Key dependencies | Side effects | Risk notes |
| --- | --- | --- | --- |
| ModuleSelectionHandler.handlePhaseSelection#5c51ca0bd43d | `jumpToPhase`, `displayMessage`, `updateCurriculumDisplay`, `llmExtractAndPlanTeachingOrder` via callback, DOM (`document.querySelectorAll`) | High-volume DOM mutations, curriculum state writes, logging | Medium blast: UI updates and learner model state mutate synchronously; relies on planner resolving promptly |
| ModuleSelectionHandler.handlePhaseSelection__anon5#380a3dcb3fbe | `llmExtractAndPlanTeachingOrder`, local retry bubble teardown | Await on external planner; propagates `TeachingPlanGenerationError` | High-cost async dependency on LLM; failure surfaces as user-facing error bubble |
| llmExtractAndPlanTeachingOrder#03e82489c291 | `GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT`, `ai.models.generateContent`, JSON parsing, `PHASE_KC_TOTAL` constant | External LLM invocation, extensive logging | High cost external call; normalization math must guard against zero divisors |
| llmExtractAndPlanTeachingOrder__anon7#515a359c701c & __anon7__anon11#5b4bb55f5f1d | `parsed.teaching_plan.map` | Mutates mapped teaching point objects | Low blast; deterministic transformation based on totals |
| llmExtractAndPlanTeachingOrder__anon8#fb31ba74eb9a & __anon8__anon12#8ca83759c6b6 | `transformedPlan.forEach` | Reassigns `kcValue` per title/non-title | Medium risk if `numNonTitlePoints` miscomputed; zero KC assigned to titles |

## Risk Register
- External LLM dependency (`llmExtractAndPlanTeachingOrder`): high cost network call; failures surface as null plan → handled via `TeachingPlanGenerationError` but impacts UX
- Normalization divisor safety: `totalNumPoints <= 0` logged and aborts plan; ensures no division by zero but relies on accurate chunk counts
- KC redistribution logic: misclassification of titles would skew KC totals; current assumption equals first item per chunk title

## Coverage Checklist (functions to observe via tests/logs)
- moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection#5c51ca0bd43d
- moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection__anon5#380a3dcb3fbe
- geminiService.ts::llmExtractAndPlanTeachingOrder#03e82489c291
- geminiService.ts::llmExtractAndPlanTeachingOrder__anon7#515a359c701c
- geminiService.ts::llmExtractAndPlanTeachingOrder__anon7__anon11#5b4bb55f5f1d
- geminiService.ts::llmExtractAndPlanTeachingOrder__anon8#fb31ba74eb9a
- geminiService.ts::llmExtractAndPlanTeachingOrder__anon8__anon12#8ca83759c6b6

## Assumptions & Unknowns Register
- None open; normalization math confirmed through source inspection and analyzer trace

## Key Architectural Insights
- Teaching-plan normalization happens entirely in `geminiService.ts` before curriculum validation; downstream components consume already-normalized KC values
- Curriculum validation enforces positive KC totals, so any absence of normalization would surface as validation errors for non-title items with zero KC

## Triggering Protocol Next
- Follow-up protocol: None required beyond responding to verification request (informational outcome)

## Test Traceability Targets
- `__tests__/curriculum.test.ts` exercises plan validation paths
- `__tests__/geminiService.test.ts` can be extended to assert KC redistribution
- `tests/adaptiveEngine.functional.test.ts` observes KC accumulation using normalized teaching points

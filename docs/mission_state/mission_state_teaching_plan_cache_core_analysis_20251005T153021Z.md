# Mission State – Teaching Plan Cache Core Analysis (2025-10-05)

## Scope & Entry Points
- Primary focus: caching Gemini-generated teaching plans per module/phase to avoid redundant LLM calls.
- Hot modules surfaced by analyzer: `index.tsx`, `moduleSelectionHandler.ts`, `curriculum.ts`, `geminiService.ts`, `ui.ts`.
- Entry points driving plan generation:
  - `ModuleSelectionHandler.handlePhaseSelection` (`moduleSelectionHandler.ts`)
  - `ensureTeachingPlanExists` and `createLLMPlannerCallback` (`index.tsx`)
  - `navigateToConcept` and `jumpToPhase` (`curriculum.ts`)
  - `generateTeachingPlanForPhase` + `validateAndProcessTeachingPlan` (`curriculum.ts`)
  - `llmExtractAndPlanTeachingOrder` (`geminiService.ts`)

## Static Execution Trace
1. UI/UX trigger (phase button or concept arrow) invokes `ModuleSelectionHandler.handlePhaseSelection` or `handleConceptNavigation` → `navigateToConcept`.
2. Both paths delegate to `generateTeachingPlanForPhase`, supplying an async planner callback.
3. The planner callback (`createLLMPlannerCallback` or inline closure) calls `llmExtractAndPlanTeachingOrder` in `geminiService.ts`.
4. `llmExtractAndPlanTeachingOrder` builds the prompt, calls `ai.models.generateContent`, parses JSON, and returns `TeachingPoint[][]`.
5. `generateTeachingPlanForPhase` receives the array, logs failures, and calls `validateAndProcessTeachingPlan` for structure/KC normalization.
6. Callers (`jumpToPhase`, `navigateToConcept`, `ensureTeachingPlanExists`) store the plan on `curriculumState` and reset learner-model tracking.

## Dependency & Side-Effect Table
| Function (file:line) | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `ModuleSelectionHandler.handlePhaseSelection` (moduleSelectionHandler.ts:200) | DOM APIs, `jumpToPhase`, `llmExtractAndPlanTeachingOrder`, `displayMessage`, timers | Manipulates DOM, kicks off LLM call, updates handler state | High: UI state churn + async intervals; must ensure cache returns shape identical to live LLM output |
| `index.tsx::ensureTeachingPlanExists` (index.tsx:451) | `generateTeachingPlanForPhase`, `createLLMPlannerCallback`, `learnerModel` | Writes `curriculumState` fields and resets KC tracking | Medium: cached plan must keep chunk counts consistent with downstream logic |
| `index.tsx::createLLMPlannerCallback` (index.tsx:401) | `curriculum`, `curriculumState`, `llmExtractAndPlanTeachingOrder` | None directly | Medium: wraps Gemini call; cache layer should slot in before invoking LLM |
| `curriculum.ts::generateTeachingPlanForPhase` (curriculum.ts:332) | `buildCombinedContentText`, planner callback, `validateAndProcessTeachingPlan` | None | Medium: must short-circuit to cached array but still run validation |
| `curriculum.ts::validateAndProcessTeachingPlan` (curriculum.ts:242) | `calculateTeachingPlanMetrics`, logging, inline sanitizers | None | Low: ensures structural integrity; cached data must already be sanitized |
| `curriculum.ts::jumpToPhase` (curriculum.ts:666) | `generateTeachingPlanForPhase`, `curriculum`, `moduleSelectionHandler` state | Writes new `CurriculumState` | Medium: relies on plan matching requested phase; cache key must include phase |
| `curriculum.ts::navigateToConcept` (curriculum.ts:780) | `generateTeachingPlanForPhase`, `learnerModel`, `state` | Resets concept indices, KC stats, coverage maps | Medium: IntroIllustrate cache must be concept-specific |
| `geminiService.ts::llmExtractAndPlanTeachingOrder` (geminiService.ts:68) | `@google/genai`, teaching-plan prompts | External network call to Gemini | High: latency/cost driver; caching aims to bypass this |

## Risk Register
- Cached payload must exactly mirror `TeachingPoint[][]` shape or downstream validation/chunk navigation can break.
- Module-wide vs concept-scoped keys: collision would misalign plans and KC tracking.
- Cache invalidation strategy unspecified; stale plans after curriculum updates could desync with learner progress.

## Coverage Checklist
- `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection`
- `index.tsx::ensureTeachingPlanExists`
- `index.tsx::createLLMPlannerCallback`
- `curriculum.ts::generateTeachingPlanForPhase`
- `curriculum.ts::validateAndProcessTeachingPlan`
- `curriculum.ts::jumpToPhase`
- `curriculum.ts::navigateToConcept`
- `geminiService.ts::llmExtractAndPlanTeachingOrder`

## Unknowns & Verification Plan
| Open Question | Impact | Verification Plan | Owner |
| --- | --- | --- | --- |
| Where should the cache live (e.g., `localStorage`, IndexedDB, in-memory singleton)? | Medium | Confirm storage expectations with user; weigh persistence vs session scope. | Self – before implementation |
| When do we invalidate cached plans (module edits, learner resets, manual refresh)? | High | Propose invalidation heuristics and validate against product requirements. | Self – before implementation |
| How to handle cache miss while Gemini fails (store partial/error state?) | Medium | Review existing error handling in `generateTeachingPlanForPhase`; ensure cache write occurs only on success. | Self – during design |

## Architectural Insights
- `curriculumPathId` already captures module/phase/concept granularity; ideal cache key with no schema changes.
- Plan consumers always read from `curriculumState.teachingPlanForPhase`, so returning cached arrays keeps execution flow unchanged after validation.
- `llmExtractAndPlanTeachingOrder` outputs already-normalized KC values; caching at the planner level avoids duplicating validation.

## Next Protocol
- User requested no additional protocols after Core Analysis. Remaining work will proceed once requirements are clarified.

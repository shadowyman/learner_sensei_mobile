# Mission State – Chunk completion title filtering (2025-10-01 05:08:28Z)

## Analysis Scope & Entry Points
- Entry functions: `index.tsx::generateNextSenseiResponse#159f9a0d9f1b` → `adaptiveEngine.ts::updateLearnerModel#24dc3eaf9296` → `curriculum.ts::advanceCurriculumState#c830f1b134a2`
- Focus modules: `curriculum.ts` (advance + focus logic), `adaptiveEngine.ts` (coverage tracking), `index.tsx` (orchestration)
- Ancillary functions: `curriculum.ts::calculateFocusPoints#62d9f38f674d`, `index.tsx::calculateFocusStrategy#17908`

## Static Execution Trace
1. `generateNextSenseiResponse` gathers current chunk texts and calls `updateLearnerModel`
2. `updateLearnerModel` tallies understanding per teaching point and mutates `coveredPointsInCurrentChunk`
3. `advanceCurriculumState` checks `currentChunkTeachingPoints.every(tp => coveredPointsInCurrentChunk.has(tp.text))`
4. If gating, `calculateFocusStrategy` invokes `calculateFocusPoints`, which filters uncovered texts via `!coveredPointsInCurrentChunk.has(text)`
5. Resulting focus set influences Sensei directives and determines chunk advancement or gating

## Dependency & Side-Effect Table
| Function | Key dependencies | Side effects | Risk notes |
| --- | --- | --- | --- |
| `generateNextSenseiResponse` | `getCurrentCurriculumItem`, `updateLearnerModel`, `advanceCurriculumState`, `calculateFocusStrategy` | Updates curriculum + learner model state, drives UI rendering | High coordination hub; mis-synced state sets surface immediately to learners |
| `updateLearnerModel` | `expectedContentPointTextsForCurrentChunk`, Gemini `analysis.key_content_point_assessment` | Mutates `coveredPointsInCurrentChunk`, `pointsToRevisit`, KC scores | Relies on LLM assessments; titles (kcValue 0) still included in expected texts |
| `advanceCurriculumState` | `state.teachingPlanForPhase`, `coveredPointsInCurrentChunk`, `pointsToRevisitInCurrentChunk` | Clears coverage sets, increments chunk index, logs gating | Uses `every(tp.text ...)` with no KC filtering, so 0-KC titles cause permanent gating |
| `calculateFocusPoints` | `state.teachingPlanForPhase`, `coveredPointsInCurrentChunk`, `pointsToRevisitInCurrentChunk` | Pure | Produces focus lists including any uncovered text; currently includes title strings |

## Risk Register
- **Chunk advancement deadlock**: Title texts (kcValue 0) never added to `coveredPointsInCurrentChunk` → `allPointsCovered` stays false → `advanceCurriculumState` never progresses (High impact, Medium likelihood)
- **Guidance drift**: `calculateFocusPoints` highlights title strings as “Teach New Content,” misdirecting Sensei prompts (Medium impact, High likelihood)
- **Points-to-revisit noise**: Titles enter `expectedContentPointTextsForCurrentChunk`, so revisit queues may accumulate non-instructional strings if assessments reference them (Medium impact, Low likelihood)

## Coverage Checklist
- `index.tsx::generateNextSenseiResponse#159f9a0d9f1b`
- `adaptiveEngine.ts::updateLearnerModel#24dc3eaf9296`
- `curriculum.ts::advanceCurriculumState#c830f1b134a2`
- `curriculum.ts::calculateFocusPoints#62d9f38f674d`

## Unknowns & Verification Plans
- Do Gemini assessments ever reference title text verbatim? (Impact: Medium) → Inspect real teaching plan samples or capture logs from `kcAssessmentSummary.coverage` payloads.
- Are there existing safeguards that pre-populate `coveredPointsInCurrentChunk` with title text? (Impact: High) → Search code/tests for routines adding titles to coverage beyond override path; confirm none exist.

## Key Architectural Insights
- Teaching-plan normalization ensures titles carry `kcValue` 0 but remain in chunk arrays; downstream logic must treat them as metadata.
- Progression gating and focus generation rely on text equality with `coveredPointsInCurrentChunk`; any non-instructional entries in the chunk list must be filtered explicitly to prevent stalling.

## Next Protocol
- Execute **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** (bug investigation, no fix attempted yet).

## Test Traceability Targets
- `tests/adaptiveEngine.functional.test.ts` (chunk progression scenarios)
- `__tests__/curriculum.test.ts` (advance + focus calculations)
- Potential new coverage: regression reproducing uncovered title stalling

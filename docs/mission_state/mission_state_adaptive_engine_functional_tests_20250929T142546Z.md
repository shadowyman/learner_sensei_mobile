# Mission State: Adaptive Engine Functional Tests (2025-09-29T14:25:46Z)

## Scope & Entry Points
- Focus functions in `adaptiveEngine.ts`: `initializeLearnerModel`, `dynamicCategoricalUpdate`, `mapAnalysisValue`, `updateLearnerModel`, `updateKC`, `updateMisconception`, `findBestMatchingContentPoint`, `overrideChunkUnderstanding`, and helper logging via `logAdaptiveValidation`.
- Supporting structures and enumerations in `curriculum.ts` governing `CurriculumState`, teaching points, and phase KC bookkeeping.
- External touchpoints: `logger.ts` for warnings, `index.tsx`/`ui.ts` bridging override hooks, and global `window.updateKCProgressBar` side effect during KC awards.
- Hot modules by fan-in: `logger.ts` (21), `curriculum.ts` (11), `adaptiveEngine.ts` (10). High fan-out orchestrators include `index.tsx` (18) and `ui.ts` (8), indicating integration test focus after functional coverage.

## Static Execution Trace
1. `initializeLearnerModel` seeds baseline KC, misconception priors, affective/cognitive defaults, session timers, and initializes `awardedKcForPhasePoints` Set.
2. `dynamicCategoricalUpdate` converts categorical states to numeric weights, applies asymmetrical averaging, and clamps back to categorical values.
3. `updateLearnerModel`
   - Clones the current model, upgrades `awardedKcForPhasePoints` back into a `Set`, and stamps `LastUserInput`, `LastAnalysis`, and `TotalTimeOnTask`.
   - When analysis exists: maps "Uncertain" affective inputs via `mapAnalysisValue`, updates affective/cognitive/SRL states through `dynamicCategoricalUpdate`, filters `StrategyUse`, adjusts misconceptions through `updateMisconception`, and updates non-phase KCs and target KCs via `updateKC`.
   - Builds/updates `contentPointsCoverage`, ensures phase KC initialization in curriculum-aware paths, processes `key_content_point_assessment` via `findBestMatchingContentPoint`, awards phase KC deltas through `updateKC`, mutates curriculum coverage sets, and emits `logAdaptiveValidation` summaries while warning on unmatched IDs.
   - Handles null-analysis fallback: scans user text for confusion/mastery keywords to adjust affective state and SRL trajectories.
   - Adjusts ZPD estimate using recent trajectory/affective signals.
4. `overrideChunkUnderstanding` validates chunk bounds, ensures coverage maps and awarded set, forces understanding scores to 0/1, updates KC totals and timestamps, syncs curriculum coverage/revisit sets, and warns when chunk data is missing.
5. `logAdaptiveValidation` relays aggregated payloads to the logger for observability.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk Level | Verification Plan |
| --- | --- | --- | --- | --- |
| `initializeLearnerModel` | `MISCONCEPTION_IDS`, `Date` | None (pure object creation) | Low | TC-01 validates seeded structure and defaults. |
| `dynamicCategoricalUpdate` | `THREE_LEVEL_MAP`, `FOUR_LEVEL_MAP`, reverse maps | None (pure computation) | Low | TC-02, TC-03, TC-04 cover weighted behavior and fallback. |
| `mapAnalysisValue` | None | None | Low | TC-06 confirms fallback reuse. |
| `updateKC` | `Date`, `Math` clamps | Writes `model.KCs`, `model.KCMasteryLastUpdated` | Medium | TC-15, TC-16, TC-17, TC-19 ensure delta/clamping behavior. |
| `updateMisconception` | None | Writes `model.Misconceptions` | Medium | TC-12, TC-13, TC-14 verify adjustments and ignored IDs. |
| `findBestMatchingContentPoint` | `normalizeContentPointText`, `calculateStringSimilarity` | None | Medium | TC-18, TC-19, TC-21 rely on matching outcomes; instrumentation captured via assertions. |
| `updateLearnerModel` | Depends on helpers above, `logger`, `curriculumState` shape, window hooks | Writes majority of learner model, curriculum coverage sets, emits logs | High | TC-05 through TC-24 exercise each branch (time-on-task, affective fallback, misconceptions, KC awards, coverage, ZPD). |
| `overrideChunkUnderstanding` | Curriculum teaching plan, Set utilities, `logger` | Mutates learner model KCs/timestamps, coverage sets, awarded set; warns on invalid indices | High | TC-25, TC-26 cover invalid and valid overrides incl. KC delta. |
| `logAdaptiveValidation` | `logger.logAdaptiveValidation` channel | Logging only | Low | TC-22 ensures emission when assessments processed. |

## Risk Register
- High: `updateLearnerModel` stateful mutations may regress learner tracking. Verification: TC-05–TC-24 plus targeted assertions on `contentPointsCoverage`, `awardedKcForPhasePoints`, ZPD outcomes.
- High: `overrideChunkUnderstanding` can misalign KC mastery and coverage sets. Verification: TC-25 (invalid guard) and TC-26 (override delta, set maintenance).
- Medium: `updateKC` clamping boundaries; cross-check via TC-15/TC-16 to ensure no negative overflow.
- Medium: `findBestMatchingContentPoint` fuzzy matching threshold may misclassify; monitored via TC-19/TC-21 with explicit assertions on warning/log output.

## Coverage Checklist
- `initializeLearnerModel`
- `dynamicCategoricalUpdate`
- `mapAnalysisValue`
- `updateLearnerModel` (all numbered branches 1-5c, null-analysis branch, ZPD updates)
- `updateKC` and `updateMisconception`
- `findBestMatchingContentPoint` and `calculateStringSimilarity`
- `overrideChunkUnderstanding`
- `logAdaptiveValidation`

## Unknowns Register
- Handling of `Date.now()` and ISO timestamps in tests (Impact: Medium). Plan: inject deterministic `SessionStartTime` and stub `Date.now` per test to assert `TotalTimeOnTask` and timestamp updates.
- Access to global `window.updateKCProgressBar` (Impact: Low). Plan: provide minimal stub on global `window` within relevant tests to prevent ReferenceErrors.
- Logger output assertions (Impact: Low). Plan: mock `logger.warn` and `logAdaptiveValidation` to capture invocations without requiring real logging backend.

## Key Architectural Insights
- Learner model cloning via JSON serialization removes `Set` instances; reconstruction at start of `updateLearnerModel` is critical and must be validated to avoid regression.
- Curriculum coverage tracking hinges on parallel `contentPointsCoverage` map and `coveredPointsInCurrentChunk`/`pointsToRevisitInCurrentChunk` sets; tests must inspect both to verify consistency.
- Phase KC awards use high-water mark logic combined with teaching point `kcValue`; verifying delta calculations safeguards curriculum progression pacing.

## Triggering Protocol
Next required protocol: **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** following successful core analysis.

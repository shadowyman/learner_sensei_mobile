# Mission State – Chunk Understood Checkbox Reset (2025-11-09T21:49:55Z)

## Scope & Entry Points
- `src/ui.ts::updateSenseiMeditationOverlay#32110ed09425` renders the header dropdown chunk cards, wires the “Understood” checkbox, and drives modal confirmations.
- The checkbox change handler `src/ui.ts::updateSenseiMeditationOverlay__anon6__anon69#7abca728f8ac` gates calls into core state overrides and optional concept advancement.
- `src/index.tsx::window.overrideChunkUnderstanding` hands UI intent to the adaptive engine, then re-syncs the KC progress bar, curriculum status, and overlay.
- `src/adaptiveEngine.ts::overrideChunkUnderstanding#1de8255f6699` updates per-point coverage plus KC mastery for the current `curriculumPathId`, which ultimately feeds the progress bar.

Hot modules from analyzer fan-in/out relevant to this flow: `src/index.tsx`, `src/ui.ts`, `src/adaptiveEngine.ts`, `src/curriculum.ts`.

## Static Execution Trace
1. `updateSenseiMeditationOverlay` builds chunk cards, computing each chunk’s understood state from `learnerModel.contentPointsCoverage`.
2. The checkbox change handler stops propagation, optionally shows `showChunkResetConfirmation` before allowing a deselect, and if selecting all chunks checks `areAllChunksUnderstood`, `getLoadedCurriculum`, and `showConceptAdvanceConfirmation`.
3. Handler calls `window.overrideChunkUnderstanding({ chunkIndex, understood })`. When setting true it may also call `window.advanceConceptFromChunk`.
4. `window.overrideChunkUnderstanding` validates state, calls `overrideChunkUnderstanding(learnerModel, curriculumState, currentItem, chunkIndex, understood)`, then refreshes `updateKCProgressBar`, `updateCurriculumDisplay`, and `updateSenseiMeditationOverlay`.
5. `overrideChunkUnderstanding` loops the chunk’s teaching points, forcing each point’s `understanding_score` to either 1 or 0, accumulating KC delta by `kcValue`, and writing the updated mastery back to `learnerModel.KCs[currentItem.curriculumPathId]`.
6. UI observers (`updateKCProgressBar`, `updateCurriculumDisplay`, overlay refresh) consume the new mastery and repaint, so any downward KC delta immediately zeroes the progress bar if the chunk carried the entire remaining mastery weight.

## Dependency & Side-Effect Table
| Function (stable id) | Key dependencies | Side effects | Risk |
| --- | --- | --- | --- |
| `updateSenseiMeditationOverlay#32110ed09425` | `curriculumState`, `(window as any).learnerModel`, `meditationHoverState`, `window.switchToChunk` | Rebuilds overlay DOM, toggles `meditationHoverState`, attaches checkbox listeners | Medium |
| Checkbox change handler `updateSenseiMeditationOverlay__anon6__anon69#7abca728f8ac` | `showChunkResetConfirmation`, `areAllChunksUnderstood`, `getLoadedCurriculum`, `showConceptAdvanceConfirmation`, `window.overrideChunkUnderstanding`, `window.advanceConceptFromChunk`, `logger` | Mutates checkbox state, triggers overrides and concept navigation | High |
| `showChunkResetConfirmation#3b78556ef3a5` | `showModalPrompt` | Creates modal DOM nodes until resolved | Low |
| `showConceptAdvanceConfirmation#b19c7378fec9` | `showModalPrompt` | Creates confirmation modal | Low |
| `areAllChunksUnderstood#1bb87ac0dd8b` | `curriculumState.teachingPlanForPhase`, `learnerModel.contentPointsCoverage` | Pure calculation | Low |
| `src/index.tsx::window.overrideChunkUnderstanding` | `curriculum`, `curriculumState`, `getCurrentCurriculumItem`, `overrideChunkUnderstanding`, `updateKCProgressBar`, `updateCurriculumDisplay`, `updateSenseiMeditationOverlay` | Invokes adaptive override, refreshes KC bar, curriculum status, overlay | High |
| `overrideChunkUnderstanding#1de8255f6699` | `curriculumState.teachingPlanForPhase`, `learnerModel.contentPointsCoverage`, `curriculumItem.curriculumPathId` | Rewrites per-point coverage, awarded KC set, `learnerModel.KCs`, chunk coverage sets | High |
| `updateKCProgressBar#964b153da2d3` | DOM via `document.getElementById`, `progressFill`, `progressText` | Animates KC progress elements | Medium |
| `updateCurriculumDisplay#11f129028112` | `getPhaseDisplayName`, `setStatusLines`, `window.updateKCProgressBar`, DOM | Writes `window.curriculumState`, updates header, triggers progress sync | Medium |

## Risk Register
- `overrideChunkUnderstanding#1de8255f6699`: Directly rewrites `learnerModel.KCs[phase]`; any misuse zeroes the concept-level mastery (High blast).
- `window.overrideChunkUnderstanding` (src/index.tsx:276): Couples user toggles to adaptive writes and re-renders; missing guards could desync UI vs model (High).
- Checkbox change handler `updateSenseiMeditationOverlay__anon6__anon69#7abca728f8ac`: Can advance or reset concepts without extra confirmation if logic regresses (High).

## Coverage Checklist
- `src/ui.ts::updateSenseiMeditationOverlay#32110ed09425`
- `src/ui.ts::updateSenseiMeditationOverlay__anon6__anon69#7abca728f8ac`
- `src/ui.ts::showChunkResetConfirmation#3b78556ef3a5`
- `src/ui.ts::showConceptAdvanceConfirmation#b19c7378fec9`
- `src/ui.ts::areAllChunksUnderstood#1bb87ac0dd8b`
- `src/index.tsx::window.overrideChunkUnderstanding`
- `src/adaptiveEngine.ts::overrideChunkUnderstanding#1de8255f6699`
- `src/index.tsx::updateKCProgressBar#964b153da2d3`
- `src/ui.ts::updateCurriculumDisplay#11f129028112`

## Unknowns & Verification Plans
- **Scope of `curriculumPathId` (concept vs module)** – Impact: Medium. **Resolution**: Inspected `src/curriculum.ts:760-783`, confirming IDs encode module id + concept + phase, so overrides target the current concept-phase rather than entire module. No remaining action.

## Key Architectural Insights
- KC mastery is tracked per `curriculumItem.curriculumPathId`; the KC progress bar simply normalizes that phase-specific value by dividing by 0.65 inside `updateKCProgressBar`.
- `overrideChunkUnderstanding` computes KC deltas as the sum of per-point `kcValue` for the chunk, so deselecting a chunk subtracts the entire accumulated KC contribution, often dropping mastery to 0 if that chunk previously carried all awarded points.
- The meditation overlay re-renders immediately after overrides, so any mismatch between chunk state and learnerModel surfaces instantly in the UI.

## Next Protocol
Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL.

## Test Traceability Targets
- UI surface: `src/ui.ts` (overlay rendering, header status).
- State orchestration: `src/index.tsx` (window glue, KC bar updates).
- Adaptive logic: `src/adaptiveEngine.ts` (KC mastery math).

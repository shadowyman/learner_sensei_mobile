# Mission State – header_chunk_status_append (2025-09-25 04:00:56 UTC)

- **Entry Point & Scope**: `ui.ts:updateCurriculumDisplay` with focus on the nested `setStatusLines`, supporting helpers (`getPhaseDisplayName`, `updateConceptNavigationArrowsUI`), and `curriculum.ts:CurriculumState` structure for chunk indices.
- **Static Execution Trace**: `updateCurriculumDisplay` → `setStatusLines` → `getPhaseDisplayName` → (`window.updateKCProgressBar` when learner data exists) → shimmer animation block → `updateConceptNavigationArrowsUI`.

| Function | Key Dependencies | Side Effects |
| --- | --- | --- |
| `updateCurriculumDisplay` | `curriculumStatusTopic`, `window.curriculumState`, `getPhaseDisplayName`, `appCurriculumState.teachingPlanForPhase`, `window.updateKCProgressBar`, `updateConceptNavigationArrowsUI` | Updates global curriculum state reference, rebuilds header DOM nodes, toggles CSS class with timeout, drives KC progress sync and navigation visibility |
| `setStatusLines` (inner closure) | `curriculumStatusTopic`, option tooltips, concept metadata | Clears and repopulates status DOM spans, applies tooltips |
| `getPhaseDisplayName` | Phase enum mapping | None |
| `updateConceptNavigationArrowsUI` | Navigation button elements, curriculum state, curriculum modules | Shows/hides arrows and sets disabled states based on indices |

- **Key Insights**:
  - Header status is rebuilt on every call using dynamically created spans, so chunk progress must be appended within the existing `phaseLine` without introducing extra blocks.
  - Active chunk data lives in `CurriculumState.currentTeachingChunkIndex` and `CurriculumState.teachingPlanForPhase.length`, already exposed globally for the meditation overlay and safe to reuse.
- **Next Protocol**: Comprehensive Impact Analysis Protocol.

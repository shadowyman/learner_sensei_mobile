Title: Immediate Socratic Completion Transition

Summary
- End Socratic phase immediately when completion flag is detected in Sensei’s response, then initialize the next pedagogical phase with a fresh teaching plan. Also timestamp KC mastery when awarding Socratic mastery.

Rationale
- Previously, after detecting [SOCRATIC_COMPLETION_TRIGGERED: …], the system awarded mastery but did not transition out of Socratic, relying on chunk gating that never completes for this phase. This caused phase lock. The fix centralizes completion handling to perform cleanup, transition, and next-phase initialization in the same turn.

Acceptance Criteria
- When the completion flag is present, the system:
  - Awards Socratic phase KC and updates KCMasteryLastUpdated for that KC ID.
  - Clears Socratic state and transitions to the next phase (typically Solidify) immediately.
  - Initializes a new teaching plan for the next phase (llmPlanner invoked once).
  - Emits logs showing [SOCRATIC_COMPLETION_VALIDATION] followed by [ADVANCE_VALIDATION] phase-state-initialized.

Key Code Changes
- curriculum.ts:932
  - Award KC and update learnerModel.KCMasteryLastUpdated[phaseKCId].
- curriculum.ts:945
  - Reworked processSocraticPendingCompletion(...) to async. Performs: award KC, log, clear Socratic state, cleanupCompletedPhase(...), determinePhaseTransition(...), initializeNewPhaseState(...). Returns true when advanced or completed.
- curriculum.ts:989
  - handleSocraticPhase(...) now awaits processSocraticPendingCompletion(...) and passes llmPlanner, enabling immediate next-phase plan generation.

Behavioral Impacts
- Socratic completion now advances the curriculum within the same user turn; users seamlessly continue into the next phase without requiring additional input or chunk gating.
- KC telemetry becomes consistent due to timestamp updates at the moment of Socratic mastery.
- Non-Socratic phases are unaffected; IntroIllustrate navigation and consolidation behavior remain unchanged.

Validation Evidence
- Expected log sequence on completion:
  - [SOCRATIC_COMPLETION_VALIDATION] event: 'completed', with curriculumPathId, turnsTaken, expectedTurns.
  - [ADVANCE_VALIDATION] event: 'phase-state-initialized' for the new phase (teachingPlanChunks present).
- Manual check: trigger a Socratic completion reply from Sensei; confirm phase indicator and teaching plan refresh to next phase.

Operational Notes
- The transition relies on existing determinePhaseTransition(...) logic; if curriculum ends, state.isCompleted is set and the function returns true.
- No changes to UI components were required; downstream code already reacts to state changes and generated plans.

Artifacts
- Backup: backup/sensei_backup_fix_socratic_completion_transition_20250925_055957.zip
- Review: code_review/review_fix_socratic_completion_transition.html


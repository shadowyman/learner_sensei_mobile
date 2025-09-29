Title: Core Analysis – curriculum.ts (Scope: curriculum and dependencies)
Timestamp: 2025-09-25 05:47:24

Scope and Entry Points
- Primary module: curriculum.ts
- Key exports: generateTeachingPlanForPhase, initializeCurriculumState, jumpToPhase, navigateToConcept, advanceCurriculumState, getCurrentCurriculumItem, getCurriculumFocusInstruction, calculateFocusPoints, checkForSocraticCompletion, parseModulesTxt, types and constants
- Direct dependencies: logger.ts, adaptiveEngine.ts (types), consolidationManager.ts, prompts.ts

Static Execution Traces (high-level)
- Teaching plan: buildCombinedContentText -> llmPlanner -> validateAndProcessTeachingPlan -> calculateTeachingPlanMetrics
- Init: initializeCurriculumState -> generateTeachingPlanForPhase -> return initial CurriculumState
- Phase jump: jumpToPhase -> generateTeachingPlanForPhase -> build new CurriculumState
- Concept nav: navigateToConcept -> generateTeachingPlanForPhase -> reset state and learnerModel fields
- Advancement: advanceCurriculumState -> handleSocraticPhase -> getCurrentCurriculumItem -> chunk gate/advance or handlePhaseCompletion -> (mastery) cleanupCompletedPhase -> determinePhaseTransition -> initializeNewPhaseState; (no mastery) initiateConsolidation/advanceConsolidationStage
- Focus instruction: getCurriculumFocusInstruction -> buildEarlyReturnInstruction -> calculateFocusPoints -> buildPrimaryActionInstruction -> buildContextualInstruction
- Parsing: parseModulesTxt -> extractModuleSegments -> parseModuleGoal -> parseModuleConcepts -> parseModuleMethodology -> parseSocraticAndSolidifyContent -> validateParsedModule

Dependencies & Side Effects (summary)
- llmPlanner: async, external model call (high cost)
- logger: info/warn/error across validation and transitions
- consolidationManager: initiateConsolidation, advanceConsolidationStage, getConsolidationFocusInstruction
- adaptiveEngine types: LearnerModel; state mutated in navigation/advancement

Architectural Insights
- Phases: concept-phase [IntroIllustrate] then module-phases [Socratic, Solidify]
- CurriculumPathId controls KC tracking and mastery gating per phase
- Consolidation loop runs when mastery below threshold

Triggering Next Protocol
- Proceed to defect identification using this checkpoint.


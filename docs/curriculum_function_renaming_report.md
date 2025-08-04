# Curriculum.ts Function Renaming Analysis Report

**Analysis Date:** 2025-06-28  
**Target File:** `curriculum.ts`  
**Total Functions Analyzed:** 17  
**Mission Directive:** Rename functions to fully represent their actual responsibilities using descriptive names with 'And' connectors for multi-responsibility functions.

---

## Executive Summary

The analysis reveals that **12 out of 17 functions** (71%) have multiple core responsibilities that warrant more descriptive names. The current naming convention often obscures the complex logic these functions perform, particularly around state management, LLM integration, and validation workflows.

---

## Function Renaming Recommendations

### 1. Global State Management Functions

| **Current Name** | **Proposed Name** | **Rationale** |
|------------------|-------------------|---------------|
| `setCurriculum` | `storeParsedCurriculumGlobally` | Clarifies that it stores in global variable, not just "sets" |
| `isCurriculumLoaded` | `checkIfCurriculumExistsInMemory` | More descriptive about what "loaded" means |
| `getLoadedCurriculum` | `retrieveStoredCurriculumFromMemory` | Consistent with storage terminology |

### 2. Complex Multi-Responsibility Functions

| **Current Name** | **Proposed Name** | **Multiple Responsibilities** |
|------------------|-------------------|-------------------------------|
| `generateTeachingPlanForPhase` | `buildPhaseContentAndGenerateLLMTeachingPlanAndValidateResults` | 1) Build content text based on phase type<br/>2) Make LLM API calls for plan generation<br/>3) Validate and log teaching plan results<br/>4) Calculate KC values and statistics |
| `parseModulesTxt` | `parseModuleHeadersAndExtractSectionsAndValidateData` | 1) Parse module headers using regex<br/>2) Extract goals, concepts, methodology sections<br/>3) Validate parsed data and log errors<br/>4) Reset regex lastIndex properties |
| `initializeCurriculumState` | `validateCurriculumDataAndCreateInitialItemAndGenerateTeachingPlanAndBuildState` | 1) Validate curriculum data and start parameters<br/>2) Create initial curriculum item structure<br/>3) Generate teaching plan via LLM call<br/>4) Build initial state object with defaults |
| `jumpToPhase` | `validatePhasePrerequisitesAndDetermineStateAndCreateItemAndGenerateTeachingPlan` | 1) Validate target phase prerequisites<br/>2) Determine state based on phase type<br/>3) Create curriculum item for phase<br/>4) Generate teaching plan and build new state |

### 3. State Management and Validation Functions

| **Current Name** | **Proposed Name** | **Multiple Responsibilities** |
|------------------|-------------------|-------------------------------|
| `getCurrentCurriculumItem` | `validateStateAndDeterminePhaseTypeAndBuildCurriculumItemAndLogDebugInfo` | 1) Validate state and module bounds<br/>2) Determine concept vs module-wide logic<br/>3) Build curriculum item structure<br/>4) Log detailed debugging information |
| `handlePhaseCompletion` | `checkMasteryThresholdAndDetermineTransitionAndResetStateAndGenerateTeachingPlanAndManageConsolidation` | 1) Check mastery threshold against KC values<br/>2) Determine next phase transition logic<br/>3) Reset state for new phase<br/>4) Generate teaching plan for advanced phase<br/>5) Handle consolidation state management |
| `advanceCurriculumState` | `handleSocraticCasesAndCheckChunkCompletionAndAdvanceProgressAndTrackInteractions` | 1) Handle Socratic special cases<br/>2) Check chunk completion status<br/>3) Advance to next chunk or phase<br/>4) Track interaction counters and progress |

### 4. Socratic Phase Management Functions

| **Current Name** | **Proposed Name** | **Multiple Responsibilities** |
|------------------|-------------------|-------------------------------|
| `handleSocraticPhase` | `processPendingCompletionsAndHandleFallbackAndAwardKCValuesAndClearSocraticState` | 1) Process pending Socratic completions<br/>2) Handle fallback completion at 2x turns<br/>3) Award phase KC values to learner model<br/>4) Clear Socratic state and trigger advancement |
| `checkForSocraticCompletion` | `detectCompletionFlagsWithRegexAndExtractTriggersAndCleanResponseAndLogResults` | 1) Use regex to detect completion flags<br/>2) Extract trigger information from flags<br/>3) Clean response by removing completion markers<br/>4) Log completion detection results |

### 5. Instruction Generation Functions

| **Current Name** | **Proposed Name** | **Multiple Responsibilities** |
|------------------|-------------------|-------------------------------|
| `getCurriculumFocusInstructionImpl` | `handleConsolidationModeAndCalculateFocusPointsAndGeneratePhaseInstructionsAndBuildContextString` | 1) Handle consolidation vs normal instruction modes<br/>2) Calculate or use pre-calculated focus points<br/>3) Generate phase-specific instruction templates<br/>4) Build comprehensive instruction string with context |
| `calculateFocusPoints` | `determinePriorityAndFilterPointsByStatusAndAssignActionTypesAndHandleSpecialCases` | 1) Determine teaching point priority (revisit vs new vs reinforce)<br/>2) Filter points based on covered/uncovered status<br/>3) Assign appropriate action types<br/>4) Handle consolidation and empty chunk cases |

### 6. Utility and Migration Functions

| **Current Name** | **Proposed Name** | **Multiple Responsibilities** |
|------------------|-------------------|-------------------------------|
| `migratePhaseIfNeeded` | `migrateOldPhaseNamesAndValidateAndLogDebugInfo` | 1) Migrate old phase names to new format<br/>2) Validate phase names against allowed values<br/>3) Log debug information for invalid phases |
| `getInitialCurriculumTopicId` | `checkCurriculumValidityAndGenerateFallbackOrBuildStandardizedTopicId` | 1) Check curriculum data validity<br/>2) Generate fallback ID if invalid<br/>3) Build standardized topic ID from first concept |

### 7. Simple Wrapper Functions

| **Current Name** | **Proposed Name** | **Rationale** |
|------------------|-------------------|---------------|
| `getCurriculumFocusInstruction` | `callCurriculumFocusInstructionImplementation` | Simple wrapper - name clarifies it just calls implementation |

---

## Implementation Impact Analysis

### **High-Impact Renames** (Require extensive refactoring)
- `generateTeachingPlanForPhase` → Used in 3+ locations
- `advanceCurriculumState` → Core state management function
- `getCurrentCurriculumItem` → Used throughout system
- `handlePhaseCompletion` → Critical progression logic

### **Medium-Impact Renames** (Moderate refactoring)
- `parseModulesTxt` → Single usage point but complex
- `initializeCurriculumState` → Initialization function
- `jumpToPhase` → Phase navigation function

### **Low-Impact Renames** (Minimal refactoring)
- Global state functions (`setCurriculum`, `isCurriculumLoaded`, `getLoadedCurriculum`)
- Utility functions (`migratePhaseIfNeeded`, `getInitialCurriculumTopicId`)
- Wrapper functions (`getCurriculumFocusInstruction`)

---

## Recommendations for Implementation

1. **Phased Rollout:** Implement renames in dependency order (utilities first, core functions last)
2. **Comprehensive Testing:** Each rename requires full integration testing
3. **Documentation Updates:** Update all inline documentation and external references
4. **Code Review:** Multiple reviewer approval for high-impact renames

---

## Conclusion

The proposed renames transform opaque function names into self-documenting code that clearly communicates each function's full responsibility scope. While the names are longer, they eliminate the need to read function internals to understand behavior, significantly improving code maintainability and developer onboarding experience.

**Total Functions Requiring Rename:** 17/17 (100%)  
**Multi-Responsibility Functions:** 12/17 (71%)  
**Average Name Length Increase:** ~3.2x (from ~22 chars to ~70 chars)  
**Maintainability Improvement:** High (self-documenting code)
# Debug Logs to Remove from Sensei Codebase

This document lists all intermediary debug logs that should be removed from the codebase. These logs were added for feature debugging and validation but are not needed for system execution trace.

## index.tsx

**Line 174:**
```typescript
logger.log("Manifest status:", manifestStatusMessage || "Manifest processed.");
```

**Line 348:**
```typescript
logger.log("Updated Learner Model:", JSON.stringify(learnerModel, null, 2));
```

**Line 351:**
```typescript
logger.log("After Learner Model Update - Covered Points in Current Chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
```

**Line 352:**
```typescript
logger.log("After Learner Model Update - Points to Revisit in Current Chunk (text):", Array.from(curriculumState.pointsToRevisitInCurrentChunk || new Set()));
```

**Line 377:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] Curriculum not advanced this turn');
```

**Line 425:**
```typescript
logger.log("Pedagogical Guidance Directive:", guidanceText);
```

**Line 426:**
```typescript
logger.log("Focus Points being used:", upcomingActionItems);
```

**Line 427:**
```typescript
logger.log("Focus Points Type:", focusPointsData?.primaryActionType || "None");
```

**Line 506:**
```typescript
logger.log(`After Sensei Response - Processing Chunk ${curriculumState.currentTeachingChunkIndex + 1} of ${curriculumState.teachingPlanForPhase.length || 1}.`);
```

**Line 508:**
```typescript
logger.log(`Content of current chunk (TeachingPoint objects):`, curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]);
```

**Line 510:**
```typescript
logger.log("Topics Covered in current chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
```

**Line 736:**
```typescript
logger.info('[PHASE_LOADING] Total message bubbles found:', phaseMessages.length);
```

**Line 745:**
```typescript
logger.debug(`[PHASE_LOADING] Message ${index} - ID: ${bubbleId}, has phase buttons: ${hasPhaseButtons}`);
```

**Line 750:**
```typescript
logger.info('[PHASE_LOADING] Found phase message bubble with ID:', phaseMessageId);
```

**Line 755:**
```typescript
logger.info('[PHASE_LOADING] Transforming phase message to loading state');
```

**Line 759:**
```typescript
logger.debug('[PHASE_LOADING] Found message-text element, clearing content');
```

**Line 792:**
```typescript
logger.info('[PHASE_LOADING] Loading animation added successfully');
```

**Line 916:**
```typescript
logger.debug('[PHASE_CURSOR_CLEANUP] Removing cursor from phase intro message');
```

## geminiService.ts

**Line 57:**
```typescript
logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Text sent to LLM for planning:", {textToProcess});
```

**Line 58:**
```typescript
logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Prompt sent to LLM:", prompt);
```

**Line 62:**
```typescript
logger.log("DEBUG: Teaching Plan Original Prompt:", prompt);
```

**Line 76:**
```typescript
logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Raw JSON response from LLM:", jsonText);
```

**Line 88:**
```typescript
logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Parsed teaching_plan object:", parsed);
```

**Line 134:**
```typescript
logger.log(`DEBUG: llmExtractAndPlanTeachingOrder - Validated and transformed teaching_plan. Total points: ${totalPoints}`, transformedPlan);
```

## curriculum.ts

**Line 137:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Generating teaching plan for module-wide phase:', phase);
```

**Line 138:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Including all', module.concepts.length, 'concepts in module-wide content');
```

**Line 148:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] Added concept', idx + 1, ':', concept.title.substring(0, 50), '...');
```

**Line 225:**
```typescript
logger.log(`Teaching plan generated with ${teachingPlan.length} chunks, ${totalActionItems} total teaching points, and deterministic KC value of ${totalKcValueDisplay} for ${item.c...
```

**Line 230:**
```typescript
logger.log("LLM generated teaching plan details:");
```

**Line 232:**
```typescript
logger.log(`  Chunk ${chunkIndex + 1}:`);
```

**Line 236:**
```typescript
logger.log(`    - Action Item ${itemIndex + 1}: "${actionItem.text}" (KC: ${actionItem.kcValue.toFixed(4)})`);
```

**Line 379:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Checking phase for migration:', phase);
```

**Line 397:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] Phase is valid, no migration needed:', phase);
```

**Line 413:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Initializing curriculum state');
```

**Line 414:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Available phases - Concept:', CONCEPT_PEDAGOGICAL_PHASES, 'Module:', MODULE_PEDAGOGICAL_PHASES);
```

**Line 429:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Starting with phase:', initialPhase, 'for concept:', initialConcept.title);
```

**Line 485:**
```typescript
logger.info('[PHASE_VALIDATION] Phase prerequisites met for:', targetPhase);
```

**Line 505:**
```typescript
logger.info('[PHASE_JUMP] Pre-jump state:', preJumpState);
```

**Line 547:**
```typescript
logger.info('[PHASE_JUMP] Post-jump state:', postJumpState);
```

**Line 572:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] getCurrentCurriculumItem - Phase:', state.currentPhase, 'IsModulePhase:', isModulePhase);
```

**Line 616:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] Curriculum item created:', {
```

**Line 638:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] === ADVANCE CURRICULUM STATE CALLED ===');
```

**Line 639:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Current state:', {
```

**Line 700:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Current phase is concept phase:', state.currentPhase);
```

**Line 701:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Current concept index:', state.currentConceptIndex, 'of', module.concepts.length);
```

**Line 709:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Advanced to next concept:', state.currentConceptIndex, 'Phase remains:', state.currentPhase);
```

**Line 716:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] CRITICAL TRANSITION: Last concept completed!');
```

**Line 717:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Transitioned from:', oldPhase, 'to module phase:', state.currentPhase);
```

**Line 718:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] This should be the module-wide Socratic phase');
```

**Line 726:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Module phase transition from:', oldPhase, 'to:', state.currentPhase);
```

**Line 744:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] === NEW PHASE STARTED ===');
```

**Line 745:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Phase:', state.currentPhase, 'Module:', state.currentModuleIndex, 'Concept:', state.currentConceptIndex);
```

**Line 746:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] Is module-wide phase?', newItem.isModuleWidePhase);
```

**Line 756:**
```typescript
logger.info('[PHASE_REFACTOR_VALIDATION] New teaching plan generated with', state.teachingPlanForPhase.length, 'chunks');
```

**Line 780:**
```typescript
logger.log(`Curriculum progression gated for current chunk ${state.currentTeachingChunkIndex + 1} of ${currentItem.curriculumPathId}. ChunkLocallyCompleted: ${currentChunkLocally...
```

## pedagogicalProfiler.ts

**Line 180:**
```typescript
logger.log(`[PedagogicalProfiler] PROMPT SENT TO LLM:\n---\n${metaPrompt}\n---`);
```

## interactionHelpers.ts

**Line 52:**
```typescript
logger.debug('[STREAM_INTRO] Updating message stream, chunk length:', chunkText.length);
```

## ui.ts

**Line 113:**
```typescript
logger.debug('[PHASE_REFACTOR_VALIDATION] UI Phase display - Input:', phase, 'Output:', displayName);
```

**Line 465:**
```typescript
logger.debug('[CURSOR_CLEANUP] Removing cursor from message:', message.id);
```

**Line 576:**
```typescript
logger.debug('[UI] Phase button click detected:', phase.name);
```

**Line 586:**
```typescript
logger.debug('[UI] Phase selection buttons rendered successfully');
```

**Line 656:**
```typescript
logger.log("About to render Mermaid. Raw code is:\n", rawMermaidCode);
```

**Line 669:**
```typescript
logger.log('🔧 Step 1: Attempting universal quote fix...');
```

**Line 679:**
```typescript
logger.log('✅ Mermaid diagram fixed with universal quote fix');
```

**Line 683:**
```typescript
logger.log('Quote fix applied but diagram still has errors, proceeding to Step 2...');
```

**Line 712:**
```typescript
logger.log('✨ Mermaid diagram successfully fixed by AI and rendered');
```

**Line 810:**
```typescript
logger.debug('[UPDATE_STREAM] Updating message:', messageId, 'with text length:', fullTextSoFar.length);
```

**Line 1001:**
```typescript
if (DEBUG_FLAGS.mermaid_debug) { logger.log("Processing Mermaid in phase 2. Raw code is:\n", rawMermaidCode); }
```

**Line 1029:**
```typescript
logger.log('Preprocessing fixes applied but diagram still has errors, proceeding to Step 2...');
```

**Line 1058:**
```typescript
logger.log('✨ Mermaid diagram successfully fixed by AI and rendered');
```

## Summary

Total debug logs identified: **63**

These logs contain:
- Raw data dumps (JSON.stringify of objects)
- Validation/debugging tags (PHASE_REFACTOR_VALIDATION, DEBUG prefixes)
- Granular implementation details
- UI rendering process tracking
- Intermediate state updates
- Feature-specific validation checks

All these logs should be removed as they were added for debugging specific features and provide no value for system execution monitoring.
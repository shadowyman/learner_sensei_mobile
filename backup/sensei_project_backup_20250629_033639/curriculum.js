/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */
import { logger, DEBUG_FLAGS } from './logger';
import { initiateConsolidation, advanceConsolidationStage, getConsolidationFocusInstruction as getConsolidationInstruction } from "./consolidationManager";
import { CURRICULUM_FOCUS_HEADER_BASE, CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE, CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER, CURRICULUM_FOCUS_PHASE_SIGNAL_PREFIX, CURRICULUM_FOCUS_PHASE_SIGNAL_SUFFIX, CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER, CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY, CURRICULUM_COMPLETED_FOCUS_INSTRUCTION, GENERAL_INTERACTION_FOCUS_INSTRUCTION, REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE, REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE, TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE, REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE, GENERAL_ENGAGEMENT_PROMPT_TEMPLATE, CURRICULUM_FOCUS_MODULE_GOAL_PREFIX, CURRICULUM_FOCUS_CONCEPT_DETAILS_HEADER, CURRICULUM_FOCUS_CONCEPT_TITLE_PREFIX, CURRICULUM_FOCUS_CONCEPT_EXPLANATION_PREFIX, CURRICULUM_FOCUS_MODULE_WIDE_FOCUS_MESSAGE_PREFIX } from "./prompts";
const CONCEPT_PEDAGOGICAL_PHASES = ['IntroIllustrate'];
const MODULE_PEDAGOGICAL_PHASES = ['Socratic', 'Solidify'];
const ALL_PHASES = [...CONCEPT_PEDAGOGICAL_PHASES, ...MODULE_PEDAGOGICAL_PHASES];
let _curriculum = null;
export function setCurriculum(parsedCurriculum) {
    _curriculum = parsedCurriculum;
}
export function isCurriculumLoaded() {
    return _curriculum !== null;
}
// Getter for the loaded curriculum
export function getLoadedCurriculum() {
    return _curriculum;
}
export async function generateTeachingPlanForPhase(curriculum, item, phase, llmPlanner) {
    let combinedText = "";
    const module = curriculum.modules.find(m => m.title === item.moduleTitle);
    if (!module) {
        logger.error("Module not found for teaching plan generation:", item.moduleTitle);
        return [];
    }
    if (item.isModuleWidePhase) {
        if (DEBUG_FLAGS.curriculum_debug) {
            logger.debug("[CURRICULUM] Processing module-wide phase:", { phase, moduleTitle: module.title, isModuleWide: true });
        }
        combinedText += `Module Title: ${module.title}\nModule Goal:\n${module.goal}\n\n`;
        // Include all concepts for module-wide phases
        combinedText += `All Module Concepts:\n`;
        module.concepts.forEach((concept, idx) => {
            combinedText += `\nConcept ${idx + 1}: ${concept.title}\n${concept.text}\n`;
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.debug("[CURRICULUM] Adding concept to module content:", { conceptIndex: idx, conceptTitle: concept.title, moduleTitle: module.title });
            }
        });
        combinedText += `\n`;
        // Section-based content sourcing
        if (phase === 'Socratic') {
            if (module.socratic && module.socratic.trim()) {
                combinedText += `Socratic Instructions for Module-Wide Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Socratic Section ---\n${module.socratic}\n`;
            }
            else {
                combinedText += "No specific Socratic instructions found for this phase; use general pedagogical principles.\n";
            }
        }
        else if (phase === 'Solidify') {
            if (module.solidify && module.solidify.trim()) {
                combinedText += `Solidify Instructions for Module-Wide Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Solidify & Prepare Section ---\n${module.solidify}\n`;
            }
            else {
                combinedText += "No specific Solidify instructions found for this phase; use general pedagogical principles.\n";
            }
        }
    }
    else if (item.concept) {
        // Debug: Log concept data flow for IntroIllustrate
        if (phase === 'IntroIllustrate') {
            logger.warn(`[BUG_TRACE] generateTeachingPlanForPhase - IntroIllustrate phase`);
            logger.warn(`[BUG_TRACE] Concept title: "${item.concept.title}"`);
            logger.warn(`[BUG_TRACE] Concept text length: ${item.concept.text?.length || 0} chars`);
            logger.warn(`[BUG_TRACE] Concept text preview: "${item.concept.text?.substring(0, 100) || 'EMPTY'}..."`);
        }
        combinedText += `Concept Title: ${item.concept.title}\nCore Concept Content:\n${item.concept.text}\n\n`;
        // NEW: Section-based content sourcing for concept-level phases
        if (phase === 'IntroIllustrate') {
            // Methodology sections are no longer included to reduce context size
        }
        else if (phase === 'Socratic') {
            if (module.socratic && module.socratic.trim()) {
                combinedText += `Socratic Instructions for Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Socratic Section ---\n${module.socratic}\n`;
            }
            else {
                combinedText += "No specific Socratic instructions found for this phase; use general pedagogical principles.\n";
            }
        }
        else if (phase === 'Solidify') {
            if (module.solidify && module.solidify.trim()) {
                combinedText += `Solidify Instructions for Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Solidify & Prepare Section ---\n${module.solidify}\n`;
            }
            else {
                combinedText += "No specific Solidify instructions found for this phase; use general pedagogical principles.\n";
            }
        }
    }
    else {
        logger.warn("Cannot generate teaching plan: item is not module-wide and has no concept, or module not found.", item, phase);
        return [];
    }
    if (combinedText.trim() === "") {
        logger.warn("Combined text for LLM teaching plan generation is empty for item:", item, "phase:", phase);
        return [];
    }
    logger.log(`Requesting LLM teaching plan generation for: ${item.curriculumPathId}, Phase: ${phase}.`);
    const teachingPlan = await llmPlanner(combinedText);
    if (teachingPlan && teachingPlan.length > 0) {
        const totalActionItems = teachingPlan.reduce((sum, chunk) => sum + (Array.isArray(chunk) ? chunk.length : 0), 0);
        const totalKcValue = teachingPlan.reduce((sum, chunk) => {
            if (!Array.isArray(chunk))
                return sum;
            return sum + chunk.reduce((cSum, tp) => {
                // Ensure tp and tp.kcValue are valid before adding
                if (tp && typeof tp.kcValue === 'number' && !isNaN(tp.kcValue)) {
                    return cSum + tp.kcValue;
                }
                return cSum; // If kcValue is invalid, don't add to sum (or add 0)
            }, 0);
        }, 0);
        const totalKcValueDisplay = typeof totalKcValue === 'number' && !isNaN(totalKcValue) ? totalKcValue.toFixed(4) : "NaN";
        logger.log(`Teaching plan generated with ${teachingPlan.length} chunks, ${totalActionItems} total teaching points, and deterministic KC value of ${totalKcValueDisplay} for ${item.curriculumPathId}, Phase: ${phase}.`);
        logger.log("LLM generated teaching plan details:");
        teachingPlan.forEach((chunk, chunkIndex) => {
            logger.log(`  Chunk ${chunkIndex + 1}:`);
            if (Array.isArray(chunk)) {
                chunk.forEach((actionItem, itemIndex) => {
                    if (actionItem && typeof actionItem.text === 'string' && typeof actionItem.kcValue === 'number' && !isNaN(actionItem.kcValue)) {
                        logger.log(`    - Action Item ${itemIndex + 1}: "${actionItem.text}" (KC: ${actionItem.kcValue.toFixed(4)})`);
                    }
                    else {
                        const itemText = (actionItem && typeof actionItem.text === 'string') ? `"${actionItem.text}"` : `(Text missing or invalid: ${JSON.stringify(actionItem?.text)})`;
                        const itemKcValueRaw = (actionItem && actionItem.hasOwnProperty('kcValue')) ? actionItem.kcValue : 'kcValue_property_missing';
                        const itemKcValueType = actionItem ? typeof actionItem.kcValue : 'actionItem_is_undefined';
                        logger.warn(`    - Action Item ${itemIndex + 1} (Problematic): Text: ${itemText}, KC_Value_Raw: ${itemKcValueRaw} (Type: ${itemKcValueType})`);
                        logger.warn(`      Full problematic actionItem object: ${JSON.stringify(actionItem)}`);
                    }
                });
            }
            else {
                logger.warn(`  Chunk ${chunkIndex + 1} is not an array:`, chunk);
            }
        });
        if (typeof totalKcValue !== 'number' || isNaN(totalKcValue) || totalKcValue < 0.60 || totalKcValue > 0.70) {
            logger.warn(`LLM generated total KC value of ${totalKcValueDisplay}, which is outside the target sum range of ~0.65 for ${item.curriculumPathId}, Phase: ${phase}.`);
        }
        return teachingPlan;
    }
    logger.warn(`LLM teaching plan generation failed or returned null/empty for ${item.curriculumPathId}, Phase: ${phase}. Falling back to empty plan.`);
    return [];
}
// Improved regex patterns for Goal and Concepts sections only
const IMPROVED_REGEX_PATTERNS = {
    goal: /\nGoal:\s*([\s\S]*?)(?=\nConcepts:|\nModule|$)/,
    conceptsSection: /\nConcepts:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/,
    individualConcept: /(?:^|\n)\s*(\d+)\.\s+([^:]+?):\s*([\s\S]*?)(?=\n\s*\d+\.\s+[^:]+:|\nMethodology:|$)/g
};
export function parseModulesTxt(txt) {
    const modules = [];
    // Split by module headers to process each module separately
    const moduleHeaderRegex = /^Module (\d+(?:\.\d+)?):\s*(.*?)$/gm;
    const moduleHeaders = [];
    let headerMatch;
    while ((headerMatch = moduleHeaderRegex.exec(txt)) !== null) {
        moduleHeaders.push({ match: headerMatch, index: headerMatch.index });
    }
    // Original regex patterns for other sections (unchanged)
    const methodologyStepRegex = /(?:^|\n)\s*([0-9]+\.[ \t]*[^:\n]+?):\s*([\s\S]*?)(?=\n\s*[0-9]+\.[ \t]*[^:\n]+?:|\n\s*Socratic:|\n\s*Solidify & Prepare|\nModule|$)/g;
    const socraticRegex = /Socratic:\s*([\s\S]*?)(?=\n\s*Solidify & Prepare|\nModule|$)/g;
    const solidifyRegex = /\n\s*Solidify & Prepare:\s*([\s\S]*?)(?=\nModule|$)/g;
    // Process each module
    for (let i = 0; i < moduleHeaders.length; i++) {
        const startIndex = moduleHeaders[i].index;
        const endIndex = i < moduleHeaders.length - 1 ? moduleHeaders[i + 1].index : txt.length;
        const moduleContent = txt.substring(startIndex, endIndex);
        const headerInfo = moduleHeaders[i].match;
        const moduleIdStr = headerInfo[1].replace('.', '_');
        const currentModule = {
            id: `Module${moduleIdStr}`,
            title: headerInfo[2].trim().replace(/\s*\(Version.*?\)/i, ''),
            goal: '',
            concepts: [],
            methodology: [],
            socratic: '',
            solidify: ''
        };
        // Extract Goal using improved regex
        const goalMatch = IMPROVED_REGEX_PATTERNS.goal.exec(moduleContent);
        if (goalMatch) {
            currentModule.goal = goalMatch[1].trim();
        }
        // Extract Concepts section using improved regex
        const conceptsSectionMatch = IMPROVED_REGEX_PATTERNS.conceptsSection.exec(moduleContent);
        if (conceptsSectionMatch) {
            const conceptsSection = conceptsSectionMatch[1];
            // Extract individual concepts
            IMPROVED_REGEX_PATTERNS.individualConcept.lastIndex = 0;
            let conceptMatch;
            while ((conceptMatch = IMPROVED_REGEX_PATTERNS.individualConcept.exec(conceptsSection)) !== null) {
                currentModule.concepts.push({
                    title: conceptMatch[2].trim(),
                    text: conceptMatch[3].trim()
                });
            }
        }
        // Extract Methodology section (using original regex)
        const methodologySectionMatch = /Methodology:\s*([\s\S]*?)(?=\nSocratic|\nSolidify|\nModule|$)/g.exec(moduleContent);
        if (methodologySectionMatch && methodologySectionMatch[1]) {
            const methodologyText = methodologySectionMatch[1];
            let stepMatch;
            let stepCount = 0;
            methodologyStepRegex.lastIndex = 0;
            while ((stepMatch = methodologyStepRegex.exec(methodologyText)) !== null) {
                currentModule.methodology.push({
                    title: stepMatch[1].trim(),
                    text: stepMatch[2].trim()
                });
                stepCount++;
                if (stepCount >= 2)
                    break;
            }
        }
        // Extract Socratic section (using original regex)
        socraticRegex.lastIndex = 0;
        const socraticMatch = socraticRegex.exec(moduleContent);
        if (socraticMatch) {
            currentModule.socratic = socraticMatch[1].trim();
        }
        // Extract Solidify section (using original regex)
        solidifyRegex.lastIndex = 0;
        const solidifyMatch = solidifyRegex.exec(moduleContent);
        if (solidifyMatch) {
            currentModule.solidify = solidifyMatch[1].trim();
        }
        // Validation and logging
        if (!currentModule.socratic) {
            logger.error('CRITICAL: Module missing Socratic section:', currentModule.id);
        }
        if (!currentModule.solidify) {
            logger.error('CRITICAL: Module missing Solidify section:', currentModule.id);
        }
        if (currentModule.methodology.length !== 2) {
            logger.error('CRITICAL: Methodology step count mismatch - Expected: 2, Got:', currentModule.methodology.length, 'Module:', currentModule.id);
        }
        modules.push(currentModule);
    }
    return { modules };
}
// Migration function for old phase names
function migratePhaseIfNeeded(phase) {
    if (phase === 'Socratic_Module') {
        return 'Socratic';
    }
    if (phase === 'Solidify_Module') {
        return 'Solidify';
    }
    // Validate it's a valid phase
    if (phase === 'IntroIllustrate' || phase === 'Socratic' || phase === 'Solidify') {
        return phase;
    }
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.debug("[CURRICULUM] Using fallback phase for invalid input:", { inputPhase: phase, fallback: 'IntroIllustrate' });
    }
    return 'IntroIllustrate';
}
export async function initializeCurriculumState(curriculumData, llmPlanner, startModuleIndex = 0) {
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.debug("[CURRICULUM] Initializing curriculum state:", { startModuleIndex, modulesAvailable: curriculumData?.modules?.length });
    }
    if (!curriculumData || curriculumData.modules.length === 0 || startModuleIndex < 0 || startModuleIndex >= curriculumData.modules.length) {
        logger.error("Invalid curriculum data or startModuleIndex for initialization:", startModuleIndex, curriculumData);
        return null;
    }
    const initialModule = curriculumData.modules[startModuleIndex];
    if (!initialModule || !initialModule.concepts || initialModule.concepts.length === 0) {
        logger.error("Selected module has no concepts:", initialModule);
        return null;
    }
    const initialConcept = initialModule.concepts[0];
    const initialPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.debug("[CURRICULUM] Initial state setup completed:", { moduleTitle: initialModule.title, conceptTitle: initialConcept.title, initialPhase });
    }
    const tempInitialItemId = `${initialModule.id}-${initialConcept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}-Phase_${initialPhase}`;
    const initialItemForPlan = {
        moduleTitle: initialModule.title,
        moduleGoal: initialModule.goal,
        concept: initialConcept,
        curriculumPathId: tempInitialItemId,
        isLastConceptInModule: false,
        isLastPhaseForConcept: false,
        isModuleWidePhase: false,
    };
    const teachingPlan = await generateTeachingPlanForPhase(curriculumData, initialItemForPlan, initialPhase, llmPlanner);
    return {
        currentModuleIndex: startModuleIndex,
        currentConceptIndex: 0,
        currentPhase: initialPhase,
        activeConsolidationState: null,
        isCompleted: false,
        teachingPlanForPhase: teachingPlan,
        currentTeachingChunkIndex: 0,
        coveredPointsInCurrentChunk: new Set(),
        pointsToRevisitInCurrentChunk: new Set(),
    };
}
export async function jumpToPhase(curriculumData, moduleIndex, targetPhase, llmPlanner) {
    if (!curriculumData || curriculumData.modules.length === 0 || moduleIndex < 0 || moduleIndex >= curriculumData.modules.length) {
        return null;
    }
    const module = curriculumData.modules[moduleIndex];
    if (!module) {
        return null;
    }
    // Validate phase prerequisites
    if (targetPhase === 'Socratic' || targetPhase === 'Solidify') {
        if (!module.concepts || module.concepts.length === 0) {
            logger.warn('[PHASE_VALIDATION] Cannot jump to Socratic without concepts');
            return null;
        }
    }
    logger.info('[PHASE_VALIDATION] Phase prerequisites met for:', targetPhase);
    // Determine initial state based on target phase
    let conceptIndex = 0;
    let isModuleWidePhase = MODULE_PEDAGOGICAL_PHASES.includes(targetPhase);
    if (isModuleWidePhase) {
        // For Socratic/Solidify, we don't need a specific concept
        conceptIndex = module.concepts.length - 1; // Set to last concept for state consistency
    }
    // For IntroIllustrate, conceptIndex already 0 from initialization
    // Create the curriculum item for teaching plan generation
    const curriculumItem = {
        moduleTitle: module.title,
        moduleGoal: module.goal,
        concept: isModuleWidePhase ? null : module.concepts[conceptIndex],
        curriculumPathId: '', // Will be set below
        isLastConceptInModule: conceptIndex >= module.concepts.length - 1,
        isLastPhaseForConcept: false, // Will be updated based on phase
        isModuleWidePhase: isModuleWidePhase
    };
    // Generate curriculum path ID
    if (isModuleWidePhase) {
        curriculumItem.curriculumPathId = `${module.id}-Phase_${targetPhase}`;
    }
    else {
        const conceptTitleCleaned = module.concepts[conceptIndex].title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        curriculumItem.curriculumPathId = `${module.id}-${conceptTitleCleaned}-Phase_${targetPhase}`;
    }
    // Generate teaching plan for the target phase
    const teachingPlan = await generateTeachingPlanForPhase(curriculumData, curriculumItem, targetPhase, llmPlanner);
    const newState = {
        currentModuleIndex: moduleIndex,
        currentConceptIndex: conceptIndex,
        currentPhase: targetPhase,
        activeConsolidationState: null,
        isCompleted: false,
        teachingPlanForPhase: teachingPlan,
        currentTeachingChunkIndex: 0,
        coveredPointsInCurrentChunk: new Set(),
        pointsToRevisitInCurrentChunk: new Set()
    };
    return newState;
}
export function getInitialCurriculumTopicId(curriculumData) {
    if (!curriculumData || curriculumData.modules.length === 0 || curriculumData.modules[0].concepts.length === 0) {
        return "General_Introduction_To_Recursion";
    }
    const firstModule = curriculumData.modules[0];
    const firstConcept = firstModule.concepts[0];
    const firstPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
    const conceptTitleCleaned = firstConcept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    return `${firstModule.id}-${conceptTitleCleaned}-Phase_${firstPhase}`;
}
export function getCurrentCurriculumItem(curriculumData, state) {
    if (state.isCompleted || !curriculumData.modules[state.currentModuleIndex]) {
        return null;
    }
    const module = curriculumData.modules[state.currentModuleIndex];
    const isModulePhase = MODULE_PEDAGOGICAL_PHASES.includes(state.currentPhase);
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.debug("[CURRICULUM] Getting current curriculum item:", { moduleIndex: state.currentModuleIndex, conceptIndex: state.currentConceptIndex, currentPhase: state.currentPhase, isModulePhase });
    }
    let concept = null;
    let conceptTitleCleaned;
    let isLastConceptInModule = false;
    let isLastPhaseForConcept = false;
    if (isModulePhase) {
        conceptTitleCleaned = 'ModuleOverall';
    }
    else {
        if (!module || !module.concepts || state.currentConceptIndex >= module.concepts.length) {
            logger.warn(`Current concept index ${state.currentConceptIndex} is out of bounds for module ${module?.title} which has ${module?.concepts?.length} concepts.`);
            return null;
        }
        concept = module.concepts[state.currentConceptIndex] || null;
        conceptTitleCleaned = concept ? concept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') : 'NoConcept';
        isLastConceptInModule = state.currentConceptIndex >= module.concepts.length - 1;
        // Debug: Log concept retrieval
        if (concept && state.currentPhase === 'IntroIllustrate') {
            logger.warn(`[BUG_TRACE] getCurrentCurriculumItem - Retrieved concept for IntroIllustrate`);
            logger.warn(`[BUG_TRACE] Module: ${module.title}, Concept index: ${state.currentConceptIndex}`);
            logger.warn(`[BUG_TRACE] Concept title: "${concept.title}"`);
            logger.warn(`[BUG_TRACE] Concept text exists: ${!!concept.text}, length: ${concept.text?.length || 0}`);
        }
        const currentConceptPhaseIndex = CONCEPT_PEDAGOGICAL_PHASES.indexOf(state.currentPhase);
        isLastPhaseForConcept = currentConceptPhaseIndex >= CONCEPT_PEDAGOGICAL_PHASES.length - 1;
    }
    const curriculumPathId = `${module.id}-${isModulePhase ? '' : conceptTitleCleaned + '-'}Phase_${state.currentPhase}`;
    const result = {
        moduleTitle: module.title,
        moduleGoal: module.goal,
        concept: concept,
        curriculumPathId: curriculumPathId,
        isLastConceptInModule: isLastConceptInModule,
        isLastPhaseForConcept: isLastPhaseForConcept,
        isModuleWidePhase: isModulePhase,
    };
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.info('[CURRICULUM_ITEM] Current item details:', {
            phase: state.currentPhase,
            conceptIndex: state.currentConceptIndex,
            conceptTitle: concept?.title || 'N/A',
            isModuleWidePhase: isModulePhase,
            curriculumPathId: curriculumPathId
        });
    }
    return result;
}
export const PHASE_MASTERY_THRESHOLD = 0.65; // This remains the target sum of kcValues for a phase
export const PHASE_KC_TOTAL = 0.65; // Total KC value to distribute uniformly across all teaching points in a phase
async function handleSocraticPhase(curriculumData, state, learnerModel, llmPlanner) {
    // Handle pending Socratic completion
    if (state.socraticCompletionPending?.triggered) {
        const currentItem = getCurrentCurriculumItem(curriculumData, state);
        if (currentItem && state.currentPhase === 'Socratic') {
            logger.info('Sensei:[SOCRATIC_V4] Processing pending Socratic completion');
            logger.info('Sensei:[SOCRATIC_V4] Phase completed after turns:', state.socraticTurnCount);
            // Award full phase KC
            const phaseKCId = currentItem.curriculumPathId;
            if (!learnerModel.KCs[phaseKCId])
                learnerModel.KCs[phaseKCId] = 0;
            learnerModel.KCs[phaseKCId] = PHASE_MASTERY_THRESHOLD;
            // Log completion details
            const expectedTurns = state.teachingPlanForPhase?.[0]?.[0]?.interactionGuidance?.expectedTurns || 'unknown';
            logger.log(`Sensei:[SOCRATIC_V4] Turn efficiency: ${state.socraticTurnCount}/${expectedTurns} turns`);
            // Clear Socratic state
            state.socraticCompletionPending = null;
            state.socraticTurnCount = 0;
            state.socraticBaseInstruction = null;
            // Let normal advancement handle the rest
            return false;
        }
    }
    // Handle Socratic fallback completion (2x expected turns)
    if (state.currentPhase === 'Socratic' && state.socraticTurnCount) {
        const expectedTurns = state.teachingPlanForPhase?.[0]?.[0]?.interactionGuidance?.expectedTurns || 20;
        const maxTurns = expectedTurns * 2;
        if (state.socraticTurnCount >= maxTurns) {
            const currentItem = getCurrentCurriculumItem(curriculumData, state);
            if (currentItem) {
                logger.warn('Sensei:[SOCRATIC_V4] Fallback completion at 2x turns:', state.socraticTurnCount);
                // Award full phase KC
                const phaseKCId = currentItem.curriculumPathId;
                if (!learnerModel.KCs[phaseKCId])
                    learnerModel.KCs[phaseKCId] = 0;
                learnerModel.KCs[phaseKCId] = PHASE_MASTERY_THRESHOLD;
                // Clear Socratic state
                state.socraticTurnCount = 0;
                state.socraticBaseInstruction = null;
                state.socraticCompletionPending = null;
                // Recursive call to force advancement
                return await advanceCurriculumState(curriculumData, state, learnerModel, llmPlanner);
            }
        }
    }
    return false;
}
async function handlePhaseCompletion(curriculumData, state, learnerModel, llmPlanner, currentItem) {
    const currentPhaseKCId = currentItem.curriculumPathId;
    const phaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
    const KC_TOLERANCE = 0.001;
    // Check if mastery achieved
    if (phaseKCMastery >= (PHASE_MASTERY_THRESHOLD - KC_TOLERANCE)) {
        // Phase mastered - handle transitions
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
        if (state.activeConsolidationState) {
            logger.log(`[CONSOLIDATION] Terminated for ${currentItem.curriculumPathId}. Reason: Mastery threshold met.`);
            state.activeConsolidationState = null;
        }
        const module = curriculumData.modules[state.currentModuleIndex];
        // Determine next phase
        if (CONCEPT_PEDAGOGICAL_PHASES.includes(state.currentPhase)) {
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.info('[ADVANCE] Concept phase completed, checking next step');
            }
            if (state.currentConceptIndex < module.concepts.length - 1) {
                state.currentConceptIndex++;
                state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
                if (DEBUG_FLAGS.curriculum_debug) {
                    logger.info('[ADVANCE] Moving to next concept:', state.currentConceptIndex);
                }
            }
            else {
                state.currentPhase = MODULE_PEDAGOGICAL_PHASES[0];
                if (DEBUG_FLAGS.curriculum_debug) {
                    logger.info('[ADVANCE] Last concept completed, moving to module phase:', state.currentPhase);
                }
            }
        }
        else if (state.currentPhase === 'Socratic') {
            // Clear Socratic state when transitioning out
            state.socraticTurnCount = 0;
            state.socraticBaseInstruction = null;
            state.socraticCompletionPending = null;
            state.currentPhase = MODULE_PEDAGOGICAL_PHASES[1];
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.info('[ADVANCE] Socratic phase completed, moving to Solidify:', state.currentPhase);
            }
        }
        else if (state.currentPhase === 'Solidify') {
            if (state.currentModuleIndex < curriculumData.modules.length - 1) {
                state.currentModuleIndex++;
                state.currentConceptIndex = 0;
                state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
            }
            else {
                state.isCompleted = true;
                logger.log("Curriculum completed!");
                return true;
            }
        }
        // Reset for new phase
        state.currentTeachingChunkIndex = 0;
        const newItem = getCurrentCurriculumItem(curriculumData, state);
        if (newItem) {
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.info('[ADVANCE] Generating teaching plan for new phase');
            }
            // Reset KC and tracking for new phase
            learnerModel.KCs[newItem.curriculumPathId] = 0;
            learnerModel.KCMasteryLastUpdated[newItem.curriculumPathId] = new Date().toISOString();
            learnerModel.awardedKcForPhasePoints = new Set();
            // Generate new teaching plan
            state.teachingPlanForPhase = await generateTeachingPlanForPhase(curriculumData, newItem, state.currentPhase, llmPlanner);
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.info('[ADVANCE] Teaching plan generated, chunks:', state.teachingPlanForPhase.length);
            }
            state.coveredPointsInCurrentChunk = new Set();
            state.pointsToRevisitInCurrentChunk = new Set();
            logger.log(`Advanced to new state: Module ${state.currentModuleIndex + 1}, Concept ${state.currentConceptIndex + 1}, Phase ${state.currentPhase}, Chunk ${state.currentTeachingChunkIndex + 1}`);
            return true;
        }
        else if (!state.isCompleted) {
            logger.error("Advanced to an invalid curriculum state. Forcing completion. State:", state);
            state.isCompleted = true;
            return true;
        }
    }
    else {
        // Phase not mastered - initiate or advance consolidation
        if (!state.activeConsolidationState) {
            state.activeConsolidationState = initiateConsolidation(learnerModel, state.teachingPlanForPhase);
        }
        else {
            advanceConsolidationStage(state.activeConsolidationState, learnerModel.LastUserInput);
        }
        return false;
    }
    return false;
}
export async function advanceCurriculumState(curriculumData, state, learnerModel, llmPlanner) {
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.info('[ADVANCE] Attempting to advance curriculum state:', {
            moduleIndex: state.currentModuleIndex,
            conceptIndex: state.currentConceptIndex,
            phase: state.currentPhase,
            chunkIndex: state.currentTeachingChunkIndex,
            totalChunks: state.teachingPlanForPhase.length
        });
    }
    // Early return for completed curriculum
    if (state.isCompleted)
        return false;
    // Handle Socratic special cases
    const socraticHandled = await handleSocraticPhase(curriculumData, state, learnerModel, llmPlanner);
    if (socraticHandled)
        return socraticHandled;
    // Get current item
    const currentItem = getCurrentCurriculumItem(curriculumData, state);
    if (!currentItem) {
        logger.error("Cannot advance curriculum: currentItem is null. State:", state);
        state.isCompleted = true;
        return false;
    }
    // Check chunk completion
    const currentChunkTeachingPoints = (state.teachingPlanForPhase &&
        state.teachingPlanForPhase[state.currentTeachingChunkIndex])
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex] : [];
    let currentChunkLocallyCompleted = false;
    if (currentChunkTeachingPoints.length > 0) {
        const allPointsCovered = currentChunkTeachingPoints.every(tp => state.coveredPointsInCurrentChunk.has(tp.text));
        const noPointsToRevisit = !state.pointsToRevisitInCurrentChunk ||
            currentChunkTeachingPoints.every(tp => !state.pointsToRevisitInCurrentChunk.has(tp.text));
        currentChunkLocallyCompleted = allPointsCovered && noPointsToRevisit;
    }
    else {
        currentChunkLocallyCompleted = true; // Empty chunk is considered completed
    }
    const isLastChunkInPhase = state.currentTeachingChunkIndex >= state.teachingPlanForPhase.length - 1;
    // Handle chunk advancement (not last chunk)
    if (currentChunkLocallyCompleted && !isLastChunkInPhase) {
        state.currentTeachingChunkIndex++;
        state.coveredPointsInCurrentChunk = new Set();
        state.pointsToRevisitInCurrentChunk = new Set();
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
        logger.log(`Advanced to next chunk: ${state.currentTeachingChunkIndex + 1} in phase ${state.currentPhase} of ${currentItem.concept?.title || currentItem.moduleTitle}`);
        return true;
    }
    // Handle phase completion (last chunk)
    if (currentChunkLocallyCompleted && isLastChunkInPhase) {
        return await handlePhaseCompletion(curriculumData, state, learnerModel, llmPlanner, currentItem);
    }
    // Track incomplete chunks
    if (!currentChunkLocallyCompleted) {
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic++;
        logger.log(`Curriculum progression gated for current chunk ${state.currentTeachingChunkIndex + 1} of ${currentItem.curriculumPathId}. ChunkLocallyCompleted: ${currentChunkLocallyCompleted}. Interaction counter for this chunk: ${learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic}`);
    }
    return false;
}
// Main implementation of curriculum focus instruction generation
function getCurriculumFocusInstructionImpl(curriculum, item, state, isMustObeyTurn, preCalculatedFocusPoints) {
    if (state.isCompleted) {
        return CURRICULUM_COMPLETED_FOCUS_INSTRUCTION;
    }
    if (!item) { // Should not happen if not completed, but as a safeguard
        return GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    }
    let primaryActionInstruction = "";
    let primaryActionType = "";
    let focusPointsStrings = [];
    const phase = state.currentPhase;
    // Handle consolidation case first as it returns early
    if (state.activeConsolidationState) {
        return getConsolidationInstruction(item, state.activeConsolidationState);
    }
    // Use pre-calculated focus points if provided, otherwise calculate them
    if (preCalculatedFocusPoints) {
        focusPointsStrings = preCalculatedFocusPoints.focusPoints;
        primaryActionType = preCalculatedFocusPoints.primaryActionType;
    }
    else {
        // Fallback to calculating focus points inline (for backward compatibility)
        const calculated = calculateFocusPoints(state);
        focusPointsStrings = calculated.focusPoints;
        primaryActionType = calculated.primaryActionType;
    }
    // Generate the appropriate instruction based on the primary action type
    if (primaryActionType === "Revisit & Clarify (from current chunk)") {
        primaryActionInstruction = REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, !isMustObeyTurn);
    }
    else if (primaryActionType === "Revisit & Clarify (general points for this phase)") {
        primaryActionInstruction = REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(focusPointsStrings, !isMustObeyTurn);
    }
    else if (primaryActionType === "Teach New Content (from current chunk)") {
        primaryActionInstruction = TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, !isMustObeyTurn);
    }
    else if (primaryActionType === "Reinforce & Deepen (current chunk)") {
        primaryActionInstruction = REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(item, focusPointsStrings);
    }
    else if (primaryActionType === "General Engagement") {
        primaryActionInstruction = GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(item, state);
    }
    let instruction = `${CURRICULUM_FOCUS_HEADER_BASE}
- Current Module: ${item.moduleTitle}
- Current Pedagogical Phase: ${phase}`;
    if (!item.isModuleWidePhase && item.concept) {
        instruction += ` (for Concept: ${item.concept.title})`;
    }
    else if (item.isModuleWidePhase) {
        instruction += ` (Module-Wide)`;
    }
    instruction += ` (Chunk ${state.currentTeachingChunkIndex + 1} of ${state.teachingPlanForPhase.length || 1})

${CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE(primaryActionType)}
${primaryActionInstruction}

${CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER}
${CURRICULUM_FOCUS_MODULE_GOAL_PREFIX}
  "${item.moduleGoal}"`;
    if (item.concept && !item.isModuleWidePhase) {
        instruction += `
${CURRICULUM_FOCUS_CONCEPT_DETAILS_HEADER}
  ${CURRICULUM_FOCUS_CONCEPT_TITLE_PREFIX} "${item.concept.title}"
  ${CURRICULUM_FOCUS_CONCEPT_EXPLANATION_PREFIX} "${item.concept.text}"`;
    }
    else if (item.isModuleWidePhase) {
        instruction += `
${CURRICULUM_FOCUS_MODULE_WIDE_FOCUS_MESSAGE_PREFIX} ('${phase}').`;
    }
    instruction += `
${CURRICULUM_FOCUS_PHASE_SIGNAL_PREFIX} "${phase}". ${CURRICULUM_FOCUS_PHASE_SIGNAL_SUFFIX}

${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER}
${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY}`;
    return instruction;
}
/**
 * Calculates the focus points for the current teaching state.
 * These are the specific teaching points that should be emphasized in this turn.
 * @returns An object containing the focus points and metadata about the teaching action
 */
export function calculateFocusPoints(state) {
    const currentChunkTeachingPoints = (state.teachingPlanForPhase && state.teachingPlanForPhase[state.currentTeachingChunkIndex])
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex]
        : [];
    const currentChunkItemTexts = currentChunkTeachingPoints.map(tp => tp.text);
    let focusPoints = [];
    let primaryActionType = "";
    if (state.activeConsolidationState) {
        primaryActionType = "Consolidation";
        // During consolidation, focus on synthesis across all chunks
        focusPoints = []; // Consolidation doesn't use specific focus points
    }
    else if (state.pointsToRevisitInCurrentChunk && state.pointsToRevisitInCurrentChunk.size > 0) {
        // Priority 1: Points that need revisiting from current chunk
        const revisitPointsTexts = currentChunkItemTexts.filter(text => state.pointsToRevisitInCurrentChunk.has(text));
        if (revisitPointsTexts.length > 0) {
            focusPoints = revisitPointsTexts;
            primaryActionType = "Revisit & Clarify (from current chunk)";
        }
        else {
            // Fallback: revisit points from other chunks
            focusPoints = Array.from(state.pointsToRevisitInCurrentChunk);
            primaryActionType = "Revisit & Clarify (general points for this phase)";
        }
    }
    else if (currentChunkItemTexts.length > 0) {
        // Priority 2: New uncovered points
        const uncoveredInChunkTexts = currentChunkItemTexts.filter(text => !state.coveredPointsInCurrentChunk.has(text));
        if (uncoveredInChunkTexts.length > 0) {
            focusPoints = uncoveredInChunkTexts;
            primaryActionType = "Teach New Content (from current chunk)";
        }
        else {
            // Priority 3: All covered, so reinforce
            focusPoints = currentChunkItemTexts; // Include all for reinforcement
            primaryActionType = "Reinforce & Deepen (current chunk)";
        }
    }
    else {
        // No teaching points available
        primaryActionType = "General Engagement";
        focusPoints = [];
    }
    return { focusPoints, primaryActionType };
}
// Main export function
export function getCurriculumFocusInstruction(curriculum, item, state, isMustObeyTurn, preCalculatedFocusPoints) {
    return getCurriculumFocusInstructionImpl(curriculum, item, state, isMustObeyTurn, preCalculatedFocusPoints);
}
export function checkForSocraticCompletion(senseiResponse) {
    // Check for completion flag using regex
    const completionRegex = /\[SOCRATIC_COMPLETION_TRIGGERED:\s*(.+?)\]/;
    const match = senseiResponse.match(completionRegex);
    logger.info('Sensei:[SOCRATIC_V4] Checking completion, found flag:', !!match);
    if (match) {
        const trigger = match[1].trim();
        logger.info('Sensei:[SOCRATIC_V4] Completion trigger:', trigger);
        const cleanResponse = senseiResponse.replace(completionRegex, '').trim();
        logger.info('Sensei:[SOCRATIC_V4] Clean response length:', cleanResponse.length);
        return {
            triggered: true,
            trigger: trigger,
            cleanResponse: cleanResponse
        };
    }
    return {
        triggered: false,
        cleanResponse: senseiResponse
    };
}

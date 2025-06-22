

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { LearnerModel } from "./adaptiveEngine";
import { 
    initiateConsolidation,
    advanceConsolidationStage,
    getConsolidationFocusInstruction as getConsolidationInstruction,
} from "./consolidationManager";
import {
    CURRICULUM_FOCUS_HEADER_BASE,
    CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE,
    CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER,
    CURRICULUM_FOCUS_PHASE_SIGNAL_PREFIX,
    CURRICULUM_FOCUS_PHASE_SIGNAL_SUFFIX,
    CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER,
    CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY,
    CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
    GENERAL_INTERACTION_FOCUS_INSTRUCTION,
    TARGETED_CONSOLIDATION_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE,
    TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE,
    REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE,
    GENERAL_ENGAGEMENT_PROMPT_TEMPLATE,
    CURRICULUM_FOCUS_MODULE_GOAL_PREFIX,
    CURRICULUM_FOCUS_CONCEPT_DETAILS_HEADER,
    CURRICULUM_FOCUS_CONCEPT_TITLE_PREFIX,
    CURRICULUM_FOCUS_CONCEPT_EXPLANATION_PREFIX,
    CURRICULUM_FOCUS_MODULE_WIDE_FOCUS_MESSAGE_PREFIX
} from "./prompts";
import { ConsolidationState } from "./consolidationManager";

// Feature flag for optimized instructions
const USE_OPTIMIZED_INSTRUCTIONS = false;

// Define TeachingPoint as the structure for items in the teaching plan
export interface TeachingPoint {
    text: string;
    kcValue: number;
}


export interface Concept {
    title: string;
    text: string; // This is the "Core Concept Content"
}

export interface MethodologyStep {
    title:string;
    text: string;
}

export interface Module {
    id: string;
    title: string;
    goal: string;
    concepts: Concept[];
    methodology: MethodologyStep[]; // Common methodologies for the module
}

export interface Curriculum {
    modules: Module[];
}

export type Phase = 'IntroIllustrate' | 'Socratic' | 'Solidify' | 'Socratic_Module' | 'Solidify_Module';

const CONCEPT_PEDAGOGICAL_PHASES: Phase[] = ['IntroIllustrate', 'Socratic', 'Solidify'];
const MODULE_PEDAGOGICAL_PHASES: Phase[] = ['Socratic_Module', 'Solidify_Module'];
const ALL_PHASES: Phase[] = [...CONCEPT_PEDAGOGICAL_PHASES, ...MODULE_PEDAGOGICAL_PHASES];


export const METHODOLOGY_NUMBERS_FOR_PHASE: Record<Phase, string[]> = {
    IntroIllustrate: ["1.", "2."],
    Socratic: ["3."],
    Solidify: ["4."],
    Socratic_Module: ["3."], 
    Solidify_Module: ["4."], 
};


export interface CurriculumState {
    currentModuleIndex: number;
    currentConceptIndex: number; 
    currentPhase: Phase;
    activeConsolidationState: ConsolidationState | null;
    isCompleted: boolean;
    teachingPlanForPhase: TeachingPoint[][]; // Array of chunks, each chunk is an array of TeachingPoint objects
    currentTeachingChunkIndex: number; 
    coveredPointsInCurrentChunk: Set<string>; // Stores TEXT of covered points
    pointsToRevisitInCurrentChunk?: Set<string>; // Stores TEXT of points to revisit
}

export interface CurriculumItem {
    moduleTitle: string;
    moduleGoal: string;
    concept: Concept | null; 
    curriculumPathId: string;
    isLastConceptInModule: boolean; 
    isLastPhaseForConcept: boolean; 
    isModuleWidePhase: boolean;
}

let _curriculum: Curriculum | null = null;

export function setCurriculum(parsedCurriculum: Curriculum): void {
    _curriculum = parsedCurriculum;
}

export function isCurriculumLoaded(): boolean {
    return _curriculum !== null;
}

// Getter for the loaded curriculum
export function getLoadedCurriculum(): Curriculum | null {
    return _curriculum;
}

type LLMTeachingPlanGenerator = (text: string) => Promise<TeachingPoint[][] | null>;


export async function generateTeachingPlanForPhase(
    curriculum: Curriculum,
    item: CurriculumItem,
    phase: Phase,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<TeachingPoint[][]> {
    let combinedText = "";
    const module = curriculum.modules.find(m => m.title === item.moduleTitle);

    if (!module) {
        logger.error("Module not found for teaching plan generation:", item.moduleTitle);
        return [];
    }

    if (item.isModuleWidePhase) {
        combinedText += `Module Title: ${module.title}\nModule Goal:\n${module.goal}\n\n`;
        
        // Only include methodology for phases other than IntroIllustrate
        if (phase !== 'IntroIllustrate') {
            const methodologyNumbers = METHODOLOGY_NUMBERS_FOR_PHASE[phase];
            combinedText += `Methodology Instructions for Module-Wide Phase '${phase}' (use these to inform actionable items):\n`;
            let methodologyFound = false;
            methodologyNumbers.forEach(numPrefix => {
                const step = module.methodology.find(m => m.title.trim().startsWith(numPrefix));
                if (step && step.text.trim()) {
                    combinedText += `\n--- Methodology Step: ${step.title} ---\n${step.text}\n`;
                    methodologyFound = true;
                }
            });
            if (!methodologyFound) {
                combinedText += "No specific module methodology steps listed for this phase; use general pedagogical principles for the phase type.\n";
            }
        }
    } else if (item.concept) {
        combinedText += `Concept Title: ${item.concept.title}\nCore Concept Content:\n${item.concept.text}\n\n`;
        
        // Only include methodology for phases other than IntroIllustrate
        if (phase !== 'IntroIllustrate') {
            const methodologyNumbers = METHODOLOGY_NUMBERS_FOR_PHASE[phase];
            combinedText += `Methodology Instructions for Phase '${phase}' (use these to inform actionable items):\n`;
            let methodologyFound = false;
            methodologyNumbers.forEach(numPrefix => {
                const step = module.methodology.find(m => m.title.trim().startsWith(numPrefix));
                if (step && step.text.trim()) {
                    combinedText += `\n--- Methodology Step: ${step.title} ---\n${step.text}\n`;
                    methodologyFound = true;
                }
            });
            if (!methodologyFound) {
                combinedText += "No specific methodology steps listed for this phase; use general pedagogical principles for the phase type.\n";
            }
        }
    } else {
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
            if (!Array.isArray(chunk)) return sum;
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
        
        // Validation for deterministic KC calculation
        const expectedKcPerPoint = PHASE_KC_TOTAL / totalActionItems;
        
        logger.log("LLM generated teaching plan details:");
        teachingPlan.forEach((chunk, chunkIndex) => {
            logger.log(`  Chunk ${chunkIndex + 1}:`);
            if (Array.isArray(chunk)) {
                chunk.forEach((actionItem, itemIndex) => {
                    if (actionItem && typeof actionItem.text === 'string' && typeof actionItem.kcValue === 'number' && !isNaN(actionItem.kcValue)) {
                        logger.log(`    - Action Item ${itemIndex + 1}: "${actionItem.text}" (KC: ${actionItem.kcValue.toFixed(4)})`);
                    } else {
                        const itemText = (actionItem && typeof actionItem.text === 'string') ? `"${actionItem.text}"` : `(Text missing or invalid: ${JSON.stringify(actionItem?.text)})`;
                        const itemKcValueRaw = (actionItem && actionItem.hasOwnProperty('kcValue')) ? actionItem.kcValue : 'kcValue_property_missing';
                        const itemKcValueType = actionItem ? typeof actionItem.kcValue : 'actionItem_is_undefined';
                        
                        logger.warn(`    - Action Item ${itemIndex + 1} (Problematic): Text: ${itemText}, KC_Value_Raw: ${itemKcValueRaw} (Type: ${itemKcValueType})`);
                        logger.warn(`      Full problematic actionItem object: ${JSON.stringify(actionItem)}`);
                    }
                });
            } else {
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


export function parseModulesTxt(txt: string): Curriculum {
    const modules: Module[] = [];
    const moduleRegex = /Module (\d+(?:\.\d+)?):\s*(.*?)\n[\s\S]*?Goal:\s*([\s\S]*?)\nConcepts[\s\S]*?:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/gi;
    const conceptRegex = /([A-Za-z0-9\s.,'&()]+?-?\s*[A-Za-z0-9\s.,'&()]+?):\s*([\s\S]*?)(?=\n\s*[A-Za-z0-9\s.,'&()]+?-?\s*[A-Za-z0-9\s.,'&()]+?:|\nMethodology:|\nModule|$)/g;
    const methodologyStepRegex = /([0-9]+\.[ \t]*[A-Za-z0-9\s,&#'\-():<>\[\].]+?):\s*([\s\S]*?)(?=\n[ \t]*[0-9]+\.[ \t]*[A-Za-z0-9\s,&#'\-():<>\[\].]+?:|\nMethodology:|\nModule|$)/g;


    let moduleMatch;
    while ((moduleMatch = moduleRegex.exec(txt)) !== null) {
        const moduleIdStr = moduleMatch[1].replace('.', '_');
        const currentModule: Module = {
            id: `Module${moduleIdStr}`,
            title: moduleMatch[2].trim().replace(/\s*\(Version.*?\)/i, ''),
            goal: moduleMatch[3].trim(),
            concepts: [],
            methodology: []
        };

        const conceptsSection = moduleMatch[4];
        let conceptMatch;
        while ((conceptMatch = conceptRegex.exec(conceptsSection)) !== null) {
            const conceptText = conceptMatch[2].trim();
            currentModule.concepts.push({
                title: conceptMatch[1].trim(),
                text: conceptText
            });
        }

        const moduleEndIndex = moduleMatch.index + moduleMatch[0].length;
        const nextModuleStartIndex = txt.indexOf("\nModule", moduleEndIndex);
        const searchEndIndex = nextModuleStartIndex === -1 ? txt.length : nextModuleStartIndex;

        const methodologySectionMatch = /Methodology:\s*([\s\S]*?)(?=\nModule|$)/g.exec(txt.substring(moduleMatch.index, searchEndIndex));

        if (methodologySectionMatch && methodologySectionMatch[1]) {
            const methodologyText = methodologySectionMatch[1];
            let stepMatch;
            while((stepMatch = methodologyStepRegex.exec(methodologyText)) !== null) {
                 currentModule.methodology.push({
                    title: stepMatch[1].trim(),
                    text: stepMatch[2].trim()
                });
            }
        }
        modules.push(currentModule);
    }
    return { modules };
}

export async function initializeCurriculumState(
    curriculumData: Curriculum,
    startModuleIndex: number = 0,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<CurriculumState | null> {
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

    const tempInitialItemId = `${initialModule.id}-${initialConcept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}-Phase_${initialPhase}`;
    const initialItemForPlan: CurriculumItem = {
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
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>(),
    };
}

export function getInitialCurriculumTopicId(curriculumData: Curriculum | null): string {
    if (!curriculumData || curriculumData.modules.length === 0 || curriculumData.modules[0].concepts.length === 0) {
        return "General_Introduction_To_Recursion";
    }
    const firstModule = curriculumData.modules[0];
    const firstConcept = firstModule.concepts[0];
    const firstPhase = CONCEPT_PEDAGOGICAL_PHASES[0];

    const conceptTitleCleaned = firstConcept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    return `${firstModule.id}-${conceptTitleCleaned}-Phase_${firstPhase}`;
}

export function getCurrentCurriculumItem(curriculumData: Curriculum, state: CurriculumState): CurriculumItem | null {
    if (state.isCompleted || !curriculumData.modules[state.currentModuleIndex]) {
        return null;
    }

    const module = curriculumData.modules[state.currentModuleIndex];
    const isModulePhase = MODULE_PEDAGOGICAL_PHASES.includes(state.currentPhase);

    let concept: Concept | null = null;
    let conceptTitleCleaned: string;
    let isLastConceptInModule = false;
    let isLastPhaseForConcept = false;

    if (isModulePhase) {
        concept = null; 
        conceptTitleCleaned = 'ModuleOverall'; 
    } else {
        if (!module || !module.concepts || state.currentConceptIndex >= module.concepts.length) {
            logger.warn(`Current concept index ${state.currentConceptIndex} is out of bounds for module ${module?.title} which has ${module?.concepts?.length} concepts.`);
            return null;
        }
        concept = module.concepts[state.currentConceptIndex] || null;
        conceptTitleCleaned = concept ? concept.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') : 'NoConcept';
        isLastConceptInModule = state.currentConceptIndex >= module.concepts.length - 1;
        const currentConceptPhaseIndex = CONCEPT_PEDAGOGICAL_PHASES.indexOf(state.currentPhase);
        isLastPhaseForConcept = currentConceptPhaseIndex >= CONCEPT_PEDAGOGICAL_PHASES.length - 1;
    }

    const curriculumPathId = `${module.id}-${isModulePhase ? '' : conceptTitleCleaned + '-'}Phase_${state.currentPhase}`;

    return {
        moduleTitle: module.title,
        moduleGoal: module.goal,
        concept: concept,
        curriculumPathId: curriculumPathId,
        isLastConceptInModule: isLastConceptInModule,
        isLastPhaseForConcept: isLastPhaseForConcept,
        isModuleWidePhase: isModulePhase,
    };
}

export const PHASE_MASTERY_THRESHOLD = 0.65; // This remains the target sum of kcValues for a phase
export const PHASE_KC_TOTAL = 0.65; // Total KC value to distribute uniformly across all teaching points in a phase

export async function advanceCurriculumState(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
    if (state.isCompleted) return false;

    const currentItem = getCurrentCurriculumItem(curriculumData, state);
    if (!currentItem) {
        logger.error("Cannot advance curriculum: currentItem is null. State:", state);
        state.isCompleted = true; 
        return false;
    }

    let currentChunkLocallyCompleted = false;
    const currentChunkTeachingPoints = (state.teachingPlanForPhase && state.teachingPlanForPhase[state.currentTeachingChunkIndex])
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex]
        : [];

    if (currentChunkTeachingPoints.length > 0) {
        const allPointsCovered = currentChunkTeachingPoints.every(tp => state.coveredPointsInCurrentChunk.has(tp.text));
        const noPointsToRevisit = !state.pointsToRevisitInCurrentChunk ||
                                  currentChunkTeachingPoints.every(tp => !state.pointsToRevisitInCurrentChunk!.has(tp.text));
        currentChunkLocallyCompleted = allPointsCovered && noPointsToRevisit;
    } else {
        currentChunkLocallyCompleted = true; // Empty chunk is considered completed
    }

    const isLastChunkInPhase = state.currentTeachingChunkIndex >= state.teachingPlanForPhase.length - 1;
    const currentPhaseKCId = currentItem.curriculumPathId;
    // PhaseKCMastery is now the sum of kcValues of understood points for this phase
    const phaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0; 

    if (currentChunkLocallyCompleted && !isLastChunkInPhase) {
        state.currentTeachingChunkIndex++;
        state.coveredPointsInCurrentChunk = new Set<string>();
        state.pointsToRevisitInCurrentChunk = new Set<string>();
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
        logger.log(`Advanced to next chunk: ${state.currentTeachingChunkIndex + 1} in phase ${state.currentPhase} of ${currentItem.concept?.title || currentItem.moduleTitle}`);
        return true;
    }

    if (currentChunkLocallyCompleted && isLastChunkInPhase) {
        // Mastery check: The sum of kcValues for understood points should reach the threshold
        // FLOATING POINT FIX: Use tolerance for KC mastery comparison to handle precision issues
        const KC_TOLERANCE = 0.001;
        if (phaseKCMastery >= (PHASE_MASTERY_THRESHOLD - KC_TOLERANCE)) {
            learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
            if (state.activeConsolidationState) {
                // Centralized Log Point 3: Termination (Implicitly handled by clearing the state)
                logger.log(`[CONSOLIDATION] Terminated for ${currentItem.curriculumPathId}. Reason: Mastery threshold met.`);
                state.activeConsolidationState = null; // Clear consolidation state
            }
            const module = curriculumData.modules[state.currentModuleIndex];

            if (CONCEPT_PEDAGOGICAL_PHASES.includes(state.currentPhase)) {
                const currentConceptPhaseIndex = CONCEPT_PEDAGOGICAL_PHASES.indexOf(state.currentPhase);
                if (currentConceptPhaseIndex < CONCEPT_PEDAGOGICAL_PHASES.length - 1) { 
                    state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[currentConceptPhaseIndex + 1];
                } else { 
                    if (state.currentConceptIndex < module.concepts.length - 1) { 
                        state.currentConceptIndex++;
                        state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0]; 
                    } else { 
                        state.currentPhase = MODULE_PEDAGOGICAL_PHASES[0]; 
                    }
                }
            }
            else if (state.currentPhase === 'Socratic_Module') {
                state.currentPhase = MODULE_PEDAGOGICAL_PHASES[1]; 
            } else if (state.currentPhase === 'Solidify_Module') {
                if (state.currentModuleIndex < curriculumData.modules.length - 1) { 
                    state.currentModuleIndex++;
                    state.currentConceptIndex = 0;
                    state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0]; 
                } else { 
                    state.isCompleted = true;
                    logger.log("Curriculum completed!");
                    return true;
                }
            }

            state.currentTeachingChunkIndex = 0;
            const newItem = getCurrentCurriculumItem(curriculumData, state);
            if (newItem) {
                // Reset KC score and awarded points for the new phase
                learnerModel.KCs[newItem.curriculumPathId] = 0; 
                learnerModel.KCMasteryLastUpdated[newItem.curriculumPathId] = new Date().toISOString();
                learnerModel.awardedKcForPhasePoints = new Set<string>(); // Reset awarded KCs for the new phase

                state.teachingPlanForPhase = await generateTeachingPlanForPhase(curriculumData, newItem, state.currentPhase, llmPlanner);
                state.coveredPointsInCurrentChunk = new Set<string>();
                state.pointsToRevisitInCurrentChunk = new Set<string>();
            } else if (!state.isCompleted) {
                logger.error("Advanced to an invalid curriculum state. Forcing completion. State:", state);
                state.isCompleted = true;
                return true;
            }
            logger.log(`Advanced to new state: Module ${state.currentModuleIndex + 1}, Concept ${state.currentConceptIndex + 1}, Phase ${state.currentPhase}, Chunk ${state.currentTeachingChunkIndex + 1}`);
            return true;

        } else { 
            if (!state.activeConsolidationState) {
                state.activeConsolidationState = initiateConsolidation(learnerModel, state.teachingPlanForPhase);
            } else {
                advanceConsolidationStage(state.activeConsolidationState, learnerModel.LastUserInput);
            }
            return false;
        }
    }

    if (!currentChunkLocallyCompleted) {
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic++;
         logger.log(`Curriculum progression gated for current chunk ${state.currentTeachingChunkIndex + 1} of ${currentItem.curriculumPathId}. ChunkLocallyCompleted: ${currentChunkLocallyCompleted}. Interaction counter for this chunk: ${learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic}`);
    }
    return false;
}


// Legacy version with full static content
function getLegacyCurriculumFocusInstruction(
    curriculum: Curriculum, 
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean
): string {
    if (state.isCompleted) {
        return CURRICULUM_COMPLETED_FOCUS_INSTRUCTION;
    }
    if (!item) { // Should not happen if not completed, but as a safeguard
        return GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    }

    let primaryActionInstruction = "";
    let primaryActionType = "";

    const phase = state.currentPhase;
    const currentChunkTeachingPoints = (state.teachingPlanForPhase && state.teachingPlanForPhase[state.currentTeachingChunkIndex]) 
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex] 
        : [];
    const currentChunkItemTexts = currentChunkTeachingPoints.map(tp => tp.text);

    if (state.activeConsolidationState) {
        return getConsolidationInstruction(item, state.activeConsolidationState);
    } else {
        let focusPointsStrings: string[] = [];
        if (state.pointsToRevisitInCurrentChunk && state.pointsToRevisitInCurrentChunk.size > 0) {
            const revisitPointsTexts = currentChunkItemTexts.filter(text => state.pointsToRevisitInCurrentChunk!.has(text));
            if (revisitPointsTexts.length > 0) {
                focusPointsStrings = revisitPointsTexts.slice(0, 3); 
                primaryActionType = "Revisit & Clarify (from current chunk)";
                primaryActionInstruction = REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, !isMustObeyTurn);
            } else {
                 const allRevisitPoints = Array.from(state.pointsToRevisitInCurrentChunk).slice(0,3); 
                 primaryActionType = "Revisit & Clarify (general points for this phase)";
                 primaryActionInstruction = REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(allRevisitPoints, !isMustObeyTurn);
            }
        } else if (currentChunkItemTexts.length > 0) {
            const uncoveredInChunkTexts = currentChunkItemTexts.filter(text => !state.coveredPointsInCurrentChunk.has(text));
            if (uncoveredInChunkTexts.length > 0) {
                focusPointsStrings = uncoveredInChunkTexts.slice(0, 3); 
                primaryActionType = "Teach New Content (from current chunk)";
                primaryActionInstruction = TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, !isMustObeyTurn);
            } else { 
                primaryActionType = "Reinforce & Deepen (current chunk)";
                primaryActionInstruction = REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(item, currentChunkItemTexts);
            }
        } else { 
            primaryActionType = "General Engagement";
            primaryActionInstruction = GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(item, state);
        }
    }

    let instruction = `${CURRICULUM_FOCUS_HEADER_BASE}
- Current Module: ${item.moduleTitle}
- Current Pedagogical Phase: ${phase}`;
    if (!item.isModuleWidePhase && item.concept) {
        instruction += ` (for Concept: ${item.concept.title})`;
    } else if (item.isModuleWidePhase) {
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
    } else if (item.isModuleWidePhase) {
         instruction += `
${CURRICULUM_FOCUS_MODULE_WIDE_FOCUS_MESSAGE_PREFIX} ('${phase}').`;
    }
    
    instruction += `
${CURRICULUM_FOCUS_PHASE_SIGNAL_PREFIX} "${phase}". ${CURRICULUM_FOCUS_PHASE_SIGNAL_SUFFIX}

${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER}
${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY}`;
    return instruction;
}

// Optimized version with minimal dynamic content
function getOptimizedCurriculumFocusInstruction(
    curriculum: Curriculum, 
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean
): string {
    if (state.isCompleted) {
        return CURRICULUM_COMPLETED_FOCUS_INSTRUCTION;
    }
    if (!item) {
        return GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    }

    let primaryActionType = "";
    let focusPointsStrings: string[] = [];
    let includeCheck = !isMustObeyTurn;

    const phase = state.currentPhase;
    const currentChunkTeachingPoints = (state.teachingPlanForPhase && state.teachingPlanForPhase[state.currentTeachingChunkIndex]) 
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex] 
        : [];
    const currentChunkItemTexts = currentChunkTeachingPoints.map(tp => tp.text);

    if (state.activeConsolidationState) {
        return getConsolidationInstruction(item, state.activeConsolidationState);
    } else {
        if (state.pointsToRevisitInCurrentChunk && state.pointsToRevisitInCurrentChunk.size > 0) {
            const revisitPointsTexts = currentChunkItemTexts.filter(text => state.pointsToRevisitInCurrentChunk!.has(text));
            if (revisitPointsTexts.length > 0) {
                focusPointsStrings = revisitPointsTexts.slice(0, 3); 
                primaryActionType = "Revisit & Clarify (from current chunk)";
            } else {
                focusPointsStrings = Array.from(state.pointsToRevisitInCurrentChunk).slice(0,3); 
                primaryActionType = "Revisit & Clarify (general points for this phase)";
            }
        } else if (currentChunkItemTexts.length > 0) {
            const uncoveredInChunkTexts = currentChunkItemTexts.filter(text => !state.coveredPointsInCurrentChunk.has(text));
            if (uncoveredInChunkTexts.length > 0) {
                focusPointsStrings = uncoveredInChunkTexts.slice(0, 3); 
                primaryActionType = "Teach New Content (from current chunk)";
            } else { 
                primaryActionType = "Reinforce & Deepen (current chunk)";
                focusPointsStrings = currentChunkItemTexts;
            }
        } else { 
            primaryActionType = "General Engagement";
        }
    }

    // Build minimal instruction focusing only on dynamic content
    let instruction = `[CURRICULUM FOCUS]
Module: ${item.moduleTitle}
Phase: ${phase} (Chunk ${state.currentTeachingChunkIndex + 1} of ${state.teachingPlanForPhase.length || 1})`;
    
    if (!item.isModuleWidePhase && item.concept) {
        instruction += `\nConcept: ${item.concept.title}`;
    } else if (item.isModuleWidePhase) {
        instruction += ` (Module-Wide)`;
    }

    instruction += `\n\nPRIMARY ACTION: ${primaryActionType}`;
    
    if (focusPointsStrings.length > 0) {
        instruction += `\nTeaching Points:\n${focusPointsStrings.map(s => `- ${s}`).join('\n')}`;
    }

    instruction += `\n\nContext:
- Module Goal: "${item.moduleGoal}"`;

    if (item.concept && !item.isModuleWidePhase) {
        instruction += `\n- Concept Explanation: "${item.concept.text}"`;
    }

    if (includeCheck) {
        instruction += '\n\nInclude: Check Understanding Section';
    }

    return instruction;
}

// Main export function that switches based on feature flag
export function getCurriculumFocusInstruction(
    curriculum: Curriculum, 
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean
): string {
    if (USE_OPTIMIZED_INSTRUCTIONS) {
        return getOptimizedCurriculumFocusInstruction(curriculum, item, state, isMustObeyTurn);
    }
    return getLegacyCurriculumFocusInstruction(curriculum, item, state, isMustObeyTurn);
}
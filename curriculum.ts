

/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */

import { logger } from './logger';
import { LearnerModel } from "./adaptiveEngine";
import { 
    initiateConsolidation,
    advanceConsolidationStage,
    getConsolidationFocusInstruction as getConsolidationInstruction,
    ConsolidationState
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


// Define TeachingPoint as the structure for items in the teaching plan
export interface TeachingPoint {
    text: string;
    kcValue: number;
    // Optional Socratic phase properties
    isSocraticIntent?: boolean;
    interactionGuidance?: {
        expectedTurns: number;
        turnManagement?: any;
        completionTriggers?: any;
    };
    socraticMetadata?: {
        detectedCategory?: string;
    };
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
    methodology: MethodologyStep[]; // Common methodologies for the module (steps 1., 2.)
    socratic: string; // NEW: Top-level Socratic section content
    solidify: string; // NEW: Top-level Solidify & Prepare section content
}

export interface Curriculum {
    modules: Module[];
}

export type Phase = 'IntroIllustrate' | 'Socratic' | 'Solidify';

const CONCEPT_PEDAGOGICAL_PHASES: Phase[] = ['IntroIllustrate'];
const MODULE_PEDAGOGICAL_PHASES: Phase[] = ['Socratic', 'Solidify'];
const ALL_PHASES: Phase[] = [...CONCEPT_PEDAGOGICAL_PHASES, ...MODULE_PEDAGOGICAL_PHASES];


// NOTE: Updated for new section-based structure - Socratic/Solidify phases now use dedicated section fields


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
    // Socratic v4 specific fields
    socraticTurnCount?: number;
    socraticBaseInstruction?: string;
    socraticCompletionPending?: SocraticCompletionResult;
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

export interface SocraticCompletionResult {
    triggered: boolean;
    trigger?: string;
    cleanResponse: string;
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


function buildCombinedContentText(curriculum: Curriculum, item: CurriculumItem, phase: Phase): string {
    let combinedText = "";
    const module = curriculum.modules.find(m => m.title === item.moduleTitle);

    if (!module) {
        return "";
    }

    if (item.isModuleWidePhase) {
        combinedText += `Module Title: ${module.title}\nModule Goal:\n${module.goal}\n\n`;
        
        combinedText += `All Module Concepts:\n`;
        module.concepts.forEach((concept, idx) => {
            combinedText += `\nConcept ${idx + 1}: ${concept.title}\n${concept.text}\n`;
        });
        combinedText += `\n`;
        
        // Section-based content sourcing
        if (phase === 'Socratic') {
            if (module.socratic && module.socratic.trim()) {
                combinedText += `Socratic Instructions for Module-Wide Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Socratic Section ---\n${module.socratic}\n`;
            } else {
                combinedText += "No specific Socratic instructions found for this phase; use general pedagogical principles.\n";
            }
        } else if (phase === 'Solidify') {
            if (module.solidify && module.solidify.trim()) {
                combinedText += `Solidify Instructions for Module-Wide Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Solidify & Prepare Section ---\n${module.solidify}\n`;
            } else {
                combinedText += "No specific Solidify instructions found for this phase; use general pedagogical principles.\n";
            }
        }
    } else if (item.concept) {
        
        if (phase === 'IntroIllustrate') {
        }
        combinedText += `Concept Title: ${item.concept.title}\nCore Concept Content:\n${item.concept.text}\n\n`;
        
        if (phase === 'Socratic') {
            if (module.socratic && module.socratic.trim()) {
                combinedText += `Socratic Instructions for Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Socratic Section ---\n${module.socratic}\n`;
            } else {
                combinedText += "No specific Socratic instructions found for this phase; use general pedagogical principles.\n";
            }
        } else if (phase === 'Solidify') {
            if (module.solidify && module.solidify.trim()) {
                combinedText += `Solidify Instructions for Phase '${phase}' (use these to inform actionable items):\n`;
                combinedText += `\n--- Solidify & Prepare Section ---\n${module.solidify}\n`;
            } else {
                combinedText += "No specific Solidify instructions found for this phase; use general pedagogical principles.\n";
            }
        }
    } else {
        return "";
    }

    return combinedText;
}

function calculateTeachingPlanMetrics(teachingPlan: TeachingPoint[][]): { totalActionItems: number; totalKcValue: number } {
    const totalActionItems = teachingPlan.reduce((sum, chunk) => sum + (Array.isArray(chunk) ? chunk.length : 0), 0);
    const totalKcValue = teachingPlan.reduce((sum, chunk) => {
        if (!Array.isArray(chunk)) return sum;
        return sum + chunk.reduce((cSum, tp) => {
            if (tp && typeof tp.kcValue === 'number' && !isNaN(tp.kcValue)) {
                return cSum + tp.kcValue;
            }
            return cSum;
        }, 0);
    }, 0);

    return { totalActionItems, totalKcValue };
}

function logTeachingPlanValidation(payload: Record<string, unknown>): void {
    logger.info('[TEACHING_PLAN_VALIDATION]', payload);
}

function logConceptNavValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[CONCEPT_NAV_VALIDATION]', { event, ...payload });
}

function logAdvanceValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[ADVANCE_VALIDATION]', { event, ...payload });
}

function logSocraticCompletionValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SOCRATIC_COMPLETION_VALIDATION]', { event, ...payload });
}

function validateAndProcessTeachingPlan(teachingPlan: TeachingPoint[][], item: CurriculumItem, phase: Phase): TeachingPoint[][] {
    if (teachingPlan && teachingPlan.length > 0) {

        const { totalActionItems, totalKcValue } = calculateTeachingPlanMetrics(teachingPlan);
        const totalKcValueDisplay = typeof totalKcValue === 'number' && !isNaN(totalKcValue) ? totalKcValue.toFixed(4) : "NaN";

        logTeachingPlanValidation({
            curriculumPathId: item.curriculumPathId,
            phase,
            chunks: teachingPlan.length,
            totalActionItems,
            totalKcValue: totalKcValueDisplay
        });

        teachingPlan.forEach((chunk, chunkIndex) => {
            if (!Array.isArray(chunk)) {
                logger.warn(`[TEACHING_PLAN_WARNING] Chunk ${chunkIndex + 1} is not an array`, chunk);
                return;
            }

            chunk.forEach((actionItem, itemIndex) => {
                if (!(actionItem && typeof actionItem.text === 'string' && typeof actionItem.kcValue === 'number' && !isNaN(actionItem.kcValue))) {
                    const itemText = (actionItem && typeof actionItem.text === 'string') ? actionItem.text : '<invalid-text>';
                    const itemKcValueRaw = actionItem && 'kcValue' in actionItem ? actionItem.kcValue : 'missing';
                    const itemKcValueType = actionItem ? typeof actionItem.kcValue : 'undefined';

                    logger.warn(`[TEACHING_PLAN_WARNING] Invalid action item`, {
                        chunkIndex: chunkIndex + 1,
                        itemIndex: itemIndex + 1,
                        text: itemText,
                        kcValueRaw: itemKcValueRaw,
                        kcValueType: itemKcValueType
                    });
                }
            });
        });

        if (typeof totalKcValue !== 'number' || isNaN(totalKcValue) || totalKcValue < 0.60 || totalKcValue > 0.70) {
             logger.warn(`LLM generated total KC value of ${totalKcValueDisplay}, which is outside the target sum range of ~0.65 for ${item.curriculumPathId}, Phase: ${phase}.`);
        }

        return teachingPlan;
    }
    
    return [];
}

export async function generateTeachingPlanForPhase(
    curriculum: Curriculum,
    item: CurriculumItem,
    phase: Phase,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<TeachingPoint[][]> {
    
    const combinedText = buildCombinedContentText(curriculum, item, phase);
    if (combinedText.trim() === "") {
        return [];
    }

    const teachingPlan = await llmPlanner(combinedText);
    return validateAndProcessTeachingPlan(teachingPlan, item, phase);
}


// Improved regex patterns for Goal and Concepts sections only
const IMPROVED_REGEX_PATTERNS = {
    goal: /\nGoal:\s*([\s\S]*?)(?=\nConcepts:|\nModule|$)/,
    conceptsSection: /\nConcepts:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)/,
    individualConcept: /(?:^|\n)\s*(\d+)\.\s+([^:]+?):\s*([\s\S]*?)(?=\n\s*\d+\.\s+[^:]+:|\nMethodology:|$)/g
};

interface ModuleSegment {
    moduleId: string;
    title: string;
    content: string;
    startIndex: number;
    endIndex: number;
}

function extractModuleSegments(txt: string): ModuleSegment[] {
    const moduleHeaderRegex = /^Module (\d+(?:\.\d+)?):\s*(.*?)$/gm;
    const moduleHeaders: Array<{ match: RegExpExecArray; index: number }> = [];
    
    let headerMatch;
    while ((headerMatch = moduleHeaderRegex.exec(txt)) !== null) {
        moduleHeaders.push({ match: headerMatch, index: headerMatch.index });
    }
    
    
    const segments: ModuleSegment[] = [];
    for (let i = 0; i < moduleHeaders.length; i++) {
        const startIndex = moduleHeaders[i].index;
        const endIndex = i < moduleHeaders.length - 1 ? moduleHeaders[i + 1].index : txt.length;
        const content = txt.substring(startIndex, endIndex);
        const headerInfo = moduleHeaders[i].match;
        
        const moduleIdStr = headerInfo[1].replace('.', '_');
        const segment: ModuleSegment = {
            moduleId: `Module${moduleIdStr}`,
            title: headerInfo[2].trim().replace(/\s*\(Version.*?\)/i, ''),
            content,
            startIndex,
            endIndex
        };
        segments.push(segment);
        
    }
    
    return segments;
}

function parseModuleGoal(moduleContent: string): string {
    const goalMatch = IMPROVED_REGEX_PATTERNS.goal.exec(moduleContent);
    const goal = goalMatch ? goalMatch[1].trim() : '';
    return goal;
}

function parseModuleConcepts(moduleContent: string): Concept[] {
    const concepts: Concept[] = [];
    
    const conceptsSectionMatch = IMPROVED_REGEX_PATTERNS.conceptsSection.exec(moduleContent);
    if (conceptsSectionMatch) {
        const conceptsSection = conceptsSectionMatch[1];
        
        IMPROVED_REGEX_PATTERNS.individualConcept.lastIndex = 0;
        let conceptMatch;
        while ((conceptMatch = IMPROVED_REGEX_PATTERNS.individualConcept.exec(conceptsSection)) !== null) {
            concepts.push({
                title: conceptMatch[2].trim(),
                text: conceptMatch[3].trim()
            });
        }
    }
    
    return concepts;
}

function parseModuleMethodology(moduleContent: string): MethodologyStep[] {
    const methodology: MethodologyStep[] = [];
    const methodologyStepRegex = /(?:^|\n)\s*(\d+\.[ \t]*[^:\n]+?):\s*([\s\S]*?)(?=\n\s*\d+\.[ \t]*[^:\n]+?:|\n\s*Socratic:|\n\s*Solidify & Prepare|\nModule|$)/g;
    
    const methodologySectionMatch = /Methodology:\s*([\s\S]*?)(?=\nSocratic|\nSolidify|\nModule|$)/g.exec(moduleContent);
    if (methodologySectionMatch && methodologySectionMatch[1]) {
        const methodologyText = methodologySectionMatch[1];
        let stepMatch;
        let stepCount = 0;
        methodologyStepRegex.lastIndex = 0;
        while((stepMatch = methodologyStepRegex.exec(methodologyText)) !== null) {
            methodology.push({
                title: stepMatch[1].trim(),
                text: stepMatch[2].trim()
            });
            stepCount++;
            if (stepCount >= 2) break;
        }
    }
    
    return methodology;
}

function parseSocraticAndSolidifyContent(moduleContent: string): {socratic: string, solidify: string} {
    const socraticRegex = /Socratic:\s*([\s\S]*?)(?=\n\s*Solidify & Prepare|\nModule|$)/g;
    const solidifyRegex = /\n\s*Solidify & Prepare:\s*([\s\S]*?)(?=\nModule|$)/g;
    
    socraticRegex.lastIndex = 0;
    const socraticMatch = socraticRegex.exec(moduleContent);
    const socratic = socraticMatch ? socraticMatch[1].trim() : '';
    
    solidifyRegex.lastIndex = 0;
    const solidifyMatch = solidifyRegex.exec(moduleContent);
    const solidify = solidifyMatch ? solidifyMatch[1].trim() : '';
    
    
    return { socratic, solidify };
}

function validateParsedModule(module: Module): void {
    
    if (!module.socratic) {
        logger.error('CRITICAL: Module missing Socratic section:', module.id);
    }
    if (!module.solidify) {
        logger.error('CRITICAL: Module missing Solidify section:', module.id);
    }
    if (module.methodology.length !== 2) {
        logger.error('CRITICAL: Methodology step count mismatch - Expected: 2, Got:', module.methodology.length, 'Module:', module.id);
    }
    
}

export function parseModulesTxt(txt: string): Curriculum {
    const modules: Module[] = [];
    
    const moduleSegments = extractModuleSegments(txt);
    if (moduleSegments.length === 0) {
        return { modules };
    }
    
    for (const segment of moduleSegments) {
        
        const currentModule: Module = {
            id: segment.moduleId,
            title: segment.title,
            goal: parseModuleGoal(segment.content),
            concepts: parseModuleConcepts(segment.content),
            methodology: parseModuleMethodology(segment.content),
            ...parseSocraticAndSolidifyContent(segment.content)
        };
        
        validateParsedModule(currentModule);
        modules.push(currentModule);
        
    }
    
    return { modules };
}

// Migration function for old phase names
function migratePhaseIfNeeded(phase: string): Phase {
    if (phase === 'Socratic_Module') {
        return 'Socratic';
    }
    if (phase === 'Solidify_Module') {
        return 'Solidify';
    }
    // Validate it's a valid phase
    if (phase === 'IntroIllustrate' || phase === 'Socratic' || phase === 'Solidify') {
        return phase as Phase;
    }
    return 'IntroIllustrate';
}

export async function initializeCurriculumState(
    curriculumData: Curriculum,
    llmPlanner: LLMTeachingPlanGenerator,
    startModuleIndex: number = 0
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
    const tempInitialItemId = `${initialModule.id}-${initialConcept.title.replace(/\s+/g, '_').replace(/\W/g, '')}-Phase_${initialPhase}`;
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

export async function jumpToPhase(
    curriculumData: Curriculum,
    moduleIndex: number,
    targetPhase: Phase,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<CurriculumState | null> {
    
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
    
    logAdvanceValidation('phase-prerequisites-met', { targetPhase });
    
    // Determine initial state based on target phase
    let conceptIndex = 0;
    let isModuleWidePhase = MODULE_PEDAGOGICAL_PHASES.includes(targetPhase);
    
    if (isModuleWidePhase) {
        // For Socratic/Solidify, we don't need a specific concept
        conceptIndex = module.concepts.length - 1; // Set to last concept for state consistency
    }
    // For IntroIllustrate, conceptIndex already 0 from initialization
    
    // Create the curriculum item for teaching plan generation
    const curriculumItem: CurriculumItem = {
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
    } else {
        const conceptTitleCleaned = module.concepts[conceptIndex].title.replace(/\s+/g, '_').replace(/\W/g, '');
        curriculumItem.curriculumPathId = `${module.id}-${conceptTitleCleaned}-Phase_${targetPhase}`;
    }
    
    // Generate teaching plan for the target phase
    const teachingPlan = await generateTeachingPlanForPhase(curriculumData, curriculumItem, targetPhase, llmPlanner);
    
    const newState: CurriculumState = {
        currentModuleIndex: moduleIndex,
        currentConceptIndex: conceptIndex,
        currentPhase: targetPhase,
        activeConsolidationState: null,
        isCompleted: false,
        teachingPlanForPhase: teachingPlan,
        currentTeachingChunkIndex: 0,
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
    };

    return newState;
}

export async function navigateToConcept(
    targetConceptIndex: number,
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {

    // Validate inputs
    if (!curriculumData || !state || !learnerModel) {
        logger.error('[CONCEPT_NAV] Invalid inputs provided');
        return false;
    }

    const module = curriculumData.modules[state.currentModuleIndex];
    if (!module) {
        logger.error('[CONCEPT_NAV] Module not found at index:', state.currentModuleIndex);
        return false;
    }

    // Validate concept index bounds
    if (targetConceptIndex < 0 || targetConceptIndex >= module.concepts.length) {
        logger.warn('[CONCEPT_NAV] Target concept index out of bounds:', targetConceptIndex);
        return false;
    }

    // Only allow navigation in IntroIllustrate phase
    if (state.currentPhase !== 'IntroIllustrate') {
        logger.warn('[CONCEPT_NAV] Navigation only allowed in IntroIllustrate phase. Current phase:', state.currentPhase);
        return false;
    }

    const previousConceptIndex = state.currentConceptIndex;

    // Check if already at target concept
    if (previousConceptIndex === targetConceptIndex) {
        logConceptNavValidation('no-op', {
            conceptIndex: targetConceptIndex
        });
        return true;
    }

    // Update concept index
    state.currentConceptIndex = targetConceptIndex;

    // Create curriculum item for the new concept
    const newConcept = module.concepts[targetConceptIndex];
    const curriculumItem: CurriculumItem = {
        moduleTitle: module.title,
        moduleGoal: module.goal,
        concept: newConcept,
        curriculumPathId: `${module.id}-${newConcept.title.replace(/\s+/g, '_').replace(/\W/g, '')}-Phase_IntroIllustrate`,
        isLastConceptInModule: targetConceptIndex >= module.concepts.length - 1,
        isLastPhaseForConcept: false,
        isModuleWidePhase: false
    };

    const teachingPlan = await generateTeachingPlanForPhase(
        curriculumData,
        curriculumItem,
        'IntroIllustrate',
        llmPlanner
    );

    // Reset state for new concept
    state.teachingPlanForPhase = teachingPlan;
    state.currentTeachingChunkIndex = 0;
    state.coveredPointsInCurrentChunk = new Set<string>();
    state.pointsToRevisitInCurrentChunk = new Set<string>();
    state.activeConsolidationState = null;

    // Reset learner model progress for new concept
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;

    // Clear all awarded KC points to start fresh
    learnerModel.awardedKcForPhasePoints = new Set<string>();

    // Clear content point coverage for ALL points in the new teaching plan
    // This ensures we start completely fresh for the new concept
    let clearedCoverage = false;
    if (learnerModel.contentPointsCoverage) {
        for (const chunk of teachingPlan) {
            for (const point of chunk) {
                const pointText = point.text;
                if (learnerModel.contentPointsCoverage[pointText]) {
                    delete learnerModel.contentPointsCoverage[pointText];
                    clearedCoverage = true;
                }
            }
        }
    }

    // Initialize KC for new concept - always start at 0 for fresh navigation
    const kcId = curriculumItem.curriculumPathId;
    learnerModel.KCs[kcId] = 0.0;

    logConceptNavValidation('navigated', {
        fromConceptIndex: previousConceptIndex,
        toConceptIndex: targetConceptIndex,
        kcId,
        teachingPlanChunks: teachingPlan.length,
        clearedCoverage,
        awardedReset: true
    });
    return true;
}

export function getInitialCurriculumTopicId(curriculumData: Curriculum | null): string {
    if (!curriculumData || curriculumData.modules.length === 0 || curriculumData.modules[0].concepts.length === 0) {
        return "General_Introduction_To_Recursion";
    }
    const firstModule = curriculumData.modules[0];
    const firstConcept = firstModule.concepts[0];
    const firstPhase = CONCEPT_PEDAGOGICAL_PHASES[0];

    const conceptTitleCleaned = firstConcept.title.replace(/\s+/g, '_').replace(/\W/g, '');
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
        conceptTitleCleaned = 'ModuleOverall'; 
    } else {
        if (!module || !module.concepts || state.currentConceptIndex >= module.concepts.length) {
            logger.warn(`Current concept index ${state.currentConceptIndex} is out of bounds for module ${module?.title} which has ${module?.concepts?.length} concepts.`);
            return null;
        }
        concept = module.concepts[state.currentConceptIndex] || null;
        conceptTitleCleaned = concept ? concept.title.replace(/\s+/g, '_').replace(/\W/g, '') : 'NoConcept';
        isLastConceptInModule = state.currentConceptIndex >= module.concepts.length - 1;
        
        // Debug: Log concept retrieval
        if (concept && state.currentPhase === 'IntroIllustrate') {
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
    
    return result;
}

export const PHASE_MASTERY_THRESHOLD = 0.65; // This remains the target sum of kcValues for a phase
export const PHASE_KC_TOTAL = 0.65; // Total KC value to distribute uniformly across all teaching points in a phase

function awardSocraticPhaseKC(learnerModel: LearnerModel, currentItem: CurriculumItem): void {
    const phaseKCId = currentItem.curriculumPathId;
    if (!learnerModel.KCs[phaseKCId]) learnerModel.KCs[phaseKCId] = 0;
    learnerModel.KCs[phaseKCId] = PHASE_MASTERY_THRESHOLD;
}

function clearSocraticState(state: CurriculumState): void {
    state.socraticCompletionPending = null;
    state.socraticTurnCount = 0;
    state.socraticBaseInstruction = null;
}

function processSocraticPendingCompletion(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel
): boolean {
    
    const currentItem = getCurrentCurriculumItem(curriculumData, state);
    if (currentItem && state.currentPhase === 'Socratic') {
        awardSocraticPhaseKC(learnerModel, currentItem);
        const expectedTurns = state.teachingPlanForPhase?.[0]?.[0]?.interactionGuidance?.expectedTurns || 'unknown';

        logSocraticCompletionValidation('completed', {
            curriculumPathId: currentItem.curriculumPathId,
            turnsTaken: state.socraticTurnCount,
            expectedTurns
        });

        clearSocraticState(state);

        // Let normal advancement handle the rest
        return false;
    }
    return false;
}

async function processSocraticFallbackCompletion(
    _curriculumData: Curriculum,
    _state: CurriculumState,
    _learnerModel: LearnerModel,
    _llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
    return false;
}

async function handleSocraticPhase(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
    
    // Handle pending Socratic completion
    if (state.socraticCompletionPending?.triggered) {
        return processSocraticPendingCompletion(curriculumData, state, learnerModel);
    }
    return await processSocraticFallbackCompletion(curriculumData, state, learnerModel, llmPlanner);
}

function determinePhaseTransition(state: CurriculumState, curriculumData: Curriculum): void {
    const module = curriculumData.modules[state.currentModuleIndex];

    if (CONCEPT_PEDAGOGICAL_PHASES.includes(state.currentPhase)) {
        const previousConceptIndex = state.currentConceptIndex;
        if (state.currentConceptIndex < module.concepts.length - 1) {
            state.currentConceptIndex++;
            state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
            logAdvanceValidation('concept-advanced', {
                moduleIndex: state.currentModuleIndex,
                fromConceptIndex: previousConceptIndex,
                toConceptIndex: state.currentConceptIndex,
                nextPhase: state.currentPhase
            });
        } else {
            state.currentPhase = MODULE_PEDAGOGICAL_PHASES[0];
            logAdvanceValidation('module-phase-transition', {
                moduleIndex: state.currentModuleIndex,
                completedConceptIndex: previousConceptIndex,
                nextPhase: state.currentPhase
            });
        }
    } else if (state.currentPhase === 'Socratic') {
        // Clear Socratic state when transitioning out
        state.socraticTurnCount = 0;
        state.socraticBaseInstruction = null;
        state.socraticCompletionPending = null;
        state.currentPhase = MODULE_PEDAGOGICAL_PHASES[1];
        logAdvanceValidation('socratic-phase-transition', {
            moduleIndex: state.currentModuleIndex,
            conceptIndex: state.currentConceptIndex,
            nextPhase: state.currentPhase
        });
    } else if (state.currentPhase === 'Solidify') {
        if (state.currentModuleIndex < curriculumData.modules.length - 1) {
            state.currentModuleIndex++;
            state.currentConceptIndex = 0;
            state.currentPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
            logAdvanceValidation('module-advanced', {
                moduleIndex: state.currentModuleIndex,
                nextPhase: state.currentPhase
            });
        } else {
            state.isCompleted = true;
            logAdvanceValidation('curriculum-completed', {
                totalModules: curriculumData.modules.length
            });
        }
    }
    
}

async function initializeNewPhaseState(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
    // Reset for new phase
    state.currentTeachingChunkIndex = 0;
    const newItem = getCurrentCurriculumItem(curriculumData, state);
    
    if (newItem) {
        // Reset KC and tracking for new phase
        learnerModel.KCs[newItem.curriculumPathId] = 0;
        learnerModel.KCMasteryLastUpdated[newItem.curriculumPathId] = new Date().toISOString();
        learnerModel.awardedKcForPhasePoints = new Set<string>();
        
        // Generate new teaching plan
        state.teachingPlanForPhase = await generateTeachingPlanForPhase(
            curriculumData, newItem, state.currentPhase, llmPlanner
        );
        state.coveredPointsInCurrentChunk = new Set<string>();
        state.pointsToRevisitInCurrentChunk = new Set<string>();
        logAdvanceValidation('phase-state-initialized', {
            moduleIndex: state.currentModuleIndex,
            conceptIndex: state.currentConceptIndex,
            phase: state.currentPhase,
            teachingPlanChunks: state.teachingPlanForPhase.length
        });
        return true;
    } else if (!state.isCompleted) {
        logger.error("Advanced to an invalid curriculum state. Forcing completion. State:", state);
        state.isCompleted = true;
        return true;
    }

    return false;
}

function cleanupCompletedPhase(
    state: CurriculumState,
    learnerModel: LearnerModel,
    currentItem: CurriculumItem
): void {
    
    // Reset interaction counter
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
    
    // Clear consolidation state if active
    if (state.activeConsolidationState) {
        logAdvanceValidation('consolidation-terminated', {
            curriculumPathId: currentItem.curriculumPathId,
            reason: 'phase-mastery'
        });
        state.activeConsolidationState = null;
    }

}

async function handlePhaseCompletion(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator,
    currentItem: CurriculumItem
): Promise<boolean> {
    const currentPhaseKCId = currentItem.curriculumPathId;
    const phaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
    const KC_TOLERANCE = 0.001;


    // Check if mastery achieved
    if (phaseKCMastery >= (PHASE_MASTERY_THRESHOLD - KC_TOLERANCE)) {
        
        // Phase mastered - handle transitions
        cleanupCompletedPhase(state, learnerModel, currentItem);
        determinePhaseTransition(state, curriculumData);
        
        if (state.isCompleted) {
            return true;
        }

        const result = await initializeNewPhaseState(curriculumData, state, learnerModel, llmPlanner);
        return result;
    } else {
        // Phase not mastered - initiate or advance consolidation
        if (!state.activeConsolidationState) {
            state.activeConsolidationState = initiateConsolidation(learnerModel, state.teachingPlanForPhase);
        } else {
            // Pass learner model and phase KC ID to check for mastery
            const shouldExitConsolidation = advanceConsolidationStage(
                state.activeConsolidationState,
                learnerModel.LastUserInput,
                learnerModel,
                currentPhaseKCId
            );

            if (shouldExitConsolidation) {
                // Clear consolidation state and handle phase completion
                logAdvanceValidation('consolidation-terminated', {
                    curriculumPathId: currentItem.curriculumPathId,
                    reason: 'mastery-during-consolidation'
                });
                state.activeConsolidationState = null;

                // Phase mastered - handle transitions
                cleanupCompletedPhase(state, learnerModel, currentItem);
                determinePhaseTransition(state, curriculumData);
                await initializeNewPhaseState(curriculumData, state, learnerModel, llmPlanner);
                return true;
            }
        }
        return false;
    }
}
}

export async function advanceCurriculumState(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
    logAdvanceValidation('attempt', {
        moduleIndex: state.currentModuleIndex,
        conceptIndex: state.currentConceptIndex,
        phase: state.currentPhase,
        chunkIndex: state.currentTeachingChunkIndex,
        totalChunks: state.teachingPlanForPhase.length
    });

    // Early return for completed curriculum
    if (state.isCompleted) {
        return false;
    }
    
    // Handle Socratic special cases
    const socraticHandled = await handleSocraticPhase(curriculumData, state, learnerModel, llmPlanner);
    if (socraticHandled) {
        return socraticHandled;
    }
    
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
        const allPointsCovered = currentChunkTeachingPoints.every(
            tp => state.coveredPointsInCurrentChunk.has(tp.text)
        );
        const noPointsToRevisit = !state.pointsToRevisitInCurrentChunk ||
            currentChunkTeachingPoints.every(tp => !state.pointsToRevisitInCurrentChunk!.has(tp.text));
        currentChunkLocallyCompleted = allPointsCovered && noPointsToRevisit;
    } else {
        currentChunkLocallyCompleted = true; // Empty chunk is considered completed
    }

    const isLastChunkInPhase = state.currentTeachingChunkIndex >= state.teachingPlanForPhase.length - 1;
    
    // Handle chunk advancement (not last chunk)
    if (currentChunkLocallyCompleted && !isLastChunkInPhase) {
        state.currentTeachingChunkIndex++;
        state.coveredPointsInCurrentChunk = new Set<string>();
        state.pointsToRevisitInCurrentChunk = new Set<string>();
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;
        logAdvanceValidation('chunk-advanced', {
            curriculumPathId: currentItem.curriculumPathId,
            nextChunkIndex: state.currentTeachingChunkIndex + 1,
            phase: state.currentPhase
        });
        return true;
    }
    
    // Handle phase completion (last chunk)
    if (currentChunkLocallyCompleted && isLastChunkInPhase) {
        return await handlePhaseCompletion(curriculumData, state, learnerModel, llmPlanner, currentItem);
    }
    
    // Track incomplete chunks
    if (!currentChunkLocallyCompleted) {
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic++;
        logAdvanceValidation('chunk-gated', {
            curriculumPathId: currentItem.curriculumPathId,
            chunkIndex: state.currentTeachingChunkIndex + 1,
            interactionCounter: learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic
        });
    }

    return false;
}


// Main implementation of curriculum focus instruction generation
function buildEarlyReturnInstruction(
    state: CurriculumState,
    item: CurriculumItem | null
): string | null {
    
    if (state.isCompleted) {
        return CURRICULUM_COMPLETED_FOCUS_INSTRUCTION;
    }
    if (!item) {
        return GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    }
    if (state.activeConsolidationState) {
        return getConsolidationInstruction(item, state.activeConsolidationState);
    }
    return null;
}

function resolveFocusPoints(
    state: CurriculumState,
    preCalculatedFocusPoints?: { focusPoints: string[], primaryActionType: string }
): { focusPoints: string[], primaryActionType: string } {
    
    if (preCalculatedFocusPoints) {
        return {
            focusPoints: preCalculatedFocusPoints.focusPoints,
            primaryActionType: preCalculatedFocusPoints.primaryActionType
        };
    }
    
    const calculated = calculateFocusPoints(state);
    return {
        focusPoints: calculated.focusPoints,
        primaryActionType: calculated.primaryActionType
    };
}

function buildPrimaryActionInstruction(
    primaryActionType: string,
    focusPointsStrings: string[],
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean
): string {
    
    const shouldIncludeCheckUnderstanding = !isMustObeyTurn;
    
    switch (primaryActionType) {
        case "Revisit & Clarify (from current chunk)":
            return REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, shouldIncludeCheckUnderstanding);
        case "Revisit & Clarify (general points for this phase)":
            return REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(focusPointsStrings, shouldIncludeCheckUnderstanding);
        case "Teach New Content (from current chunk)": {
            const introExpansion = state.currentPhase === 'IntroIllustrate'
                ? `### IntroIllustrate Dual-Pass Structure\n- Conceptual Narrative: restate the teaching point in plain language so the learner immediately grasps what it is. Highlight the pain it removes, the stakes if it’s neglected, and how it builds on previously mastered recursion tools so it feels like a natural upgrade. Offer a brief thought experiment that contrasts a success path with a failure path to seed intuition without overwhelming detail. Share a gentle readiness signal (for example, noting that once this idea feels natural, the upcoming mechanics will click) to boost confidence, then explicitly preview that the technical drilldown will walk through the execution step by step.\n- Technical Drilldown: deliver an exceptionally expansive explanation of the action item’s technical meaning (contract, inputs, outputs, guarantees) that also covers application areas, strengths, trade-offs, and pitfalls so the learner gains interview-ready depth. After completing this long-form insight, optionally choose exactly one of the following supplemental modes—or skip them entirely if they would overwhelm the learner this turn:\n  * Full C++ Walkthrough: only when prerequisites are satisfied, present a tightly scoped implementation with narrated dry run and line-by-line linkage back to the concept.\n  * Fill-in-the-Blank Reveal: provide a scaffolded snippet, invite the learner to reason about the missing pieces, then unveil the completed solution and discuss how it realizes the concept.\n- Present two contrasting application scenarios (baseline and high-pressure or edge-case) and explain how the concept adapts.\n- Provide an algorithmic and communication perspective so the learner can explain trade-offs to interviewers.\n- Wrap up with a self-assessment checklist that highlights the critical mastery signals.`
                : undefined;
            return TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(focusPointsStrings, shouldIncludeCheckUnderstanding, introExpansion);
        }
        case "Reinforce & Deepen (current chunk)":
            return REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(item, focusPointsStrings);
        case "General Engagement":
            return GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(item, state);
        default:
            return "";
    }
}

function buildContextualInstruction(
    item: CurriculumItem,
    state: CurriculumState,
    primaryActionType: string,
    primaryActionInstruction: string
): string {
    const phase = state.currentPhase;
    
    // Base instruction
    let instruction = `${CURRICULUM_FOCUS_HEADER_BASE}
- Current Module: ${item.moduleTitle}
- Current Pedagogical Phase: ${phase}`;
    
    // Concept/Module context
    if (!item.isModuleWidePhase && item.concept) {
        instruction += ` (for Concept: ${item.concept.title})`;
    } else if (item.isModuleWidePhase) {
        instruction += ` (Module-Wide)`;
    }
    
    // Chunk progress
    instruction += ` (Chunk ${state.currentTeachingChunkIndex + 1} of ${state.teachingPlanForPhase.length || 1})

${CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE(primaryActionType)}
${primaryActionInstruction}

${CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER}
${CURRICULUM_FOCUS_MODULE_GOAL_PREFIX}
  "${item.moduleGoal}"`;

    // Concept details
    if (item.concept && !item.isModuleWidePhase) {
        instruction += `
${CURRICULUM_FOCUS_CONCEPT_DETAILS_HEADER}
  ${CURRICULUM_FOCUS_CONCEPT_TITLE_PREFIX} "${item.concept.title}"
  ${CURRICULUM_FOCUS_CONCEPT_EXPLANATION_PREFIX} "${item.concept.text}"`;
    } else if (item.isModuleWidePhase) {
        instruction += `
${CURRICULUM_FOCUS_MODULE_WIDE_FOCUS_MESSAGE_PREFIX} ('${phase}').`;
    }
    
    // Final directive
    instruction += `
${CURRICULUM_FOCUS_PHASE_SIGNAL_PREFIX} "${phase}". ${CURRICULUM_FOCUS_PHASE_SIGNAL_SUFFIX}

${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER}
${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY}`;

    if (phase === 'IntroIllustrate') {
        instruction += `
== 🔍 INTRO/ILLUSTRATE EXPANSION DIRECTIVE ==
Deliver two complementary passes: one that builds intuition and one that provides the mandated expansive technical drilldown described above. When you invoke the optional supplemental mode, tailor this second pass accordingly—use narrated C++ dry runs for the walkthrough option or scaffolded reasoning for the fill-in-the-blank option—otherwise remain entirely within the extended insight narrative.
Include contrasting application scenarios (baseline versus high-pressure) and describe how the learner should adjust in each case.
Offer an interview-oriented perspective so the learner can justify trade-offs out loud.
Wrap up with a concise self-assessment checklist reinforcing the mastery signals covered.`;
    }

    return instruction;
}

function getCurriculumFocusInstructionImpl(
    curriculum: Curriculum, 
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean,
    preCalculatedFocusPoints?: { focusPoints: string[], primaryActionType: string }
): string {
    
    // Handle early returns
    const earlyReturn = buildEarlyReturnInstruction(state, item);
    if (earlyReturn) return earlyReturn;
    
    // Resolve focus points
    const { focusPoints, primaryActionType } = resolveFocusPoints(state, preCalculatedFocusPoints);
    
    // Build primary action instruction
    const primaryActionInstruction = buildPrimaryActionInstruction(
        primaryActionType, focusPoints, item, state, isMustObeyTurn
    );
    
    // Build complete contextual instruction
    return buildContextualInstruction(item, state, primaryActionType, primaryActionInstruction);
}


/**
 * Calculates the focus points for the current teaching state.
 * These are the specific teaching points that should be emphasized in this turn.
 * @returns An object containing the focus points and metadata about the teaching action
 */
export function calculateFocusPoints(
    state: CurriculumState
): { focusPoints: string[], primaryActionType: string } {
    const currentChunkTeachingPoints = (state.teachingPlanForPhase && state.teachingPlanForPhase[state.currentTeachingChunkIndex]) 
        ? state.teachingPlanForPhase[state.currentTeachingChunkIndex] 
        : [];
    const currentChunkItemTexts = currentChunkTeachingPoints.map(tp => tp.text);
    
    let focusPoints: string[] = [];
    let primaryActionType = "";
    
    if (state.activeConsolidationState) {
        primaryActionType = "Consolidation";
        // During consolidation, focus on synthesis across all chunks
        focusPoints = []; // Consolidation doesn't use specific focus points
    } else if (state.pointsToRevisitInCurrentChunk && state.pointsToRevisitInCurrentChunk.size > 0) {
        // Priority 1: Points that need revisiting from current chunk
        const revisitPointsTexts = currentChunkItemTexts.filter(text => state.pointsToRevisitInCurrentChunk!.has(text));
        if (revisitPointsTexts.length > 0) {
            focusPoints = revisitPointsTexts;
            primaryActionType = "Revisit & Clarify (from current chunk)";
        } else {
            // Fallback: revisit points from other chunks
            focusPoints = Array.from(state.pointsToRevisitInCurrentChunk);
            primaryActionType = "Revisit & Clarify (general points for this phase)";
        }
    } else if (currentChunkItemTexts.length > 0) {
        // Priority 2: New uncovered points
        const uncoveredInChunkTexts = currentChunkItemTexts.filter(text => !state.coveredPointsInCurrentChunk.has(text));
        if (uncoveredInChunkTexts.length > 0) {
            focusPoints = uncoveredInChunkTexts;
            primaryActionType = "Teach New Content (from current chunk)";
        } else {
            // Priority 3: All covered, so reinforce
            focusPoints = currentChunkItemTexts; // Include all for reinforcement
            primaryActionType = "Reinforce & Deepen (current chunk)";
        }
    } else {
        // No teaching points available
        primaryActionType = "General Engagement";
        focusPoints = [];
    }
    
    return { focusPoints, primaryActionType };
}


// Main export function
export function getCurriculumFocusInstruction(
    curriculum: Curriculum, 
    item: CurriculumItem,
    state: CurriculumState,
    isMustObeyTurn: boolean,
    preCalculatedFocusPoints?: { focusPoints: string[], primaryActionType: string }
): string {
    return getCurriculumFocusInstructionImpl(curriculum, item, state, isMustObeyTurn, preCalculatedFocusPoints);
}

export function checkForSocraticCompletion(senseiResponse: string): SocraticCompletionResult {
    // Check for completion flag using regex
    const completionRegex = /\[SOCRATIC_COMPLETION_TRIGGERED:\s*(.+?)\]/;
    const match = senseiResponse.match(completionRegex);
    const triggered = Boolean(match);
    const trigger = triggered ? match![1].trim() : undefined;
    const cleanResponse = triggered ? senseiResponse.replace(completionRegex, '').trim() : senseiResponse;

    logSocraticCompletionValidation('completion-flag-check', {
        triggered,
        trigger: trigger ?? null,
        cleanResponseLength: cleanResponse.length
    });

    if (triggered) {
        return {
            triggered: true,
            trigger: trigger!,
            cleanResponse
        };
    }

    return {
        triggered: false,
        cleanResponse
    };
}

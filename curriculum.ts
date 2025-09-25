

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
    CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
    GENERAL_INTERACTION_FOCUS_INSTRUCTION,
    REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE,
    TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE,
    REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE,
    GENERAL_ENGAGEMENT_PROMPT_TEMPLATE,
    PEDAGOGICAL_GUIDANCE_PLACEHOLDER
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


export class TeachingPlanGenerationError extends Error {
    details: Record<string, unknown>;

    constructor(message: string, details: Record<string, unknown>) {
        super(message);
        this.name = 'TeachingPlanGenerationError';
        this.details = details;
    }
}

export class TeachingPlanValidationError extends TeachingPlanGenerationError {
    constructor(message: string, details: Record<string, unknown>) {
        super(message, details);
        this.name = 'TeachingPlanValidationError';
    }
}

export class CurriculumParsingError extends Error {
    details: Record<string, unknown>;

    constructor(message: string, details: Record<string, unknown>) {
        super(message);
        this.name = 'CurriculumParsingError';
        this.details = details;
    }
}

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
    socraticBaseInstruction?: string | null;
    socraticCompletionPending?: SocraticCompletionResult | null;
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

type LLMTeachingPlanGenerator = (phase: Phase, text: string) => Promise<TeachingPoint[][] | null>;


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

function logAdvanceValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[ADVANCE_VALIDATION]', { event, ...payload });
}

function logSocraticCompletionValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SOCRATIC_COMPLETION_VALIDATION]', { event, ...payload });
}

function validateAndProcessTeachingPlan(teachingPlan: TeachingPoint[][] | null, item: CurriculumItem, phase: Phase): TeachingPoint[][] {
    const planDetails = {
        curriculumPathId: item.curriculumPathId,
        phase
    };

    if (!Array.isArray(teachingPlan) || teachingPlan.length === 0) {
        const message = 'Teaching plan is empty or missing.';
        logger.error('[TEACHING_PLAN_INVALID]', { ...planDetails, reason: message });
        throw new TeachingPlanValidationError(message, planDetails);
    }

    const sanitizedPlan: TeachingPoint[][] = teachingPlan.map((chunk, chunkIndex) => {
        if (!Array.isArray(chunk) || chunk.length === 0) {
            const message = `Chunk ${chunkIndex + 1} is empty or not an array.`;
            logger.error('[TEACHING_PLAN_INVALID]', { ...planDetails, chunkIndex: chunkIndex + 1, reason: message });
            throw new TeachingPlanValidationError(message, { ...planDetails, chunkIndex: chunkIndex + 1 });
        }

        return chunk.map((actionItem, itemIndex) => {
            if (!actionItem) {
                const message = `Action item ${itemIndex + 1} in chunk ${chunkIndex + 1} is missing.`;
                logger.error('[TEACHING_PLAN_INVALID]', { ...planDetails, chunkIndex: chunkIndex + 1, itemIndex: itemIndex + 1, reason: message });
                throw new TeachingPlanValidationError(message, { ...planDetails, chunkIndex: chunkIndex + 1, itemIndex: itemIndex + 1 });
            }

            const text = typeof actionItem.text === 'string' ? actionItem.text.trim() : '';
            const kcValue = actionItem.kcValue;

            if (!text) {
                const message = `Action item ${itemIndex + 1} in chunk ${chunkIndex + 1} is missing text.`;
                logger.error('[TEACHING_PLAN_INVALID]', { ...planDetails, chunkIndex: chunkIndex + 1, itemIndex: itemIndex + 1, reason: message });
                throw new TeachingPlanValidationError(message, { ...planDetails, chunkIndex: chunkIndex + 1, itemIndex: itemIndex + 1 });
            }

            const isTitleItem = itemIndex === 0;
            const invalidKcValue = typeof kcValue !== 'number' || Number.isNaN(kcValue) || kcValue < 0 || (!isTitleItem && kcValue === 0);
            if (invalidKcValue) {
                const message = `Action item ${itemIndex + 1} in chunk ${chunkIndex + 1} has invalid kcValue.`;
                logger.error('[TEACHING_PLAN_INVALID]', {
                    ...planDetails,
                    chunkIndex: chunkIndex + 1,
                    itemIndex: itemIndex + 1,
                    kcValue,
                    reason: message
                });
                throw new TeachingPlanValidationError(message, {
                    ...planDetails,
                    chunkIndex: chunkIndex + 1,
                    itemIndex: itemIndex + 1,
                    kcValue
                });
            }

            const socraticMetadata = actionItem.socraticMetadata && typeof actionItem.socraticMetadata === 'object'
                ? ('detectedCategory' in actionItem.socraticMetadata && actionItem.socraticMetadata.detectedCategory !== undefined
                    ? { detectedCategory: actionItem.socraticMetadata.detectedCategory }
                    : {})
                : undefined;

            const sanitizedItem: TeachingPoint = {
                text,
                kcValue,
                ...(actionItem.isSocraticIntent !== undefined ? { isSocraticIntent: actionItem.isSocraticIntent } : {}),
                ...(actionItem.interactionGuidance !== undefined ? { interactionGuidance: actionItem.interactionGuidance } : {}),
                ...(socraticMetadata && Object.keys(socraticMetadata).length > 0 ? { socraticMetadata } : {})
            };

            return sanitizedItem;
        });
    });

    const { totalActionItems, totalKcValue } = calculateTeachingPlanMetrics(sanitizedPlan);
    const totalKcValueDisplay = Number.isFinite(totalKcValue) ? totalKcValue.toFixed(4) : 'NaN';

    if (totalActionItems === 0 || !Number.isFinite(totalKcValue) || totalKcValue <= 0) {
        const message = 'Teaching plan produced no actionable content or invalid KC totals.';
        logger.error('[TEACHING_PLAN_INVALID]', { ...planDetails, totalActionItems, totalKcValue: totalKcValueDisplay, reason: message });
        throw new TeachingPlanValidationError(message, { ...planDetails, totalActionItems, totalKcValue });
    }

    logTeachingPlanValidation({
        ...planDetails,
        chunks: sanitizedPlan.length,
        totalActionItems,
        totalKcValue: totalKcValueDisplay
    });

    return sanitizedPlan;
}

export async function generateTeachingPlanForPhase(
    curriculum: Curriculum,
    item: CurriculumItem,
    phase: Phase,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<TeachingPoint[][]> {
    const combinedText = buildCombinedContentText(curriculum, item, phase);
    if (combinedText.trim() === '') {
        const message = 'No source content available to generate teaching plan.';
        logger.error('[TEACHING_PLAN_GENERATION_FAILED]', {
            curriculumPathId: item.curriculumPathId,
            phase,
            reason: message
        });
        throw new TeachingPlanGenerationError(message, {
            curriculumPathId: item.curriculumPathId,
            phase
        });
    }

    let rawPlan: TeachingPoint[][] | null;
    try {
        rawPlan = await llmPlanner(phase, combinedText);
    } catch (error) {
        const message = 'LLM planner threw an exception while generating the teaching plan.';
        logger.error('[TEACHING_PLAN_GENERATION_FAILED]', {
            curriculumPathId: item.curriculumPathId,
            phase,
            reason: message,
            error: error instanceof Error ? error.message : String(error)
        });
        throw new TeachingPlanGenerationError(message, {
            curriculumPathId: item.curriculumPathId,
            phase,
            error: error instanceof Error ? error.message : String(error)
        });
    }

    return validateAndProcessTeachingPlan(rawPlan, item, phase);
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
        const header = moduleHeaders[i];
        if (!header) {
            continue;
        }
        const headerMatch = header.match;
        if (!headerMatch || headerMatch[1] === undefined || headerMatch[2] === undefined) {
            logger.warn('[CURRICULUM_PARSE] Skipping malformed module header.', { index: i, raw: headerMatch?.[0] });
            continue;
        }

        const startIndex = header.index ?? 0;
        const nextHeader = moduleHeaders[i + 1];
        const endIndex = nextHeader && nextHeader.index !== undefined ? nextHeader.index : txt.length;
        const content = txt.substring(startIndex, endIndex);

        const moduleIdStr = headerMatch[1].replace('.', '_');
        const segment: ModuleSegment = {
            moduleId: `Module${moduleIdStr}`,
            title: headerMatch[2].trim().replace(/\s*\(Version.*?\)/i, ''),
            content,
            startIndex,
            endIndex
        };
        segments.push(segment);

    }
    
    return segments;
}

function parseModuleGoal(moduleContent: string, moduleId: string): string {
    const goal = IMPROVED_REGEX_PATTERNS.goal.exec(moduleContent)?.[1]?.trim();
    if (!goal) {
        const details = {
            moduleId,
            snippet: moduleContent.slice(0, 200)
        };
        logger.error('[CURRICULUM_PARSE] Missing module goal.', details);
        throw new CurriculumParsingError('Missing module goal', details);
    }
    return goal;
}

function parseModuleConcepts(moduleContent: string, moduleId: string): Concept[] {
    const conceptsSectionMatch = IMPROVED_REGEX_PATTERNS.conceptsSection.exec(moduleContent);
    if (!conceptsSectionMatch || !conceptsSectionMatch[1]) {
        const details = {
            moduleId,
            snippet: moduleContent.slice(0, 200)
        };
        logger.error('[CURRICULUM_PARSE] Missing concepts section.', details);
        throw new CurriculumParsingError('Missing concepts section', details);
    }

    const concepts: Concept[] = [];
    const matches = Array.from(conceptsSectionMatch[1].matchAll(IMPROVED_REGEX_PATTERNS.individualConcept));

    if (matches.length === 0) {
        const details = {
            moduleId,
            snippet: conceptsSectionMatch[1].slice(0, 200)
        };
        logger.error('[CURRICULUM_PARSE] No valid concepts found.', details);
        throw new CurriculumParsingError('No valid concepts found', details);
    }

    for (const match of matches) {
        const title = match[2]?.trim();
        const text = match[3]?.trim();
        if (!title || !text) {
            const details = {
                moduleId,
                raw: match[0]
            };
            logger.error('[CURRICULUM_PARSE] Malformed concept entry.', details);
            throw new CurriculumParsingError('Malformed concept entry', details);
        }
        concepts.push({
            title,
            text
        });
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
            const title = stepMatch[1]?.trim();
            const text = stepMatch[2]?.trim();
            if (!title || !text) {
                logger.warn('[CURRICULUM_PARSE] Skipping malformed methodology step.', {
                    raw: stepMatch[0]
                });
                continue;
            }
            methodology.push({
                title,
                text
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
    const socratic = socraticMatch && socraticMatch[1] ? socraticMatch[1].trim() : '';
    
    solidifyRegex.lastIndex = 0;
    const solidifyMatch = solidifyRegex.exec(moduleContent);
    const solidify = solidifyMatch && solidifyMatch[1] ? solidifyMatch[1].trim() : '';
    
    
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
            goal: parseModuleGoal(segment.content, segment.moduleId),
            concepts: parseModuleConcepts(segment.content, segment.moduleId),
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
    if (!initialConcept) {
        logger.error("Selected module has no first concept:", initialModule.id);
        return null;
    }
    const initialPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
    if (!initialPhase) {
        logger.error('[CURRICULUM_INIT_FAILURE] No concept phases configured.');
        return null;
    }
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

    let teachingPlan: TeachingPoint[][];
    try {
        teachingPlan = await generateTeachingPlanForPhase(curriculumData, initialItemForPlan, initialPhase, llmPlanner);
    } catch (error) {
        logger.error('[CURRICULUM_INIT_FAILURE]', {
            moduleId: initialModule.id,
            phase: initialPhase,
            reason: error instanceof Error ? error.message : String(error)
        });
        return null;
    }

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
        concept: null,
        curriculumPathId: '', // Will be set below
        isLastConceptInModule: conceptIndex >= module.concepts.length - 1,
        isLastPhaseForConcept: false, // Will be updated based on phase
        isModuleWidePhase: isModuleWidePhase
    };

    if (!isModuleWidePhase) {
        const concept = module.concepts[conceptIndex];
        if (!concept) {
            logger.warn('[PHASE_JUMP_FAILURE] Concept index out of bounds during phase jump.', {
                moduleId: module.id,
                conceptIndex
            });
            return null;
        }
        curriculumItem.concept = concept;
    }
    
    // Generate curriculum path ID
    if (isModuleWidePhase) {
        curriculumItem.curriculumPathId = `${module.id}-Phase_${targetPhase}`;
    } else {
        const conceptTitleCleaned = curriculumItem.concept!.title.replace(/\s+/g, '_').replace(/\W/g, '');
        curriculumItem.curriculumPathId = `${module.id}-${conceptTitleCleaned}-Phase_${targetPhase}`;
    }
    
    // Generate teaching plan for the target phase
    let teachingPlan: TeachingPoint[][];
    try {
        teachingPlan = await generateTeachingPlanForPhase(curriculumData, curriculumItem, targetPhase, llmPlanner);
    } catch (error) {
        logger.error('[PHASE_JUMP_FAILURE]', {
            moduleId: module.id,
            phase: targetPhase,
            reason: error instanceof Error ? error.message : String(error)
        });
        return null;
    }

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

    if (previousConceptIndex === targetConceptIndex) {
        return true;
    }

    const newConcept = module.concepts[targetConceptIndex];
    if (!newConcept) {
        logger.warn('[CONCEPT_NAV] Concept unavailable at target index.', {
            targetConceptIndex,
            moduleId: module.id
        });
        return false;
    }
    const curriculumItem: CurriculumItem = {
        moduleTitle: module.title,
        moduleGoal: module.goal,
        concept: newConcept,
        curriculumPathId: `${module.id}-${newConcept.title.replace(/\s+/g, '_').replace(/\W/g, '')}-Phase_IntroIllustrate`,
        isLastConceptInModule: targetConceptIndex >= module.concepts.length - 1,
        isLastPhaseForConcept: false,
        isModuleWidePhase: false
    };

    let teachingPlan: TeachingPoint[][];
    try {
        teachingPlan = await generateTeachingPlanForPhase(
            curriculumData,
            curriculumItem,
            'IntroIllustrate',
            llmPlanner
        );
    } catch (error) {
        logger.error('[CONCEPT_NAV] Teaching plan generation failed', {
            moduleId: module.id,
            targetConceptIndex,
            reason: error instanceof Error ? error.message : String(error)
        });
        return false;
    }

    // Update concept index only after successful plan generation
    state.currentConceptIndex = targetConceptIndex;

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

    return true;
}

export function getInitialCurriculumTopicId(curriculumData: Curriculum | null): string {
    if (!curriculumData || curriculumData.modules.length === 0) {
        return "General_Introduction_To_Recursion";
    }
    const firstModule = curriculumData.modules[0];
    if (!firstModule || !firstModule.concepts || firstModule.concepts.length === 0) {
        return "General_Introduction_To_Recursion";
    }
    const firstConcept = firstModule.concepts[0];
    if (!firstConcept) {
        return "General_Introduction_To_Recursion";
    }
    const firstPhase = CONCEPT_PEDAGOGICAL_PHASES[0];

    const conceptTitleCleaned = firstConcept.title.replace(/\s+/g, '_').replace(/\W/g, '');
    return `${firstModule.id}-${conceptTitleCleaned}-Phase_${firstPhase}`;
}

export function getCurrentCurriculumItem(curriculumData: Curriculum, state: CurriculumState): CurriculumItem | null {
    if (state.isCompleted) {
        return null;
    }

    const module = curriculumData.modules[state.currentModuleIndex];
    if (!module) {
        logger.error('[CURRICULUM_STATE] Module missing for current index.', {
            moduleIndex: state.currentModuleIndex
        });
        return null;
    }
    const isModulePhase = MODULE_PEDAGOGICAL_PHASES.includes(state.currentPhase);

    let concept: Concept | null = null;
    let conceptTitleCleaned: string;
    let isLastConceptInModule = false;
    let isLastPhaseForConcept = false;

    if (isModulePhase) {
        conceptTitleCleaned = 'ModuleOverall'; 
    } else {
        if (!module.concepts || state.currentConceptIndex >= module.concepts.length) {
            logger.warn(`Current concept index ${state.currentConceptIndex} is out of bounds for module ${module.title} which has ${module.concepts.length} concepts.`);
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
    learnerModel.KCMasteryLastUpdated[phaseKCId] = new Date().toISOString();
}

function clearSocraticState(state: CurriculumState): void {
    state.socraticCompletionPending = null;
    state.socraticTurnCount = 0;
    state.socraticBaseInstruction = null;
}

async function processSocraticPendingCompletion(
    curriculumData: Curriculum,
    state: CurriculumState,
    learnerModel: LearnerModel,
    llmPlanner: LLMTeachingPlanGenerator
): Promise<boolean> {
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
        cleanupCompletedPhase(state, learnerModel, currentItem);
        try {
            determinePhaseTransition(state, curriculumData);
        } catch (error) {
            logger.error('[CURRICULUM_ADVANCE] Phase transition failed after Socratic completion.', {
                reason: error instanceof Error ? error.message : String(error)
            });
            state.isCompleted = true;
            return true;
        }
        if (state.isCompleted) {
            return true;
        }
        const initialized = await initializeNewPhaseState(curriculumData, state, learnerModel, llmPlanner);
        return initialized;
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
        return await processSocraticPendingCompletion(curriculumData, state, learnerModel, llmPlanner);
    }
    return await processSocraticFallbackCompletion(curriculumData, state, learnerModel, llmPlanner);
}

function determinePhaseTransition(state: CurriculumState, curriculumData: Curriculum): void {
    const module = curriculumData.modules[state.currentModuleIndex];
    if (!module) {
        logger.error('[CURRICULUM_ADVANCE] Module missing during phase transition.', {
            moduleIndex: state.currentModuleIndex
        });
        throw new CurriculumParsingError('Missing module for phase transition', {
            moduleIndex: state.currentModuleIndex
        });
    }

    const firstConceptPhase = CONCEPT_PEDAGOGICAL_PHASES[0];
    const firstModulePhase = MODULE_PEDAGOGICAL_PHASES[0];
    const secondModulePhase = MODULE_PEDAGOGICAL_PHASES[1];

    if (!firstConceptPhase || !firstModulePhase || !secondModulePhase) {
        logger.error('[CURRICULUM_ADVANCE] Phase configuration invalid.');
        throw new CurriculumParsingError('Invalid phase configuration', {
            conceptPhases: CONCEPT_PEDAGOGICAL_PHASES,
            modulePhases: MODULE_PEDAGOGICAL_PHASES
        });
    }

    if (CONCEPT_PEDAGOGICAL_PHASES.includes(state.currentPhase)) {
        const previousConceptIndex = state.currentConceptIndex;
        if (state.currentConceptIndex < module.concepts.length - 1) {
            state.currentConceptIndex++;
            state.currentPhase = firstConceptPhase;
            logAdvanceValidation('concept-advanced', {
                moduleIndex: state.currentModuleIndex,
                fromConceptIndex: previousConceptIndex,
                toConceptIndex: state.currentConceptIndex,
                nextPhase: state.currentPhase
            });
        } else {
            state.currentPhase = firstModulePhase;
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
        state.currentPhase = secondModulePhase;
        logAdvanceValidation('socratic-phase-transition', {
            moduleIndex: state.currentModuleIndex,
            conceptIndex: state.currentConceptIndex,
            nextPhase: state.currentPhase
        });
    } else if (state.currentPhase === 'Solidify') {
        if (state.currentModuleIndex < curriculumData.modules.length - 1) {
            state.currentModuleIndex++;
            state.currentConceptIndex = 0;
            state.currentPhase = firstConceptPhase;
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
    const newItem = getCurrentCurriculumItem(curriculumData, state);
    
    if (newItem) {
        // Generate new teaching plan
        let teachingPlan: TeachingPoint[][];
        try {
            teachingPlan = await generateTeachingPlanForPhase(
                curriculumData, newItem, state.currentPhase, llmPlanner
            );
        } catch (error) {
            logger.error('[PHASE_INIT_FAILURE]', {
                moduleId: curriculumData.modules[state.currentModuleIndex]?.id,
                phase: state.currentPhase,
                reason: error instanceof Error ? error.message : String(error)
            });
            return false;
        }

        // Reset KC and tracking for new phase only after plan success
        learnerModel.KCs[newItem.curriculumPathId] = 0;
        learnerModel.KCMasteryLastUpdated[newItem.curriculumPathId] = new Date().toISOString();
        learnerModel.awardedKcForPhasePoints = new Set<string>();

        state.currentTeachingChunkIndex = 0;
        state.teachingPlanForPhase = teachingPlan;
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
        try {
            determinePhaseTransition(state, curriculumData);
        } catch (error) {
            logger.error('[CURRICULUM_ADVANCE] Phase transition failed after mastery.', {
                reason: error instanceof Error ? error.message : String(error)
            });
            state.isCompleted = true;
            return true;
        }
        
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
                try {
                    determinePhaseTransition(state, curriculumData);
                } catch (error) {
                    logger.error('[CURRICULUM_ADVANCE] Phase transition failed during consolidation.', {
                        reason: error instanceof Error ? error.message : String(error)
                    });
                    state.isCompleted = true;
                    return true;
                }
                await initializeNewPhaseState(curriculumData, state, learnerModel, llmPlanner);
                return true;
            }
        }
        return false;
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
    const currentChunkTeachingPoints = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? [];

    let currentChunkLocallyCompleted = false;
    if (currentChunkTeachingPoints.length > 0) {
        const allPointsCovered = currentChunkTeachingPoints.every(
            tp => state.coveredPointsInCurrentChunk.has(tp.text)
        );
        const pointsToRevisit = state.pointsToRevisitInCurrentChunk;
        const noPointsToRevisit = !pointsToRevisit ||
            currentChunkTeachingPoints.every(tp => !pointsToRevisit.has(tp.text));
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
    includeCheckUnderstanding: boolean
): { instruction: string; includeCheck: boolean } {

    switch (primaryActionType) {
        case "Revisit & Clarify (from current chunk)":
            return {
                instruction: REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(focusPointsStrings),
                includeCheck: includeCheckUnderstanding
            };
        case "Revisit & Clarify (general points for this phase)":
            return {
                instruction: REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(focusPointsStrings),
                includeCheck: includeCheckUnderstanding
            };
        case "Teach New Content (from current chunk)":
            return {
                instruction: TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(focusPointsStrings),
                includeCheck: includeCheckUnderstanding
            };
        case "Reinforce & Deepen (current chunk)":
            return {
                instruction: REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(item, focusPointsStrings),
                includeCheck: includeCheckUnderstanding
            };
        case "General Engagement":
            return {
                instruction: GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(item, state),
                includeCheck: includeCheckUnderstanding
            };
        default:
            return {
                instruction: "",
                includeCheck: includeCheckUnderstanding
            };
    }
}

function buildSupportingContextBlock(
    item: CurriculumItem,
    state: CurriculumState
): string {
    const lines: string[] = [];
    lines.push(`- Current Module Goal (Overall context for this module):`);
    lines.push(`  "${item.moduleGoal}"`);

    if (item.concept && !item.isModuleWidePhase) {
        lines.push(`- Current Concept (Background for the primary action):`);
        lines.push(`  - Title: "${item.concept.title}"`);
        lines.push(`  - Core Explanation: "${item.concept.text}"`);
    } else if (item.isModuleWidePhase) {
        lines.push(`- Current Focus: This is a module-wide phase. Focus on the overall module goal and the nature of the current phase ('${state.currentPhase}').`);
    }

    lines.push(`- Current Phase Signal: You are in the "${state.currentPhase}". This signals the general style of interaction expected (e.g., 'IntroIllustrate' implies explanation and examples; 'Socratic' implies questioning and discussion; 'Solidify' implies review and connection).`);

    return lines.join('\n');
}

function buildContextualInstruction(
    item: CurriculumItem,
    state: CurriculumState,
    primaryActionType: string,
    primaryActionResult: { instruction: string; includeCheck: boolean }
): string {
    const sections: string[] = [];
    const chunkProgress = `Chunk ${state.currentTeachingChunkIndex + 1} of ${state.teachingPlanForPhase.length || 1}`;
    const phaseLineParts: string[] = [`Current Pedagogical Phase: ${state.currentPhase}`];

    if (!item.isModuleWidePhase && item.concept) {
        phaseLineParts.push(`(for Concept: ${item.concept.title})`);
    } else if (item.isModuleWidePhase) {
        phaseLineParts.push('(Module-Wide)');
    }

    phaseLineParts.push(`(${chunkProgress})`);

    sections.push([
        '## Curriculum Focus',
        `Current Module: ${item.moduleTitle}`,
        phaseLineParts.join(' ')
    ].join('\n'));

    sections.push([
        `## ⭐ PRIMARY ACTION FOR THIS TURN: ${primaryActionType} ⭐`,
        primaryActionResult.instruction
    ].join('\n'));

    sections.push(PEDAGOGICAL_GUIDANCE_PLACEHOLDER);

    if (primaryActionResult.includeCheck) {
        sections.push([
            '## 🧠 Let\'s Check Your Understanding',
            '(Here, you will ask 1-2 open-ended, Socratic questions that test the application of all concepts you just explained. The questions should require synthesis, not just recall. They must collectively cover the key topics from your main explanation.)'
        ].join('\n'));
    }

    sections.push([
        '## SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE',
        buildSupportingContextBlock(item, state)
    ].join('\n'));

    const assembled = sections.join('\n\n======\n\n');
    return `${assembled}\n\n======`;
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
    
    const includeCheckUnderstanding = !isMustObeyTurn;
    const primaryActionInstruction = buildPrimaryActionInstruction(
        primaryActionType,
        focusPoints,
        item,
        state,
        includeCheckUnderstanding
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
    const currentChunkTeachingPoints = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? [];
    const currentChunkItemTexts = currentChunkTeachingPoints.map(tp => tp.text);
    
    let focusPoints: string[] = [];
    let primaryActionType = "";
    const pointsToRevisit = state.pointsToRevisitInCurrentChunk;

    if (state.activeConsolidationState) {
        primaryActionType = "Consolidation";
        // During consolidation, focus on synthesis across all chunks
        focusPoints = []; // Consolidation doesn't use specific focus points
    } else if (pointsToRevisit && pointsToRevisit.size > 0) {
        // Priority 1: Points that need revisiting from current chunk
        const revisitPointsTexts = currentChunkItemTexts.filter(text => pointsToRevisit.has(text));
        if (revisitPointsTexts.length > 0) {
            focusPoints = revisitPointsTexts;
            primaryActionType = "Revisit & Clarify (from current chunk)";
        } else {
            // Fallback: revisit points from other chunks
            focusPoints = Array.from(pointsToRevisit);
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
    const trigger = match?.[1]?.trim();
    const triggered = Boolean(trigger);
    const cleanResponse = triggered ? senseiResponse.replace(completionRegex, '').trim() : senseiResponse;

    logSocraticCompletionValidation('completion-flag-check', {
        triggered,
        trigger: trigger ?? null,
        cleanResponseLength: cleanResponse.length
    });

    if (triggered && trigger) {
        return {
            triggered: true,
            trigger,
            cleanResponse
        };
    }

    return {
        triggered: false,
        cleanResponse
    };
}

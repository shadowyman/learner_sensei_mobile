
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, DEBUG_FLAGS } from './logger';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import {
    LearnerModel,
    initializeLearnerModel,
    updateLearnerModel,
    overrideChunkUnderstanding,
    // getPedagogicalGuidance is now obsolete
} from "./adaptiveEngine";
import {
    Curriculum,
    CurriculumState,
    CurriculumItem,
    TeachingPoint, // Import TeachingPoint
    Phase,
    parseModulesTxt,
    initializeCurriculumState,
    jumpToPhase,
    getCurrentCurriculumItem,
    advanceCurriculumState,
    getCurriculumFocusInstruction,
    calculateFocusPoints,
    isCurriculumLoaded,
    setCurriculum,
    getInitialCurriculumTopicId,
    generateTeachingPlanForPhase,
    checkForSocraticCompletion
} from "./curriculum";
import { PedagogicalProfiler } from "./pedagogicalProfiler";
import {
    Message,
    ReloadContext, // Import ReloadContext
    getPhaseDisplayName,
    initializeUI,
    updateCurriculumDisplay,
    showLoading,
    displayMessage,
    processMermaidBlocks,
    updateFooter,    
    setupFullscreenToggle,
    setupTextareaAutosize,
    streamingMessagesRawText,
    updateSenseiMeditationOverlay
} from './ui';
import { SaveLoadProgressManager } from './saveloadProgressManager';
import { ChatWindowController } from './chatWindowController';
import {
    llmExtractAndPlanTeachingOrder, 
    getAnalysisFromGemini
} from './geminiService';
import { 
    SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    MODULE_INTRODUCTION_TASK_TEMPLATE,
    CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
    GENERAL_INTERACTION_FOCUS_INSTRUCTION
} from './prompts';
import {
    streamModuleIntroduction,
    buildSenseiDynamicSystemInstruction,
    streamMainSenseiResponse,
    buildSocraticExecutionInstruction
} from './interactionHelpers';
import { initializeDebugMode, toggleDebugModalVisibility } from './debugMode'; // Import debug mode functions
import { initializeSelectionSensei } from "./selectionSensei"; // Import the new initializer
import { MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG } from './model_usage';
import { notepad } from './notepad';
import { runTestSuite } from './test';
import { ModuleSelectionHandler } from './moduleSelectionHandler';

// Auto-resize system configuration


const debug = false; 

const inputArea = document.getElementById('input-area') as HTMLFormElement;
const userInputElement = document.getElementById('user-input') as HTMLTextAreaElement;
const debugModeButton = document.getElementById('debug-mode-button') as HTMLButtonElement;


const isLocal = window.location.hostname === 'localhost';

const API_KEY = isLocal 
  ? 'AIzaSyDULWGft-KSgnRBBJbMJcItdGOeaaqWElk'
  : process.env.API_KEY;
let ai: GoogleGenAI | null = null;
let mainSenseiChat: Chat | null = null;
let learnerModel: LearnerModel = initializeLearnerModel();
let lastSenseiResponses: string[] = [];
let chronologicallyLastLLMSenseiMessageId: string | null = null; // For reload logic


let curriculum: Curriculum | null = null;
let curriculumState: CurriculumState | null = null;
let currentActiveConceptIndex: number | null = null; // Track current concept for notepad
let currentMessageId = 0;
let userInputHistory: string[] = [];
let pendingModuleSelection: number | null = null; // Track module selection pending phase choice
// Store project file contents (now primarily for the manifest itself)
const projectFileContents = new Map<string, string>();
let availableProjectFilePaths: string[] = []; // Stores the list of file paths

// Chat window controller instance
let chatWindowController: ChatWindowController | null = null;
// Module selection handler instance
let moduleSelectionHandler: ModuleSelectionHandler | null = null;

declare global {
    interface Window {
        switchToChunk?: (targetIndex: number) => Promise<void>;
        overrideChunkUnderstanding?: (payload: { chunkIndex: number; understood: boolean }) => Promise<void>;
        advanceConceptFromChunk?: () => Promise<void>;
    }
}

// Immediately expose state variables for SaveLoadProgressManager
// Using getters/setters to ensure we always get current values
Object.defineProperties(window, {
    curriculum: { get: () => curriculum, set: (v) => { curriculum = v; }, enumerable: true },
    curriculumState: { get: () => curriculumState, set: (v) => { curriculumState = v; }, enumerable: true },
    learnerModel: { get: () => learnerModel, set: (v) => { learnerModel = v; }, enumerable: true },
    currentMessageId: { get: () => currentMessageId, set: (v) => { currentMessageId = v; }, enumerable: true },
    lastSenseiResponses: { get: () => lastSenseiResponses, set: (v) => { lastSenseiResponses = v; }, enumerable: true },
    chronologicallyLastLLMSenseiMessageId: { get: () => chronologicallyLastLLMSenseiMessageId, set: (v) => { chronologicallyLastLLMSenseiMessageId = v; }, enumerable: true },
    mainSenseiChat: { get: () => mainSenseiChat, set: (v) => { mainSenseiChat = v; }, enumerable: true },
    userInputHistory: { get: () => userInputHistory, set: (v) => { userInputHistory = v; }, enumerable: true },
    pendingModuleSelection: { get: () => pendingModuleSelection, set: (v) => { pendingModuleSelection = v; }, enumerable: true },
    autoResizeEnabled: { get: () => chatWindowController?.getAutoResizePreference() || true, set: (v) => { chatWindowController?.setAutoResizePreference(v); }, enumerable: true },
    currentActiveConceptIndex: { get: () => currentActiveConceptIndex, set: (v) => { currentActiveConceptIndex = v; }, enumerable: true },
    projectFileContents: { get: () => projectFileContents, enumerable: true },
    notepad: { get: () => notepad, enumerable: true },
    streamingMessagesRawText: { get: () => streamingMessagesRawText, enumerable: true },
    // Expose UI functions for save/load restoration
    displayMessage: { get: () => displayMessage, enumerable: true },
    updateFooter: { get: () => updateFooter, enumerable: true },
    updateCurriculumDisplay: { get: () => updateCurriculumDisplay, enumerable: true },
    getCurrentCurriculumItem: { get: () => getCurrentCurriculumItem, enumerable: true },
    processMermaidBlocks: { get: () => processMermaidBlocks, enumerable: true }
});

window.switchToChunk = async (targetIndex: number) => {
    if (!curriculum || !curriculumState) {
        logger.warn('[CHUNK_SWITCH] Cannot switch chunk without active curriculum');
        return;
    }
    const currentItem = getCurrentCurriculumItem(curriculum, curriculumState);
    if (!currentItem) {
        logger.warn('[CHUNK_SWITCH] Current curriculum item unavailable');
        return;
    }
    if (targetIndex < 0) {
        logger.warn('[CHUNK_SWITCH] Requested chunk index below zero', { chunkIndex: targetIndex });
        return;
    }
    if (!curriculumState.teachingPlanForPhase ||
        curriculumState.teachingPlanForPhase.length === 0 ||
        targetIndex >= curriculumState.teachingPlanForPhase.length) {
        if (!ai) {
            logger.warn('[CHUNK_SWITCH] Teaching plan missing and AI unavailable');
            return;
        }
        await ensureTeachingPlanExists(curriculum, curriculumState, currentItem, ai);
    }
    if (!curriculumState.teachingPlanForPhase || targetIndex >= curriculumState.teachingPlanForPhase.length) {
        logger.warn('[CHUNK_SWITCH] Requested chunk index out of bounds after regeneration', { chunkIndex: targetIndex });
        return;
    }

    showLoading(true);
    try {
        const chunkPoints = curriculumState.teachingPlanForPhase[targetIndex] || [];
        curriculumState.currentTeachingChunkIndex = targetIndex;
        curriculumState.coveredPointsInCurrentChunk = new Set<string>();
        curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
        curriculumState.activeConsolidationState = null;
        learnerModel.awardedKcForPhasePoints = new Set<string>();
        if (learnerModel.contentPointsCoverage) {
            chunkPoints.forEach(point => {
                if (learnerModel.contentPointsCoverage && learnerModel.contentPointsCoverage[point.text]) {
                    delete learnerModel.contentPointsCoverage[point.text];
                }
            });
        }
        learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 0;

        const phaseKCId = currentItem.curriculumPathId;
        const currentKCMastery = learnerModel.KCs[phaseKCId] || 0;
        updateCurriculumDisplay(currentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
        updateSenseiMeditationOverlay(curriculumState, true);
        updateKCProgressBar(currentKCMastery);

        await generateNextSenseiResponse('', true);
    } catch (error) {
        logger.error('[CHUNK_SWITCH] Chunk switch failed', error);
    } finally {
        showLoading(false);
    }
};

window.overrideChunkUnderstanding = async ({ chunkIndex, understood }) => {
    if (!curriculum || !curriculumState) {
        logger.warn('[CHUNK_CHECK] Override attempted without active curriculum');
        return;
    }
    const currentItem = getCurrentCurriculumItem(curriculum, curriculumState);
    if (!currentItem) {
        logger.warn('[CHUNK_CHECK] Override failed: curriculum item unavailable');
        return;
    }
    if (!curriculumState.teachingPlanForPhase || chunkIndex < 0 || chunkIndex >= curriculumState.teachingPlanForPhase.length) {
        logger.warn('[CHUNK_CHECK] Override chunk index out of bounds', { chunkIndex });
        return;
    }

    overrideChunkUnderstanding(learnerModel, curriculumState, currentItem, chunkIndex, understood);
    const mastery = learnerModel.KCs[currentItem.curriculumPathId] || 0;
    updateKCProgressBar(mastery);
    updateCurriculumDisplay(currentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
    const overlayElement = document.getElementById('sensei-meditation-overlay');
    const overlayVisible = !!overlayElement && overlayElement.style.display !== 'none';
    updateSenseiMeditationOverlay(curriculumState, overlayVisible);
};

window.advanceConceptFromChunk = async () => {
    await handleConceptNavigation('next');
    const overlayElement = document.getElementById('sensei-meditation-overlay');
    const overlayVisible = !!overlayElement && overlayElement.style.display !== 'none';
    if (overlayVisible && curriculumState) {
        updateSenseiMeditationOverlay(curriculumState, true);
    }
};

const FALLBACK_FILE_PATHS = [
    'adaptiveEngine.ts',
    'curriculum.ts',
    'debugMode.ts',
    'file-manifest.json',
    'geminiService.ts',
    'index.css',
    'index.html',
    'index.tsx',
    'interactionHelpers.ts',
    'metadata.json',
    'model_usage.ts',
    'Modules.txt',
    'pedagogicalProfiler.ts',
    'prompts.ts',
    'selectionSensei.ts',
    'ui.ts'
];

async function loadProjectFileManifestAndPaths() {
    let filePathsToLoadFromManifest: string[] = [];
    let manifestStatusMessage = "";

    try {
        const manifestResponse = await fetch('file-manifest.json');
        if (!manifestResponse.ok) {
            throw new Error(`Failed to fetch file-manifest.json: ${manifestResponse.statusText} (${manifestResponse.status})`);
        }
        const manifestText = await manifestResponse.text();
        projectFileContents.set('file-manifest.json', manifestText); // Store manifest content

        try {
            const parsedManifest = JSON.parse(manifestText);
            if (Array.isArray(parsedManifest) && parsedManifest.every(item => typeof item === 'string')) {
                filePathsToLoadFromManifest = parsedManifest;
                manifestStatusMessage = `Successfully loaded ${filePathsToLoadFromManifest.length} file paths from file-manifest.json.`;
                logger.info(manifestStatusMessage);
                availableProjectFilePaths = filePathsToLoadFromManifest;
            } else {
                throw new Error("file-manifest.json is not a valid array of strings.");
            }
        } catch (parseError) {
            const errorMsg = `Error parsing file-manifest.json: ${parseError instanceof Error ? parseError.message : String(parseError)}. Falling back to predefined list.`;
            logger.warn(errorMsg);
            manifestStatusMessage = errorMsg;
            projectFileContents.set('file-manifest.json', `${manifestText}\n\n// ${manifestStatusMessage}`);
            availableProjectFilePaths = FALLBACK_FILE_PATHS;
        }
    } catch (fetchError) {
        const errorMsg = `Could not load file-manifest.json: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}. Falling back to predefined list.`;
        logger.warn(errorMsg);
        manifestStatusMessage = errorMsg;
        projectFileContents.set('file-manifest.json', `// ${manifestStatusMessage}`);
        availableProjectFilePaths = FALLBACK_FILE_PATHS;
    }
    // DO NOT fetch individual file contents here. That will be done on-demand in debugMode.ts.

} 

let profiler: PedagogicalProfiler | null = null;

async function initializeGoogleAI() {
    if (!API_KEY) {
        updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
        logger.error("API_KEY is not set.");
        return;
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
    
    // Initialize persistent chat immediately
    mainSenseiChat = ai.chats.create({
        model: MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.modelName,
        config: {
            ...MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.config,
            systemInstruction: SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS,
        },
        history: []
    });
    
    // Make AI available globally for Mermaid error recovery
    (window as any).ai = ai;
    logger.log("Google AI SDK initialized with persistent chat.");
    profiler = new PedagogicalProfiler(ai);


    if (ai) {
        initializeDebugMode(
            ai, 
            availableProjectFilePaths, 
            () => projectFileContents.get('file-manifest.json') || null
        );
    }
}



async function handleInitialModuleSelectionInternal(userInputText: string): Promise<boolean> {
    if (!moduleSelectionHandler) return false;
    
    // Update handler state before processing
    moduleSelectionHandler.updateState({
        curriculum,
        curriculumState,
        currentMessageId,
        lastSenseiResponses,
        userInputHistory,
        learnerModel,
        currentActiveConceptIndex,
        mainSenseiChat,
        ai,
        pendingModuleSelection
    });
    
    const result = await moduleSelectionHandler.handleInitialModuleSelectionInternal(userInputText);
    
    // Read back state changes - especially pendingModuleSelection
    const handlerState = moduleSelectionHandler.getState();
    pendingModuleSelection = handlerState.pendingModuleSelection;
    currentMessageId = handlerState.currentMessageId;
    lastSenseiResponses = handlerState.lastSenseiResponses;
    
    return result;
}

function createLLMPlannerCallback(
    curriculum: Curriculum,
    curriculumState: CurriculumState,
    ai: GoogleGenAI
): (text: string) => Promise<TeachingPoint[][]> {
    return async (text: string) => {
        const module = curriculum.modules[curriculumState.currentModuleIndex];
        const conceptsSummary = module.concepts.map(c => c.title).join(', ');
        const result = await llmExtractAndPlanTeachingOrder(ai, text, module.title, module.goal, conceptsSummary);
        return result || [];
    };
}

function calculateFocusStrategy(
    curriculumState: CurriculumState | null
): { focusPoints: string[], primaryActionType: string, upcomingActionItems: string[] } {
    if (curriculumState && !curriculumState.isCompleted) {
        const focusPointsData = calculateFocusPoints(curriculumState);
        return {
            focusPoints: focusPointsData.focusPoints,
            primaryActionType: focusPointsData.primaryActionType,
            upcomingActionItems: focusPointsData.focusPoints
        };
    }
    return { focusPoints: [], primaryActionType: 'none', upcomingActionItems: [] };
}

async function ensureTeachingPlanExists(
    curriculum: Curriculum,
    curriculumState: CurriculumState,
    currentItem: CurriculumItem,
    ai: GoogleGenAI
): Promise<void> {
    if (!curriculumState.teachingPlanForPhase || 
        curriculumState.teachingPlanForPhase.length === 0 ||
        !curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]) {
        
        curriculumState.teachingPlanForPhase = await generateTeachingPlanForPhase(
            curriculum, 
            currentItem, 
            curriculumState.currentPhase, 
            createLLMPlannerCallback(curriculum, curriculumState, ai)
        );
        curriculumState.currentTeachingChunkIndex = 0;
        curriculumState.coveredPointsInCurrentChunk = new Set<string>();
        curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
        learnerModel.awardedKcForPhasePoints = new Set<string>();
    }
}

function updateResponseHistory(
    responseText: string,
    messageId: string
): void {
    lastSenseiResponses.unshift(responseText);
    if (lastSenseiResponses.length > 3) {
        lastSenseiResponses.pop();
    }
    chronologicallyLastLLMSenseiMessageId = messageId;
}


async function generateNextSenseiResponse(inputText: string, skipPedagogicalIntervention: boolean = false) {
    // Update module selection handler state before processing
    if (moduleSelectionHandler) {
        moduleSelectionHandler.updateState({
            curriculum,
            curriculumState,
            currentMessageId,
            lastSenseiResponses,
            userInputHistory,
            learnerModel,
            currentActiveConceptIndex,
            mainSenseiChat,
            ai,
            pendingModuleSelection
        });
    }

    if (curriculum && !curriculumState && !await handleInitialModuleSelectionInternal(inputText)){
        showLoading(false);
        return;
    }

    let currentCurriculumItem = curriculum && curriculumState ? getCurrentCurriculumItem(curriculum, curriculumState) : null;
    
    if (curriculum && currentCurriculumItem && curriculumState) {
        await ensureTeachingPlanExists(curriculum, curriculumState, currentCurriculumItem, ai!);
    }
    const currentTaskIdForAnalysis = currentCurriculumItem ? currentCurriculumItem.curriculumPathId : learnerModel.CurrentTask.ID;
    
    const expectedContentPointTextsForCurrentChunk = (curriculumState?.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex])
        ? curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex].map(tp => tp.text)
        : [];

    // Skip analysis completely when navigating via arrows
    let analysisResult = null;
    if (!skipPedagogicalIntervention || inputText.trim() !== '') {
        analysisResult = await getAnalysisFromGemini(ai!, inputText, lastSenseiResponses[0] || null, currentTaskIdForAnalysis, expectedContentPointTextsForCurrentChunk);
    } else {
        logger.info('[CONCEPT_NAV] Skipping learner analysis for arrow navigation');
    }

    if (analysisResult) {
        if (DEBUG_FLAGS.learner_analysis_debug) {
            logger.warn("Recursive Sensei - Gemini Analysis of User Input:", {
                userInput: inputText,
                primaryIntent: analysisResult.primary_intent,
                affectiveState: {
                    confidence: analysisResult.affective_state.confidence,
                    engagement: analysisResult.affective_state.engagement,
                    frustration: analysisResult.affective_state.frustration,
                    confusion: analysisResult.affective_state.confusion,
                    selfEfficacy: analysisResult.affective_state.self_efficacy,
                },
                cognitiveLoad: {
                    perceivedDifficulty: analysisResult.cognitive_load_indicators.perceived_intrinsic_difficulty,
                    extraneousLoad: analysisResult.cognitive_load_indicators.extraneous_load_signals,
                },
                srl: {
                    planning: analysisResult.srl_indicators.planning_observed,
                    monitoring: analysisResult.srl_indicators.monitoring_observed,
                    helpSeeking: analysisResult.srl_indicators.help_seeking_style,
                    strategyHint: analysisResult.srl_indicators.strategy_hint,
                },
                misconceptions: analysisResult.misconception_hints.filter(m => m.likelihood === 'High' || m.likelihood === 'Medium'),
                knowledgeComponentUpdates: analysisResult.knowledge_component_references
                    .filter(kc => kc.kc_id !== currentTaskIdForAnalysis && (kc.understanding_signal === 'Positive' || kc.understanding_signal === 'Negative')),
                topicInteraction: analysisResult.topic_interaction,
                keyContentPointsCoverage: analysisResult.key_content_point_assessment?.map(kcp => ({
                    point: kcp.point_id,
                    coverage: kcp.coverage,
                    understanding_score: kcp.understanding_score
                })) || "Not assessed in this turn",
            });
        }
    }


    // Only update learner model if we have analysis results
    if (analysisResult) {
        learnerModel = updateLearnerModel(inputText, analysisResult, learnerModel, expectedContentPointTextsForCurrentChunk, curriculumState);
    }
    updateFooter(learnerModel); // NEW: Update the footer with the new model state
    if (debug) { 
        logger.log("Updated Learner Model:", JSON.stringify(learnerModel, null, 2)); 
    }
    if (curriculumState) { 
        logger.log("After Learner Model Update - Covered Points in Current Chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
        logger.log("After Learner Model Update - Points to Revisit in Current Chunk (text):", Array.from(curriculumState.pointsToRevisitInCurrentChunk || new Set()));
        
        // Log teaching point understanding scores for current chunk
        const currentChunkTeachingPoints = (curriculumState.teachingPlanForPhase && 
            curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]) 
            ? curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex] : [];
        
        const pointScores = currentChunkTeachingPoints.map(tp => {
            const score = learnerModel.contentPointsCoverage?.[tp.text]?.understanding_score || 0.0;
            return {
                point: tp.text.substring(0, 80) + (tp.text.length > 80 ? '...' : ''),
                score: score.toFixed(2),
                covered: curriculumState.coveredPointsInCurrentChunk.has(tp.text) ? '✓' : '✗'
            };
        });
        
        const formattedScores = pointScores.map((item, index) => 
            `  ${index + 1}. ${item.covered} [${item.score}] ${item.point}`
        ).join('\n');
        
        logger.log(`[CHUNK_UNDERSTANDING] Teaching Point Scores for Current Chunk:\n${formattedScores}`);
    }
    
    let curriculumWasAdvanced = false;
    // Skip curriculum advancement when navigating via arrows (already at desired concept)
    if (curriculum && curriculumState && !curriculumState.isCompleted && !skipPedagogicalIntervention) {
        const llmPlannerForAdvance = createLLMPlannerCallback(curriculum, curriculumState, ai!);
        curriculumWasAdvanced = await advanceCurriculumState(curriculum, curriculumState, learnerModel, llmPlannerForAdvance);
        
        if (curriculumWasAdvanced) {
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.info('[PHASE_REFACTOR_VALIDATION] Curriculum was advanced! New state:', {
                    moduleIndex: curriculumState.currentModuleIndex,
                    conceptIndex: curriculumState.currentConceptIndex,
                    phase: curriculumState.currentPhase
                });
            }
            const newPhaseKCId = getCurrentCurriculumItem(curriculum, curriculumState)?.curriculumPathId;
            if (newPhaseKCId && (!learnerModel.KCs[newPhaseKCId] || learnerModel.KCs[newPhaseKCId] === 0)) {
                 learnerModel.awardedKcForPhasePoints = new Set<string>();
            }
        } else {
            if (DEBUG_FLAGS.curriculum_debug) {
                logger.debug('[PHASE_REFACTOR_VALIDATION] Curriculum not advanced this turn');
            }
        }
    }
    
    const newCurrentItem = curriculum && curriculumState ? getCurrentCurriculumItem(curriculum, curriculumState) : null;
    if (newCurrentItem && curriculumState) {
        currentActiveConceptIndex = curriculumState.currentConceptIndex;
        logger.info('Active concept updated to:', currentActiveConceptIndex);
        notepad.updateActiveConceptIndex(currentActiveConceptIndex);
        notepad.updateActiveModuleIndex(curriculumState.currentModuleIndex);
        
        updateCurriculumDisplay(newCurrentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
        learnerModel.CurrentTask.ID = newCurrentItem.curriculumPathId;
        learnerModel.CurrentTask.TargetKCs = [newCurrentItem.curriculumPathId];

        // Update KC progress bar: reset to current phase mastery (0% for new phase, current progress for existing)
        const currentPhaseKCId = newCurrentItem.curriculumPathId;
        const currentPhaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
        // Update KC progress bar after curriculum advancement
        updateKCProgressBar(currentPhaseKCMastery);

        if (curriculum && newCurrentItem) { 
            await ensureTeachingPlanExists(curriculum, curriculumState, newCurrentItem, ai!);
        }
    } else if (curriculumState?.isCompleted) {
        updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
    }

    const focusStrategy = calculateFocusStrategy(curriculumState);
    const focusPointsData = focusStrategy.focusPoints.length > 0 ? {
        focusPoints: focusStrategy.focusPoints,
        primaryActionType: focusStrategy.primaryActionType
    } : null;
    const upcomingActionItems = focusStrategy.upcomingActionItems;

    // Skip pedagogical intervention when navigating via arrows to start fresh
    let guidanceText = "";
    let isMustObey = false;

    if (!skipPedagogicalIntervention) {
        guidanceText = await profiler!.getDirective(learnerModel, {
            upcomingActionItems: upcomingActionItems, // Now uses the focused subset
            lastThreeUserResponses: userInputHistory.slice(-3), // Pass last 3 user responses
            lastThreeSenseiResponses: lastSenseiResponses.slice(0, 3)   // Pass last 3 sensei responses
        });

        logger.log("Pedagogical Guidance Directive:", guidanceText);
        logger.log("Focus Points Type:", focusPointsData?.primaryActionType || "None");

        isMustObey = guidanceText.startsWith('MUST_OBEY');
    } else {
        logger.log("Pedagogical Guidance SKIPPED - Navigation via arrows");
    }
    
    // Track Socratic turns
    if (curriculumState && curriculumState.currentPhase === 'Socratic') {
        if (!curriculumState.socraticTurnCount) {
            curriculumState.socraticTurnCount = 0;
        }
        curriculumState.socraticTurnCount++;
        logger.info('Sensei:[SOCRATIC_V4] Socratic phase detected, turn:', curriculumState.socraticTurnCount);
    }
    
    const curriculumFocusInstruction = (curriculum && curriculumState && newCurrentItem)
        ? getCurriculumFocusInstruction(curriculum, newCurrentItem, curriculumState, isMustObey, focusPointsData || undefined)
        : curriculumState?.isCompleted
            ? CURRICULUM_COMPLETED_FOCUS_INSTRUCTION
            : GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    
    let dynamicContext: string;
    
    // Log diagnostic info for Socratic phase detection
    logger.info('Sensei:[SOCRATIC_V4] Phase check - currentPhase:', curriculumState?.currentPhase);
    logger.info('Sensei:[SOCRATIC_V4] Phase check - has teachingPlanForPhase:', !!curriculumState?.teachingPlanForPhase);
    logger.info('Sensei:[SOCRATIC_V4] Phase check - socraticTurnCount:', curriculumState?.socraticTurnCount);
    
    // Use Socratic-specific instruction building for Socratic phase
    if (curriculumState && curriculumState.currentPhase === 'Socratic' && curriculumState.teachingPlanForPhase) {
        logger.info('Sensei:[SOCRATIC_V4] Using Socratic execution instruction');
        logger.info('Sensei:[SOCRATIC_V4] User response turn, count:', curriculumState.socraticTurnCount);
        const pedagogicalGuidance = {
            metaPrompt: isMustObey ? guidanceText : undefined,
            directive: !isMustObey ? guidanceText : undefined
        };
        dynamicContext = buildSocraticExecutionInstruction(
            curriculumState.teachingPlanForPhase,
            pedagogicalGuidance,
            false  // isSystemInitialization = false for user responses
        );
    } else {
        logger.info('Sensei:[SOCRATIC_V4] NOT using Socratic execution - using standard dynamic instruction');
        dynamicContext = buildSenseiDynamicSystemInstruction(
            curriculumFocusInstruction,
            guidanceText
        );
    }

    currentMessageId++;
    const senseiMessageId = `msg-${currentMessageId}`;
    let senseiResponseText = "Sensei is generating response...";
    
    const reloadContext: ReloadContext = {
        type: 'mainResponse',
        dynamicSystemInstruction: dynamicContext,
        userInput: inputText
    };

    await displayMessage({
        id: senseiMessageId,
        sender: 'sensei',
        displayName: 'Recursive Sensei',
        text: senseiResponseText,
        timestamp: new Date(),
        isLoading: true,
        isReloadable: true,
        reloadContext: reloadContext
    });
    
    if (!ai) { 
        senseiResponseText = "Error: AI service not initialized.";
        await displayMessage({ 
            id: senseiMessageId, 
            sender: 'sensei', 
            displayName: 'Recursive Sensei', 
            text: senseiResponseText, 
            timestamp: new Date(), 
            isLoading: false,
            isReloadable: true, // Still allow trying to reload if AI comes back
            reloadContext: reloadContext
        });
        showLoading(false);
        return;
    }
    
    try {
        senseiResponseText = await streamMainSenseiResponse(mainSenseiChat!, dynamicContext, inputText, senseiMessageId);
        
        // Check for Socratic completion
        if (curriculumState && curriculumState.currentPhase === 'Socratic') {
            const completion = checkForSocraticCompletion(senseiResponseText);
            logger.info('Sensei:[SOCRATIC_V4] Completion check result:', completion);
            
            if (completion.triggered) {
                // Store completion pending for processing after response display
                curriculumState.socraticCompletionPending = completion;
                // Use clean response without the flag
                senseiResponseText = completion.cleanResponse;
            }
        }
        
        updateResponseHistory(senseiResponseText, senseiMessageId);
    } catch (error) {
        logger.error("Error sending message to Sensei:", error);
        senseiResponseText = "Sorry, I encountered an error trying to respond.";
        updateResponseHistory(senseiResponseText, senseiMessageId);
    } finally {
        await displayMessage({
            id: senseiMessageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: senseiResponseText,
            timestamp: new Date(),
            isLoading: false,
            isReloadable: true,
            reloadContext: reloadContext,
            skipMermaid: true,  // Phase 1: Skip mermaid processing
        });
        // Phase 2: Process mermaid blocks after display is stable
        await processMermaidBlocks(senseiMessageId);
        
        if (curriculumState) {
            logger.log(`After Sensei Response - Processing Chunk ${curriculumState.currentTeachingChunkIndex + 1} of ${curriculumState.teachingPlanForPhase.length || 1}.`);
            if (curriculumState.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]) {
                 logger.log(`Content of current chunk (TeachingPoint objects):`, curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]);
            }
            logger.log("Topics Covered in current chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
        }

        showLoading(false);

        // End overall timing was previously here but moved to function end
    }

}

async function handleUserInput(event: Event) {
    event.preventDefault();
    const inputText = userInputElement.value.trim();
    if (!inputText || !ai || !profiler) {
        return;
    }

    // Track input history management
    userInputHistory.push(inputText);
    if (userInputHistory.length > 10) { // Keep last 10 user inputs
        userInputHistory.shift();
    }

    // Track message creation
    currentMessageId++;
    const userMessage: Message = {
        id: `msg-${currentMessageId}`,
        sender: 'user',
        displayName: 'You',
        text: inputText,
        timestamp: new Date(),
        skipMermaid: true,  // Phase 1: Skip mermaid processing
    };

    // Track display message
    await displayMessage(userMessage);

    // Phase 2: Process mermaid blocks after display is stable
    await processMermaidBlocks(userMessage.id);

    // Track UI cleanup
    userInputElement.value = '';
    setupTextareaAutosize(userInputElement); // Reset textarea height

    if (inputText.trim().toLowerCase() === 'mskip') {
        if (curriculumState && curriculum && ai) {
            showLoading(true);

            // Award full KC for all points in the current chunk.
            const currentItem = getCurrentCurriculumItem(curriculum, curriculumState);
            const currentChunkPoints = curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex] || [];
            if (currentItem && currentChunkPoints.length > 0) {
                const phaseKCId = currentItem.curriculumPathId;
                if (!learnerModel.KCs[phaseKCId]) learnerModel.KCs[phaseKCId] = 0;

                for (const point of currentChunkPoints) {
                    if (!learnerModel.awardedKcForPhasePoints.has(point.text)) {
                        // Per user feedback, award the FULL base KC value on skip.
                        learnerModel.KCs[phaseKCId] += point.kcValue;
                        learnerModel.awardedKcForPhasePoints.add(point.text);
                    }
                    curriculumState.coveredPointsInCurrentChunk.add(point.text);
                    if(curriculumState.pointsToRevisitInCurrentChunk) {
                        curriculumState.pointsToRevisitInCurrentChunk.delete(point.text);
                    }
                }
                // Clamp mastery at 1.0 to prevent over-awarding
                learnerModel.KCs[phaseKCId] = Math.min(1.0, learnerModel.KCs[phaseKCId]);
                 logger.warn(`MSKIP: Awarded full KC for current chunk. New '${phaseKCId}' mastery: ${learnerModel.KCs[phaseKCId].toFixed(4)}`);
            }

            // Immediately advance state and generate the next turn's response.
            const llmPlannerForAdvance = createLLMPlannerCallback(curriculum, curriculumState, ai!);
            await advanceCurriculumState(curriculum, curriculumState, learnerModel, llmPlannerForAdvance);

            await generateNextSenseiResponse(inputText); // Call the refactored function for the new state.

            showLoading(false);
            return; // End execution for this input.
        } else {
            logger.warn("mskip command received, but curriculum/AI not ready. Proceeding normally.");
        }
    }


    // Track module selection path
    if (curriculum && !curriculumState) {
        const moduleSelected = await handleInitialModuleSelectionInternal(inputText);

        if (moduleSelected) {
            // showLoading(false) will be handled within handleInitialModuleSelectionInternal if it returns true
            // or by the subsequent generateNextSenseiResponse path.
            const userInputElem = document.getElementById('user-input') as HTMLTextAreaElement;
            if (userInputElem && curriculumState) {
                userInputElem.placeholder = "Module selected. Ask questions or type your thoughts...";
            }
            return;
        }
    }

    showLoading(true);
    // Normal processing path
    await generateNextSenseiResponse(inputText);
}

async function handleReloadSenseiMessage(messageId: string, context: ReloadContext) {
    if (!ai) {
        logger.error("AI not initialized, cannot reload message.");
        await displayMessage({
            id: messageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: "Sorry, I can't reload this message right now. AI service is unavailable.",
            timestamp: new Date(),
            isLoading: false,
            isReloadable: true,
            reloadContext: context,
        });
        return;
    }

    await displayMessage({ // Set bubble to loading state
        id: messageId,
        sender: 'sensei',
        displayName: 'Recursive Sensei',
        text: 'Reloading response...', // This text will be quickly replaced by stream
        timestamp: new Date(),
        isLoading: true,
        isReloadable: true, // It remains reloadable
        reloadContext: context,
    });
    streamingMessagesRawText.delete(messageId); // Clear previous raw text

    let newSenseiText = "";
    try {
        if (context.type === 'mainResponse' && context.dynamicSystemInstruction && context.userInput) {
            newSenseiText = await streamMainSenseiResponse(mainSenseiChat!, context.dynamicSystemInstruction, context.userInput, messageId);
        } else if (context.type === 'moduleIntro' && context.introSystemInstruction && context.moduleTitleForPrompt) {
            newSenseiText = await streamModuleIntroduction(mainSenseiChat!, context.introSystemInstruction, context.moduleTitleForPrompt, messageId);
        } else {
            throw new Error("Invalid reload context type or missing data for reload.");
        }

        if (messageId === chronologicallyLastLLMSenseiMessageId) {
            lastSenseiResponses[0] = newSenseiText;
        }
    } catch (error) {
        logger.error(`Error reloading Sensei message ${messageId}:`, error);
        newSenseiText = "Sorry, I encountered an error trying to reload that message.";
        if (messageId === chronologicallyLastLLMSenseiMessageId) {
            lastSenseiResponses[0] = newSenseiText;
        }
    } finally {
        await displayMessage({ // Display final reloaded content
            id: messageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: newSenseiText,
            timestamp: new Date(),
            isLoading: false,
            isReloadable: true,
            reloadContext: context,
            skipMermaid: true,  // Phase 1: Skip mermaid processing
        });
        // Phase 2: Process mermaid blocks after display is stable
        await processMermaidBlocks(messageId);
    }
}

async function handleClickedModuleSelection(moduleTitle: string) {
    if (!moduleSelectionHandler) return;
    
    // Update handler state before processing
    moduleSelectionHandler.updateState({
        curriculum,
        curriculumState,
        currentMessageId,
        lastSenseiResponses,
        userInputHistory,
        learnerModel,
        currentActiveConceptIndex,
        mainSenseiChat,
        ai,
        pendingModuleSelection
    });
    
    await moduleSelectionHandler.handleClickedModuleSelection(moduleTitle);
    
    // Read back any state changes - including pendingModuleSelection
    const handlerState = moduleSelectionHandler.getState();
    pendingModuleSelection = handlerState.pendingModuleSelection;
    currentMessageId = handlerState.currentMessageId;
    lastSenseiResponses = handlerState.lastSenseiResponses;
}

async function handlePhaseSelection(phaseName: string) {
    logger.log('[PHASE_DEBUG] handlePhaseSelection called with:', phaseName, 'handler exists:', !!moduleSelectionHandler);
    logger.log('[PHASE_DEBUG] Current pendingModuleSelection:', pendingModuleSelection);
    
    if (!moduleSelectionHandler) {
        logger.error('[PHASE_DEBUG] moduleSelectionHandler is null!');
        return;
    }
    
    // Update handler state before processing
    moduleSelectionHandler.updateState({
        curriculum,
        curriculumState,
        currentMessageId,
        lastSenseiResponses,
        userInputHistory,
        learnerModel,
        currentActiveConceptIndex,
        mainSenseiChat,
        ai,
        pendingModuleSelection
    });
    
    await moduleSelectionHandler.handlePhaseSelection(phaseName);
    
    // Read back any state changes from the handler
    const handlerState = moduleSelectionHandler.getState();
    pendingModuleSelection = handlerState.pendingModuleSelection;
    currentMessageId = handlerState.currentMessageId;
    lastSenseiResponses = handlerState.lastSenseiResponses;
    userInputHistory = handlerState.userInputHistory;
    learnerModel = handlerState.learnerModel;
    curriculumState = handlerState.curriculumState;
    currentActiveConceptIndex = handlerState.currentActiveConceptIndex;
}

/**
 * Initialize Save/Load UI Controls
 */
function initializeSaveLoadUI(): void {
    logger.info('[SAVELOAD-UI] Initializing save/load buttons');
    
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    
    if (!saveButton || !loadButton || !fileInput) {
        logger.warn('[SAVELOAD-UI] Save/load buttons not found in header');
        return;
    }
    
    saveButton.onclick = async () => {
        try {
            logger.info('[SAVELOAD-UI] Save clicked');
            await SaveLoadProgressManager.saveProgress();
        } catch (error) {
            logger.error('[SAVELOAD-UI] Save failed:', error);
            console.error('Failed to save progress. Check console for details.', error);
        }
    };
    
    fileInput.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            try {
                logger.info('[SAVELOAD-UI] Loading file:', file.name);
                await SaveLoadProgressManager.loadProgress(file);
            } catch (error) {
                logger.error('[SAVELOAD-UI] Load failed:', error);
                console.error('Failed to load progress. File may be corrupted.', error);
            }
            fileInput.value = ''; // Reset input
        }
    };
    
    loadButton.onclick = () => fileInput.click();
    
    // Add keyboard shortcut for save (Ctrl+S / Cmd+S)
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            SaveLoadProgressManager.saveProgress().catch(error => {
                logger.error('[SAVELOAD-UI] Save shortcut failed:', error);
            });
        }
    });
    
    logger.info('[SAVELOAD-UI] Save/load buttons initialized in header');
}

async function loadCurriculumAndGreet() {
    initializeUI();
    initializeSaveLoadUI(); // Add save/load buttons
    await loadProjectFileManifestAndPaths(); // Load manifest and paths
    await initializeGoogleAI(); // Initializes AI and then Debug Mode with paths

    if (!ai) { 
        return; 
    }
    
    // Run test suite (disabled by default, controlled by TEST_SUITE_CONFIG)
    if (API_KEY) {
        try {
            await runTestSuite(API_KEY);
        } catch (error) {
            logger.error("Failed to run test suite:", error);
        }
    }
    
    (window as any).handleModuleClick = (moduleId: string, moduleTitle: string) => {
        handleClickedModuleSelection(moduleTitle);
    };
    
    (window as any).handlePhaseSelection = async (phaseName: string) => {
        await handlePhaseSelection(phaseName);
    };

    (window as any).handleReloadSenseiMessage = 
        (messageId: string, context: ReloadContext) => 
        handleReloadSenseiMessage(messageId, context);
    
    // Expose SaveLoadProgressManager for save/load functionality
    (window as any).SaveLoadManager = SaveLoadProgressManager;
    (window as any).saveProgress = () => SaveLoadProgressManager.saveProgress();
    (window as any).loadProgress = (file: File) => SaveLoadProgressManager.loadProgress(file);
    
    // Setup the new main chat fullscreen button
    setupFullscreenToggle('main-chat-fullscreen-button', 'chat-container', 'main-chat-fullscreen');

    // Automatically start in fullscreen mode
    const fullscreenButton = document.getElementById('main-chat-fullscreen-button') as HTMLButtonElement;
    if (fullscreenButton) {
        fullscreenButton.click();
    }

    // Initialize the new self-contained selection sensei module
    const messageArea = document.getElementById('message-area') as HTMLDivElement;
    if (messageArea) {
        initializeSelectionSensei(ai, messageArea);
    }


    try {
        const response = await fetch('Modules.txt');
        if (!response.ok) {
            throw new Error(`Failed to load curriculum: ${response.statusText}`);
        }
        const txt = await response.text();
        curriculum = parseModulesTxt(txt);
        setCurriculum(curriculum);
        
        // Initialize notepad with curriculum
        notepad.initialize(curriculum);
        
        // Initialize module selection handler after curriculum is loaded
        if (ai && mainSenseiChat) {
            moduleSelectionHandler = new ModuleSelectionHandler({
                pendingModuleSelection,
                currentMessageId,
                lastSenseiResponses,
                userInputHistory,
                learnerModel,
                curriculum,
                curriculumState,
                currentActiveConceptIndex,
                mainSenseiChat,
                ai
            });
        }
        
        // Check for session restoration (as per save_load_implementation_plan.md line 1182)
        if (window.location.hash === '#restore' || sessionStorage.getItem('pendingRestore')) {
            logger.info('[INIT] Restoration mode detected - waiting for save file');
            displayMessage('🔄 Ready to restore your saved session. Please use the Load button to select a save file.', 'system');
            // Skip normal initialization - user will load a save file
            return;
        }

        if (curriculum && curriculum.modules.length > 0) {
            const initialId = getInitialCurriculumTopicId(curriculum); 
            learnerModel.CurrentTask.ID = initialId; 
            learnerModel.CurrentTask.TargetKCs = [initialId];
            learnerModel.KCs[initialId] = 0; 
            learnerModel.KCMasteryLastUpdated[initialId] = new Date().toISOString();
            learnerModel.awardedKcForPhasePoints = new Set<string>();


            let moduleListMessage = "Hello! I'm the Recursive Sensei. I can help you learn about the following topics. Please tell me which module `number` or part of the title you'd like to start with (e.g., 'start module 1', '1.5', or 'The Recursive Soul'). You can also type 'start curriculum' to begin with the first module, or simply click on a module below:\n\n**Available Modules:**\n\n";
            curriculum.modules.forEach((module) => {
                const moduleIdNumber = module.id.replace('Module', '').replace('_', '.');
                moduleListMessage += `*   **Module ${moduleIdNumber}:** ${module.title}\n`;
            });
            
            currentMessageId++;
            await displayMessage({ // Static message, not LLM reloadable
                id: `msg-${currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: moduleListMessage,
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false
            });
            updateResponseHistory(moduleListMessage, `msg-${currentMessageId}`);
            updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel); 
        } else {
            logger.error("Parsed curriculum is empty or invalid.");
            updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel); 
            currentMessageId++;
            await displayMessage({ // Static message
                id: `msg-${currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: "I seem to be having trouble loading my curriculum files. Please try refreshing!",
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false
            });
        }
    } catch (error) {
        logger.error("Error loading curriculum or preparing module list:", error);
        updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel); 
        currentMessageId++;
        await displayMessage({ // Static message
            id: `msg-${currentMessageId}`,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: "I had trouble loading my curriculum. Please check the console and try refreshing the page.",
            timestamp: new Date(),
            isLoading: false,
            isReloadable: false
        });
    } finally {
        updateFooter(learnerModel);
    }
    
    // Initialize draggable and resizable after everything is loaded
    // Initialize chat window controller with a small delay to ensure DOM is ready
    setTimeout(() => {
        chatWindowController = ChatWindowController.getInstance();
        chatWindowController.initialize();
    }, 100);
}

inputArea.addEventListener('submit', handleUserInput);
userInputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleUserInput(event);
    }
});
debugModeButton.addEventListener('click', () => toggleDebugModalVisibility(true));

// Concept Navigation Handler
async function handleConceptNavigation(direction: 'prev' | 'next') {
    if (!curriculumState || !curriculum || !learnerModel || !ai) {
        logger.warn('[CONCEPT_NAV] Cannot navigate: system not initialized');
        return;
    }

    // Only allow in IntroIllustrate phase
    if (curriculumState.currentPhase !== 'IntroIllustrate') {
        logger.warn('[CONCEPT_NAV] Navigation only allowed in IntroIllustrate phase');
        return;
    }

    const module = curriculum.modules[curriculumState.currentModuleIndex];
    if (!module) {
        logger.error('[CONCEPT_NAV] Current module not found');
        return;
    }

    const currentIndex = curriculumState.currentConceptIndex;
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds
    if (targetIndex < 0 || targetIndex >= module.concepts.length) {
        logger.warn('[CONCEPT_NAV] Target concept index out of bounds:', targetIndex);
        return;
    }

    showLoading(true);

    try {
        const llmPlanner = createLLMPlannerCallback(curriculum, curriculumState, ai);
        const { navigateToConcept } = await import('./curriculum');

        const success = await navigateToConcept(
            targetIndex,
            curriculum,
            curriculumState,
            learnerModel,
            llmPlanner
        );

        if (success) {
            // Update UI
            currentActiveConceptIndex = targetIndex;
            const newCurrentItem = getCurrentCurriculumItem(curriculum, curriculumState);
            if (newCurrentItem) {
                updateCurriculumDisplay(newCurrentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
                updateConceptNavigationArrows(curriculumState, curriculum);
            }

            // Update notepad
            notepad.updateActiveConceptIndex(targetIndex);

            // Reset KC progress bar for new concept
            updateKCProgressBar(0);

            // Clear interaction history for fresh start
            userInputHistory = [];
            lastSenseiResponses = [];
            logger.info('[CONCEPT_NAV] Cleared interaction history for fresh start');

            // Generate initial response for new concept with special flag
            // to skip pedagogical intervention
            await generateNextSenseiResponse('', true);
        }
    } catch (error) {
        logger.error('[CONCEPT_NAV] Navigation failed:', error);
    } finally {
        showLoading(false);
    }
}

// Update concept navigation arrow visibility and state
function updateConceptNavigationArrows(state: CurriculumState | null, curriculum: Curriculum | null) {
    const prevButton = document.getElementById('concept-nav-prev') as HTMLButtonElement;
    const nextButton = document.getElementById('concept-nav-next') as HTMLButtonElement;

    if (!prevButton || !nextButton) return;

    // Hide arrows if not in IntroIllustrate phase or no state
    if (!state || !curriculum || state.currentPhase !== 'IntroIllustrate') {
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        return;
    }

    const module = curriculum.modules[state.currentModuleIndex];
    if (!module) {
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        return;
    }

    // Show arrows and update disabled state
    prevButton.style.display = 'block';
    nextButton.style.display = 'block';

    prevButton.disabled = state.currentConceptIndex <= 0;
    nextButton.disabled = state.currentConceptIndex >= module.concepts.length - 1;
}

// Add event listeners for concept navigation arrows
const conceptNavPrev = document.getElementById('concept-nav-prev');
const conceptNavNext = document.getElementById('concept-nav-next');

if (conceptNavPrev) {
    conceptNavPrev.addEventListener('click', () => handleConceptNavigation('prev'));
}

if (conceptNavNext) {
    conceptNavNext.addEventListener('click', () => handleConceptNavigation('next'));
}

loadCurriculumAndGreet();

// KC Progress Bar Management
function updateKCProgressBar(kcphasemastery: number): void {
    // Input validation
    if (typeof kcphasemastery !== 'number' || isNaN(kcphasemastery) || kcphasemastery < 0) {
        logger.warn('Invalid KC mastery value for progress bar:', kcphasemastery);
        return;
    }
    
    try {
        const progressFill = document.getElementById('kc-progress-fill') as HTMLElement;
        const progressText = document.getElementById('kc-progress-text') as HTMLElement;
        const progressBar = progressFill?.parentElement as HTMLElement; // Get the .progress-bar element
        
        if (!progressFill || !progressText || !progressBar) {
            logger.warn('KC Progress bar elements not found in DOM');
            return;
        }
        
        // Calculate percentage (kcphasemastery is 0 to ~0.65, convert to 0-100%)
        const rawPercentage = (kcphasemastery / 0.65) * 100;
        const percentage = Math.round(Math.min(100, rawPercentage));
        
        // Update progress bar width and percentage text
        progressFill.style.width = percentage + '%';
        progressFill.setAttribute('data-progress', percentage.toString());
        progressText.textContent = percentage + '%';
        
        // Set data-has-progress attribute on progress bar for shimmer effect
        if (percentage > 0) {
            progressBar.setAttribute('data-has-progress', 'true');
        } else {
            progressBar.removeAttribute('data-has-progress');
        }
        
        // Special celebration animation for completion
        if (percentage === 100) {
            progressFill.style.animation = 'kc-progress-celebration 0.8s ease-in-out';
            setTimeout(() => {
                progressFill.style.animation = '';
            }, 800);
        }
    } catch (error) {
        logger.error('Error updating KC progress bar:', error);
    }
}

// Expose function globally with namespace to avoid conflicts
if (typeof window !== 'undefined') {
    (window as any).recursiveSensei = (window as any).recursiveSensei || {};
    (window as any).recursiveSensei.updateKCProgressBar = updateKCProgressBar;
    // Backward compatibility
    (window as any).updateKCProgressBar = updateKCProgressBar;
    
    // Expose concept index getter for notepad
    (window as any).getCurrentActiveConceptIndex = () => currentActiveConceptIndex;
}

// Add celebration keyframe animation
const celebrationStyle = document.createElement('style');
celebrationStyle.textContent = `
    @keyframes kc-progress-celebration {
        0%, 100% { transform: scaleY(1); }
        50% { 
            transform: scaleY(1.4); 
            box-shadow: 0 0 20px rgba(196, 229, 56, 0.8);
            filter: brightness(1.4);
        }
    }
`;
document.head.appendChild(celebrationStyle);

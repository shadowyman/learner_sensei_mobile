
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';

// Auto-resize system configuration
const AUTO_RESIZE_CONFIG = {
    enabled: true, // Default enabled
    expansionThreshold: 200, // Minimum viewport increase in pixels to trigger auto-resize
    debounceDelay: 150, // Delay in ms for debouncing resize events
    maxScaleFactor: 1.5, // Maximum scaling factor for auto-resize
    preferenceKey: 'sensei-auto-resize-enabled'
};
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import {
    LearnerModel,
    initializeLearnerModel,
    updateLearnerModel,
    // getPedagogicalGuidance is now obsolete
} from "./adaptiveEngine";
import {
    Curriculum,
    CurriculumState,
    CurriculumItem,
    TeachingPoint, // Import TeachingPoint
    parseModulesTxt,
    initializeCurriculumState,
    getCurrentCurriculumItem,
    advanceCurriculumState,
    getCurriculumFocusInstruction,
    isCurriculumLoaded,
    setCurriculum,
    getInitialCurriculumTopicId,
    generateTeachingPlanForPhase, 
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
    streamingMessagesRawText, // Import the map to pass as a dependency
    setupTextareaAutosize
} from './ui';
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
    streamMainSenseiResponse
} from './interactionHelpers';
import { initializeDebugMode, toggleDebugModalVisibility } from './debugMode'; // Import debug mode functions
import { initializeSelectionSensei } from "./selectionSensei"; // Import the new initializer
import { MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG } from './model_usage';

const debug = false; 

const inputArea = document.getElementById('input-area') as HTMLFormElement;
const userInputElement = document.getElementById('user-input') as HTMLTextAreaElement;
const debugModeButton = document.getElementById('debug-mode-button') as HTMLButtonElement;


const API_KEY = process.env.API_KEY;
let ai: GoogleGenAI | null = null;
let mainSenseiChat: Chat | null = null;
let learnerModel: LearnerModel = initializeLearnerModel();
let lastSenseiResponses: string[] = [];
let chronologicallyLastLLMSenseiMessageId: string | null = null; // For reload logic

// Global flag to coordinate between drag and resize
let isResizingWindow = false;

let curriculum: Curriculum | null = null;
let curriculumState: CurriculumState | null = null;
let currentMessageId = 0;
let userInputHistory: string[] = [];
// Store project file contents (now primarily for the manifest itself)
const projectFileContents = new Map<string, string>();
let availableProjectFilePaths: string[] = []; // Stores the list of file paths

// Auto-resize system state
let autoResizeEnabled = true;
let previousViewportWidth = window.innerWidth;
let previousViewportHeight = window.innerHeight;
let resizeDebounceTimer: number | null = null;
let isAutoResizing = false;

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
        logger.info("Attempting to load project file paths from file-manifest.json...");
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

    if (debug) {
        logger.log("Manifest status:", manifestStatusMessage || "Manifest processed.");
    }
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
    if (curriculum && !curriculumState) {
        let selectedModuleIndex: number | null = null;
        const lowerInput = userInputText.toLowerCase();

        if (lowerInput === "start curriculum") {
            selectedModuleIndex = 0;
        } else {
            const moduleMatch = lowerInput.match(/^(?:module\s*)?(\d+(?:[._]\d+)?)/);
            if (moduleMatch && moduleMatch[1]) {
                const moduleIdNumber = moduleMatch[1].replace('_', '.');
                selectedModuleIndex = curriculum.modules.findIndex(m => {
                    const curriculumModuleIdNum = m.id.replace('Module', '').replace('_', '.');
                    return curriculumModuleIdNum === moduleIdNumber;
                });
            }
            if (selectedModuleIndex === null || selectedModuleIndex === -1) {
                // Try matching by title, this will be hit by clicks passing the title
                selectedModuleIndex = curriculum.modules.findIndex(m => m.title.toLowerCase().includes(lowerInput) && lowerInput.length >= 3);
            }
        }

        if (selectedModuleIndex !== null && selectedModuleIndex >= 0 && selectedModuleIndex < curriculum.modules.length) {
            curriculumState = await initializeCurriculumState(curriculum, selectedModuleIndex, (text) => llmExtractAndPlanTeachingOrder(ai!, text));
            
            if (curriculumState) {
                const currentItem = getCurrentCurriculumItem(curriculum, curriculumState);
                if (currentItem) {
                    learnerModel.CurrentTask.ID = currentItem.curriculumPathId;
                    learnerModel.CurrentTask.TargetKCs = [currentItem.curriculumPathId];
                    if (!learnerModel.KCs[currentItem.curriculumPathId]) {
                        learnerModel.KCs[currentItem.curriculumPathId] = 0;
                    }
                    learnerModel.KCMasteryLastUpdated[currentItem.curriculumPathId] = new Date().toISOString();
                    learnerModel.awardedKcForPhasePoints = new Set<string>();

                    updateCurriculumDisplay(currentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);

                    const selectedModule = curriculum.modules[selectedModuleIndex];
                    const firstConceptTitle = currentItem.concept?.title || "the first topic";
                    const phaseDisplayName = getPhaseDisplayName(curriculumState.currentPhase);
                    const initialInstructionForSensei = getCurriculumFocusInstruction(curriculum, currentItem, curriculumState, false); // Not a MUST_OBEY turn

                    currentMessageId++;
                    const senseiIntroId = `msg-${currentMessageId}`;
                    let introResponseText = "Sensei is preparing the first lesson...";
                    
                    const introContext = `${MODULE_INTRODUCTION_TASK_TEMPLATE(selectedModule.title, firstConceptTitle, phaseDisplayName, userInputText)}
${initialInstructionForSensei}
`;
                    const reloadContext: ReloadContext = {
                        type: 'moduleIntro',
                        introSystemInstruction: introContext,
                        moduleTitleForPrompt: selectedModule.title
                    };

                    await displayMessage({
                        id: senseiIntroId,
                        sender: 'sensei',
                        displayName: 'Recursive Sensei',
                        text: introResponseText,
                        timestamp: new Date(),
                        isLoading: true,
                        isReloadable: true,
                        reloadContext: reloadContext,
                    });

                    try {
                        introResponseText = await streamModuleIntroduction(mainSenseiChat!, introContext, selectedModule.title, senseiIntroId);
                        lastSenseiResponses.unshift(introResponseText);
                        if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
                        chronologicallyLastLLMSenseiMessageId = senseiIntroId;
                    } catch (error) {
                        logger.error("Error generating module intro:", error);
                        introResponseText = `Alright, let's start with **${selectedModule.title}** and the concept of **"${firstConceptTitle}"**. What are your initial thoughts or questions?`;
                        lastSenseiResponses.unshift(introResponseText);
                        if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
                        chronologicallyLastLLMSenseiMessageId = senseiIntroId; // Still counts as last message
                    } finally {
                        await displayMessage({
                            id: senseiIntroId,
                            sender: 'sensei',
                            displayName: 'Recursive Sensei',
                            text: introResponseText,
                            timestamp: new Date(),
                            isLoading: false,
                            isReloadable: true,
                            reloadContext: reloadContext,
                            skipMermaid: true,  // Phase 1: Skip mermaid processing
                        });
                        // Phase 2: Process mermaid blocks after display is stable
                        await processMermaidBlocks(senseiIntroId);
                    }

                    logger.log("Purging pre-curriculum history. Resetting user and sensei logs.");
                    userInputHistory = [];
                    lastSenseiResponses = [introResponseText]; // Seed the history with ONLY the first teaching 
                    
                    if (curriculumState) {
                        logger.log(`After Module Intro - Processing Chunk ${curriculumState.currentTeachingChunkIndex + 1} of ${curriculumState.teachingPlanForPhase.length || 1}.`);
                        if (curriculumState.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]) {
                            logger.log(`Content of current chunk (TeachingPoint objects):`, curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]);
                        }
                        logger.log("Topics Covered in current chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
                    }
                    return true;
                }
            } else {
                return false;
            }
        } else if (selectedModuleIndex === null || selectedModuleIndex === -1) {
            currentMessageId++;
            const nudgeText = "I'm ready to start a module when you are! Please choose from the list I provided, or type 'start curriculum' for the first one. If you have a general question, feel free to ask!";
            await displayMessage({ // This is a static message, not reloadable by LLM
                id: `msg-${currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: nudgeText,
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false 
            });
            lastSenseiResponses.unshift(nudgeText);
            if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
            chronologicallyLastLLMSenseiMessageId = `msg-${currentMessageId}`; // Track its ID as last
            return true; 
        }
    }
    return false; 
}

async function generateNextSenseiResponse(inputText: string) {
    if (curriculum && !curriculumState && !await handleInitialModuleSelectionInternal(inputText)){
        showLoading(false);
        return;
    }


    let currentCurriculumItem = curriculum && curriculumState ? getCurrentCurriculumItem(curriculum, curriculumState) : null;
    
    if (curriculum && currentCurriculumItem && curriculumState && (!curriculumState.teachingPlanForPhase || curriculumState.teachingPlanForPhase.length === 0)) {
        curriculumState.teachingPlanForPhase = await generateTeachingPlanForPhase(curriculum, currentCurriculumItem, curriculumState.currentPhase, (text) => llmExtractAndPlanTeachingOrder(ai!, text));
        curriculumState.currentTeachingChunkIndex = 0; 
        curriculumState.coveredPointsInCurrentChunk = new Set<string>();
        curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
        learnerModel.awardedKcForPhasePoints = new Set<string>(); 
    }
    const currentTaskIdForAnalysis = currentCurriculumItem ? currentCurriculumItem.curriculumPathId : learnerModel.CurrentTask.ID;
    
    const expectedContentPointTextsForCurrentChunk = (curriculumState?.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex])
        ? curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex].map(tp => tp.text)
        : [];

    const analysisResult = await getAnalysisFromGemini(ai!, inputText, lastSenseiResponses[0] || null, currentTaskIdForAnalysis, expectedContentPointTextsForCurrentChunk);

    if (analysisResult) {
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


    learnerModel = updateLearnerModel(inputText, analysisResult, learnerModel, expectedContentPointTextsForCurrentChunk, curriculumState);
    updateFooter(learnerModel); // NEW: Update the footer with the new model state
    if (debug) { 
        logger.log("Updated Learner Model:", JSON.stringify(learnerModel, null, 2)); 
    }
    if (curriculumState) { 
        logger.log("After Learner Model Update - Covered Points in Current Chunk (text):", Array.from(curriculumState.coveredPointsInCurrentChunk));
        logger.log("After Learner Model Update - Points to Revisit in Current Chunk (text):", Array.from(curriculumState.pointsToRevisitInCurrentChunk || new Set()));
    }
    
    let curriculumWasAdvanced = false;
    if (curriculum && curriculumState && !curriculumState.isCompleted) {
        const llmPlannerForAdvance = async (text: string) => {
            const plan = await llmExtractAndPlanTeachingOrder(ai!, text);
            return plan;
        };
        curriculumWasAdvanced = await advanceCurriculumState(curriculum, curriculumState, learnerModel, llmPlannerForAdvance);
        
        if (curriculumWasAdvanced) {
            const newPhaseKCId = getCurrentCurriculumItem(curriculum, curriculumState)?.curriculumPathId;
            if (newPhaseKCId && (!learnerModel.KCs[newPhaseKCId] || learnerModel.KCs[newPhaseKCId] === 0)) {
                 learnerModel.awardedKcForPhasePoints = new Set<string>();
            }
        }
    }
    
    const newCurrentItem = curriculum && curriculumState ? getCurrentCurriculumItem(curriculum, curriculumState) : null;
    if (newCurrentItem && curriculumState) {
        updateCurriculumDisplay(newCurrentItem, curriculumState.currentPhase, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
        learnerModel.CurrentTask.ID = newCurrentItem.curriculumPathId;
        learnerModel.CurrentTask.TargetKCs = [newCurrentItem.curriculumPathId];

        // Update KC progress bar: reset to current phase mastery (0% for new phase, current progress for existing)
        const currentPhaseKCId = newCurrentItem.curriculumPathId;
        const currentPhaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
        // Update KC progress bar after curriculum advancement
        updateKCProgressBar(currentPhaseKCMastery);

        if (curriculum && (!curriculumState.teachingPlanForPhase || curriculumState.teachingPlanForPhase.length === 0 || !curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex])) { 
            curriculumState.teachingPlanForPhase = await generateTeachingPlanForPhase(curriculum, newCurrentItem, curriculumState.currentPhase, (text) => llmExtractAndPlanTeachingOrder(ai!, text));
            curriculumState.currentTeachingChunkIndex = 0;
            curriculumState.coveredPointsInCurrentChunk = new Set<string>(); 
            curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
            learnerModel.awardedKcForPhasePoints = new Set<string>();
        }
    } else if (curriculumState?.isCompleted) {
        updateCurriculumDisplay(null, null, curriculum, curriculumState, isCurriculumLoaded(), learnerModel);
    }

    // Recalculate the upcoming action items AFTER the curriculum has potentially advanced.
    const upcomingActionItems = (curriculumState?.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex])
        ? curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex].map(tp => tp.text)
        : [];

    const guidanceText = await profiler!.getDirective(learnerModel, {
        upcomingActionItems: upcomingActionItems,
        lastThreeUserResponses: userInputHistory.slice(-3), // Pass last 3 user responses
        lastThreeSenseiResponses: lastSenseiResponses.slice(0, 3)   // Pass last 3 sensei responses
    });

    logger.log("Pedagogical Guidance Directive:", guidanceText);

    const isMustObey = guidanceText.startsWith('MUST_OBEY');
    
    const curriculumFocusInstruction = (curriculum && curriculumState && newCurrentItem)
        ? getCurriculumFocusInstruction(curriculum, newCurrentItem, curriculumState, isMustObey)
        : curriculumState?.isCompleted 
            ? CURRICULUM_COMPLETED_FOCUS_INSTRUCTION
            : GENERAL_INTERACTION_FOCUS_INSTRUCTION;
    
    const dynamicContext = buildSenseiDynamicSystemInstruction(
        curriculumFocusInstruction,
        guidanceText
    );

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
        lastSenseiResponses.unshift(senseiResponseText);
        if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
        chronologicallyLastLLMSenseiMessageId = senseiMessageId;
    } catch (error) {
        logger.error("Error sending message to Sensei:", error);
        senseiResponseText = "Sorry, I encountered an error trying to respond.";
        lastSenseiResponses.unshift(senseiResponseText);
        if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
        chronologicallyLastLLMSenseiMessageId = senseiMessageId;
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
    }
}

async function handleUserInput(event: Event) {
    event.preventDefault();
    const inputText = userInputElement.value.trim();
    if (!inputText || !ai || !profiler) return;

    userInputHistory.push(inputText);
    if (userInputHistory.length > 10) { // Keep last 10 user inputs
        userInputHistory.shift(); 
    }

    currentMessageId++;
    const userMessage: Message = {
        id: `msg-${currentMessageId}`,
        sender: 'user',
        displayName: 'You',
        text: inputText,
        timestamp: new Date(),
        skipMermaid: true,  // Phase 1: Skip mermaid processing
    };
    await displayMessage(userMessage);
    // Phase 2: Process mermaid blocks after display is stable
    await processMermaidBlocks(userMessage.id);
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
            const llmPlannerForAdvance = async (text: string) => {
                 const plan = await llmExtractAndPlanTeachingOrder(ai!, text);
                 return plan;
            };
            await advanceCurriculumState(curriculum, curriculumState, learnerModel, llmPlannerForAdvance);
            await generateNextSenseiResponse(inputText); // Call the refactored function for the new state.
            showLoading(false);
            return; // End execution for this input.
        } else {
            logger.warn("mskip command received, but curriculum/AI not ready. Proceeding normally.");
        }
    }


    if (curriculum && !curriculumState && await handleInitialModuleSelectionInternal(inputText)) {
        // showLoading(false) will be handled within handleInitialModuleSelectionInternal if it returns true
        // or by the subsequent generateNextSenseiResponse path.
        const userInputElem = document.getElementById('user-input') as HTMLTextAreaElement;
        if (userInputElem && curriculumState) { 
            userInputElem.placeholder = "Module selected. Ask questions or type your thoughts...";
        }
        return;
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
    if (!ai || !curriculum) { 
        logger.warn("AI or Curriculum not ready for clicked module selection.");
        currentMessageId++;
        await displayMessage({ // Not reloadable by LLM
            id: `msg-${currentMessageId}`,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: "I'm not quite ready to start a module yet. Please wait a moment and try again.",
            timestamp: new Date(),
            isLoading: false,
            isReloadable: false
        });
        return;
    }

    currentMessageId++;
    const userMessage: Message = {
        id: `msg-${currentMessageId}`,
        sender: 'user',
        displayName: 'You',
        text: `Start module: "${moduleTitle}"`, 
        timestamp: new Date(),
        skipMermaid: true,  // Phase 1: Skip mermaid processing
    };
    await displayMessage(userMessage);
    // Phase 2: Process mermaid blocks after display is stable
    await processMermaidBlocks(userMessage.id);
    if (userInputElement) userInputElement.value = ''; 
    setupTextareaAutosize(userInputElement); // Reset textarea height

    const success = await handleInitialModuleSelectionInternal(moduleTitle);

    if (success && curriculumState) { 
        if (userInputElement) {
            userInputElement.placeholder = "Module selected. Ask questions or type your thoughts...";
        }
    } else {
        currentMessageId++;
        const errorMessage = `I'm sorry, I had trouble starting the module "${moduleTitle}" properly. Please try selecting again or type the module name.`;
        await displayMessage({ // Not reloadable by LLM
            id: `msg-${currentMessageId}`,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: errorMessage,
            timestamp: new Date(),
            isLoading: false,
            isReloadable: false
        });
        lastSenseiResponses.unshift(errorMessage);
        if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
        chronologicallyLastLLMSenseiMessageId = `msg-${currentMessageId}`;
    }
}


async function loadCurriculumAndGreet() {
    initializeUI();
    await loadProjectFileManifestAndPaths(); // Load manifest and paths
    await initializeGoogleAI(); // Initializes AI and then Debug Mode with paths

    if (!ai) { 
        return; 
    }
    (window as any).handleModuleClick = (moduleId: string, moduleTitle: string) => {
        handleClickedModuleSelection(moduleTitle);
    };

    (window as any).handleReloadSenseiMessage = 
        (messageId: string, context: ReloadContext) => 
        handleReloadSenseiMessage(messageId, context);
    
    // Setup the new main chat fullscreen button
    setupFullscreenToggle('main-chat-fullscreen-button', 'chat-container', 'main-chat-fullscreen');

    // Initialize the new self-contained selection sensei module
    const messageArea = document.getElementById('message-area') as HTMLDivElement;
    if (messageArea) {
        initializeSelectionSensei(ai, messageArea, streamingMessagesRawText);
    }


    try {
        const response = await fetch('Modules.txt');
        if (!response.ok) {
            throw new Error(`Failed to load curriculum: ${response.statusText}`);
        }
        const txt = await response.text();
        curriculum = parseModulesTxt(txt);
        setCurriculum(curriculum); 

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
            lastSenseiResponses.unshift(moduleListMessage);
            if (lastSenseiResponses.length > 3) lastSenseiResponses.pop(); // Keep last 3 Sensei responses
            chronologicallyLastLLMSenseiMessageId = `msg-${currentMessageId}`;
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
    makeMainWindowDraggable();
    makeMainWindowResizable();
    initializeAutoResizeSystem();
}

inputArea.addEventListener('submit', handleUserInput);
userInputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleUserInput(event);
    }
});
debugModeButton.addEventListener('click', () => toggleDebugModalVisibility(true));

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
        
        if (!progressFill || !progressText) {
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

function makeMainWindowDraggable() {
    const chatContainer = document.getElementById('chat-container');
    const header = document.querySelector('.chat-window-header') as HTMLElement;
    if (!chatContainer || !header) return;

    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    // Set initial styles once
    if (!chatContainer.style.position || chatContainer.style.position === 'relative') {
        const rect = chatContainer.getBoundingClientRect();
        chatContainer.style.position = 'fixed';
        chatContainer.style.width = rect.width + 'px';
        chatContainer.style.height = rect.height + 'px';
        chatContainer.style.top = '50%';
        chatContainer.style.left = '50%';
        chatContainer.style.transform = 'translate(-50%, -50%)';
        chatContainer.style.margin = '0';
    }
    header.style.cursor = 'move';

    function dragStart(e: MouseEvent) {
        // Ignore if clicking on controls or resize handle
        if ((e.target as HTMLElement).closest('.chat-window-controls')) return;
        if ((e.target as HTMLElement).closest('.resize-handle')) return;
        
        // Don't start dragging if resizing is in progress
        if (isResizingWindow) return;
        
        const targetElement = e.target as HTMLElement;
        if (targetElement === header || targetElement.closest('.chat-window-header')) {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = chatContainer.getBoundingClientRect();
            
            // If still centered, convert to absolute positioning
            if (chatContainer.style.transform.includes('translate')) {
                chatContainer.style.transform = 'none';
                chatContainer.style.left = rect.left + 'px';
                chatContainer.style.top = rect.top + 'px';
            }
            
            isDragging = true;
            currentX = parseInt(chatContainer.style.left);
            currentY = parseInt(chatContainer.style.top);
            initialX = e.clientX;
            initialY = e.clientY;
            
            document.body.style.userSelect = 'none';
        }
    }

    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    }

    function drag(e: MouseEvent) {
        if (!isDragging || isResizingWindow) return;
        
        e.preventDefault();
        
        currentX = currentX + (e.clientX - initialX);
        currentY = currentY + (e.clientY - initialY);
        initialX = e.clientX;
        initialY = e.clientY;
        
        chatContainer.style.left = currentX + 'px';
        chatContainer.style.top = currentY + 'px';
    }

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
}

function makeMainWindowResizable() {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    // Check if resize handle already exists
    if (chatContainer.querySelector('.resize-handle')) return;

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: se-resize;
        background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
        z-index: 10000;
        pointer-events: auto;
    `;
    chatContainer.appendChild(resizeHandle);

    let isResizing = false;
    let startX: number;
    let startY: number;
    let startWidth: number;
    let startHeight: number;

    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
        isResizingWindow = true; // Use only global flag for consistency
        isResizing = true; // Keep local for backwards compatibility
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView!.getComputedStyle(chatContainer).width, 10);
        startHeight = parseInt(document.defaultView!.getComputedStyle(chatContainer).height, 10);
        
        // Prevent text selection and event bubbling
        e.preventDefault();
        e.stopPropagation();
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        // Safety mechanism: force reset if mouse leaves window
        document.addEventListener('mouseleave', forceStopResize);
    });
    
    function forceStopResize() {
        if (isResizingWindow) {
            isResizing = false;
            isResizingWindow = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('mouseleave', forceStopResize);
        }
    }

    function doResize(e: MouseEvent) {
        // Use global flag for consistency instead of local isResizing
        if (!isResizingWindow) return;
        e.preventDefault();
        
        const newWidth = Math.max(400, startWidth + e.clientX - startX); // Min width 400px
        const newHeight = Math.max(300, startHeight + e.clientY - startY); // Min height 300px
        
        chatContainer.style.width = newWidth + 'px';
        chatContainer.style.height = newHeight + 'px';
    }

    function stopResize(e: MouseEvent) {
        // Use global flag check for consistency and add safety reset
        if (isResizingWindow) {
            isResizing = false;
            isResizingWindow = false; // Clear global flag
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('mouseleave', forceStopResize);
            
            // Prevent event from bubbling to drag handler
            e.stopPropagation();
        } else if (isResizing) {
            // Safety check: clear local flag if global is already false
            isResizing = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('mouseleave', forceStopResize);
        }
    }
}

// Auto-resize system implementation
function initializeAutoResizeSystem(): void {
    // Load user preferences
    const savedPreference = localStorage.getItem(AUTO_RESIZE_CONFIG.preferenceKey);
    if (savedPreference !== null) {
        autoResizeEnabled = savedPreference === 'true';
    }
    
    // Auto-resize system ready
    
    // Set up viewport monitoring
    window.addEventListener('resize', handleViewportChange);
}

function handleViewportChange(): void {
    // Clear existing timer
    if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
    }
    
    // Debounce the resize handling
    resizeDebounceTimer = window.setTimeout(() => {
        processViewportChange();
    }, AUTO_RESIZE_CONFIG.debounceDelay);
}

function processViewportChange(): void {
    if (!autoResizeEnabled || isAutoResizing || isResizingWindow) {
        return;
    }
    
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    const widthIncrease = currentWidth - previousViewportWidth;
    const heightIncrease = currentHeight - previousViewportHeight;
    
    // Check if expansion threshold is met
    if (widthIncrease >= AUTO_RESIZE_CONFIG.expansionThreshold || heightIncrease >= AUTO_RESIZE_CONFIG.expansionThreshold) {
        applyAutoResize(widthIncrease, heightIncrease);
    }
    
    // Update previous dimensions
    previousViewportWidth = currentWidth;
    previousViewportHeight = currentHeight;
}

function applyAutoResize(widthIncrease: number, heightIncrease: number): void {
    isAutoResizing = true;
    
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) {
        isAutoResizing = false;
        return;
    }
    
    const currentRect = chatContainer.getBoundingClientRect();
    const currentWidth = currentRect.width;
    const currentHeight = currentRect.height;
    
    // Calculate new dimensions with scaling factor limits
    const availableWidth = window.innerWidth * 0.9; // Respect 90vw constraint
    const availableHeight = window.innerHeight * 0.9; // Respect 90vh constraint
    
    let newWidth = Math.min(
        currentWidth + (widthIncrease * 0.7), // Use 70% of increase
        availableWidth,
        currentWidth * AUTO_RESIZE_CONFIG.maxScaleFactor
    );
    
    let newHeight = Math.min(
        currentHeight + (heightIncrease * 0.7), // Use 70% of increase
        availableHeight,
        currentHeight * AUTO_RESIZE_CONFIG.maxScaleFactor
    );
    
    // Ensure minimum constraints
    newWidth = Math.max(newWidth, 400);
    newHeight = Math.max(newHeight, 300);
    
    // Apply resize with smooth transition
    requestAnimationFrame(() => {
        chatContainer.style.width = `${newWidth}px`;
        chatContainer.style.height = `${newHeight}px`;
        
        // Reset auto-resize flag after animation
        setTimeout(() => {
            isAutoResizing = false;
        }, 200);
    });
}

function setAutoResizePreference(enabled: boolean): void {
    autoResizeEnabled = enabled;
    localStorage.setItem(AUTO_RESIZE_CONFIG.preferenceKey, enabled.toString());
}

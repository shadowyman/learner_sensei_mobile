import { logger } from './logger';
import { GoogleGenAI } from "@google/genai";
import {
    Curriculum,
    CurriculumState,
    Phase,
    TeachingPoint,
    TeachingPlanGenerationError,
    jumpToPhase,
    getCurrentCurriculumItem,
    getCurriculumFocusInstruction,
    calculateFocusPoints
} from "./curriculum";
import {
    Message,
    ReloadContext,
    getPhaseDisplayName,
    displayMessage,
    updateMessageStream,
    updateCurriculumDisplay,
    processMermaidBlocks,
    setupTextareaAutosize,
} from './ui';
import {
    LearnerModel,
} from "./adaptiveEngine";
import {
    llmExtractAndPlanTeachingOrder,
    generateWrapUpAssessment,
    WrapUpAssessmentGenerationResult,
} from './geminiService';
import {
    MODULE_INTRODUCTION_TASK_TEMPLATE,
    KEY_TAKEAWAY_PROMPT_PREFIX
} from './prompts';
import {
    streamModuleIntroduction,
    buildSocraticExecutionInstruction,
    buildSenseiDynamicSystemInstruction,
} from './interactionHelpers';
import { KeyTakeawayEnhancerController, computeKeyTakeawayEnhancerPromptHash, hasKeyTakeawayEnhancerCacheEntry } from './keyTakeawayEnhancerController';
import { buildPrimaryActionBlockForKeyTakeaway } from './curriculum';
import { ENABLE_KEY_TAKEAWAY_ENHANCER, KEY_TAKEAWAY_ENHANCER_MODEL_CONFIG, KEY_TAKEAWAY_PLACEHOLDER, KEY_TAKEAWAY_POST_STREAM_GRACE_MS } from './model_usage';
import { Chat } from "@google/genai";
import { notepad } from './notepad';
import { showWrapUpAssessmentOverlay, WrapUpAssessmentOverlayData, validateWrapUpAssessmentQuestions, unlockWrapUpChatControls } from './wrapUpAssessment';

interface ModuleSelectionState {
    pendingModuleSelection: number | null;
    pendingPhaseSelection: Phase | null;
    pendingConceptSelectionIndex: number | null;
    pendingConceptSelectionBubbleId: string | null;
    currentMessageId: number;
    lastSenseiResponses: string[];
    userInputHistory: string[];
    learnerModel: LearnerModel;
    curriculum: Curriculum | null;
    curriculumState: CurriculumState | null;
    currentActiveConceptIndex: number | null;
    mainSenseiChat: Chat | null;
    ai: GoogleGenAI | null;
}

function logModuleSelectionValidation(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[MODULE_SELECTION_VALIDATION]', { event, ...payload });
    } else {
        logger.info('[MODULE_SELECTION_VALIDATION]', { event });
    }
}

export class ModuleSelectionHandler {
    private state: ModuleSelectionState;
    private pendingWrapUpAssessment: WrapUpAssessmentOverlayData | null = null;
    private pendingWrapUpAssessmentFailed = false;

    constructor(state: ModuleSelectionState) {
        this.state = state;
    }

    updateState(updates: Partial<ModuleSelectionState>) {
        Object.assign(this.state, updates);
    }

    getState(): ModuleSelectionState {
        return this.state;
    }

    async handleInitialModuleSelectionInternal(userInputText: string): Promise<boolean> {
        if (this.state.curriculum && !this.state.curriculumState) {
            let selectedModuleIndex: number | null = null;
            const lowerInput = userInputText.toLowerCase();

            if (lowerInput === "start curriculum") {
                selectedModuleIndex = 0;
            } else {
                const moduleMatch = lowerInput.match(/^(?:module\s*)?(\d+(?:[._]\d+)?)/);
                if (moduleMatch && moduleMatch[1]) {
                    const moduleIdNumber = moduleMatch[1].replace('_', '.');
                    selectedModuleIndex = this.state.curriculum.modules.findIndex(m => {
                        const curriculumModuleIdNum = m.id.replace('Module', '').replace('_', '.');
                        return curriculumModuleIdNum === moduleIdNumber;
                    });
                }
                if (selectedModuleIndex === null || selectedModuleIndex === -1) {
                    selectedModuleIndex = this.state.curriculum.modules.findIndex(m => m.title.toLowerCase().includes(lowerInput) && lowerInput.length >= 3);
                }
            }

            if (selectedModuleIndex !== null && selectedModuleIndex >= 0 && selectedModuleIndex < this.state.curriculum.modules.length) {
                this.state.pendingModuleSelection = selectedModuleIndex;
                
                this.state.currentMessageId++;
                const phaseSelectionId = `msg-${this.state.currentMessageId}`;
                const selectedModule = this.state.curriculum.modules[selectedModuleIndex];
                if (!selectedModule) {
                    logger.error('[MODULE_SELECTION] Selected module index resolved to undefined module.', {
                        selectedModuleIndex
                    });
                    return false;
                }
                const currentApiKey = typeof window !== 'undefined' ? (window as any).__senseiCurrentApiKey : null;
                logger.info('[API_KEY_USAGE]', {
                    event: 'module_selection',
                    moduleId: selectedModule.id,
                    moduleTitle: selectedModule.title,
                    key: currentApiKey ?? 'undefined'
                });
                
                const phaseSelectionText = `Great choice! You've selected **${selectedModule.title}**.

Where would you like to begin your learning journey?`;
                
                await displayMessage({
                    id: phaseSelectionId,
                    sender: 'sensei',
                    displayName: 'Recursive Sensei',
                    text: phaseSelectionText,
                    timestamp: new Date(),
                    isLoading: false,
                    phaseSelectionEnabled: true,
                    selectedModuleIndex: selectedModuleIndex
                });
                
                return true;
            } else if (selectedModuleIndex === null || selectedModuleIndex === -1) {
                this.state.currentMessageId++;
                const nudgeText = "I'm ready to start a module when you are! Please choose from the list I provided, or type 'start curriculum' for the first one. If you have a general question, feel free to ask!";
                await displayMessage({
                    id: `msg-${this.state.currentMessageId}`,
                    sender: 'sensei',
                    displayName: 'Recursive Sensei',
                    text: nudgeText,
                    timestamp: new Date(),
                    isLoading: false,
                    isReloadable: false 
                });
                this.updateResponseHistory(nudgeText, `msg-${this.state.currentMessageId}`);
                return true; 
            }
        }
        return false; 
    }

    async handleClickedModuleSelection(moduleTitle: string): Promise<void> {
        if (!this.state.ai || !this.state.curriculum) { 
            logger.warn("AI or Curriculum not ready for clicked module selection.");
            this.state.currentMessageId++;
            await displayMessage({
                id: `msg-${this.state.currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: "I'm not quite ready to start a module yet. Please wait a moment and try again.",
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false
            });
            return;
        }

        this.state.currentMessageId++;
        const userMessage: Message = {
            id: `msg-${this.state.currentMessageId}`,
            sender: 'user',
            displayName: 'You',
            text: `Start module: "${moduleTitle}"`, 
            timestamp: new Date(),
            skipMermaid: true,
        };
        await displayMessage(userMessage);
        await processMermaidBlocks(userMessage.id);
        
        const userInputElement = document.getElementById('user-input') as HTMLTextAreaElement;
        if (userInputElement) {
            userInputElement.value = ''; 
            setupTextareaAutosize(userInputElement);
        }

        const success = await this.handleInitialModuleSelectionInternal(moduleTitle);

        if (success) { 
        } else if (!success) {
            this.state.currentMessageId++;
            const errorMessage = `I'm sorry, I had trouble starting the module "${moduleTitle}" properly. Please try selecting again or type the module name.`;
            await displayMessage({
                id: `msg-${this.state.currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: errorMessage,
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false
            });
            this.updateResponseHistory(errorMessage, `msg-${this.state.currentMessageId}`);
        }
    }

    async handlePhaseSelection(phaseName: string): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 50));

        if (!this.state.curriculum || this.state.pendingModuleSelection === null || !this.state.ai) {
            logger.warn('[MODULE_SELECTION] Phase selection attempted before curriculum or AI ready.');
            return;
        }

        const phase = phaseName as Phase;
        const validPhases: Phase[] = ['IntroIllustrate', 'Socratic', 'Solidify'];

        if (!validPhases.includes(phase)) {
            logger.warn('[MODULE_SELECTION] Invalid phase requested.', { phaseName });
            return;
        }

        const moduleIndex = this.state.pendingModuleSelection;
        const module = this.state.curriculum.modules[moduleIndex];
        if (!module) {
            logger.error('[MODULE_SELECTION] Selected module index out of bounds.', { moduleIndex });
            return;
        }

        this.state.pendingPhaseSelection = phase;
        this.state.pendingConceptSelectionIndex = null;

        if (phase === 'IntroIllustrate') {
            await this.showConceptSelectionBubble(moduleIndex);
            return;
        }

        await this.executePhaseSelection(moduleIndex, phase);
    }

    async handleConceptSelection(moduleId: string, conceptIndex: number): Promise<void> {
        if (!this.state.curriculum || this.state.pendingModuleSelection === null || !this.state.ai) {
            logger.warn('[CONCEPT_SELECT] Concept selection attempted before curriculum ready.');
            return;
        }
        if (this.state.pendingPhaseSelection !== 'IntroIllustrate') {
            logger.warn('[CONCEPT_SELECT] No pending Teaching phase for concept selection.', { moduleId, conceptIndex });
            return;
        }
        const moduleIndex = this.state.pendingModuleSelection;
        const module = this.state.curriculum.modules[moduleIndex];
        if (!module || module.id !== moduleId) {
            logger.warn('[CONCEPT_SELECT] Module mismatch during concept selection.', { expectedModuleId: module?.id ?? null, receivedModuleId: moduleId });
            return;
        }
        if (conceptIndex < 0 || conceptIndex >= module.concepts.length) {
            logger.warn('[CONCEPT_SELECT] Concept index out of range.', { moduleId, conceptIndex });
            return;
        }

        const concept = module.concepts[conceptIndex];
        this.state.pendingConceptSelectionIndex = conceptIndex;
        this.state.currentMessageId++;
        const userMessageId = `msg-${this.state.currentMessageId}`;
        await displayMessage({
            id: userMessageId,
            sender: 'user',
            displayName: 'You',
            text: `Start module: "${module.title}" – Concept: "${concept.title}" (Teaching)`,
            timestamp: new Date(),
            skipMermaid: true
        });
        this.clearConceptSelectionBubble();
        this.removePhaseSelectionBubble();
        await this.executePhaseSelection(moduleIndex, 'IntroIllustrate', conceptIndex);
    }

    private async executePhaseSelection(moduleIndex: number, phase: Phase, conceptIndexOverride?: number): Promise<void> {
        if (!this.state.curriculum || !this.state.ai) {
            return;
        }
        const curriculum = this.state.curriculum;
        const module = curriculum.modules[moduleIndex];
        if (!module) {
            logger.error('[MODULE_SELECTION] Module missing during phase execution.', { moduleIndex });
            return;
        }
        const ai = this.state.ai;
        const phaseMessages = Array.from(document.querySelectorAll<HTMLElement>('.message-bubble:not(#response-modal-sensei-bubble)'));
        let phaseMessageBubble: HTMLElement | null = null;
        for (const bubble of phaseMessages) {
            if (bubble.querySelector('.phase-buttons-container')) {
                phaseMessageBubble = bubble;
                const buttons = bubble.querySelectorAll<HTMLButtonElement>('.phase-button');
                buttons.forEach(button => {
                    button.disabled = true;
                });
                break;
            }
        }

        if (!phaseMessageBubble) {
            this.state.currentMessageId++;
            const loaderId = `msg-${this.state.currentMessageId}`;
            await displayMessage({
                id: loaderId,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: '',
                timestamp: new Date(),
                isLoading: false,
                phaseLoadingAnimation: true
            });
            phaseMessageBubble = document.getElementById(loaderId);
        }

        const isSolidify = phase === 'Solidify';
        let cleanupPhaseBubble: (() => void) | null = null;

        if (phaseMessageBubble) {
            const messageText = phaseMessageBubble.querySelector<HTMLElement>('.message-text');
            if (messageText) {
                messageText.innerHTML = '';
                const loadingContainer = document.createElement('div');
                loadingContainer.classList.add('phase-loading-container');
                const spinner = document.createElement('div');
                spinner.classList.add('phase-loading-spinner');
                const loadingText = document.createElement('div');
                loadingText.classList.add('phase-loading-text');
                const loadingMessages: string[] = isSolidify
                    ? [
                        'Sensei is assembling your FAANG-style wrap-up assessment',
                        'Selecting interview-grade questions that mirror the module’s Solidify focus',
                        'Balancing C++ snippets and conceptual traps for maximum coverage',
                        'Double-checking explanations and interviewer insights',
                        'Scouting high-signal topics to confirm mastery before remediation',
                        'Tuning markdown formatting so every insight reads clearly'
                    ]
                    : [
                        'Sensei is generating a teaching plan and will be back with you shortly',
                        'Analyzing your learning patterns to optimize the experience',
                        'Crafting personalized examples based on your progress',
                        'Selecting the most effective teaching strategies',
                        'Preparing interactive exercises tailored to your needs',
                        'Building cognitive bridges to deepen understanding'
                    ];

                let messageIndex = 0;
                const textSpan = document.createElement('span');
                textSpan.textContent = loadingMessages[messageIndex] ?? '';
                const dots = document.createElement('span');
                dots.classList.add('phase-loading-dots');
                dots.textContent = '...';
                loadingText.appendChild(textSpan);
                loadingText.appendChild(dots);
                loadingContainer.appendChild(spinner);
                loadingContainer.appendChild(loadingText);
                messageText.appendChild(loadingContainer);

                let dotCount = 1;
                const dotAnimation = setInterval(() => {
                    dotCount = (dotCount % 3) + 1;
                    dots.textContent = '.'.repeat(dotCount);
                }, 500);

                const messageAnimation = setInterval(() => {
                    messageIndex = (messageIndex + 1) % loadingMessages.length;
                    textSpan.textContent = loadingMessages[messageIndex] ?? '';
                }, 5000);

                (phaseMessageBubble as any).dotAnimation = dotAnimation;
                (phaseMessageBubble as any).messageAnimation = messageAnimation;

                cleanupPhaseBubble = () => {
                    clearInterval(dotAnimation);
                    clearInterval(messageAnimation);
                    phaseMessageBubble?.remove();
                };
            }
        }

        const planner = isSolidify
            ? async (phaseForPlan: Phase) => this.createSolidifyTeachingPlan(module, phaseForPlan, ai)
            : async (phaseForPlan: Phase, text: string) => {
                const conceptsSummary = module.concepts.map(c => c.title).join(', ');
                const result = await llmExtractAndPlanTeachingOrder(
                    ai,
                    text,
                    phaseForPlan,
                    module.title,
                    module.goal,
                    conceptsSummary
                );
                if (!result || result.length === 0) {
                    throw new TeachingPlanGenerationError('LLM returned an empty teaching plan.', {
                        moduleId: module.id,
                        phase: phaseForPlan
                    });
                }
                return result;
            };

        const plannerOptions = conceptIndexOverride !== undefined ? { targetConceptIndex: conceptIndexOverride } : undefined;
        this.state.curriculumState = await jumpToPhase(
            curriculum,
            moduleIndex,
            phase,
            planner,
            plannerOptions
        );

        if (!this.state.curriculumState) {
            this.state.currentMessageId++;
            await displayMessage({
                id: `msg-${this.state.currentMessageId}`,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: "I encountered an error while preparing that phase. Please try again or select a different phase.",
                timestamp: new Date(),
                isLoading: false,
            });
            this.state.pendingPhaseSelection = null;
            this.state.pendingConceptSelectionIndex = null;
            return;
        }

        if (isSolidify) {
            this.state.pendingModuleSelection = null;
            this.state.pendingPhaseSelection = null;
            this.state.pendingConceptSelectionIndex = null;
            const overlayData = this.pendingWrapUpAssessment;
            const generationFailed = this.pendingWrapUpAssessmentFailed;
            this.pendingWrapUpAssessment = null;
            this.pendingWrapUpAssessmentFailed = false;

            const currentItem = getCurrentCurriculumItem(this.state.curriculum, this.state.curriculumState);
            if (currentItem) {
                updateCurriculumDisplay(currentItem, this.state.curriculumState.currentPhase, this.state.curriculum, this.state.curriculumState, true, this.state.learnerModel);
            }

            if (overlayData) {
                showWrapUpAssessmentOverlay(overlayData);
            } else if (generationFailed) {
                await this.showWrapUpAssessmentApology(module.id, module.title);
            }
            if (cleanupPhaseBubble) {
                cleanupPhaseBubble();
            }
            return;
        }

        if (this.state.curriculumState.currentPhase === 'Socratic') {
            this.state.curriculumState.socraticTurnCount = 0;
        }

        this.state.currentActiveConceptIndex = this.state.curriculumState.currentConceptIndex;
        logModuleSelectionValidation('active-concept-tracking-initialized', {
            activeConceptIndex: this.state.currentActiveConceptIndex
        });
        const currentItem = getCurrentCurriculumItem(this.state.curriculum, this.state.curriculumState);
        if (currentItem) {
            const moduleTitle = this.state.curriculum?.modules?.[this.state.curriculumState.currentModuleIndex]?.title ?? null;
            notepad.setActiveCurriculumContext({
                conceptTitle: currentItem.concept?.title ?? null,
                moduleTitle
            });
            this.state.learnerModel.CurrentTask.ID = currentItem.curriculumPathId;
            this.state.learnerModel.CurrentTask.TargetKCs = [currentItem.curriculumPathId];
            if (!this.state.learnerModel.KCs[currentItem.curriculumPathId]) {
                this.state.learnerModel.KCs[currentItem.curriculumPathId] = 0;
            }
            this.state.learnerModel.KCMasteryLastUpdated[currentItem.curriculumPathId] = new Date().toISOString();
            this.state.learnerModel.awardedKcForPhasePoints = new Set<string>();

            updateCurriculumDisplay(currentItem, this.state.curriculumState.currentPhase, this.state.curriculum, this.state.curriculumState, true, this.state.learnerModel);

            const currentPhaseKCMastery = this.state.learnerModel.KCs[currentItem.curriculumPathId] || 0;
            this.updateKCProgressBar(currentPhaseKCMastery);

            const phaseMessagesToRemove = document.querySelectorAll<HTMLElement>('.message-bubble:not(#response-modal-sensei-bubble)');
            phaseMessagesToRemove.forEach(bubble => {
                if (bubble.querySelector('.phase-buttons-container') || bubble.querySelector('.phase-loading-container')) {
                    const dotAnimation = (bubble as any).dotAnimation;
                    if (dotAnimation) {
                        clearInterval(dotAnimation);
                    }
                    const messageAnimation = (bubble as any).messageAnimation;
                    if (messageAnimation) {
                        clearInterval(messageAnimation);
                    }
                    bubble.remove();
                }
            });

            const currentModuleIndex = this.state.pendingModuleSelection;
            const currentCurriculum = this.state.curriculum;
            if (currentModuleIndex === null || !currentCurriculum) {
                logger.error('[MODULE_SELECTION] Pending module selection missing during phase intro.');
                return;
            }
            const selectedModule = currentCurriculum.modules[currentModuleIndex];
            if (!selectedModule) {
                logger.error('[MODULE_SELECTION] Pending module selection index invalid.', {
                    moduleIndex: currentModuleIndex
                });
                return;
            }
            const phaseDisplayName = getPhaseDisplayName(this.state.curriculumState.currentPhase);
            const conceptTitle = currentItem.concept?.title || "the module concepts";

            let introResponseText = "";

            if (this.state.curriculumState.currentPhase === 'Socratic') {
                await this.sendSystemSocraticMessage();
            } else {
                const curriculumFocusInstruction = getCurriculumFocusInstruction(this.state.curriculum, currentItem, this.state.curriculumState, false);
                const focusPointsSnapshot = calculateFocusPoints(this.state.curriculumState);
                const coreInstruction = buildSenseiDynamicSystemInstruction(
                    curriculumFocusInstruction,
                    undefined
                );

                this.state.currentMessageId++;
                const senseiIntroId = `msg-${this.state.currentMessageId}`;

                const introContext = `${MODULE_INTRODUCTION_TASK_TEMPLATE(selectedModule.title, conceptTitle, phaseDisplayName, `Phase: ${phaseDisplayName}`)}
${coreInstruction}
`;

                const reloadContext: ReloadContext = {
                    type: 'moduleIntro',
                    introSystemInstruction: introContext,
                    moduleTitleForPrompt: selectedModule.title
                };

                let introEnhancerController: KeyTakeawayEnhancerController | undefined;
                const introEnhancerEligible = ENABLE_KEY_TAKEAWAY_ENHANCER
                    && this.state.ai
                    && this.state.curriculumState.currentPhase === 'IntroIllustrate';
                if (introEnhancerEligible) {
                    const primaryActionBlock = buildPrimaryActionBlockForKeyTakeaway(
                        this.state.curriculum!,
                        currentItem,
                        this.state.curriculumState,
                        false,
                        focusPointsSnapshot
                    );
                    const enhancerPrompt = `${KEY_TAKEAWAY_PROMPT_PREFIX}\n\n${primaryActionBlock}`;
                    const promptHash = computeKeyTakeawayEnhancerPromptHash(enhancerPrompt);
                    const promptHashChanged = !hasKeyTakeawayEnhancerCacheEntry(promptHash);
                    introEnhancerController = new KeyTakeawayEnhancerController({
                        ai: this.state.ai!,
                        modelName: KEY_TAKEAWAY_ENHANCER_MODEL_CONFIG.modelName,
                        modelConfig: KEY_TAKEAWAY_ENHANCER_MODEL_CONFIG.config,
                        promptText: enhancerPrompt,
                        placeholderToken: KEY_TAKEAWAY_PLACEHOLDER,
                        messageId: senseiIntroId,
                        updateMessageStream,
                        cacheKey: promptHash,
                        postStreamGraceMs: KEY_TAKEAWAY_POST_STREAM_GRACE_MS
                    });
                    introEnhancerController.start();
                    logger.info('[KEY_TAKE_AWAY_SENSEI] enhancer-armed', { messageId: senseiIntroId, promptHashChanged, source: 'module-selection' });
                    reloadContext.keyTakeawayEnhancer = {
                        promptHash,
                        promptText: enhancerPrompt
                    };
                }

                await displayMessage({
                    id: senseiIntroId,
                    sender: 'sensei',
                    displayName: 'Recursive Sensei',
                    text: '',
                    timestamp: new Date(),
                    isLoading: true,
                    isReloadable: true,
                    reloadContext: reloadContext,
                });

                try {
                    introResponseText = await streamModuleIntroduction(
                        this.state.mainSenseiChat!,
                        introContext,
                        selectedModule.title,
                        senseiIntroId,
                        { enhancerController: introEnhancerController }
                    );
                    this.updateResponseHistory(introResponseText, senseiIntroId);
                } catch (error) {
                    logger.error("Error generating phase intro:", error);
                    introResponseText = `Welcome to the **${phaseDisplayName}** phase of **${selectedModule.title}**! Let's begin exploring ${conceptTitle}.`;
                    this.updateResponseHistory(introResponseText, senseiIntroId);
                }

                await displayMessage({
                    id: senseiIntroId,
                    sender: 'sensei',
                    displayName: 'Recursive Sensei',
                    text: introResponseText,
                    timestamp: new Date(),
                    isLoading: false,
                    isReloadable: true,
                    reloadContext: reloadContext,
                    skipMermaid: true,
                });
                const messageBubble = document.getElementById(senseiIntroId);
                if (messageBubble) {
                    messageBubble.dataset.reloadable = 'true';
                    messageBubble.dataset.reloadType = 'moduleIntro';
                    messageBubble.dataset.reloadContext = JSON.stringify(reloadContext);
                }
                logger.info('[MODULE_INTRO_RELOAD] Intro bubble finalized', { messageId: senseiIntroId });
                await processMermaidBlocks(senseiIntroId);
            }

            this.state.userInputHistory = [];
            if (this.state.curriculumState.currentPhase !== 'Socratic') {
                this.state.lastSenseiResponses = [introResponseText];
            }
            this.state.pendingModuleSelection = null;
            this.state.pendingPhaseSelection = null;
            this.state.pendingConceptSelectionIndex = null;

            const userInputElem = document.getElementById('user-input') as HTMLTextAreaElement;
            if (userInputElem) {
                userInputElem.placeholder = "Phase selected. Ask questions or type your thoughts...";
            }
        }
    }

    private async showConceptSelectionBubble(moduleIndex: number): Promise<void> {
        if (!this.state.curriculum) {
            return;
        }
        const module = this.state.curriculum.modules[moduleIndex];
        if (!module || !module.concepts || module.concepts.length === 0) {
            logger.warn('[CONCEPT_SELECT] Module missing concepts for selection.', { moduleIndex });
            return;
        }
        this.clearConceptSelectionBubble();
        const concepts = module.concepts.map((concept, index) => ({
            title: `Concept ${index + 1}: ${concept.title}`,
            index
        }));
        this.state.currentMessageId++;
        const messageId = `msg-${this.state.currentMessageId}`;
        const promptText = `Great! Choose the concept you want to start within **${module.title}**.`;
        await displayMessage({
            id: messageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: promptText,
            timestamp: new Date(),
            isLoading: false,
            conceptSelectionPayload: {
                moduleId: module.id,
                moduleTitle: module.title,
                concepts
            }
        });
        this.state.pendingConceptSelectionBubbleId = messageId;
    }

    private clearConceptSelectionBubble(): void {
        if (!this.state.pendingConceptSelectionBubbleId) {
            return;
        }
        const existing = document.getElementById(this.state.pendingConceptSelectionBubbleId);
        if (existing) {
            existing.remove();
        }
        this.state.pendingConceptSelectionBubbleId = null;
    }

    private removePhaseSelectionBubble(): void {
        const phaseBubble = Array.from(document.querySelectorAll<HTMLElement>('.message-bubble:not(#response-modal-sensei-bubble)')).find(bubble =>
            bubble.querySelector('.phase-buttons-container')
        );
        if (phaseBubble) {
            phaseBubble.remove();
        }
    }

    private async createSolidifyTeachingPlan(
        module: Curriculum['modules'][number],
        phaseForPlan: Phase,
        ai: GoogleGenAI
    ): Promise<TeachingPoint[][]> {
        this.pendingWrapUpAssessment = null;
        this.pendingWrapUpAssessmentFailed = false;

        const conceptSummaries = module.concepts.map(concept => `${concept.title}: ${concept.text}`);

        try {
            const result: WrapUpAssessmentGenerationResult | null = await generateWrapUpAssessment(ai, module.id, {
                moduleTitle: module.title,
                moduleGoal: module.goal ?? '',
                solidifyContent: '',
                conceptSummaries
            });

            if (result && result.questions.length > 0) {
                const validatedQuestions = validateWrapUpAssessmentQuestions(result.questions);
                this.pendingWrapUpAssessment = {
                    moduleTitle: module.title,
                    moduleGoal: module.goal ?? undefined,
                    conceptSummaries,
                    questions: validatedQuestions
                };
            } else {
                this.pendingWrapUpAssessmentFailed = true;
            }
        } catch (error) {
            logger.error('[WRAP_UP_ASSESSMENT] generation-error', {
                moduleId: module.id,
                error: error instanceof Error ? error.message : String(error)
            });
            this.pendingWrapUpAssessmentFailed = true;
        }

        logger.info('[WRAP_UP_ASSESSMENT] jump-to-phase-stub', {
            moduleId: module.id,
            phase: phaseForPlan,
            kcTotal: 0.65
        });

        const stubTeachingPoint: TeachingPoint = {
            text: `Wrap Up assessment prepared for ${module.title}`,
            kcValue: 0.65
        };

        return [[stubTeachingPoint]];
    }

    private async showWrapUpAssessmentApology(moduleId: string, moduleTitle: string): Promise<void> {
        this.state.currentMessageId++;
        await displayMessage({
            id: `msg-${this.state.currentMessageId}`,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: `I'm sorry—the Wrap Up assessment for **${moduleTitle}** is temporarily unavailable. Please try again shortly.`,
            timestamp: new Date(),
            isLoading: false,
            isReloadable: false
        });
        logger.warn('[WRAP_UP_ASSESSMENT] overlay-missing', { moduleId, moduleTitle });
        unlockWrapUpChatControls();
    }

    private async sendSystemSocraticMessage(): Promise<void> {
        if (!this.state.curriculumState || !this.state.curriculumState.teachingPlanForPhase) {
            logger.error('[SOCRATIC_FIX] Cannot send system message: missing curriculum state or teaching plan');
            return;
        }
        
        const systemInstruction = buildSocraticExecutionInstruction(
            this.state.curriculumState.teachingPlanForPhase,
            { directive: undefined },
            true,
            undefined,
            this.buildSocraticConceptReference()
        );
        
        this.state.currentMessageId++;
        const messageId = `msg-${this.state.currentMessageId}`;
        
        await displayMessage({
            id: messageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: '',
            timestamp: new Date(),
            isLoading: true,
            isReloadable: false
        });
        
        let finalResponse = '';
        const reloadContext: ReloadContext = {
            type: 'mainResponse',
            dynamicSystemInstruction: systemInstruction,
            userInput: ''
        };
        
        try {
            const { streamMainSenseiResponse } = await import('./interactionHelpers.js');
            finalResponse = await streamMainSenseiResponse(this.state.mainSenseiChat!, systemInstruction, "", messageId);
            this.updateResponseHistory(finalResponse, messageId);
        } catch (error) {
            logger.error('[SOCRATIC_FIX] Error in system message generation:', error);
            finalResponse = "Welcome to the Socratic exploration phase! I'm ready to guide you through this learning journey.";
            this.updateResponseHistory(finalResponse, messageId);
        }
        
        await displayMessage({
            id: messageId,
            sender: 'sensei',
            displayName: 'Recursive Sensei',
            text: finalResponse,
            timestamp: new Date(),
            isLoading: false,
            isReloadable: true,
            reloadContext,
            skipMermaid: true
        });
        const bubble = document.getElementById(messageId);
        if (bubble) {
            bubble.dataset.reloadable = 'true';
            bubble.dataset.reloadType = 'mainResponse';
            bubble.dataset.reloadContext = JSON.stringify(reloadContext);
        }
        logger.info('[SOCFIX] Socratic intro finalized', { messageId, hasReloadContext: !!reloadContext });

        await processMermaidBlocks(messageId);
    }

    private updateResponseHistory(responseText: string, messageId: string): void {
        this.state.lastSenseiResponses.unshift(responseText);
        if (this.state.lastSenseiResponses.length > 3) {
            this.state.lastSenseiResponses.pop();
        }
    }

    private buildSocraticConceptReference(): string | undefined {
        if (!this.state.curriculum || !this.state.curriculumState) {
            return undefined;
        }

        const moduleIndex = this.state.curriculumState.currentModuleIndex;
        if (moduleIndex < 0 || moduleIndex >= this.state.curriculum.modules.length) {
            return undefined;
        }

        const selectedModule = this.state.curriculum.modules[moduleIndex];
        if (!selectedModule || !selectedModule.concepts || selectedModule.concepts.length === 0) {
            return undefined;
        }

        const conceptLines: string[] = [
            'CONCEPT REFERENCE FOR SOCRATIC PHASE:',
            'The user learned the following concepts in this module. This context is provided so you understand the learner’s background during the Socratic phase—use it to enrich the dialogue while still following the teaching plan and any LeetCode collaboration protocol.',
            ''
        ];

        selectedModule.concepts.forEach((concept, index) => {
            conceptLines.push(`Concept ${index + 1}: ${concept.title}`);
            conceptLines.push(concept.text);
            conceptLines.push('');
        });

        return conceptLines.join('\n').trim();
    }

    private updateKCProgressBar(kcphasemastery: number): void {
        if (typeof kcphasemastery !== 'number' || isNaN(kcphasemastery) || kcphasemastery < 0) {
            logger.warn('Invalid KC mastery value for progress bar:', kcphasemastery);
            return;
        }
        
        try {
            const progressFill = document.getElementById('kc-progress-fill') as HTMLElement;
            const progressText = document.getElementById('kc-progress-text') as HTMLElement;
            const progressBar = progressFill?.parentElement as HTMLElement;
            
            if (!progressFill || !progressText || !progressBar) {
                logger.warn('KC Progress bar elements not found in DOM');
                return;
            }
            
            const rawPercentage = (kcphasemastery / 0.65) * 100;
            const percentage = Math.round(Math.min(100, rawPercentage));
            
            progressFill.style.width = percentage + '%';
            progressFill.setAttribute('data-progress', percentage.toString());
            progressText.textContent = percentage + '%';
            
            if (percentage > 0) {
                progressBar.setAttribute('data-has-progress', 'true');
            } else {
                progressBar.removeAttribute('data-has-progress');
            }
            
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
}

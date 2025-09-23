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
} from "./curriculum";
import {
    Message,
    ReloadContext,
    getPhaseDisplayName,
    displayMessage,
    updateCurriculumDisplay,
    processMermaidBlocks,
    setupTextareaAutosize,
} from './ui';
import {
    LearnerModel,
} from "./adaptiveEngine";
import {
    llmExtractAndPlanTeachingOrder,
} from './geminiService';
import {
    MODULE_INTRODUCTION_TASK_TEMPLATE,
} from './prompts';
import {
    streamModuleIntroduction,
    buildSocraticExecutionInstruction,
    buildSenseiDynamicSystemInstruction,
} from './interactionHelpers';
import { Chat } from "@google/genai";
import { notepad } from './notepad';

interface ModuleSelectionState {
    pendingModuleSelection: number | null;
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

        const curriculum = this.state.curriculum;
        const moduleIndex = this.state.pendingModuleSelection;
        const ai = this.state.ai;
        const module = curriculum.modules[moduleIndex];
        if (!module) {
            logger.error('[MODULE_SELECTION] Selected module index out of bounds.', { moduleIndex });
            return;
        }

        const phaseMessages = Array.from(document.querySelectorAll<HTMLElement>('.message-bubble:not(#response-modal-sensei-bubble)'));
        let phaseMessageBubble: HTMLElement | null = null;
        let phaseMessageId: string | null = null;

        for (const bubble of phaseMessages) {
            const bubbleId = bubble.id || 'no-id';
            if (bubble.querySelector('.phase-buttons-container')) {
                phaseMessageBubble = bubble;
                phaseMessageId = bubbleId;
                break;
            }
        }
        
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
                
                const loadingMessages: string[] = [
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
            }
        }
        
        this.state.curriculumState = await jumpToPhase(
            curriculum,
            moduleIndex,
            phase,
            async (phaseForPlan, text) => {
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
            }
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
            return;
        }
        
        if (this.state.curriculumState.currentPhase === 'Socratic') {
            this.state.curriculumState.socraticTurnCount = 0;
        }
        
        this.state.currentActiveConceptIndex = this.state.curriculumState.currentConceptIndex;
        logModuleSelectionValidation('active-concept-tracking-initialized', {
            activeConceptIndex: this.state.currentActiveConceptIndex
        });
        notepad.updateActiveConceptIndex(this.state.currentActiveConceptIndex);
        notepad.updateActiveModuleIndex(this.state.curriculumState.currentModuleIndex);
        
        const currentItem = getCurrentCurriculumItem(this.state.curriculum, this.state.curriculumState);
        if (currentItem) {
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
                    const bubbleId = bubble.id || 'unknown';
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
            
            const moduleIndex = this.state.pendingModuleSelection;
            const curriculum = this.state.curriculum;
            if (moduleIndex === null || !curriculum) {
                logger.error('[MODULE_SELECTION] Pending module selection missing during phase intro.');
                return;
            }
            const selectedModule = curriculum.modules[moduleIndex];
            if (!selectedModule) {
                logger.error('[MODULE_SELECTION] Pending module selection index invalid.', {
                    moduleIndex
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
                    introResponseText = await streamModuleIntroduction(this.state.mainSenseiChat!, introContext, selectedModule.title, senseiIntroId);
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
            
            const userInputElem = document.getElementById('user-input') as HTMLTextAreaElement;
            if (userInputElem) {
                userInputElem.placeholder = "Phase selected. Ask questions or type your thoughts...";
            }
        }
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
        
        try {
            const { streamMainSenseiResponse } = await import('./interactionHelpers.js');
            const response = await streamMainSenseiResponse(this.state.mainSenseiChat!, systemInstruction, "", messageId);
            
            this.updateResponseHistory(response, messageId);
        } catch (error) {
            logger.error('[SOCRATIC_FIX] Error in system message generation:', error);
            
            const fallbackMessage = "Welcome to the Socratic exploration phase! I'm ready to guide you through this learning journey.";
            await displayMessage({
                id: messageId,
                sender: 'sensei',
                displayName: 'Recursive Sensei',
                text: fallbackMessage,
                timestamp: new Date(),
                isLoading: false,
                isReloadable: false
            });
            this.updateResponseHistory(fallbackMessage, messageId);
        }
        
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

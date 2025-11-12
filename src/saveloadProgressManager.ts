/**
 * Save/Load Progress Manager
 * Handles complete session state preservation and restoration
 * Based on save_load_implementation_plan.md v2.0
 */

import { 
    serializeForSave, 
    deserializeFromSave,
    serializeCurriculumState as serializeCurriculumStateHelper,
    deserializeCurriculumState as deserializeCurriculumStateHelper,
    serializeLearnerModel as serializeLearnerModelHelper,
    deserializeLearnerModel as deserializeLearnerModelHelper,
    validateSerializedData
} from './saveloadSerialization';
import { logger } from './logger';
import { CurriculumState, Curriculum, getCurrentCurriculumItem, Phase } from './curriculum';
import { LearnerModel } from './adaptiveEngine';
import { displayMessage } from './ui';
import { MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG } from './model_usage';

interface SaveFileMetadata {
    version: string;
    timestamp: string;
    metadata: {
        moduleName: string;
        phase: string;
        chunkProgress: string;
        sessionDuration: number;
        totalInteractions: number;
        curriculumChecksum?: string;
        saveEnvironment?: string;
    };
}

interface SessionData {
    curriculum: Curriculum | null;  // Not saved - always loaded from Modules.txt
    curriculumState: CurriculumState | null;
    learnerModel: LearnerModel;
    applicationState: {
        currentActiveConceptIndex: number | null;
        currentMessageId: number;
        lastSenseiResponses: string[];
        chronologicallyLastLLMSenseiMessageId: string | null;
        userInputHistory: string[];
        pendingModuleSelection: number | null;
        pendingPhaseSelection: Phase | null;
        pendingConceptSelectionIndex: number | null;
        pendingConceptSelectionBubbleId: string | null;
        autoResizeEnabled: boolean;
    };
    chatSession: {
        history: Array<{ role: string; content: string; timestamp?: string }>;
        systemInstruction: string;
        modelConfig: any;
    };
    ui: {
        messages: any[];
        rawTextMap: { [key: string]: string };
        footerState: {
            confidence: string;
            confusion: string;
            intent: string;
        };
        curriculumStatus: string;
    };
    notepad: {
        notes: any[];
    };
    consolidation: any | null;
}

export class SaveLoadProgressManager {
    private static SAVE_VERSION = "2.0.0";
    private static isRestoring = false;
    
    /**
     * Main save function - collects and serializes all state
     */
    static async saveProgress(): Promise<void> {
        try {
            
            if (this.hasActiveStreamingMessages()) {
                await this.waitForStreamingCompletion();
            }
            
            const jsonString = await this.exportSessionAsJson();
            
            try {
                const isoString = new Date().toISOString();
                const filename = `sensei_progress_${isoString.replace(/[:.]/g, '-')}.json`;
                
                this.downloadSaveFile(jsonString, filename);
            } catch (fileError) {
                // Fallback filename without replace
                const fallbackFilename = `sensei_progress_${Date.now()}.json`;
                this.downloadSaveFile(jsonString, fallbackFilename);
            }
            
            // Note: displayMessage requires a full Message object, not just text and sender
            // For now, just log success - UI feedback handled in index.tsx
            
        } catch (error) {
            // Note: displayMessage requires a full Message object, not just text and sender
            // For now, just log error - UI feedback handled in index.tsx
            throw error;
        }
    }

    static async exportSessionAsJson(): Promise<string> {
        if (this.hasActiveStreamingMessages()) {
            await this.waitForStreamingCompletion();
        }

        const sessionData = this.collectSessionData();
        const validation = validateSerializedData(sessionData);
        if (!validation.isValid) {
            throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
        }

        const saveFile = {
            version: this.SAVE_VERSION,
            timestamp: new Date().toISOString(),
            metadata: this.generateMetadata(sessionData),
            session: sessionData
        };

        return JSON.stringify(saveFile, serializeForSave, 2);
    }
    
    /**
     * Main load function - reads file and restores all state
     */
    static async loadProgress(file: File): Promise<void> {
        try {
            this.isRestoring = true;
            
            const jsonString = await this.readFile(file);
            
            await this.restoreFromSerializedJson(jsonString);

            // Re-initialize SelectionSensei after DOM has been rebuilt
            // Add a small delay to ensure DOM is fully settled
            const w = window as any;
            const loadSelectionSensei = w.__selectionSenseiLoader ?? (() => import('./selectionSensei.js'));
            setTimeout(async () => {
                try {
                    const { reinitializeSelectionSensei } = await loadSelectionSensei();
                    if (w.ai) {
                        reinitializeSelectionSensei(w.ai);
                    }
                } catch (error) {
                    logger.error('[SAVELOAD_SELECTION_SENSEI] Failed to reinitialize SelectionSensei', { error });
                }
            }, 100);

            // Note: displayMessage requires a full Message object, not just text and sender
            // For now, just log success - UI feedback handled in index.tsx
            
        } catch (error) {
            // Note: displayMessage requires a full Message object, not just text and sender
            // For now, just log error - UI feedback handled in index.tsx
            throw error;
        } finally {
            this.isRestoring = false;
        }
    }

    static async restoreFromSerializedJson(jsonString: string): Promise<void> {
        const saveFile = JSON.parse(jsonString, deserializeFromSave);
        const compatibility = this.checkCompatibility(saveFile);
        if (!compatibility.isCompatible) {
            throw new Error(`Incompatible save file: ${compatibility.reason}`);
        }
        await this.restoreSessionData(saveFile.session);
    }
    
    /**
     * Collects all session state from the running application
     */
    private static collectSessionData(): SessionData {
        
        const w = window as any;
        
        // Debug log to see what's actually on window
        
        const chatHistory = this.extractChatHistory(w.mainSenseiChat);
        
        const rawNotepadNotes = w.notepad?.getAllNotes?.();
        const notepadNotes = Array.isArray(rawNotepadNotes) ? rawNotepadNotes : [];
        logger.info('[NOTEPAD_SAVE_BUG] collectSessionData captured notepad notes', { count: notepadNotes.length });
        
        const uiState = this.collectUIState();
        
        const sessionData: SessionData = {
            curriculum: null as any, // Curriculum is always loaded from Modules.txt, no need to save
            curriculumState: serializeCurriculumStateHelper(w.curriculumState),
            learnerModel: serializeLearnerModelHelper(w.learnerModel),
            applicationState: {
                currentActiveConceptIndex: w.currentActiveConceptIndex,
                currentMessageId: w.currentMessageId,
                lastSenseiResponses: w.lastSenseiResponses || [],
                chronologicallyLastLLMSenseiMessageId: w.chronologicallyLastLLMSenseiMessageId,
                userInputHistory: w.userInputHistory || [],
                pendingModuleSelection: w.pendingModuleSelection,
                pendingPhaseSelection: w.pendingPhaseSelection ?? null,
                pendingConceptSelectionIndex: w.pendingConceptSelectionIndex ?? null,
                pendingConceptSelectionBubbleId: w.pendingConceptSelectionBubbleId ?? null,
                autoResizeEnabled: w.autoResizeEnabled ?? true
            },
            chatSession: {
                history: chatHistory,
                systemInstruction: this.getCurrentSystemInstruction(),
                modelConfig: this.getModelConfig()
            },
            ui: uiState,
            notepad: { notes: notepadNotes },
            consolidation: w.curriculumState?.activeConsolidationState ? 
                this.serializeConsolidation(w.curriculumState.activeConsolidationState) : null
        };
        
        return sessionData;
    }
    
    /**
     * Restores all session state to the running application
     */
    private static async restoreSessionData(session: SessionData): Promise<void> {
        const w = window as any;
        
        // Curriculum is not saved/restored - it's always loaded from Modules.txt
        // w.curriculum = session.curriculum; // Skip this - curriculum already loaded
        
        // Restore curriculumState - the deserialization handles Sets and Maps
        w.curriculumState = deserializeCurriculumStateHelper(session.curriculumState);
        
        // No need to reconnect references - curriculumState uses indices to reference
        // the already-loaded curriculum. The curriculum modules and concepts are accessed
        // via currentModuleIndex and currentConceptIndex when needed.
        
        w.learnerModel = deserializeLearnerModelHelper(session.learnerModel);
        
        w.currentActiveConceptIndex = session.applicationState.currentActiveConceptIndex;
        w.currentMessageId = session.applicationState.currentMessageId;
        w.lastSenseiResponses = session.applicationState.lastSenseiResponses;
        w.chronologicallyLastLLMSenseiMessageId = session.applicationState.chronologicallyLastLLMSenseiMessageId;
        w.userInputHistory = session.applicationState.userInputHistory;
        w.pendingModuleSelection = session.applicationState.pendingModuleSelection;
        w.pendingPhaseSelection = session.applicationState.pendingPhaseSelection;
        w.pendingConceptSelectionIndex = session.applicationState.pendingConceptSelectionIndex;
        w.pendingConceptSelectionBubbleId = session.applicationState.pendingConceptSelectionBubbleId;
        w.autoResizeEnabled = session.applicationState.autoResizeEnabled;
        
        await this.recreateChatSession(session.chatSession);
        
        await this.restoreUIState(session.ui);

        this.restoreNotepadContext();
        this.syncModuleSelectionState();
        
        if (session.notepad?.notes && w.notepad?.restoreNotes) {
            w.notepad.restoreNotes(session.notepad.notes);
            logger.info('[NOTEPAD_SAVE_BUG] restoreSessionData completed notepad hydration');
        }
        
        this.handlePendingOperations(session);
        
        try {
            this.updateAllDisplays(session);
        } catch (error) {
            throw error;
        }
        
    }
    
    /**
     * Extracts chat history from the active chat session
     */
    private static extractChatHistory(chat: any): any[] {
        
        // Always prefer DOM extraction as it has the actual user input without system prompts
        const history: any[] = [];
        const messageElements = document.querySelectorAll('.message-bubble:not(#response-modal-sensei-bubble)');

        messageElements.forEach((msg: any) => {
            // Check dataset.sender to determine if it's user or sensei
            const sender = msg.dataset.sender;
            const isUser = sender === 'user';
            const msgId = msg.id;
            
            const messageTextEl = msg.querySelector('.message-text');
            let content = messageTextEl?.textContent || messageTextEl?.innerText || '';
            
            // For sensei messages, check if we can get raw text from streamingMessagesRawText
            if (!isUser && msgId) {
                const w = window as any;
                if (w.streamingMessagesRawText && w.streamingMessagesRawText.has(msgId)) {
                    // Use raw text if available (preserves formatting)
                    content = w.streamingMessagesRawText.get(msgId);
                }
            }
            
            if (content && content.trim()) {
                const trimmedContent = content.trim();
                const messageData = {
                    role: isUser ? 'user' : 'model',
                    content: trimmedContent,
                    timestamp: msg.dataset.timestamp || new Date().toISOString()
                };
                history.push(messageData);
            } else {
            }
        });
        
        // If DOM extraction failed, try chat API as fallback (but note it includes system prompts)
        if (history.length === 0 && chat && typeof chat.getHistory === 'function') {
            try {
                const rawHistory = chat.getHistory();
                
                // Combine consecutive model messages that are part of the same streaming response
                const combinedHistory: any[] = [];
                let currentMessage: any = null;
                
                for (const entry of rawHistory) {
                    const role = entry.role;
                    let content = entry.parts?.[0]?.text || entry.content || '';
                    
                    // Try to clean up user messages that contain system prompts
                    if (role === 'user' && content.includes('[RecursiveSensei')) {
                        // Extract actual user input after the system prompt
                        const userInputMatch = content.match(/\n\nUser:\s*([\s\S]*?)$/);
                        if (userInputMatch) {
                            content = userInputMatch[1];
                        } else {
                            // Try another pattern - sometimes the user input is at the end after all directives
                            const lines = content.split('\n');
                            const userStartIndex = lines.findLastIndex((line: string) => line.trim().startsWith('User:'));
                            if (userStartIndex !== -1) {
                                content = lines.slice(userStartIndex).join('\n').replace(/^User:\s*/, '');
                            }
                        }
                    }
                    
                    if (role === 'user') {
                        // User messages are always complete, never streamed
                        if (currentMessage && currentMessage.role === 'model' && currentMessage.content.trim()) {
                            // Save any pending model message if it has content
                            combinedHistory.push(currentMessage);
                            currentMessage = null;
                        }
                        if (content.trim()) {
                            combinedHistory.push({
                                role: 'user',
                                content: content,
                                timestamp: entry.timestamp || new Date().toISOString()
                            });
                        }
                    } else if (role === 'model') {
                        // Model messages might be streamed chunks
                        if (currentMessage && currentMessage.role === 'model') {
                            // Append to existing model message (streaming chunks)
                            currentMessage.content += content;
                        } else {
                            // Start new model message
                            currentMessage = {
                                role: 'model',
                                content: content,
                                timestamp: entry.timestamp || new Date().toISOString()
                            };
                        }
                    }
                }
                
                // Don't forget the last message if it's a model message with content
                if (currentMessage && currentMessage.role === 'model' && currentMessage.content.trim()) {
                    combinedHistory.push(currentMessage);
                }
                
                return combinedHistory;
                
            } catch (e) {
            }
        }
        
        return history;
    }
    
    /**
     * Recreates the chat session with saved history
     */
    private static async recreateChatSession(chatSession: any): Promise<void> {
        const w = window as any;
        
        if (!chatSession?.history || !w.ai) {
            return;
        }
        
        const limitedHistory = chatSession.history.slice(-100);
        
        const sdkHistory = limitedHistory.map((entry: any) => ({
            role: entry.role,
            parts: [{ text: entry.content || '' }]
        }));
        
        try {
            // Use the correct Google AI SDK API with proper model config from model_usage.ts
            w.mainSenseiChat = w.ai.chats.create({
                model: MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.modelName,
                config: {
                    ...MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.config,
                    systemInstruction: chatSession.systemInstruction,
                },
                history: sdkHistory
            });
        } catch (error) {
        }
    }
    
    /**
     * Collects current UI state
     */
    private static collectUIState(): any {
        
        const messages: any[] = [];
        const messageElements = document.querySelectorAll('.message-bubble:not(#response-modal-sensei-bubble)');

        messageElements.forEach((element: any) => {
            let conceptSelectionPayload: any = null;
            const conceptContainer = element.querySelector('.concept-selection-buttons');
            const payloadText = conceptContainer?.dataset?.conceptPayload;
            if (payloadText) {
                try {
                    conceptSelectionPayload = JSON.parse(payloadText);
                } catch (error) {
                    conceptSelectionPayload = null;
                }
            }
            messages.push({
                id: element.id,
                className: element.className,
                sender: element.dataset.sender || (element.classList.contains('user-message') ? 'user' : 'sensei'),
                text: element.querySelector('.message-text')?.textContent || '',
                htmlContent: element.querySelector('.message-text')?.innerHTML || '',
                timestamp: element.dataset.timestamp,
                isReloadable: element.classList.contains('reloadable'),
                phaseSelectionEnabled: element.querySelector('.phase-selection-buttons') !== null,
                conceptSelectionPayload
            });
        });
        
        const w = window as any;
        const rawTextMap: { [key: string]: string } = {};
        
        if (w.streamingMessagesRawText instanceof Map) {
            w.streamingMessagesRawText.forEach((value: string, key: string) => {
                rawTextMap[key] = value;
            });
        }
        
        const footerState = {
            confidence: document.getElementById('footer-confidence')?.textContent || '',
            confusion: document.getElementById('footer-confusion')?.textContent || '',
            intent: document.getElementById('footer-intent')?.textContent || ''
        };
        
        const curriculumStatus = document.getElementById('curriculum-status')?.textContent || '';
        
        return {
            messages,
            rawTextMap,
            footerState,
            curriculumStatus
        };
    }
    
    /**
     * Restores UI state
     */
    private static async restoreUIState(uiState: any): Promise<void> {
        
        // Target the message area specifically, NOT the entire chat container
        const messageArea = document.getElementById('message-area');
        if (!messageArea) {
            return;
        }
        
        // Get the displayMessage function from window
        const w = window as any;
        const displayMessage = w.displayMessage;
        
        if (!displayMessage) {
            // Try importing directly as fallback
            try {
                const uiModule = await import('./ui.js');
                const displayMessageFunc = uiModule.displayMessage;
                
                // Preserve the meditation overlay before clearing
                const meditationOverlay = document.getElementById('sensei-meditation-overlay');
                
                // Clear ONLY the message area content, preserve UI structure
                messageArea.innerHTML = '';
                
                // Restore the meditation overlay at the beginning if it existed
                if (meditationOverlay && messageArea) {
                    // Reset the overlay styles to ensure proper positioning
                    meditationOverlay.style.position = 'absolute';
                    meditationOverlay.style.top = '64px';
                    meditationOverlay.style.zIndex = ''; // Let CSS handle it
                    messageArea.insertBefore(meditationOverlay, messageArea.firstChild);
                }
                
                // First restore the raw text map
                if (uiState.rawTextMap && w.streamingMessagesRawText instanceof Map) {
                    w.streamingMessagesRawText.clear();
                    Object.entries(uiState.rawTextMap).forEach(([key, value]) => {
                        w.streamingMessagesRawText.set(key, value as string);
                    });
                }
                
                for (const msg of uiState.messages) {
                    const rawText = uiState.rawTextMap?.[msg.id] || msg.text;
                    const message = {
                        id: msg.id,
                        sender: msg.sender,
                        displayName: msg.sender === 'user' ? 'You' : 'Recursive Sensei',
                        text: rawText,  // Use raw text to preserve formatting
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                        isLoading: false,
                        isReloadable: msg.isReloadable || false,
                        phaseSelectionEnabled: msg.phaseSelectionEnabled || false,
                        selectedModuleIndex: msg.selectedModuleIndex,
                        skipMermaid: false,
                        conceptSelectionPayload: msg.conceptSelectionPayload
                    };
                    
                    await displayMessageFunc(message);
                }
                
                // Process mermaid diagrams after restoration
                const processMermaidBlocks = w.processMermaidBlocks;
                if (processMermaidBlocks) {
                    for (const msg of uiState.messages) {
                        if (msg.sender === 'sensei') {
                            await processMermaidBlocks(msg.id);
                        }
                    }
                }
            } catch (error) {
                return;
            }
        } else {
            // Preserve the meditation overlay before clearing
            const meditationOverlay = document.getElementById('sensei-meditation-overlay');
            
            // Clear only the message area, preserving the UI structure
            messageArea.innerHTML = '';
            
            // Restore the meditation overlay at the beginning if it existed
            if (meditationOverlay && messageArea) {
                // Reset the overlay styles to ensure proper positioning
                meditationOverlay.style.position = 'absolute';
                meditationOverlay.style.top = '64px';
                meditationOverlay.style.zIndex = ''; // Let CSS handle it
                messageArea.insertBefore(meditationOverlay, messageArea.firstChild);
            }
            
            // First restore the raw text map so displayMessage can use it
            if (uiState.rawTextMap && w.streamingMessagesRawText instanceof Map) {
                w.streamingMessagesRawText.clear();
                Object.entries(uiState.rawTextMap).forEach(([key, value]) => {
                    w.streamingMessagesRawText.set(key, value as string);
                });
            }
            
            // Restore each message using the proper displayMessage function
            for (const msg of uiState.messages) {
                // Try to get the original raw text (preserves markdown/formatting)
                const rawText = uiState.rawTextMap?.[msg.id] || msg.text;
                
                // Reconstruct the Message object
                const message = {
                    id: msg.id,
                    sender: msg.sender,
                    displayName: msg.sender === 'user' ? 'You' : 'Recursive Sensei',
                    text: rawText,  // Use raw text to preserve formatting
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                    isLoading: false,
                    isReloadable: msg.isReloadable || false,
                    phaseSelectionEnabled: msg.phaseSelectionEnabled || false,
                    selectedModuleIndex: msg.selectedModuleIndex,
                    skipMermaid: false,  // We'll process mermaid after all messages are restored
                    conceptSelectionPayload: msg.conceptSelectionPayload
                };
                
                // Use the proper display function to render the message
                await displayMessage(message);
            }
            
            // After all messages are restored, process mermaid diagrams
            const processMermaidBlocks = w.processMermaidBlocks;
            if (processMermaidBlocks) {
                for (const msg of uiState.messages) {
                    if (msg.sender === 'sensei') {
                        await processMermaidBlocks(msg.id);
                    }
                }
            }
        }
        
        // Scroll to bottom after restoring messages
        if (messageArea) {
            messageArea.scrollTop = messageArea.scrollHeight;
        }
        
    }

    private static restoreNotepadContext(): void {
        const w = window as any;

        if (!w.notepad || typeof w.notepad.setActiveCurriculumContext !== 'function') {
            return;
        }
        if (!w.curriculum || !w.curriculumState) {
            return;
        }

        try {
            const currentItem = getCurrentCurriculumItem(w.curriculum, w.curriculumState);
            if (!currentItem) {
                return;
            }

            const moduleTitle =
                currentItem.moduleTitle ??
                w.curriculum.modules?.[w.curriculumState.currentModuleIndex]?.title ??
                null;

            w.notepad.setActiveCurriculumContext({
                conceptTitle: currentItem.concept?.title ?? null,
                moduleTitle
            });
        } catch (error) {
            logger.warn('[SAVELOAD] Failed to restore notepad active context', { error });
        }
    }

    private static syncModuleSelectionState(): void {
        const w = window as any;
        const handler = w.moduleSelectionHandler;

        if (!handler || typeof handler.updateState !== 'function') {
            return;
        }

        try {
            handler.updateState({
                lastSenseiResponses: Array.isArray(w.lastSenseiResponses) ? [...w.lastSenseiResponses] : [],
                pendingModuleSelection: w.pendingModuleSelection,
                pendingPhaseSelection: w.pendingPhaseSelection ?? null,
                pendingConceptSelectionIndex: w.pendingConceptSelectionIndex ?? null,
                pendingConceptSelectionBubbleId: w.pendingConceptSelectionBubbleId ?? null
            });
        } catch (error) {
            logger.warn('[SAVELOAD] Unable to sync module selection handler state', { error });
        }
    }
    
    /**
     * Handles pending operations after restoration
     */
    private static handlePendingOperations(session: SessionData): void {
        const w = window as any;
        
        if (session.applicationState.pendingModuleSelection !== null) {
            const module = w.curriculum?.modules[session.applicationState.pendingModuleSelection];
            if (module && w.displayPhaseSelectionMessage) {
                w.displayPhaseSelectionMessage(module);
            }
        }

        if (session.consolidation) {
            if (w.curriculumState) {
                w.curriculumState.activeConsolidationState = this.deserializeConsolidation(session.consolidation);
            }
        }
    }
    
    /**
     * Updates all UI displays after restoration
     */
    private static updateAllDisplays(session: SessionData): void {
        const w = window as any;
        
        // Use the existing updateFooter function if available
        if (w.updateFooter && w.learnerModel) {
            w.updateFooter(w.learnerModel);
        } else {
            // Fallback to manual update
            if (session.ui.footerState) {
                const confidenceEl = document.getElementById('footer-confidence');
                const confusionEl = document.getElementById('footer-confusion');
                const intentEl = document.getElementById('footer-intent');
                
                if (confidenceEl) confidenceEl.textContent = session.ui.footerState.confidence;
                if (confusionEl) confusionEl.textContent = session.ui.footerState.confusion;
                if (intentEl) intentEl.textContent = session.ui.footerState.intent;
            }
        }
        
        // Use the existing updateCurriculumDisplay function if available
        if (w.updateCurriculumDisplay && w.curriculumState && w.curriculum) {
            try {
                // Get the current curriculum item using the helper function from curriculum.ts
                // This properly reconstructs the curriculum item from indices
                const getCurrentCurriculumItem = w.getCurrentCurriculumItem;
                let currentItem = null;
                
                if (getCurrentCurriculumItem && w.curriculum) {
                    currentItem = getCurrentCurriculumItem(w.curriculum, w.curriculumState);
                } else if (!w.curriculum) {
                    return;
                } else {
                    // Fallback: manually get the current item
                    const module = w.curriculum.modules[w.curriculumState.currentModuleIndex];
                    if (module) {
                        const isModulePhase = ['Introduce', 'HighLevelOverview', 'ConceptOverviews', 'Solidify'].includes(w.curriculumState.currentPhase);
                        if (!isModulePhase && module.concepts) {
                            const concept = module.concepts[w.curriculumState.currentConceptIndex];
                            if (concept) {
                                currentItem = {
                                    moduleTitle: module.title,
                                    moduleGoal: module.goal,
                                    concept: concept,
                                    curriculumPathId: `${module.id}-${concept.id}-Phase_${w.curriculumState.currentPhase}`,
                                    isLastConceptInModule: w.curriculumState.currentConceptIndex === module.concepts.length - 1,
                                    isLastPhaseForConcept: false, // Would need more logic to determine
                                    isModuleWidePhase: false
                                };
                            }
                        } else {
                            currentItem = {
                                moduleTitle: module.title,
                                moduleGoal: module.goal,
                                concept: null,
                                curriculumPathId: `${module.id}-Phase_${w.curriculumState.currentPhase}`,
                                isLastConceptInModule: false,
                                isLastPhaseForConcept: false,
                                isModuleWidePhase: true
                            };
                        }
                    }
                }
                
                w.updateCurriculumDisplay(
                    currentItem,                        // curriculumItem
                    w.curriculumState.currentPhase,    // currentPhase  
                    w.curriculum,                       // appCurriculum
                    w.curriculumState,                  // appCurriculumState
                    true,                               // appIsCurriculumLoaded
                    w.learnerModel                      // learnerModel
                );
            } catch (error) {
                // Don't throw - continue with rest of restoration
            }
        } else {
            // Fallback to manual update
            const statusEl = document.getElementById('curriculum-status');
            if (statusEl && session.ui.curriculumStatus) {
                statusEl.textContent = session.ui.curriculumStatus;
            }
        }
        
        // Make sure input area is visible and enabled
        const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
        if (userInput) {
            userInput.disabled = false;
            userInput.focus();
        }
        
    }
    
    /**
     * Generates metadata for the save file
     */
    private static generateMetadata(session: SessionData): any {
        const w = window as any;
        const state = session.curriculumState;
        
        let moduleName = 'No module selected';
        let phase = 'N/A';
        let chunkProgress = 'N/A';
        
        // Use curriculum from window, not from session (since we don't save it)
        if (state && w.curriculum) {
            const module = w.curriculum.modules[state.currentModuleIndex];
            if (module) {
                moduleName = module.title;
                phase = state.currentPhase;
                
                if (state.teachingPlanForPhase) {
                    chunkProgress = `${state.currentTeachingChunkIndex + 1}/${state.teachingPlanForPhase.length}`;
                }
            }
        }
        
        return {
            moduleName,
            phase,
            chunkProgress,
            sessionDuration: Date.now() - (w.sessionStartTime || Date.now()),
            totalInteractions: session.learnerModel?.LearningTrajectory?.totalInteractions || 0,
            curriculumChecksum: this.generateCurriculumChecksum(w.curriculum),
            saveEnvironment: navigator.userAgent
        };
    }
    
    /**
     * Helper functions
     */
    
    private static hasActiveStreamingMessages(): boolean {
        const w = window as any;
        return w.streamingMessageTimers && w.streamingMessageTimers.size > 0;
    }
    
    private static async waitForStreamingCompletion(): Promise<void> {
        const maxWait = 10000;
        const startTime = Date.now();
        
        while (this.hasActiveStreamingMessages() && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    private static downloadSaveFile(jsonString: string, filename: string): void {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    private static async readFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    private static checkCompatibility(saveFile: any): { isCompatible: boolean; reason?: string } {
        if (!saveFile.version) {
            return { isCompatible: false, reason: 'No version information' };
        }
        
        const [major] = saveFile.version.split('.');
        const [currentMajor] = this.SAVE_VERSION.split('.');
        
        if (major !== currentMajor) {
            return { isCompatible: false, reason: `Major version mismatch: ${saveFile.version} vs ${this.SAVE_VERSION}` };
        }
        
        return { isCompatible: true };
    }
    
    private static async verifyCurriculumCompatibility(savedCurriculum: any): Promise<void> {
        // Curriculum compatibility check is no longer needed since curriculum is not saved
        // It's always loaded fresh from Modules.txt
        // This function is kept for potential future use if we need to verify module compatibility
        if (!savedCurriculum) {
            return;
        }
        
        const w = window as any;
        const currentCurriculum = w.curriculum;
        
        if (!currentCurriculum) {
            throw new Error('Current curriculum not loaded');
        }
        
        const savedIds = savedCurriculum.modules.map((m: any) => m.id);
        const currentIds = currentCurriculum.modules.map((m: any) => m.id);
        
        const missingIds = savedIds.filter((id: string) => !currentIds.includes(id));
        if (missingIds.length > 0) {
        }
    }
    
    private static getCurrentSystemInstruction(): string {
        return 'You are Sensei, an adaptive AI tutor helping students learn through the curriculum.';
    }
    
    private static getModelConfig(): any {
        return {
            modelName: MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.modelName,
            ...MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.config
        };
    }
    
    private static generateCurriculumChecksum(curriculum: any): string {
        if (!curriculum || !curriculum.modules) {
            return 'no-curriculum';
        }
        const str = JSON.stringify(curriculum.modules.map((m: any) => ({ id: m.id, title: m.title })));
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    
    private static serializeConsolidation(consolidation: any): any {
        if (!consolidation) return null;
        
        return {
            ...consolidation,
            plan: consolidation.plan instanceof Map ? 
                Array.from(consolidation.plan.entries()) : consolidation.plan
        };
    }
    
    private static deserializeConsolidation(consolidation: any): any {
        if (!consolidation) return null;
        
        return {
            ...consolidation,
            plan: Array.isArray(consolidation.plan) ? 
                new Map(consolidation.plan) : consolidation.plan
        };
    }
}

// Export as window global for easy access
(window as any).SaveLoadProgressManager = SaveLoadProgressManager;

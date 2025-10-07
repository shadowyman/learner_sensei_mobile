/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, DEBUG_FLAGS } from './logger';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { marked } from 'marked';
import {
    sanitizeCodeFences,
    addLanguageDisplayToCodeBlocks,
    addCopyButtonsToCodeBlocks,
    setupTextareaAutosize,
    displayMessage,
    createMessageRegistry,
    MessageRegistry,
    Message,
} from './ui';
import { renderMermaidThumbnailWithTheme } from './mermaid-theme-integration.js';
import { mermaidManager } from './mermaidManager';
import { runMermaidRecovery } from './mermaidErrorRecovery';
import { 
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION
} from './prompts';
import { SELECTION_SENSEI_CONFIG } from './model_usage';
import { notepad } from './notepad';

const RESPONSE_MODAL_SENSEI_MESSAGE_ID = 'response-modal-sensei-bubble';

type ContentStrategy = 'parsed-full' | 'explanation-only' | 'raw-fallback' | 'error';

// Declare hljs for TypeScript if it's loaded globally from a CDN
declare var hljs: any;

function logSelectionSenseiValidation(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[SELECTION_SENSEI_VALIDATION]', { event, ...payload });
    } else {
        logger.info('[SELECTION_SENSEI_VALIDATION]', { event });
    }
}


const TOOLBAR_ACTIONS = [
    { label: 'Simpler', actionType: 'explainSimpler' },
    { label: 'Analogy', actionType: 'explainWithAnalogy' },
    { label: 'Depth', actionType: 'explainInMoreDepth' },
    { label: 'Example', actionType: 'showAnExample' },
    { label: 'Code', actionType: 'showExampleCodeSnippet' },
    { label: 'Ask', actionType: 'askQuestion' },
    { label: 'Add to Notepad', actionType: 'addToNotepad' },
];

class SelectionSensei {
    private selectionToolbarElement: HTMLDivElement | null = null;
    private responseModal: HTMLDivElement | null = null;
    private responseModalHeader: HTMLElement | null = null; 
    private responseModalTitleElement: HTMLElement | null = null;
    private responseModalContentArea: HTMLDivElement | null = null;
    private responseModalTextContent: HTMLDivElement | null = null;
    private responseModalSpinner: HTMLDivElement | null = null;
    private responseModalCloseButton: HTMLButtonElement | null = null;
    private responseModalDragZone: HTMLDivElement | null = null;
    private responseModalTranscript: HTMLDivElement | null = null;
    private responseModalComposer: HTMLDivElement | null = null;
    private responseModalComposerInput: HTMLTextAreaElement | null = null;
    private responseModalSendButton: HTMLButtonElement | null = null;
    private modalMessageRegistry: MessageRegistry = createMessageRegistry();
    private modalResponseRawMarkdown: string = '';
    private followupInFlight = false;
    private modalMessageCounter = 0;
    private modalConversationToken = 0;
    private selectionChat: Chat | null = null;

    private isAskModeActive = false; // Add this line
    private askInputContainer: HTMLDivElement | null = null; // Add this property
    private isDragging = false;
    private offsetX = 0;
    private offsetY = 0;
    private boundOutsidePointerHandler: (event: PointerEvent) => void;

    constructor(
        private ai: GoogleGenAI,
        private messageArea: HTMLDivElement
    ) {
        // Bind methods to ensure 'this' context is correct in event handlers
        this.handleTextSelection = this.handleTextSelection.bind(this);
        this.handleSelectionChange = this.handleSelectionChange.bind(this);
        this.hideResponseModal = this.hideResponseModal.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragMove = this.handleDragMove.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.boundOutsidePointerHandler = this.handleOutsidePointerDown.bind(this);
        this.handleFollowupSubmit = this.handleFollowupSubmit.bind(this);
        this.handleComposerKeydown = this.handleComposerKeydown.bind(this);
    }

    public initialize(): void {
        this.getDOMElements();
        this.attachEventListeners();
        this.initializeModalComposer();
        this.resetModalState();
    }

    public cleanup(): void {
        // Remove all event listeners to prevent memory leaks and interference
        this.messageArea.removeEventListener('mouseup', this.handleTextSelection);
        this.messageArea.removeEventListener('touchend', this.handleTextSelection);
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        document.removeEventListener('pointerdown', this.boundOutsidePointerHandler, true);

        if (this.responseModalCloseButton) {
            this.responseModalCloseButton.removeEventListener('click', this.hideResponseModal);
        }

        if (this.responseModalHeader) {
            this.responseModalHeader.removeEventListener('mousedown', this.handleDragStart);
            this.responseModalHeader.removeEventListener('touchstart', this.handleDragStart as any);
        }

        if (this.responseModalDragZone) {
            this.responseModalDragZone.removeEventListener('mousedown', this.handleDragStart);
            this.responseModalDragZone.removeEventListener('touchstart', this.handleDragStart as any);
        }

        if (this.responseModalComposerInput) {
            this.responseModalComposerInput.removeEventListener('keydown', this.handleComposerKeydown);
        }

        if (this.responseModalSendButton) {
            this.responseModalSendButton.removeEventListener('click', this.handleFollowupSubmit);
        }

        this.clearModalRegistry();
        this.modalMessageRegistry = createMessageRegistry();
        this.followupInFlight = false;
        this.modalMessageCounter = 0;
        this.selectionChat = null;

        // Hide any open modals
        if (this.responseModal) {
            this.responseModal.style.display = 'none';
        }
        this.hideSelectionToolbar();

        // Clear references
        this.responseModal = null;
        this.responseModalHeader = null;
        this.responseModalTitleElement = null;
        this.responseModalContentArea = null;
        this.responseModalTextContent = null;
        this.responseModalSpinner = null;
        this.responseModalCloseButton = null;
        this.responseModalDragZone = null;
        this.responseModalTranscript = null;
        this.responseModalComposer = null;
        this.responseModalComposerInput = null;
        this.responseModalSendButton = null;
    }

    private getDOMElements(): void {
        this.responseModal = document.getElementById('response-modal') as HTMLDivElement;
        this.responseModalHeader = document.getElementById('response-modal-header') as HTMLElement;
        this.responseModalTitleElement = document.getElementById('response-modal-title') as HTMLElement;
        this.responseModalContentArea = document.getElementById('response-modal-content-area') as HTMLDivElement;
        this.responseModalTextContent = document.getElementById('response-modal-text-content') as HTMLDivElement;
        this.responseModalSpinner = document.getElementById('response-modal-spinner') as HTMLDivElement;
        this.responseModalCloseButton = document.getElementById('response-modal-close-button') as HTMLButtonElement;
        this.responseModalDragZone = document.getElementById('response-modal-drag-zone') as HTMLDivElement;
        this.responseModalTranscript = document.getElementById('selection-sensei-transcript') as HTMLDivElement;
        this.responseModalComposer = document.getElementById('selection-sensei-composer') as HTMLDivElement;
        this.responseModalComposerInput = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement;
        this.responseModalSendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement;

        if (!this.responseModal || !this.responseModalTextContent) {
            logger.warn("[SENSEI_SELECTION] Modal elements not yet available in DOM - will retry on first use");
        }
    }

    private ensureDOMElementsValid(): void {
        // Check if the modal element is still connected to the document
        // If not (e.g., after save/load), re-fetch all DOM elements
        if (!this.responseModal || !this.responseModal.isConnected ||
            !this.responseModalTextContent || !this.responseModalTextContent.isConnected ||
            !this.responseModalSpinner || !this.responseModalSpinner.isConnected ||
            !this.responseModalDragZone || !this.responseModalDragZone.isConnected) {

            this.getDOMElements();
            this.initializeModalComposer();

            // Re-attach event listeners for modal elements only
            if (this.responseModalCloseButton) {
                this.responseModalCloseButton.removeEventListener('click', this.hideResponseModal);
                this.responseModalCloseButton.addEventListener('click', this.hideResponseModal);
            }

            if (this.responseModalHeader) {
                this.responseModalHeader.removeEventListener('mousedown', this.handleDragStart);
                this.responseModalHeader.addEventListener('mousedown', this.handleDragStart);
                this.responseModalHeader.removeEventListener('touchstart', this.handleDragStart as any);
                this.responseModalHeader.addEventListener('touchstart', this.handleDragStart as any);
            }

            if (this.responseModalDragZone) {
                this.responseModalDragZone.removeEventListener('mousedown', this.handleDragStart);
                this.responseModalDragZone.addEventListener('mousedown', this.handleDragStart);
                this.responseModalDragZone.removeEventListener('touchstart', this.handleDragStart as any);
                this.responseModalDragZone.addEventListener('touchstart', this.handleDragStart as any);
            }
        }
    }

    private attachEventListeners(): void {
        this.messageArea.addEventListener('mouseup', this.handleTextSelection);
        this.messageArea.addEventListener('touchend', this.handleTextSelection); 
        document.addEventListener('selectionchange', this.handleSelectionChange);

        if (this.responseModalCloseButton) {
            this.responseModalCloseButton.addEventListener('click', this.hideResponseModal);
        }

        if (this.responseModalHeader) {
            this.responseModalHeader.addEventListener('mousedown', this.handleDragStart);
            this.responseModalHeader.addEventListener('touchstart', this.handleDragStart as any);
        }

        if (this.responseModalDragZone) {
            this.responseModalDragZone.addEventListener('mousedown', this.handleDragStart);
            this.responseModalDragZone.addEventListener('touchstart', this.handleDragStart as any);
        }
        // Use global listeners for move and up to handle dragging outside the modal
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('pointerdown', this.boundOutsidePointerHandler, true);
    }

    private initializeModalComposer(): void {
        if (!this.responseModalComposerInput || !this.responseModalSendButton) {
            return;
        }

        this.responseModalComposerInput.removeEventListener('keydown', this.handleComposerKeydown);
        this.responseModalComposerInput.addEventListener('keydown', this.handleComposerKeydown);
        setupTextareaAutosize(this.responseModalComposerInput);

        this.responseModalSendButton.removeEventListener('click', this.handleFollowupSubmit);
        this.responseModalSendButton.addEventListener('click', this.handleFollowupSubmit);

        if (!this.responseModalComposerInput.dataset.selFollowupInit) {
            this.responseModalComposerInput.dataset.selFollowupInit = 'true';
            logger.info('[SEL_FOLLOWUP] modal-ready', {
                transcriptId: this.responseModalTranscript?.id || null,
                composerId: this.responseModalComposer?.id || null,
            });
        }
    }

    private clearModalRegistry(): number {
        let clearedTimerCount = 0;
        this.modalMessageRegistry.timers.forEach(timerId => {
            clearInterval(timerId);
            clearedTimerCount += 1;
        });
        this.modalMessageRegistry.timers.clear();
        this.modalMessageRegistry.rawText.clear();
        return clearedTimerCount;
    }

    private setComposerEnabled(enabled: boolean): void {
        if (this.responseModalComposerInput) {
            this.responseModalComposerInput.disabled = !enabled;
        }
        if (this.responseModalSendButton) {
            this.responseModalSendButton.disabled = !enabled;
        }
    }

    private ensureSelectionChat(): Chat | null {
        if (!this.ai) {
            return null;
        }
        if (!this.selectionChat) {
            this.selectionChat = this.ai.chats.create({
                model: SELECTION_SENSEI_CONFIG.modelName,
                config: {
                    ...SELECTION_SENSEI_CONFIG.config,
                    systemInstruction: SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
                },
                history: [],
            });
        }
        return this.selectionChat;
    }

    private resetModalState(): void {
        this.modalConversationToken += 1;
        this.ensureDOMElementsValid();
        const transcript = this.responseModalTranscript;
        let removedMessages = 0;
        if (transcript) {
            const children = Array.from(transcript.children);
            children.forEach(child => {
                if (child instanceof HTMLElement && child.id !== 'response-modal-sensei-bubble') {
                    transcript.removeChild(child);
                    removedMessages += 1;
                }
            });
        }

        if (this.responseModalTextContent) {
            this.responseModalTextContent.innerHTML = '';
        }

        if (this.responseModalSpinner) {
            this.responseModalSpinner.style.display = 'none';
        }

        if (this.responseModalTitleElement) {
            this.responseModalTitleElement.textContent = 'Sensei Explains...';
        }

        if (this.responseModalComposerInput) {
            this.responseModalComposerInput.value = '';
            this.responseModalComposerInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const timersCleared = this.clearModalRegistry();
        this.modalMessageRegistry = createMessageRegistry();
        this.modalResponseRawMarkdown = '';
        this.followupInFlight = false;
        this.modalMessageCounter = 0;
        this.selectionChat = null;
        this.setComposerEnabled(true);

        logger.info('[SEL_FOLLOWUP] reset', {
            removedMessages,
            timersCleared,
        });
    }

    private generateModalMessageId(prefix: 'user' | 'sensei'): string {
        this.modalMessageCounter += 1;
        return `selection-sensei-modal-${prefix}-${this.modalMessageCounter}`;
    }

    private formatFollowupAnswer(rawText: string): { text: string; strategy: 'parsed-full' | 'explanation-only' | 'raw' } {
        const trimmed = rawText.trim();
        if (!trimmed) {
            return { text: 'Sensei could not generate a response.', strategy: 'raw' };
        }

        const extracted = this.extractContentWithRegex(trimmed);

        if (extracted.suggestedTitle && extracted.explanation) {
            return {
                text: `**${extracted.suggestedTitle}**\n\n${extracted.explanation}`,
                strategy: 'parsed-full',
            };
        }

        if (extracted.explanation) {
            return {
                text: extracted.explanation,
                strategy: 'explanation-only',
            };
        }

        return { text: trimmed, strategy: 'raw' };
    }

    private async appendModalMessage(message: Message, conversationToken?: number): Promise<void> {
        if (conversationToken !== undefined && conversationToken !== this.modalConversationToken) {
            return;
        }
        this.ensureDOMElementsValid();
        if (!this.responseModalTranscript) {
            return;
        }
        const shouldSkipGlobalMermaid = message.sender === 'sensei' && !!this.responseModalTranscript;
        const modalMessage = shouldSkipGlobalMermaid ? { ...message, skipMermaid: true } : message;

        await displayMessage(modalMessage, {
            container: this.responseModalTranscript,
            scrollTarget: this.responseModalTranscript,
            registry: this.modalMessageRegistry,
        });

        if (shouldSkipGlobalMermaid) {
            if (conversationToken !== undefined && conversationToken !== this.modalConversationToken) {
                return;
            }
            const messageBubble = document.getElementById(modalMessage.id) as HTMLDivElement | null;
            const messageContent = messageBubble?.querySelector('.message-text') as HTMLElement | null;
            if (messageContent) {
                await this.processMermaidDiagrams(messageContent, { messageId: modalMessage.id });
            }
        }
    }

    private handleComposerKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void this.handleFollowupSubmit();
        }
    }

    private async handleFollowupSubmit(): Promise<void> {
        if (this.followupInFlight || !this.responseModalComposerInput) {
            return;
        }
        const conversationToken = this.modalConversationToken;
        const trimmed = this.responseModalComposerInput.value.trim();
        if (!trimmed) {
            return;
        }

        this.followupInFlight = true;
        this.setComposerEnabled(false);

        try {
            const userMessageId = this.generateModalMessageId('user');
            await this.appendModalMessage({
                id: userMessageId,
                sender: 'user',
                displayName: 'You',
                text: trimmed,
                timestamp: new Date(),
            }, conversationToken);

            if (conversationToken !== this.modalConversationToken) {
                this.followupInFlight = false;
                return;
            }

            this.responseModalComposerInput.value = '';
            this.responseModalComposerInput.dispatchEvent(new Event('input', { bubbles: true }));

            await this.dispatchFollowupToAI(trimmed, conversationToken);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[SEL_FOLLOWUP] failure', {
                message,
                stage: 'submit',
            });
            this.followupInFlight = false;
            if (conversationToken === this.modalConversationToken) {
                this.setComposerEnabled(true);
            }
        }
    }

    private async dispatchFollowupToAI(question: string, conversationToken: number): Promise<void> {
        if (conversationToken !== this.modalConversationToken) {
            this.followupInFlight = false;
            return;
        }

        const loadingMessageId = this.generateModalMessageId('sensei');
        await this.appendModalMessage({
            id: loadingMessageId,
            sender: 'sensei',
            displayName: 'Sensei',
            text: 'Sensei is preparing a follow-up...',
            timestamp: new Date(),
            isLoading: true,
        }, conversationToken);

        if (conversationToken !== this.modalConversationToken) {
            this.followupInFlight = false;
            return;
        }

        if (!this.ai) {
            await this.appendModalMessage({
                id: loadingMessageId,
                sender: 'sensei',
                displayName: 'Sensei',
                text: 'AI service is not available. Please refresh and try again.',
                timestamp: new Date(),
                isLoading: false,
            }, conversationToken);
            this.followupInFlight = false;
            if (conversationToken === this.modalConversationToken) {
                this.setComposerEnabled(true);
            }
            return;
        }

        try {
            const chat = this.ensureSelectionChat();
            if (!chat) {
                throw new Error('Selection Sensei chat unavailable');
            }

            const response = await chat.sendMessage({
                message: question,
            });

            const formatted = this.formatFollowupAnswer(response.text ?? '');

            if (conversationToken !== this.modalConversationToken) {
                this.followupInFlight = false;
                return;
            }

            await this.appendModalMessage({
                id: loadingMessageId,
                sender: 'sensei',
                displayName: 'Sensei',
                text: formatted.text,
                timestamp: new Date(),
                isLoading: false,
            }, conversationToken);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (conversationToken === this.modalConversationToken) {
                await this.appendModalMessage({
                    id: loadingMessageId,
                    sender: 'sensei',
                    displayName: 'Sensei',
                    text: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date(),
                    isLoading: false,
                }, conversationToken);
            }
        } finally {
            if (conversationToken === this.modalConversationToken) {
                this.followupInFlight = false;
                this.setComposerEnabled(true);
            }
        }
    }

    private handleTextSelection(event: MouseEvent | TouchEvent): void {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const selectedText = selection.toString().trim();
            if (selectedText.length > 0) {
                const range = selection.getRangeAt(0);
                let parentElement: Node | null = range.commonAncestorContainer;
                if (parentElement.nodeType === Node.TEXT_NODE) {
                    parentElement = parentElement.parentElement ?? parentElement;
                }

                const senseiMessageTextElement = parentElement instanceof HTMLElement
                    ? parentElement.closest('.message-bubble[data-sender="sensei"] .message-text')
                    : null;
                if (senseiMessageTextElement) {
                    const originalSenseiMessageText = senseiMessageTextElement.textContent || "";
                    this.createAndShowSelectionToolbar(selection, originalSenseiMessageText);
                    return;
                }

                const contextCarrier = parentElement instanceof HTMLElement
                    ? parentElement.closest('[data-selection-sensei-context]') as HTMLElement | null
                    : null;
                if (contextCarrier) {
                    const contextText = contextCarrier.dataset.selectionSenseiContext;
                    if (contextText && contextText.trim().length > 0) {
                        this.createAndShowSelectionToolbar(selection, contextText);
                        return;
                    }
                }
            }
        }
        this.hideSelectionToolbar();
    }

    private handleSelectionChange(): void {
        if (this.isAskModeActive) return; // Add this guard clause
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            if (this.selectionToolbarElement && this.selectionToolbarElement.classList.contains('visible')) {
                this.hideSelectionToolbar();
            }
        }
    }

    private createAndShowSelectionToolbar(selection: Selection, originalSenseiMessageText: string): void {
        this.hideSelectionToolbar(); 

        this.selectionToolbarElement = document.createElement('div');
        this.selectionToolbarElement.className = 'selection-toolbar';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'selection-toolbar-buttons';

        const selectedText = selection.toString().trim();

        TOOLBAR_ACTIONS.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.label; 
            button.title = action.label;
            
            if (action.actionType === 'addToNotepad') {
                button.className = 'notepad-button';
            }
            
            button.addEventListener('click', () => {
                if (action.actionType === 'askQuestion') {
                    this.activateAskMode(selectedText, originalSenseiMessageText, action.label);
                } else if (action.actionType === 'addToNotepad') {
                    this.handleAddToNotepad(selectedText);
                } else {
                    this.handleToolbarAction(selectedText, action.actionType, originalSenseiMessageText, action.label);
                }
            });
            buttonContainer.appendChild(button);
        });
        this.selectionToolbarElement.appendChild(buttonContainer); // Append the button container

        document.body.appendChild(this.selectionToolbarElement);

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Calculate initial position
        const toolbarHeight = this.selectionToolbarElement.offsetHeight;
        const toolbarWidth = this.selectionToolbarElement.offsetWidth;
        
        let top = window.scrollY + rect.top - toolbarHeight - 8;
        let left = window.scrollX + rect.left + (rect.width / 2) - (toolbarWidth / 2);
        
        // Viewport boundary checks
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Check right boundary
        if (left + toolbarWidth > window.scrollX + viewportWidth - 10) {
            left = window.scrollX + viewportWidth - toolbarWidth - 10;
        }
        
        // Check left boundary
        if (left < window.scrollX + 10) {
            left = window.scrollX + 10;
        }
        
        // Check top boundary - if toolbar would go above viewport, show below selection
        if (top < window.scrollY + 10) {
            top = window.scrollY + rect.bottom + 8;
        }
        
        // Check bottom boundary - if toolbar would go below viewport, show above selection
        if (top + toolbarHeight > window.scrollY + viewportHeight - 10) {
            top = window.scrollY + rect.top - toolbarHeight - 8;
        }
        
        this.selectionToolbarElement.style.top = `${top}px`; 
        this.selectionToolbarElement.style.left = `${left}px`;

        requestAnimationFrame(() => {
            if (this.selectionToolbarElement) {
                this.selectionToolbarElement.classList.add('visible');
            }
        });
    }

    private hideSelectionToolbar(): void {
        if (this.selectionToolbarElement) {
            this.selectionToolbarElement.remove();
            this.selectionToolbarElement = null;
            this.askInputContainer = null; // Reset the container
        }
        this.isAskModeActive = false; // Add this line
    }

    private activateAskMode(selectedText: string, originalSenseiMessageText: string, actionLabel: string): void {
        if (!this.selectionToolbarElement || this.askInputContainer) return; // Prevent creating multiple inputs

        this.isAskModeActive = true; // Add this line
        // Disable other buttons
        this.selectionToolbarElement.querySelectorAll('.selection-toolbar-buttons button').forEach(btn => {
            (btn as HTMLButtonElement).disabled = true;
        });

        this.askInputContainer = document.createElement('div');
        this.askInputContainer.className = 'selection-ask-container';

        const textInput = document.createElement('textarea');
        textInput.className = 'selection-ask-input';
        textInput.placeholder = 'Ask a question about the text...';

        const sendButton = document.createElement('button');
        sendButton.className = 'selection-ask-send-button';
        sendButton.textContent = 'Send';

        const sendMessage = () => {
            const userQuestion = textInput.value.trim();
            if (userQuestion) {
                this.handleToolbarAction(selectedText, 'askQuestion', originalSenseiMessageText, actionLabel, userQuestion);
            }
        };

        sendButton.addEventListener('click', sendMessage);

        textInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        this.askInputContainer.appendChild(textInput);
        this.askInputContainer.appendChild(sendButton);
        this.selectionToolbarElement.appendChild(this.askInputContainer);

        // Trigger the animation and setup autosize
        requestAnimationFrame(() => {
            this.selectionToolbarElement?.classList.add('ask-mode-active');
            setupTextareaAutosize(textInput); // ADD THIS LINE
            textInput.focus();
        });
    }
    
    private handleAddToNotepad(selectedText: string): void {
        logSelectionSenseiValidation('notepad-add-requested', {
            textLength: selectedText.length
        });
        
        // Get the selection for HTML capture
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            logger.error('No selection available');
            return;
        }
        
        const range = selection.getRangeAt(0);
        
        // Capture the HTML fragment of the selection
        let selectedHTML = '';
        try {
            const fragment = range.cloneContents();
            const div = document.createElement('div');
            div.appendChild(fragment);
            selectedHTML = div.innerHTML;
            logSelectionSenseiValidation('html-fragment-captured', {
                textLength: selectedText.length,
                htmlLength: selectedHTML.length
            });
        } catch (error) {
            logger.error('Error capturing HTML fragment:', error);
        }
        
        // Add to notepad with the plain text and HTML version
        // Pass selectedText for both text and markdown parameters since markdown extraction doesn't work
        notepad.addNote(selectedText, selectedText, selectedHTML);
        
        this.hideSelectionToolbar();
    }

    private showResponseModalWithLoading(): void {
        // Ensure DOM elements are still valid (important after save/load)
        this.ensureDOMElementsValid();

        if (!this.responseModal || !this.responseModalTitleElement || !this.responseModalTextContent || !this.responseModalSpinner) {
            logger.error("Selection Sensei: Cannot show modal - required elements missing");
            return;
        }

        // Log what's currently in the modal before we change it

        // CRITICAL: Clear content BEFORE showing the modal to prevent flash of old content
        // Force clear any existing content - remove ALL children first
        while (this.responseModalTextContent.firstChild) {
            this.responseModalTextContent.removeChild(this.responseModalTextContent.firstChild);
        }
        this.responseModalTextContent.innerHTML = '';
        this.responseModalTextContent.textContent = ''; // Triple clear

        this.responseModalTitleElement.textContent = "Sensei is preparing an explanation...";
        this.responseModalSpinner.style.display = 'block';

        this.setComposerEnabled(false);

        // Now show the modal with clean content
        this.responseModal.style.left = '50%';
        this.responseModal.style.top = '50%';
        this.responseModal.style.transform = 'translate(-50%, -50%)';
        this.responseModal.style.display = 'flex';
        logSelectionSenseiValidation('modal-loading', {
            spinnerVisible: true,
            contentCleared: this.responseModalTextContent.innerHTML.length === 0
        });
    }

    private async updateResponseModalContentAndTitle(title: string, htmlContent: string, conversationToken?: number): Promise<void> {
        if (conversationToken !== undefined && conversationToken !== this.modalConversationToken) {
            return;
        }
        // Ensure DOM elements are still valid (important after save/load)
        this.ensureDOMElementsValid();

        if (!this.responseModal || !this.responseModalTextContent || !this.responseModalSpinner || !this.responseModalTitleElement) {
            logger.error("Selection Sensei: Cannot update content - required elements missing", {
                modalTextContent: !!this.responseModalTextContent,
                modalSpinner: !!this.responseModalSpinner,
                modalTitle: !!this.responseModalTitleElement
            });
            return;
        }


        let highlightApplied = false;
        let uiEnhancementsApplied = false;
        let mermaidProcessed = false;

        try {
            // Trim the content to prevent accidental code block formatting
            const trimmedContent = htmlContent.trim();
            this.modalResponseRawMarkdown = trimmedContent;
            const sanitizedContent = sanitizeCodeFences(trimmedContent);
            this.responseModalTitleElement.textContent = title;
            this.responseModalSpinner.style.display = 'none';

            const parsedMarkdown = marked.parse(sanitizedContent) as string;

            // Complete nuclear option: remove all children and set new content
            while (this.responseModalTextContent.firstChild) {
                this.responseModalTextContent.removeChild(this.responseModalTextContent.firstChild);
            }

            // Create a new div with the content and replace everything
            const contentWrapper = document.createElement('div');
            contentWrapper.innerHTML = parsedMarkdown;
            contentWrapper.style.display = 'block'; // Ensure it's visible

            // Replace all content with the new wrapper
            this.responseModalTextContent.innerHTML = '';
            this.responseModalTextContent.appendChild(contentWrapper);

            // Force the modal to be visible and content to be displayed
            this.responseModalTextContent.style.display = 'block';
            this.responseModal.style.display = 'flex';

        } catch (innerError) {
            logger.error("[SENSEI_SELECTION] Error in content update:", innerError);
            throw innerError;
        }
        
        try {
            this.responseModalTextContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });
            highlightApplied = true;
        } catch (highlightError) {
            logger.warn("[SENSEI_SELECTION] Error during code highlighting:", highlightError);
            // Continue without highlighting
        }

        try {
            addLanguageDisplayToCodeBlocks(this.responseModalTextContent);
            addCopyButtonsToCodeBlocks(this.responseModalTextContent);
            uiEnhancementsApplied = true;
        } catch (uiError) {
            logger.warn("[SENSEI_SELECTION] Error adding UI elements:", uiError);
            // Continue without these UI enhancements
        }

        try {
            await this.processMermaidDiagrams(this.responseModalTextContent, { messageId: RESPONSE_MODAL_SENSEI_MESSAGE_ID });
            mermaidProcessed = true;
        } catch (mermaidError) {
            logger.warn("[SENSEI_SELECTION] Error processing Mermaid diagrams:", mermaidError);
            // Continue without Mermaid rendering
        }

        logSelectionSenseiValidation('content-postprocess', {
            highlightApplied,
            uiEnhancementsApplied,
            mermaidProcessed
        });

        this.setComposerEnabled(true);
    }

    private hideResponseModal(): void {
        this.ensureDOMElementsValid();

        const modalElement = this.responseModal;
        const wasHidden = modalElement ? modalElement.style.display === 'none' : true;
        const previousToken = this.modalConversationToken;

        this.resetModalState();

        if (!wasHidden && modalElement) {
            modalElement.style.display = 'none';
            if (this.responseModalTextContent) {
                this.responseModalTextContent.innerHTML = '';
            }
            if (this.responseModalTitleElement) {
                this.responseModalTitleElement.textContent = '';
            }
        }

        logger.info("[SEL_MODAL_CANCEL] modal-hidden", {
            previousToken,
            nextToken: this.modalConversationToken,
        });
        this.hideSelectionToolbar();
    }

    

    private extractContentWithRegex(text: string): { suggestedTitle?: string; explanation?: string } {
        const normalized = this.normalizeJsonPayload(text);

        const parsed = this.tryParseStructuredPayload(normalized);
        if (parsed.suggestedTitle || parsed.explanation) {
            return parsed;
        }

        const repairedPayload = this.repairLooseJson(normalized);
        if (repairedPayload !== normalized) {
            const repairedParsed = this.tryParseStructuredPayload(repairedPayload, false);
            if (repairedParsed.suggestedTitle || repairedParsed.explanation) {
                return repairedParsed;
            }
        }

        const fallbackTitle = this.extractStringField(normalized, 'suggestedTitle');
        const fallbackExplanation = this.extractStringField(normalized, 'explanation');

        const result: { suggestedTitle?: string; explanation?: string } = {};
        if (fallbackTitle !== undefined) {
            result.suggestedTitle = fallbackTitle;
        }
        if (fallbackExplanation !== undefined) {
            result.explanation = fallbackExplanation;
        }
        return result;
    }

    private normalizeJsonPayload(payload: string): string {
        return payload
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .trim();
    }

    private tryParseStructuredPayload(payload: string, logFailure: boolean = true): { suggestedTitle?: string; explanation?: string } {
        try {
            const parsed = JSON.parse(payload);
            if (parsed && typeof parsed === 'object') {
                const result: { suggestedTitle?: string; explanation?: string } = {};
                if (typeof (parsed as any).suggestedTitle === 'string') {
                    result.suggestedTitle = (parsed as any).suggestedTitle;
                }
                if (typeof (parsed as any).explanation === 'string') {
                    result.explanation = (parsed as any).explanation;
                }
                return result;
            }
        } catch (error) {
            if (logFailure) {
                logger.debug('[SENSEI_SELECTION] JSON parse failed', {
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return {};
    }

    private repairLooseJson(payload: string): string {
        let repaired = payload;
        repaired = repaired.replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":');
        repaired = repaired.replace(/:\s*'([^']*?)'/g, ': "$1"');
        repaired = repaired.replace(/,\s*}/g, '}');
        repaired = repaired.replace(/,\s*]/g, ']');
        return repaired;
    }

    private extractStringField(source: string, key: string): string | undefined {
        const keyIndex = source.indexOf(`"${key}"`);
        if (keyIndex === -1) {
            return undefined;
        }

        let cursor = source.indexOf(':', keyIndex + key.length + 2);
        if (cursor === -1) {
            return undefined;
        }

        cursor += 1;
        while (cursor < source.length && /\s/.test(source.charAt(cursor))) {
            cursor += 1;
        }

        if (cursor >= source.length) {
            return undefined;
        }

        const quoteChar = source.charAt(cursor);
        if (quoteChar !== '"' && quoteChar !== "'") {
            return undefined;
        }

        cursor += 1;
        let escapeNext = false;
        let value = '';

        while (cursor < source.length) {
            const ch = source.charAt(cursor);
            cursor += 1;

            if (escapeNext) {
                switch (ch) {
                    case 'n':
                        value += '\n';
                        break;
                    case 'r':
                        value += '\r';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case '\\':
                        value += '\\';
                        break;
                    case '"':
                        value += '"';
                        break;
                    case "'":
                        value += "'";
                        break;
                    case 'u': {
                        const hex = source.slice(cursor, cursor + 4);
                        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                            value += String.fromCharCode(parseInt(hex, 16));
                            cursor += 4;
                        } else {
                            value += 'u';
                        }
                        break;
                    }
                    default:
                        value += ch;
                        break;
                }
                escapeNext = false;
                continue;
            }

            if (ch === '\\') {
                escapeNext = true;
                continue;
            }

            if (ch === quoteChar) {
                return value;
            }

            value += ch;
        }

        return value || undefined;
    }

    private updateModalMermaidFence(messageId: string, originalCode: string, replacement: string): void {
        const rawTextMap = this.modalMessageRegistry.rawText;
        const current = rawTextMap.get(messageId) || '';
        if (!current) {
            return;
        }
        const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactFence = new RegExp('```\\s*mermaid\\s*\\n\\s*' + escapeRe(originalCode) + '\\s*\\n```', 's');
        if (exactFence.test(current)) {
            const updated = current.replace(exactFence, replacement);
            rawTextMap.set(messageId, updated);
            return;
        }
        const genericFence = /```\s*mermaid[\s\S]*?```/;
        if (genericFence.test(current)) {
            const updated = current.replace(genericFence, replacement);
            rawTextMap.set(messageId, updated);
        }
    }

    private async processMermaidDiagrams(container: HTMLElement, context?: { messageId?: string }): Promise<void> {
        const messageId = context?.messageId;
        const mermaidBlocks = container.querySelectorAll('pre code.language-mermaid');

        if (messageId && this.modalResponseRawMarkdown) {
            this.modalMessageRegistry.rawText.set(messageId, this.modalResponseRawMarkdown);
        }

        // Process all Mermaid diagrams in parallel
        const mermaidPromises = Array.from(mermaidBlocks).map(async (block) => {
            const preElement = block.parentElement as HTMLElement;
            const rawMermaidCode = block.textContent || '';

            try {
                const uniqueId = `selection-mermaid-${crypto.randomUUID()}`;
                const { svg } = await mermaidManager.render(uniqueId, rawMermaidCode);
                renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), rawMermaidCode);
            } catch (error: any) {
                if (DEBUG_FLAGS.mermaid_debug) {
                    logger.error("Selection Sensei: Mermaid rendering failed:", error);
                }

                const fixingDiv = document.createElement('div');
                fixingDiv.className = 'mermaid-error';
                fixingDiv.style.color = '#f59e0b';
                fixingDiv.innerHTML = `
                    <span class="inline-spinner"></span> Attempting to fix diagram...
                `;
                preElement.replaceWith(fixingDiv);

                try {
                    const recoveryResult = await runMermaidRecovery({
                        ai: this.ai || null,
                        initialDiagram: rawMermaidCode,
                        initialError: error?.message || 'Unknown error',
                        renderAttempt: async (diagram: string) => {
                            const uniqueId = `selection-mermaid-recovery-${crypto.randomUUID()}`;
                            return mermaidManager.render(uniqueId, diagram);
                        }
                    });
                    if (recoveryResult) {
                        renderMermaidThumbnailWithTheme(fixingDiv, recoveryResult.svg, mermaidManager.getCurrentTheme(), recoveryResult.diagram);
                        if (messageId) {
                            const replacement = '```mermaid\n' + recoveryResult.diagram + '\n```';
                            this.updateModalMermaidFence(messageId, rawMermaidCode, replacement);
                            const updated = this.modalMessageRegistry.rawText.get(messageId);
                            if (updated) {
                                this.modalResponseRawMarkdown = updated;
                            }
                        }
                        return;
                    }
                } catch (fixError) {
                    logger.error('Selection Sensei: Mermaid recovery failed:', fixError);
                }

                const errorDiv = document.createElement('div');
                logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                if (messageId) {
                    this.updateModalMermaidFence(messageId, rawMermaidCode, "[Diagram could not be rendered, and automatic fix failed]");
                    const updated = this.modalMessageRegistry.rawText.get(messageId);
                    if (updated) {
                        this.modalResponseRawMarkdown = updated;
                    }
                }
                errorDiv.className = 'mermaid-error';
                errorDiv.textContent = "[Diagram could not be rendered, and automatic fix failed]";
                fixingDiv.replaceWith(errorDiv);
            }
        });

        await Promise.all(mermaidPromises);
    }

    private async handleToolbarAction(selectedText: string, actionType: string, originalSenseiMessageText: string, actionLabel: string, userQuestion?: string): Promise<void> {
        const aiAvailable = !!this.ai;
        const modelsAvailable = this.ai ? !!this.ai.models : false;
        logSelectionSenseiValidation('toolbar-action', {
            actionType,
            selectedTextLength: selectedText?.length || 0,
            hasUserQuestion: !!userQuestion,
            aiAvailable,
            modelsAvailable
        });

        this.resetModalState();
        const conversationToken = this.modalConversationToken;
        const guardActive = (stage: string): boolean => {
            if (conversationToken !== this.modalConversationToken) {
                return false;
            }
            return true;
        };

        this.showResponseModalWithLoading();
        this.setComposerEnabled(false);
        this.hideSelectionToolbar();

        if (!this.ai || !this.ai.models) {
            logger.error("Selection Sensei: AI instance is not properly initialized", {
                aiExists: !!this.ai,
                modelsExists: this.ai ? !!this.ai.models : false
            });
            if (guardActive('ai-check')) {
                await this.updateResponseModalContentAndTitle("Error", "AI service is not available. Please refresh the page.", conversationToken);
            }
            return;
        }

        let instructionText = "";
        let userPrompt = "";

        if (actionType === 'askQuestion' && userQuestion) {
            userPrompt = SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(originalSenseiMessageText, selectedText, userQuestion, actionLabel);
        } else {
            switch (actionType) {
                case 'explainSimpler': instructionText = "Explain the 'SELECTED TEXT' in a simpler way, suitable for a beginner who might be finding it complex."; break;
                case 'explainWithAnalogy': instructionText = "Provide a clear and concise analogy to help understand the 'SELECTED TEXT'."; break;
                case 'explainInMoreDepth': instructionText = "Explain the 'SELECTED TEXT' in more depth, providing more details and context. Try to understand why someone would require more depth for 'SELECTED TEXT' and tailor your response accordingly. The goal is proactively making sure you cover everything for it."; break;
                case 'showAnExample': instructionText = "Provide a new relevant and illustrative example for the concept in the 'SELECTED TEXT'. The example should be explained in detail."; break;
                case 'showExampleCodeSnippet': instructionText = "Provide a complete, fully functional C++ code implementation that demonstrates the concept discussed in the 'SELECTED TEXT'. This must be a FULL implementation, not just a snippet. After the code, provide a LINE-BY-LINE explanation of the code, anticipating and addressing common questions or pitfalls a novice programmer might have about each part of the code. Make connections to the context throughout your explanation."; break;
                default:
                    if (guardActive('unknown-action')) {
                        await this.updateResponseModalContentAndTitle("Error", "Unknown action type.", conversationToken);
                    }
                    return;
            }
            userPrompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(originalSenseiMessageText, selectedText, instructionText, actionLabel);
        }

        let responseLength = 0;
        let hadFence = false;
        let parseStrategy: 'regex' | 'failed' = 'failed';
        let contentStrategy: ContentStrategy = 'error';
        let hasTitle = false;
        let hasExplanation = false;

        const chat = this.ensureSelectionChat();
        if (!chat) {
            if (guardActive('ensure-chat')) {
                await this.updateResponseModalContentAndTitle("Error", "AI service is not available. Please refresh the page.", conversationToken);
                this.setComposerEnabled(true);
            }
            return;
        }

        try {
            const response = await chat.sendMessage({
                message: userPrompt,
            });

            if (!guardActive('post-send')) {
                return;
            }

            let jsonText = (response.text || '').trim();
            responseLength = jsonText.length;

            const startsWithBrace = jsonText.startsWith('{');
            const endsWithBrace = jsonText.endsWith('}');
            logSelectionSenseiValidation('response-received', {
                actionType,
                length: responseLength,
                startsWithBrace,
                endsWithBrace
            });

            // Try to extract from code fence if present
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonText.match(fenceRegex);
            if (match && match[2]) {
                jsonText = match[2].trim();
                hadFence = true;
            }

            let parsedResponse: { suggestedTitle?: string; explanation?: string } = {};
            let parseSuccess = false;

            // Regex-only extraction
            parsedResponse = this.extractContentWithRegex(jsonText);
            if (parsedResponse.suggestedTitle || parsedResponse.explanation) {
                parseSuccess = true;
                parseStrategy = 'regex';
            }

            // Step 4: Display the response or fallback
            if (parseSuccess && parsedResponse.suggestedTitle && parsedResponse.explanation) {
                hasTitle = true;
                hasExplanation = true;
                contentStrategy = 'parsed-full';
                if (!guardActive('update-parsed-full')) {
                    return;
                }
                try {
                    await this.updateResponseModalContentAndTitle(
                        parsedResponse.suggestedTitle,
                        parsedResponse.explanation,
                        conversationToken
                    );
                } catch (updateError) {
                    logger.error("[SENSEI_SELECTION] Error updating modal:", updateError);
                    throw updateError;
                }
            } else if (parseSuccess && parsedResponse.explanation) {
                hasExplanation = true;
                contentStrategy = 'explanation-only';
                if (!guardActive('update-explanation-only')) {
                    return;
                }
                await this.updateResponseModalContentAndTitle(
                    "Sensei Explains...",
                    parsedResponse.explanation,
                    conversationToken
                );
            } else if (jsonText && jsonText.length > 0) {
                contentStrategy = 'raw-fallback';
                logger.warn("[SENSEI_SELECTION] Using raw response as fallback");
                if (!guardActive('update-raw-fallback')) {
                    return;
                }
                await this.updateResponseModalContentAndTitle(
                    "Sensei's Response",
                    jsonText,
                    conversationToken
                );
            } else {
                contentStrategy = 'error';
                logger.warn("[SENSEI_SELECTION] No valid content to display");
                if (!guardActive('update-empty')) {
                    return;
                }
                await this.updateResponseModalContentAndTitle(
                    "Error",
                    "Sorry, I couldn't generate a proper response. Please try again.",
                    conversationToken
                );
            }
        } catch (error) {
            contentStrategy = 'error';
            // Improved error logging to capture the actual error details
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : '';
            
            logger.error("Error calling Gemini for selected text action:", {
                message: errorMessage,
                stack: errorStack,
                error: error,
                actionType: actionType,
                selectedTextLength: selectedText?.length || 0,
                timestamp: new Date().toISOString()
            });
            
            // More specific error messages based on error type
            let userMessage = "Sorry, I encountered an error. Please try again.";
            
            if (errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('429')) {
                userMessage = "API rate limit reached. Please wait a moment before trying again.";
            } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
                userMessage = "Network error occurred. Please check your connection and try again.";
            } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
                userMessage = "Failed to process the response. Please try again.";
            }

            if (!guardActive('update-error')) {
                return;
            }

            await this.updateResponseModalContentAndTitle("Error", userMessage, conversationToken);
        }

        if (!guardActive('response-handled')) {
            return;
        }

        logSelectionSenseiValidation('response-handled', {
            actionType,
            parseStrategy,
            contentStrategy,
            responseLength,
            hadFence,
            hasTitle,
            hasExplanation
        });
    }

    private handleDragStart(e: MouseEvent): void {
        if (!this.responseModal || (e.target as HTMLElement).closest('#response-modal-close-button')) return;

        this.isDragging = true;
        const modalRect = this.responseModal.getBoundingClientRect();

        this.responseModal.style.transform = 'none';
        this.responseModal.style.left = modalRect.left + 'px';
        this.responseModal.style.top = modalRect.top + 'px';

        this.offsetX = e.clientX - modalRect.left;
        this.offsetY = e.clientY - modalRect.top;

        this.responseModal.style.userSelect = 'none';
    }

    private handleDragMove(e: MouseEvent): void {
        if (!this.isDragging || !this.responseModal) return;
        let newX = e.clientX - this.offsetX;
        let newY = e.clientY - this.offsetY;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        newX = Math.max(0, Math.min(newX, viewportWidth - this.responseModal.offsetWidth));
        newY = Math.max(0, Math.min(newY, viewportHeight - this.responseModal.offsetHeight));

        this.responseModal.style.transform = 'none';
        this.responseModal.style.left = `${newX}px`;
        this.responseModal.style.top = `${newY}px`;
    }

    private handleDragEnd(): void {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.responseModal) this.responseModal.style.userSelect = '';
        }
    }

    private handleOutsidePointerDown(event: PointerEvent): void {
        if (!this.responseModal) {
            return;
        }

        if (this.isDragging) {
            return;
        }

        if (this.responseModal.style.display === 'none') {
            return;
        }

        const target = event.target as Node | null;
        if (target && this.responseModal.contains(target)) {
            return;
        }

        this.hideResponseModal();
    }
}

let currentSelectionSenseiInstance: SelectionSensei | null = null;

export function initializeSelectionSensei(
    ai: GoogleGenAI,
    messageArea: HTMLDivElement
): void {
    // Clean up any existing instance
    if (currentSelectionSenseiInstance) {
        currentSelectionSenseiInstance.cleanup();
        currentSelectionSenseiInstance = null;
    }

    currentSelectionSenseiInstance = new SelectionSensei(ai, messageArea);
    currentSelectionSenseiInstance.initialize();
}

export function reinitializeSelectionSensei(
    ai: GoogleGenAI
): void {
    const messageArea = document.getElementById('message-area') as HTMLDivElement;
    if (messageArea) {
        logSelectionSenseiValidation('reinitialized', { messageAreaFound: true });
        initializeSelectionSensei(ai, messageArea);
    }
}

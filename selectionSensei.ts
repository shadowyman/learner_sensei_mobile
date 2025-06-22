/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { marked } from 'marked';
import { sanitizeCodeFences, addLanguageDisplayToCodeBlocks, addCopyButtonsToCodeBlocks, setupTextareaAutosize } from './ui';
import { renderMermaidThumbnailWithTheme } from './mermaid-theme-integration.js';
import { mermaidManager } from './mermaidManager.js';
import { 
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION
} from './prompts';
import { SELECTION_SENSEI_CONFIG } from './model_usage';

// Declare hljs for TypeScript if it's loaded globally from a CDN
declare var hljs: any;


const TOOLBAR_ACTIONS = [
    { label: 'Simpler', actionType: 'explainSimpler' },
    { label: 'Analogy', actionType: 'explainWithAnalogy' },
    { label: 'Depth', actionType: 'explainInMoreDepth' },
    { label: 'Example', actionType: 'showAnExample' },
    { label: 'Code', actionType: 'showExampleCodeSnippet' },
    { label: 'Ask', actionType: 'askQuestion' }, // Add this line
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

    private isAskModeActive = false; // Add this line
    private askInputContainer: HTMLDivElement | null = null; // Add this property
    private isDragging = false;
    private offsetX = 0;
    private offsetY = 0;

    constructor(
        private ai: GoogleGenAI,
        private messageArea: HTMLDivElement,
        private streamingMessagesRawText: Map<string, string>
    ) {
        // Bind methods to ensure 'this' context is correct in event handlers
        this.handleTextSelection = this.handleTextSelection.bind(this);
        this.handleSelectionChange = this.handleSelectionChange.bind(this);
        this.hideResponseModal = this.hideResponseModal.bind(this);
        this.handleDragMove = this.handleDragMove.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
    }

    public initialize(): void {
        this.getDOMElements();
        this.attachEventListeners();
    }

    private getDOMElements(): void {
        this.responseModal = document.getElementById('response-modal') as HTMLDivElement;
        this.responseModalHeader = document.getElementById('response-modal-header') as HTMLElement;
        this.responseModalTitleElement = document.getElementById('response-modal-title') as HTMLElement;
        this.responseModalContentArea = document.getElementById('response-modal-content-area') as HTMLDivElement;
        this.responseModalTextContent = document.getElementById('response-modal-text-content') as HTMLDivElement;
        this.responseModalSpinner = document.getElementById('response-modal-spinner') as HTMLDivElement;
        this.responseModalCloseButton = document.getElementById('response-modal-close-button') as HTMLButtonElement;
        
        if (!this.responseModal || !this.responseModalTextContent) {
            logger.error("Selection Sensei: Failed to initialize required modal elements");
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
            this.responseModalHeader.addEventListener('mousedown', this.handleDragStart.bind(this));
        }
        // Use global listeners for move and up to handle dragging outside the modal
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
    }

    private handleTextSelection(event: MouseEvent | TouchEvent): void {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const selectedText = selection.toString().trim();
            if (selectedText.length > 0) {
                const range = selection.getRangeAt(0);
                let parentElement = range.commonAncestorContainer;
                if (parentElement.nodeType === Node.TEXT_NODE) {
                    parentElement = parentElement.parentElement;
                }

                const senseiMessageTextElement = (parentElement as HTMLElement)?.closest('.message-bubble[data-sender="sensei"] .message-text');
                if (senseiMessageTextElement) {
                    const messageBubbleElement = senseiMessageTextElement.closest('.message-bubble[data-sender="sensei"]');
                    let originalSenseiMessageText = senseiMessageTextElement.textContent || ""; 

                    if (messageBubbleElement && messageBubbleElement.id) {
                        originalSenseiMessageText = this.streamingMessagesRawText.get(messageBubbleElement.id) || originalSenseiMessageText;
                    }
                    this.createAndShowSelectionToolbar(selection, originalSenseiMessageText);
                    return; 
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
            button.addEventListener('click', () => {
                if (action.actionType === 'askQuestion') {
                    this.activateAskMode(selectedText, originalSenseiMessageText, action.label);
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
        
        this.selectionToolbarElement.style.top = `${window.scrollY + rect.top - this.selectionToolbarElement.offsetHeight - 8}px`; 
        this.selectionToolbarElement.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (this.selectionToolbarElement.offsetWidth / 2)}px`;

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

        sendButton.addEventListener('click', () => {
            const userQuestion = textInput.value.trim();
            if (userQuestion) {
                this.handleToolbarAction(selectedText, 'askQuestion', originalSenseiMessageText, actionLabel, userQuestion);
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

    private showResponseModalWithLoading(): void {
        if (!this.responseModal || !this.responseModalTitleElement || !this.responseModalTextContent || !this.responseModalSpinner) {
            logger.error("Selection Sensei: Cannot show modal - required elements missing");
            return;
        }

        this.responseModalTitleElement.textContent = "Sensei is preparing an explanation..."; 
        this.responseModalTextContent.innerHTML = ''; 
        this.responseModalSpinner.style.display = 'block'; 

        this.responseModal.style.left = '50%';
        this.responseModal.style.top = '50%';
        this.responseModal.style.transform = 'translate(-50%, -50%)';
        this.responseModal.style.display = 'flex'; 

    }

    private async updateResponseModalContentAndTitle(title: string, htmlContent: string): Promise<void> {
        if (!this.responseModalTextContent || !this.responseModalSpinner || !this.responseModalTitleElement) {
            logger.error("Selection Sensei: Cannot update content - required elements missing");
            return;
        }


        const sanitizedContent = sanitizeCodeFences(htmlContent);
        this.responseModalTitleElement.textContent = title;
        this.responseModalSpinner.style.display = 'none'; 
        
        this.responseModalTextContent.innerHTML = marked.parse(sanitizedContent) as string;
        
        this.responseModalTextContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block as HTMLElement);
        });
        
        addLanguageDisplayToCodeBlocks(this.responseModalTextContent);
        addCopyButtonsToCodeBlocks(this.responseModalTextContent);
        
        await this.processMermaidDiagrams(this.responseModalTextContent);
    }

    private hideResponseModal(): void {
        if (this.responseModal) {
            this.responseModal.style.display = 'none';
        }
        this.hideSelectionToolbar(); 
    }

    private async processMermaidDiagrams(container: HTMLElement): Promise<void> {
        const mermaidBlocks = container.querySelectorAll('pre code.language-mermaid');
        
        for (const block of mermaidBlocks) {
            const preElement = block.parentElement as HTMLElement;
            const rawMermaidCode = block.textContent || '';
            
            try {
                const uniqueId = `selection-mermaid-${Date.now()}-${Math.random().toString(36).substring(2)}`;
                const { svg } = await mermaidManager.render(uniqueId, rawMermaidCode);
                renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), rawMermaidCode);
            } catch (error: any) {
                logger.error("Selection Sensei: Mermaid rendering failed:", error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'mermaid-error';
                errorDiv.innerHTML = `
                    [Diagram could not be rendered]<br>
                    <pre><code>${rawMermaidCode}</code></pre>
                `;
                preElement.replaceWith(errorDiv);
            }
        }
    }

    private async handleToolbarAction(selectedText: string, actionType: string, originalSenseiMessageText: string, actionLabel: string, userQuestion?: string): Promise<void> {
        this.showResponseModalWithLoading();
        this.hideSelectionToolbar(); 

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
                case 'showExampleCodeSnippet': instructionText = "Provide a relevant C++ code snippet that demonstrates the concept discussed in the 'SELECTED TEXT'. Explain the code snippet in detail, making connections to the context."; break;
                default: await this.updateResponseModalContentAndTitle("Error", "Unknown action type."); return;
            }
            userPrompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(originalSenseiMessageText, selectedText, instructionText, actionLabel);
        }

        try {
            const response: GenerateContentResponse = await this.ai.models.generateContent({
                model: SELECTION_SENSEI_CONFIG.modelName, 
                contents: [{ parts: [{ text: userPrompt }] }],
                config: {
                     ...SELECTION_SENSEI_CONFIG.config, 
                     systemInstruction: SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
                }
            });
            
            let jsonText = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonText.match(fenceRegex);
            if (match && match[2]) jsonText = match[2].trim();

            const parsedResponse = JSON.parse(jsonText);
            if (parsedResponse.suggestedTitle && parsedResponse.explanation) {
                await this.updateResponseModalContentAndTitle(parsedResponse.suggestedTitle, parsedResponse.explanation);
            } else {
                await this.updateResponseModalContentAndTitle("Sensei Explains...", "Sorry, I had trouble formatting my thoughts.");
            }
        } catch (error) {
            logger.error("Error calling Gemini for selected text action:", error);
            await this.updateResponseModalContentAndTitle("Error", "Sorry, I encountered an error. Please try again.");
        }
    }

    private handleDragStart(e: MouseEvent): void {
        if (!this.responseModal || (e.target as HTMLElement).closest('#response-modal-close-button')) return;
        
        this.isDragging = true;
        const modalRect = this.responseModal.getBoundingClientRect();
        
        // Convert from centered transform to absolute positioning (like main window)
        if (this.responseModal.style.transform.includes('translate')) {
            this.responseModal.style.transform = 'none';
            this.responseModal.style.left = modalRect.left + 'px';
            this.responseModal.style.top = modalRect.top + 'px';
        }
        
        // Simple offset calculation from absolute position
        this.offsetX = e.clientX - modalRect.left;
        this.offsetY = e.clientY - modalRect.top;
        
        this.responseModal.style.userSelect = 'none';
    }

    private handleDragMove(e: MouseEvent): void {
        if (!this.isDragging || !this.responseModal) return;
        let newX = e.clientX - this.offsetX;
        let newY = e.clientY - this.offsetY;

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
}

export function initializeSelectionSensei(
    ai: GoogleGenAI,
    messageArea: HTMLDivElement,
    streamingMessagesRawText: Map<string, string>
): void {
    const selectionSenseiInstance = new SelectionSensei(ai, messageArea, streamingMessagesRawText);
    selectionSenseiInstance.initialize();
}

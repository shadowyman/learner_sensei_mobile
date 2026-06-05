/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { sendToNative } from './mobile/webviewBridge';
import type { SelectionSenseiModalMessagePayload, SelectionSenseiModalMessageResult, SelectionSenseiToolbarActionType } from './mobile/bridge/contracts';
import { requestSelectionSenseiModalMessageViaBridge } from './mobile/webviewMessageRouter';
import { requestSelectionSenseiModalMessage } from './selectionSenseiRouting';
import { GoogleGenAI, Chat } from "@google/genai";
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

const globalMarkedConfig = globalThis as typeof globalThis & { __markedKatexConfigured?: boolean };
if (!globalMarkedConfig.__markedKatexConfigured) {
    marked.use(markedKatex({ throwOnError: false, output: 'mathml', nonStandard: true }));
    globalMarkedConfig.__markedKatexConfigured = true;
}
import {
    sanitizeMarkdownFences,
    parseSanitizedMarkdown,
    addLanguageDisplayToCodeBlocks,
    addCopyButtonsToCodeBlocks,
    setupTextareaAutosize,
    displayMessage,
    createMessageRegistry,
    MessageRegistry,
    Message,
} from './ui';
import { parseSelectionSenseiResponsePayload } from './selectionSenseiResponseParser';
import { 
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION,
    getSelectionSenseiToolbarActionInstruction
} from './prompts';
import { SELECTION_SENSEI_CONFIG } from './model_usage';
import { notepad } from './notepad';

const RESPONSE_MODAL_SENSEI_MESSAGE_ID = 'response-modal-sensei-bubble';

type ContentStrategy = 'parsed-full' | 'explanation-only' | 'raw-fallback' | 'error';
type ModalInitialContext = {
    selectedText: string;
    originalSenseiMessageText: string;
    initialActionType: SelectionSenseiToolbarActionType;
    initialActionLabel: string;
    initialResponse: {
        suggestedTitle?: string;
        explanation?: string;
        rawText?: string;
    };
};

type ModalBoxMetrics = {
    top: string;
    left: string;
    right: string;
    bottom: string;
    width: string;
    height: string;
    transform: string;
    resize: string;
};

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

const BRIDGE_ACTION_LABELS: Record<string, string> = {
    explainSimpler: 'Simpler',
    explainWithAnalogy: 'Analogy',
    explainInMoreDepth: 'Depth',
    showAnExample: 'Example',
    showExampleCodeSnippet: 'Code',
    askQuestion: 'Ask',
    addToNotepad: 'Add to Notepad'
};

interface BridgeInvokeExtras {
    actionLabel?: string;
    userQuestion?: string;
}

class SelectionSensei {
    private selectionToolbarElement: HTMLDivElement | null = null;
    private responseModal: HTMLDivElement | null = null;
    private responseModalHeader: HTMLElement | null = null; 
    private responseModalTitleElement: HTMLElement | null = null;
    private responseModalContentArea: HTMLDivElement | null = null;
    private responseModalTextContent: HTMLDivElement | null = null;
    private responseModalSpinner: HTMLDivElement | null = null;
    private responseModalCloseButton: HTMLButtonElement | null = null;
    private responseModalFullscreenButton: HTMLButtonElement | null = null;
    private responseModalMinimizeButton: HTMLButtonElement | null = null;
    private responseModalDragZone: HTMLDivElement | null = null;
    private responseModalTranscript: HTMLDivElement | null = null;
    private responseModalComposer: HTMLDivElement | null = null;
    private responseModalComposerInput: HTMLTextAreaElement | null = null;
    private responseModalSendButton: HTMLButtonElement | null = null;
    private overlayContainer: HTMLDivElement | null = null;
    private overlayButton: HTMLButtonElement | null = null;
    private modalMessageRegistry: MessageRegistry = createMessageRegistry();
    private followupInFlight = false;
    private modalMessageCounter = 0;
    private modalConversationToken = 0;
    private modalConversationId: string | null = null;
    private modalInitialContext: ModalInitialContext | null = null;
    private modalTranscriptContext: Array<{ role: 'user' | 'sensei'; text: string }> = [];
    private pendingToolbarRequestKey: string | null = null;
    private selectionChat: Chat | null = null;
    private isModalFullscreen = false;
    private modalFullscreenRestore: ModalBoxMetrics | null = null;
    private isModalMinimized = false;
    private modalMinimizeRestore: ModalBoxMetrics | null = null;
    private isMinimizeAnimationInFlight = false;
    private isRestoreAnimationInFlight = false;

    private isAskModeActive = false;
    private askInputContainer: HTMLDivElement | null = null;
    private isDragging = false;
    private offsetX = 0;
    private offsetY = 0;
    private boundOutsidePointerHandler: (event: PointerEvent) => void;
    private lastSelectionSnapshot: { text: string; context: string; html: string } | null = null;
    private nativeSelectionActive = false;

    private notifyNativeSelectionActive(active: boolean): void {
        if (!this.isNativeBridgeActive()) {
            return;
        }
        if (this.nativeSelectionActive === active) {
            return;
        }
        this.nativeSelectionActive = active;
        try {
            window.dispatchEvent(new CustomEvent('sensei-mobile-selection-active-change', { detail: { active } }));
        } catch {
            return;
        }
    }

    private captureSelectionHtml(selection: Selection): string {
        try {
            if (typeof document === 'undefined') {
                return '';
            }
            if (selection.rangeCount === 0) {
                return '';
            }
            const range = selection.getRangeAt(0);
            const fragment = range.cloneContents();
            const div = document.createElement('div');
            div.appendChild(fragment);
            return div.innerHTML;
        } catch (error) {
            logger.warn('[MOBILE_PORT_SELECTION] html capture failed', { error: error instanceof Error ? error.message : String(error) });
            return '';
        }
    }

    private async copySelectionText(text: string): Promise<void> {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                logger.info('[MOBILE_PORT_SELECTION] copy success');
                return;
            }
        } catch (error) {
            logger.warn('[MOBILE_PORT_SELECTION] copy failed via clipboard API', { error: (error as Error).message });
        }
        if (typeof document === 'undefined') {
            return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            logger.info('[MOBILE_PORT_SELECTION] copy success', { fallback: true });
        } catch (error) {
            logger.error('[MOBILE_PORT_SELECTION] copy fallback failed', { error: (error as Error).message });
        } finally {
            document.body.removeChild(textarea);
        }
    }

    private async shareSelectionText(text: string): Promise<void> {
        try {
            if (navigator?.share) {
                await navigator.share({ text, title: 'Recursive Sensei Selection' });
                logger.info('[MOBILE_PORT_SELECTION] share success');
                return;
            }
        } catch (error) {
            logger.warn('[MOBILE_PORT_SELECTION] share via navigator failed', { error: (error as Error).message });
        }
        await this.copySelectionText(text);
    }

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
        this.toggleModalFullscreen = this.toggleModalFullscreen.bind(this);
        this.minimizeModal = this.minimizeModal.bind(this);
        this.restoreFromOverlay = this.restoreFromOverlay.bind(this);
    }

    public initialize(): void {
        this.getDOMElements();
        this.attachEventListeners();
        this.initializeModalComposer();
        this.resetModalState();
        this.ensureOverlayMounted();
        this.updateMinimizeButtonState(false);
        this.setOverlayVisibility(false);
        this.updateOverlayAria(true);
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
        if (this.responseModalFullscreenButton) {
            this.responseModalFullscreenButton.removeEventListener('click', this.toggleModalFullscreen);
        }
        if (this.responseModalMinimizeButton) {
            this.responseModalMinimizeButton.removeEventListener('click', this.minimizeModal);
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
        this.setModalFullscreen(false);
        this.hideSelectionToolbar();

        // Clear references
        this.responseModal = null;
        this.responseModalHeader = null;
        this.responseModalTitleElement = null;
        this.responseModalContentArea = null;
        this.responseModalTextContent = null;
        this.responseModalSpinner = null;
        this.responseModalCloseButton = null;
        this.responseModalFullscreenButton = null;
        this.responseModalMinimizeButton = null;
        this.responseModalDragZone = null;
        this.responseModalTranscript = null;
        this.responseModalComposer = null;
        this.responseModalComposerInput = null;
        this.responseModalSendButton = null;
        this.modalFullscreenRestore = null;
        this.isModalFullscreen = false;
        this.modalMinimizeRestore = null;
        this.isModalMinimized = false;
        if (this.overlayButton) {
            this.overlayButton.removeEventListener('click', this.restoreFromOverlay);
        }
        this.setOverlayVisibility(false);
        this.updateOverlayAria(true);
        this.overlayContainer = null;
        this.overlayButton = null;
    }

    private getDOMElements(): void {
        this.responseModal = document.getElementById('response-modal') as HTMLDivElement;
        this.responseModalHeader = document.getElementById('response-modal-header') as HTMLElement;
        this.responseModalTitleElement = document.getElementById('response-modal-title') as HTMLElement;
        this.responseModalContentArea = document.getElementById('response-modal-content-area') as HTMLDivElement;
        this.responseModalTextContent = document.getElementById('response-modal-text-content') as HTMLDivElement;
        this.responseModalSpinner = document.getElementById('response-modal-spinner') as HTMLDivElement;
        this.responseModalCloseButton = document.getElementById('response-modal-close-button') as HTMLButtonElement;
        this.responseModalFullscreenButton = document.getElementById('response-modal-fullscreen-button') as HTMLButtonElement;
        this.responseModalMinimizeButton = document.getElementById('response-modal-minimize-button') as HTMLButtonElement;
        this.responseModalDragZone = document.getElementById('response-modal-drag-zone') as HTMLDivElement;
        this.responseModalTranscript = document.getElementById('selection-sensei-transcript') as HTMLDivElement;
        this.responseModalComposer = document.getElementById('selection-sensei-composer') as HTMLDivElement;
        this.responseModalComposerInput = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement;
        this.responseModalSendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement;

        if (this.responseModalHeader && !this.responseModalHeader.hasAttribute('tabindex')) {
            this.responseModalHeader.setAttribute('tabindex', '-1');
        }

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
            if (this.responseModalFullscreenButton) {
                this.responseModalFullscreenButton.removeEventListener('click', this.toggleModalFullscreen);
                this.responseModalFullscreenButton.addEventListener('click', this.toggleModalFullscreen);
            }
            if (this.responseModalMinimizeButton) {
                this.responseModalMinimizeButton.removeEventListener('click', this.minimizeModal);
                this.responseModalMinimizeButton.addEventListener('click', this.minimizeModal);
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

            this.ensureOverlayMounted();
        }
    }

    private attachEventListeners(): void {
        this.messageArea.addEventListener('mouseup', this.handleTextSelection);
        this.messageArea.addEventListener('touchend', this.handleTextSelection); 
        document.addEventListener('selectionchange', this.handleSelectionChange);

        if (this.responseModalCloseButton) {
            this.responseModalCloseButton.addEventListener('click', this.hideResponseModal);
        }
        if (this.responseModalFullscreenButton) {
            this.responseModalFullscreenButton.addEventListener('click', this.toggleModalFullscreen);
        }
        if (this.responseModalMinimizeButton) {
            this.responseModalMinimizeButton.addEventListener('click', this.minimizeModal);
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

    private toggleModalFullscreen(): void {
        this.ensureDOMElementsValid();
        this.setModalFullscreen(!this.isModalFullscreen);
    }

    private setModalFullscreen(fullscreen: boolean): void {
        if (!this.responseModal) {
            this.isModalFullscreen = false;
            this.modalFullscreenRestore = null;
            if (this.responseModalFullscreenButton) {
                this.responseModalFullscreenButton.setAttribute('aria-pressed', 'false');
                this.responseModalFullscreenButton.setAttribute('aria-label', 'Enter fullscreen');
                this.responseModalFullscreenButton.setAttribute('title', 'Enter fullscreen');
            }
            return;
        }

        if (fullscreen) {
            if (!this.isModalFullscreen) {
                this.modalFullscreenRestore = this.captureModalBoxMetrics();
                this.responseModal.dataset.fullscreen = 'true';
                this.responseModal.style.top = '';
                this.responseModal.style.left = '';
                this.responseModal.style.right = '';
                this.responseModal.style.bottom = '';
                this.responseModal.style.width = '';
                this.responseModal.style.height = '';
                this.responseModal.style.transform = '';
                this.responseModal.style.resize = '';
                this.isDragging = false;
            }
            if (this.responseModalFullscreenButton) {
                this.responseModalFullscreenButton.setAttribute('aria-pressed', 'true');
                this.responseModalFullscreenButton.setAttribute('aria-label', 'Exit fullscreen');
                this.responseModalFullscreenButton.setAttribute('title', 'Exit fullscreen');
            }
        } else {
            if (this.isModalFullscreen) {
                if (this.responseModal.dataset.fullscreen) {
                    delete this.responseModal.dataset.fullscreen;
                }
                this.applyModalBoxMetrics(this.modalFullscreenRestore);
                this.modalFullscreenRestore = null;
            }
            if (this.responseModalFullscreenButton) {
                this.responseModalFullscreenButton.setAttribute('aria-pressed', 'false');
                this.responseModalFullscreenButton.setAttribute('aria-label', 'Enter fullscreen');
                this.responseModalFullscreenButton.setAttribute('title', 'Enter fullscreen');
            }
        }

        this.isModalFullscreen = fullscreen;
    }

    private captureModalBoxMetrics(): ModalBoxMetrics | null {
        if (!this.responseModal) {
            return null;
        }
        return {
            top: this.responseModal.style.top,
            left: this.responseModal.style.left,
            right: this.responseModal.style.right,
            bottom: this.responseModal.style.bottom,
            width: this.responseModal.style.width,
            height: this.responseModal.style.height,
            transform: this.responseModal.style.transform,
            resize: this.responseModal.style.resize,
        };
    }

    private applyModalBoxMetrics(metrics: ModalBoxMetrics | null): void {
        if (!this.responseModal) {
            return;
        }
        if (metrics) {
            this.responseModal.style.top = metrics.top;
            this.responseModal.style.left = metrics.left;
            this.responseModal.style.right = metrics.right;
            this.responseModal.style.bottom = metrics.bottom;
            this.responseModal.style.width = metrics.width;
            this.responseModal.style.height = metrics.height;
            this.responseModal.style.transform = metrics.transform;
            this.responseModal.style.resize = metrics.resize;
        } else {
            this.responseModal.style.top = '';
            this.responseModal.style.left = '';
            this.responseModal.style.right = '';
            this.responseModal.style.bottom = '';
            this.responseModal.style.width = '';
            this.responseModal.style.height = '';
            this.responseModal.style.transform = '';
            this.responseModal.style.resize = '';
        }
    }

    private async minimizeModal(): Promise<void> {
        this.ensureDOMElementsValid();
        if (!this.responseModal || this.responseModal.style.display === 'none' || this.isModalMinimized || this.isMinimizeAnimationInFlight) {
            return;
        }
        this.isMinimizeAnimationInFlight = true;
        try {
            this.setModalFullscreen(false);
            this.ensureOverlayMounted();
            if (!this.overlayContainer || !this.overlayButton) {
                logger.error('[SENSEI_SELECTION] Cannot minimize modal - overlay elements missing');
                return;
            }

            const targetRect = this.measureOverlayButtonRect();
            this.modalMinimizeRestore = this.captureModalBoxMetrics();

            const animation = this.playMinimizeAnimation(targetRect || null);
            if (animation) {
                try {
                    await animation;
                } catch {
                    // ignore animation cancellation errors
                }
            }

            this.responseModal.style.display = 'none';
            this.isModalMinimized = true;
            this.setOverlayVisibility(true);
            this.updateOverlayAria(false);
            this.updateMinimizeButtonState(true);
            this.overlayButton.focus();
            logSelectionSenseiValidation('modal-minimized', {
                conversationToken: this.modalConversationToken,
            });
        } finally {
            this.isMinimizeAnimationInFlight = false;
        }
    }

    private async restoreFromOverlay(): Promise<void> {
        this.ensureDOMElementsValid();
        if (!this.responseModal || !this.isModalMinimized || this.isRestoreAnimationInFlight) {
            return;
        }
        this.isRestoreAnimationInFlight = true;
        try {
            logSelectionSenseiValidation('overlay-clicked', {
                conversationToken: this.modalConversationToken,
            });
            const overlayRect = this.measureOverlayButtonRect();
            this.setOverlayVisibility(false);
            this.updateOverlayAria(true);
            this.applyModalBoxMetrics(this.modalMinimizeRestore);
            this.responseModal.style.visibility = 'hidden';
            this.responseModal.style.display = 'flex';

            const animation = this.playRestoreAnimation(overlayRect || null);
            if (animation) {
                try {
                    await animation;
                } catch {
                    // ignore animation cancellation errors
                }
            }

            this.responseModal.style.visibility = '';
            this.modalMinimizeRestore = null;
            this.isModalMinimized = false;
            this.updateMinimizeButtonState(false);
            this.focusModalHeader();
            this.scrollModalTranscriptToLatest();
            logSelectionSenseiValidation('modal-restored', {
                conversationToken: this.modalConversationToken,
            });
        } finally {
            this.isRestoreAnimationInFlight = false;
        }
    }

    private ensureOverlayMounted(): void {
        if (!this.messageArea) {
            return;
        }
        if (!this.overlayContainer || !this.overlayContainer.isConnected) {
            let container = document.getElementById('selection-sensei-overlay') as HTMLDivElement | null;
            if (!container && this.messageArea) {
                container = document.createElement('div');
                container.id = 'selection-sensei-overlay';
                container.setAttribute('aria-hidden', 'true');
                const button = document.createElement('button');
                button.id = 'selection-sensei-overlay-button';
                container.appendChild(button);
                this.messageArea.insertBefore(container, this.messageArea.firstChild);
            }
            this.overlayContainer = container;
        }

        if (!this.overlayButton || !this.overlayButton.isConnected) {
            let button = document.getElementById('selection-sensei-overlay-button') as HTMLButtonElement | null;
            if (!button && this.overlayContainer) {
                button = this.overlayContainer.querySelector('#selection-sensei-overlay-button') as HTMLButtonElement | null;
            }
            if (!button && this.overlayContainer) {
                button = document.createElement('button');
                button.id = 'selection-sensei-overlay-button';
                this.overlayContainer.appendChild(button);
            }
            this.overlayButton = button;
        }

        if (this.overlayButton) {
            this.overlayButton.type = 'button';
            this.overlayButton.textContent = '🧠';
            this.overlayButton.setAttribute('aria-label', 'Open Selection Sensei');
            this.overlayButton.setAttribute('title', 'Open Selection Sensei');
            this.overlayButton.setAttribute('aria-controls', 'response-modal');
            this.overlayButton.setAttribute('aria-expanded', this.isModalMinimized ? 'false' : 'true');
            this.overlayButton.removeEventListener('click', this.restoreFromOverlay);
            this.overlayButton.addEventListener('click', this.restoreFromOverlay);
        }
        this.setOverlayVisibility(this.isModalMinimized);
    }

    private setOverlayVisibility(visible: boolean): void {
        if (!this.overlayContainer) {
            return;
        }
        this.overlayContainer.style.display = visible ? 'block' : 'none';
        this.overlayContainer.style.visibility = visible ? 'visible' : 'hidden';
        this.overlayContainer.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    private updateOverlayAria(expanded: boolean): void {
        if (this.overlayButton) {
            this.overlayButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    private updateMinimizeButtonState(minimized: boolean): void {
        if (!this.responseModalMinimizeButton) {
            return;
        }
        this.responseModalMinimizeButton.setAttribute('aria-pressed', minimized ? 'true' : 'false');
        this.responseModalMinimizeButton.setAttribute('aria-label', minimized ? 'Restore Selection Sensei' : 'Minimize Selection Sensei');
        this.responseModalMinimizeButton.setAttribute('title', minimized ? 'Restore Selection Sensei' : 'Minimize Selection Sensei');
    }

    private focusModalHeader(): void {
        if (!this.responseModalHeader) {
            return;
        }
        this.responseModalHeader.focus();
    }

    private clearMinimizeState(): void {
        this.isModalMinimized = false;
        this.modalMinimizeRestore = null;
        this.setOverlayVisibility(false);
        this.updateOverlayAria(true);
        this.updateMinimizeButtonState(false);
    }

    private expandModalWidth(): void {
        if (!this.responseModal || this.isModalFullscreen) {
            return;
        }
        const currentWidth = this.responseModal.getBoundingClientRect().width || this.responseModal.offsetWidth;
        if (!currentWidth) {
            return;
        }
        const growthFactor = 1.2;
        const viewportLimit = window.innerWidth * 0.9;
        const minWidth = 320;
        const desiredWidth = currentWidth * growthFactor;
        const finalWidth = Math.max(Math.min(desiredWidth, viewportLimit), minWidth);
        this.responseModal.style.width = `${finalWidth}px`;
    }

    private tryShowToolbarForActiveSelection(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            return false;
        }
        const selectedText = selection.toString().trim();
        if (selectedText.length === 0) {
            return false;
        }
        const range = selection.getRangeAt(0);
        let parentElement: Node | null = range.commonAncestorContainer;
        if (parentElement.nodeType === Node.TEXT_NODE) {
            parentElement = parentElement.parentElement ?? parentElement;
        }

        const senseiMessageTextElement = parentElement instanceof HTMLElement
            ? parentElement.closest('.message-bubble[data-sender="sensei"] .message-text')
            : null;
        if (senseiMessageTextElement) {
            const originalSenseiMessageText = senseiMessageTextElement.textContent || '';
            const isNativeBridgeActive = this.isNativeBridgeActive();
            this.lastSelectionSnapshot = {
                text: selectedText,
                context: originalSenseiMessageText,
                html: this.captureSelectionHtml(selection),
            };
            if (isNativeBridgeActive) {
                this.sendSelectionToNative(selection, selectedText);
                return true;
            }
            this.createAndShowSelectionToolbar(selection, originalSenseiMessageText);
            return true;
        }

        const contextCarrier = parentElement instanceof HTMLElement
            ? parentElement.closest('[data-selection-sensei-context]') as HTMLElement | null
            : null;
        if (contextCarrier) {
            const contextText = contextCarrier.dataset.selectionSenseiContext;
            if (contextText && contextText.trim().length > 0) {
                const isNativeBridgeActive = this.isNativeBridgeActive();
                this.lastSelectionSnapshot = {
                    text: selectedText,
                    context: contextText,
                    html: this.captureSelectionHtml(selection),
                };
                if (isNativeBridgeActive) {
                    this.sendSelectionToNative(selection, selectedText);
                    return true;
                }
                this.createAndShowSelectionToolbar(selection, contextText);
                return true;
            }
        }
        return false;
    }

    private measureOverlayButtonRect(): DOMRect | null {
        if (!this.overlayButton) {
            return null;
        }
        const container = this.overlayContainer;
        if (!container) {
            return this.overlayButton.getBoundingClientRect();
        }
        const previousDisplay = container.style.display;
        const previousVisibility = container.style.visibility;
        if (previousDisplay === 'none') {
            container.style.display = 'block';
            container.style.visibility = 'hidden';
            const rect = this.overlayButton.getBoundingClientRect();
            container.style.display = previousDisplay;
            container.style.visibility = previousVisibility;
            return rect;
        }
        return this.overlayButton.getBoundingClientRect();
    }

    private playMinimizeAnimation(targetRect: DOMRect | null): Promise<void> | null {
        if (!this.responseModal || !this.overlayButton) {
            return null;
        }
        const modalRect = this.responseModal.getBoundingClientRect();
        const overlayRect = targetRect || this.overlayButton.getBoundingClientRect();
        if (overlayRect.width === 0 || overlayRect.height === 0) {
            return null;
        }
        const ghost = this.createAnimationGhost(modalRect);
        document.body.appendChild(ghost);
        const modalCenter = this.getRectCenter(modalRect);
        const overlayCenter = this.getRectCenter(overlayRect);
        const deltaX = overlayCenter.x - modalCenter.x;
        const deltaY = overlayCenter.y - modalCenter.y;
        const scaleX = Math.max(overlayRect.width / modalRect.width, 0.2);
        const scaleY = Math.max(overlayRect.height / modalRect.height, 0.2);
        const keyframes: Keyframe[] = [
            { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0.95 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`, opacity: 0.2 }
        ];
        return this.runGhostAnimation(ghost, keyframes, {
            duration: 320,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
    }

    private playRestoreAnimation(sourceRect: DOMRect | null): Promise<void> | null {
        if (!this.responseModal || !sourceRect) {
            return null;
        }
        const overlayRect = sourceRect;
        if (overlayRect.width === 0 || overlayRect.height === 0) {
            return null;
        }
        const modalRect = this.responseModal.getBoundingClientRect();
        const ghost = this.createAnimationGhost(modalRect);
        document.body.appendChild(ghost);
        const overlayCenter = this.getRectCenter(overlayRect);
        const modalCenter = this.getRectCenter(modalRect);
        const startDeltaX = overlayCenter.x - modalCenter.x;
        const startDeltaY = overlayCenter.y - modalCenter.y;
        const scaleX = Math.max(overlayRect.width / modalRect.width, 0.2);
        const scaleY = Math.max(overlayRect.height / modalRect.height, 0.2);
        const keyframes: Keyframe[] = [
            { transform: `translate(${startDeltaX}px, ${startDeltaY}px) scale(${scaleX}, ${scaleY})`, opacity: 0.2 },
            { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0.95 }
        ];
        return this.runGhostAnimation(ghost, keyframes, {
            duration: 320,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
    }

    private createAnimationGhost(rect: DOMRect): HTMLDivElement {
        const ghost = document.createElement('div');
        ghost.className = 'selection-sensei-minimize-ghost';
        ghost.style.top = `${rect.top}px`;
        ghost.style.left = `${rect.left}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        const borderRadius = this.responseModal ? window.getComputedStyle(this.responseModal).borderRadius : '24px';
        ghost.style.borderRadius = borderRadius;
        ghost.style.transformOrigin = 'center center';
        return ghost;
    }

    private runGhostAnimation(
        ghost: HTMLDivElement,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions
    ): Promise<void> {
        if (typeof ghost.animate !== 'function') {
            ghost.remove();
            return Promise.resolve();
        }
        const animation = ghost.animate(keyframes, options);
        return new Promise(resolve => {
            const cleanup = (): void => {
                ghost.remove();
                resolve();
            };
            animation.addEventListener('finish', cleanup, { once: true });
            animation.addEventListener('cancel', cleanup, { once: true });
        });
    }

    private getRectCenter(rect: DOMRect): { x: number; y: number } {
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    }

    private scrollModalTranscriptToLatest(): void {
        if (!this.responseModalTranscript) {
            return;
        }
        this.responseModalTranscript.scrollTop = this.responseModalTranscript.scrollHeight;
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
            logger.info('[SEL_MERMAID_DISABLE] selection chat initialized without mermaid directives');
        }
        return this.selectionChat;
    }

    private resetModalState(): void {
        this.modalConversationToken += 1;
        this.ensureDOMElementsValid();
        this.setModalFullscreen(false);
        this.clearMinimizeState();
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
        this.followupInFlight = false;
        this.modalMessageCounter = 0;
        this.modalConversationId = `selection-sensei-modal-${this.modalConversationToken}`;
        this.modalInitialContext = null;
        this.modalTranscriptContext = [];
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

    private isLlmToolbarAction(actionType: string): actionType is SelectionSenseiToolbarActionType {
        return actionType === 'explainSimpler' ||
            actionType === 'explainWithAnalogy' ||
            actionType === 'explainInMoreDepth' ||
            actionType === 'showAnExample' ||
            actionType === 'showExampleCodeSnippet' ||
            actionType === 'askQuestion';
    }

    private buildToolbarRequestKey(selectedText: string, actionType: string, originalSenseiMessageText: string, actionLabel: string, userQuestion?: string): string {
        return JSON.stringify([actionType, actionLabel, selectedText, originalSenseiMessageText, userQuestion ?? '']);
    }

    private selectionSenseiResultToRawText(result: SelectionSenseiModalMessageResult): string {
        if (result.rawText && result.rawText.trim()) {
            return result.rawText;
        }
        if (result.suggestedTitle || result.explanation) {
            return JSON.stringify({
                suggestedTitle: result.suggestedTitle,
                explanation: result.explanation
            });
        }
        return '';
    }

    private async generateLocalToolbarAction(userPrompt: string): Promise<SelectionSenseiModalMessageResult> {
        const chat = this.ensureSelectionChat();
        if (!chat) {
            throw new Error('Selection Sensei chat unavailable');
        }
        const response = await chat.sendMessage({
            message: userPrompt,
        });
        const rawText = (response.text || '').trim();
        const parsed = this.extractContentWithRegex(rawText);
        return {
            ...parsed,
            rawText
        };
    }

    private async generateLocalFollowUp(question: string): Promise<SelectionSenseiModalMessageResult> {
        const chat = this.ensureSelectionChat();
        if (!chat) {
            throw new Error('Selection Sensei chat unavailable');
        }
        const response = await chat.sendMessage({
            message: question,
        });
        const rawText = (response.text || '').trim();
        const parsed = this.extractContentWithRegex(rawText);
        return {
            ...parsed,
            rawText
        };
    }

    private buildFollowUpPayload(question: string): SelectionSenseiModalMessagePayload | null {
        if (!this.modalInitialContext) {
            return null;
        }
        return {
            mode: 'followUp',
            modalConversationId: this.modalConversationId ?? undefined,
            selectedText: this.modalInitialContext.selectedText,
            originalSenseiMessageText: this.modalInitialContext.originalSenseiMessageText,
            initialActionType: this.modalInitialContext.initialActionType,
            initialActionLabel: this.modalInitialContext.initialActionLabel,
            initialResponse: this.modalInitialContext.initialResponse,
            modalTranscript: this.modalTranscriptContext.slice(-24),
            question
        };
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
                this.normalizeMermaidCodeBlocks(messageContent);
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

        if (!this.isNativeBridgeActive() && !this.ai) {
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
            const payload = this.buildFollowUpPayload(question);
            if (!payload) {
                throw new Error('Selection Sensei modal context unavailable');
            }

            const routed = await requestSelectionSenseiModalMessage({
                isMobileWebView: this.isNativeBridgeActive(),
                payload,
                requestViaBridge: requestSelectionSenseiModalMessageViaBridge,
                generateLocal: () => this.generateLocalFollowUp(question)
            });

            const rawText = this.selectionSenseiResultToRawText(routed.result);
            const formatted = this.formatFollowupAnswer(rawText);

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

            this.modalTranscriptContext.push({ role: 'user', text: question });
            this.modalTranscriptContext.push({ role: 'sensei', text: formatted.text });

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
        if (!this.tryShowToolbarForActiveSelection()) {
            this.hideSelectionToolbar();
        }
    }

    private handleSelectionChange(): void {
        if (this.isAskModeActive) return; // Add this guard clause
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            if (this.isNativeBridgeActive()) {
                this.hideSelectionToolbar();
                return;
            }
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
            
            if (action.actionType === 'askQuestion') {
                button.className = 'ask-button';
            } else if (action.actionType === 'addToNotepad') {
                button.className = 'notepad-button';
            }
            
            button.addEventListener('click', () => {
                if (action.actionType === 'askQuestion') {
                    this.activateAskMode(selectedText, originalSenseiMessageText, action.label);
                } else if (action.actionType === 'addToNotepad') {
                    this.handleAddToNotepad(selectedText, this.lastSelectionSnapshot?.html);
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
            this.askInputContainer = null;
        }
        if (this.isNativeBridgeActive() && this.nativeSelectionActive) {
            sendToNative({ type: 'selection:clear' });
            this.notifyNativeSelectionActive(false);
            try {
                const selection = window.getSelection();
                if (selection && selection.isCollapsed) {
                    selection.removeAllRanges();
                }
            } catch {}
        }
        this.isAskModeActive = false;
    }

    private isNativeBridgeActive(): boolean {
        return Boolean((window as any)?.__SENSEI_MOBILE_BUILD__);
    }

    private sendSelectionToNative(selection: Selection, selectedText: string): void {
        this.notifyNativeSelectionActive(true);
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        sendToNative({
            type: 'selection',
            phase: 'start',
            text: selectedText,
            rect: {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollY: window.scrollY,
                devicePixelRatio: window.devicePixelRatio ?? 1
            }
        });
    }

    public handleBridgeInvoke(actionId: string, extras?: BridgeInvokeExtras): void {
        if (!this.lastSelectionSnapshot) {
            return;
        }
        logger.info('[MOBILE_PORT_SELECTION] web invoke', {
            actionId,
            fromBridge: true,
            hasQuestion: !!extras?.userQuestion
        });
        const { text, context, html } = this.lastSelectionSnapshot;
        if (actionId === 'copy') {
            void this.copySelectionText(text);
            return;
        }
        if (actionId === 'share') {
            void this.shareSelectionText(text);
            return;
        }
        if (actionId === 'addToNotepad') {
            this.handleAddToNotepad(text, html);
            return;
        }
        if (actionId === 'askQuestion') {
            if (!extras?.userQuestion) {
                logger.warn('[MOBILE_PORT_SELECTION] missing question payload', { actionId });
                return;
            }
            void this.handleToolbarAction(text, 'askQuestion', context, extras.actionLabel ?? BRIDGE_ACTION_LABELS[actionId] ?? 'Ask', extras.userQuestion);
            return;
        }
        if (BRIDGE_ACTION_LABELS[actionId]) {
            void this.handleToolbarAction(text, actionId, context, extras?.actionLabel ?? BRIDGE_ACTION_LABELS[actionId]);
        }
    }

    private activateAskMode(selectedText: string, originalSenseiMessageText: string, actionLabel: string): void {
        if (!this.selectionToolbarElement || this.askInputContainer) return;

        this.isAskModeActive = true;
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

        requestAnimationFrame(() => {
            this.selectionToolbarElement?.classList.add('ask-mode-active');
            setupTextareaAutosize(textInput);
            textInput.focus();
        });
    }
    
    private handleAddToNotepad(selectedText: string, selectionHtml?: string): void {
        logSelectionSenseiValidation('notepad-add-requested', {
            textLength: selectedText.length
        });

        let selectedHTML = selectionHtml ?? '';
        if (!selectedHTML) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                logger.error('No selection available');
            } else {
                const range = selection.getRangeAt(0);
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
            }
        }
        
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

        this.clearMinimizeState();

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
        let normalizedCount = 0;

        try {
            // Trim the content to prevent accidental code block formatting
            const trimmedContent = htmlContent.trim();
            const sanitizedContent = sanitizeMarkdownFences(trimmedContent);
            this.responseModalTitleElement.textContent = title;
            this.responseModalSpinner.style.display = 'none';

            const parsedMarkdown = parseSanitizedMarkdown(sanitizedContent);

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

            normalizedCount = this.normalizeMermaidCodeBlocks(this.responseModalTextContent);
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

        logSelectionSenseiValidation('content-postprocess', {
            highlightApplied,
            uiEnhancementsApplied,
            normalizedCount
        });
        logger.info('[SEL_MERMAID_DISABLE] modal content rendered without mermaid processing', {
            highlightApplied,
            uiEnhancementsApplied,
            normalizedCount
        });

        this.setComposerEnabled(true);
        this.expandModalWidth();
    }

    private hideResponseModal(): void {
        this.ensureDOMElementsValid();
        this.setModalFullscreen(false);

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
        this.tryShowToolbarForActiveSelection();
    }

    

    private extractContentWithRegex(text: string): { suggestedTitle?: string; explanation?: string } {
        return parseSelectionSenseiResponsePayload(text, { logger });
    }

    private normalizeMermaidCodeBlocks(container: HTMLElement): number {
        const mermaidBlocks = Array.from(container.querySelectorAll('pre code.language-mermaid'));
        mermaidBlocks.forEach((block) => {
            block.classList.remove('language-mermaid');
            if (![...block.classList].some((cls) => cls.startsWith('language-'))) {
                block.classList.add('language-plaintext');
            }
            try {
                if (hljs && typeof hljs.highlightElement === 'function') {
                    hljs.highlightElement(block as HTMLElement);
                }
            } catch (error) {
                logger.warn('[SEL_MERMAID_DISABLE] highlight failed', { message: error instanceof Error ? error.message : String(error) });
            }
        });
        logger.info('[SEL_MERMAID_DISABLE] normalized code blocks', { count: mermaidBlocks.length });
        return mermaidBlocks.length;
    }

    private async handleToolbarAction(selectedText: string, actionType: string, originalSenseiMessageText: string, actionLabel: string, userQuestion?: string): Promise<void> {
        const isMobileWebView = this.isNativeBridgeActive();
        const aiAvailable = !!this.ai;
        const modelsAvailable = this.ai ? !!this.ai.models : false;
        logSelectionSenseiValidation('toolbar-action', {
            actionType,
            selectedTextLength: selectedText?.length || 0,
            hasUserQuestion: !!userQuestion,
            aiAvailable,
            modelsAvailable
        });

        if (!this.isLlmToolbarAction(actionType)) {
            logger.warn('[SENSEI_SELECTION] unknown toolbar action', { actionType });
            return;
        }

        const pendingKey = this.buildToolbarRequestKey(selectedText, actionType, originalSenseiMessageText, actionLabel, userQuestion);
        if (isMobileWebView && this.pendingToolbarRequestKey === pendingKey) {
            logger.info('[SENSEI_SELECTION] duplicate mobile toolbar request ignored', { actionType });
            return;
        }
        if (isMobileWebView) {
            this.pendingToolbarRequestKey = pendingKey;
        }

        this.resetModalState();
        const conversationToken = this.modalConversationToken;
        const guardActive = (): boolean => conversationToken === this.modalConversationToken;

        this.showResponseModalWithLoading();
        this.setComposerEnabled(false);
        this.hideSelectionToolbar();

        if (!isMobileWebView && (!this.ai || !this.ai.models)) {
            logger.error("Selection Sensei: AI instance is not properly initialized", {
                aiExists: !!this.ai,
                modelsExists: this.ai ? !!this.ai.models : false
            });
            if (guardActive()) {
                await this.updateResponseModalContentAndTitle("Error", "AI service is not available. Please refresh the page.", conversationToken);
            }
            if (isMobileWebView && this.pendingToolbarRequestKey === pendingKey) {
                this.pendingToolbarRequestKey = null;
            }
            return;
        }

        let responseLength = 0;
        let hadFence = false;
        let parseStrategy: 'regex' | 'failed' = 'failed';
        let contentStrategy: ContentStrategy = 'error';
        let hasTitle = false;
        let hasExplanation = false;

        try {
            const payload: SelectionSenseiModalMessagePayload = actionType === 'askQuestion'
                ? {
                    mode: 'toolbarAction',
                    actionType,
                    selectedText,
                    originalSenseiMessageText,
                    actionLabel,
                    userQuestion
                }
                : {
                    mode: 'toolbarAction',
                    actionType,
                    selectedText,
                    originalSenseiMessageText,
                    actionLabel
                };

            const routed = await requestSelectionSenseiModalMessage({
                isMobileWebView,
                payload,
                requestViaBridge: requestSelectionSenseiModalMessageViaBridge,
                generateLocal: () => {
                    let userPrompt = '';
                    if (actionType === 'askQuestion' && userQuestion) {
                        userPrompt = SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(originalSenseiMessageText, selectedText, userQuestion, actionLabel);
                    } else {
                        const instructionText = getSelectionSenseiToolbarActionInstruction(actionType);
                        if (!instructionText) {
                            throw new Error('Unknown action type');
                        }
                        userPrompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(originalSenseiMessageText, selectedText, instructionText, actionLabel);
                    }
                    return this.generateLocalToolbarAction(userPrompt);
                }
            });

            if (!guardActive()) {
                return;
            }

            const rawResponseText = this.selectionSenseiResultToRawText(routed.result).trim();
            let jsonText = rawResponseText;
            responseLength = jsonText.length;
            logSelectionSenseiValidation('response-received', {
                actionType,
                length: responseLength,
                startsWithBrace: jsonText.startsWith('{'),
                endsWithBrace: jsonText.endsWith('}')
            });

            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonText.match(fenceRegex);
            if (match && match[2]) {
                jsonText = match[2].trim();
                hadFence = true;
            }

            const parsedResponse = this.extractContentWithRegex(jsonText);
            const parseSuccess = Boolean(parsedResponse.suggestedTitle || parsedResponse.explanation);
            if (parseSuccess) {
                parseStrategy = 'regex';
            }

            if (parseSuccess && parsedResponse.suggestedTitle && parsedResponse.explanation) {
                hasTitle = true;
                hasExplanation = true;
                contentStrategy = 'parsed-full';
                await this.updateResponseModalContentAndTitle(parsedResponse.suggestedTitle, parsedResponse.explanation, conversationToken);
            } else if (parseSuccess && parsedResponse.explanation) {
                hasExplanation = true;
                contentStrategy = 'explanation-only';
                await this.updateResponseModalContentAndTitle("Sensei Explains...", parsedResponse.explanation, conversationToken);
            } else if (jsonText && jsonText.length > 0) {
                contentStrategy = 'raw-fallback';
                logger.warn("[SENSEI_SELECTION] Using raw response as fallback");
                await this.updateResponseModalContentAndTitle("Sensei's Response", jsonText, conversationToken);
            } else {
                contentStrategy = 'error';
                logger.warn("[SENSEI_SELECTION] No valid content to display");
                await this.updateResponseModalContentAndTitle("Error", "Sorry, I couldn't generate a proper response. Please try again.", conversationToken);
            }

            this.modalInitialContext = {
                selectedText,
                originalSenseiMessageText,
                initialActionType: actionType,
                initialActionLabel: actionLabel,
                initialResponse: {
                    suggestedTitle: parsedResponse.suggestedTitle,
                    explanation: parsedResponse.explanation,
                    rawText: rawResponseText
                }
            };
            this.modalTranscriptContext = [];
        } catch (error) {
            contentStrategy = 'error';
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("Error routing Selection Sensei selected text action:", {
                message: errorMessage,
                actionType,
                selectedTextLength: selectedText?.length || 0,
                timestamp: new Date().toISOString()
            });

            let userMessage = "Sorry, I encountered an error. Please try again.";
            if (errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('429')) {
                userMessage = "API rate limit reached. Please wait a moment before trying again.";
            } else if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('bridge') || errorMessage.includes('native')) {
                userMessage = "Selection Sensei is unavailable in the mobile app right now. Please try again in a moment.";
            } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
                userMessage = "Failed to process the response. Please try again.";
            }

            if (guardActive()) {
                await this.updateResponseModalContentAndTitle("Error", userMessage, conversationToken);
            }
        } finally {
            if (isMobileWebView && this.pendingToolbarRequestKey === pendingKey) {
                this.pendingToolbarRequestKey = null;
            }
        }

        if (!guardActive()) {
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
        if (!this.responseModal) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.closest('#response-modal-close-button') || target.closest('#response-modal-fullscreen-button') || target.closest('#response-modal-minimize-button'))) return;
        if (this.isModalFullscreen) return;

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
        if (this.isModalFullscreen) return;
        let newX = e.clientX - this.offsetX;
        let newY = e.clientY - this.offsetY;

        const topClamp = 0;
        newY = Math.max(newY, topClamp);

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

    private handleOutsidePointerDown(): void {
        return;
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

export function invokeSelectionSenseiBridgeAction(actionId: string, extras?: BridgeInvokeExtras): void {
    currentSelectionSenseiInstance?.handleBridgeInvoke(actionId, extras);
}

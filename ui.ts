/**
 * @license
 * SPDX-License-Identifier: Apache-2 
 */

import { logger } from './logger';
import { LearnerModel } from './adaptiveEngine';
import { attemptMermaidFix, applyBacktickFix, applyUniversalQuoteFix } from './mermaidErrorRecovery.js';
import { Curriculum, CurriculumState, CurriculumItem, Phase, getLoadedCurriculum } from "./curriculum";
import { renderMermaidThumbnailWithTheme } from './mermaid-theme-integration.js';
import { mermaidManager, DEFAULT_MERMAID_THEME } from './mermaidManager.js';
import { marked } from 'marked';

// Declare hljs for TypeScript if it's loaded globally from a CDN
declare var hljs: any;

// Declare anime.js for TypeScript if it's loaded globally from a CDN
declare var anime: any;

// Declare global window.ai for Mermaid error recovery
declare global {
    interface Window {
        ai?: any; // GoogleGenAI instance
    }
}

// --- START: Reload Functionality Types ---
export type ReloadableMessageType = 'mainResponse' | 'moduleIntro';

export interface ReloadContext {
    type: ReloadableMessageType;
    dynamicSystemInstruction?: string; // For mainResponse
    userInput?: string;                // User input that triggered this Sensei response
    introSystemInstruction?: string;   // For moduleIntro
    moduleTitleForPrompt?: string;     // For moduleIntro
}
// --- END: Reload Functionality Types ---

export interface Message {
    id: string;
    sender: 'user' | 'sensei';
    displayName: string;
    text: string;
    timestamp: Date;
    isLoading?: boolean;
    isReloadable?: boolean;      // New property
    reloadContext?: ReloadContext; // New property
    skipMermaid?: boolean;       // Skip mermaid processing in displayMessage
}

/**
 * Removes leading whitespace from markdown code fences to prevent rendering issues.
 * @param text The raw markdown text from the AI.
 * @returns The sanitized text.
 */
export function sanitizeCodeFences(text: string): string {
    // This regex finds lines starting with whitespace followed by ``` and removes the whitespace.
    return text.replace(/^\s+(```)/gm, '$1');
}

export const messageArea = document.getElementById('message-area') as HTMLDivElement;
export const userInput = document.getElementById('user-input') as HTMLTextAreaElement; // Changed to HTMLTextAreaElement
export const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const curriculumStatusContainer = document.getElementById('curriculum-status-container') as HTMLDivElement; // ADD THIS
const curriculumStatusTopic = document.getElementById('curriculum-status-topic') as HTMLDivElement;
const headerTitleElement = document.getElementById('header-title') as HTMLHeadingElement; // Added for glow effect
const meditationOverlay = document.getElementById('sensei-meditation-overlay') as HTMLDivElement;
const meditationActionItems = document.getElementById('meditation-action-items') as HTMLDivElement;
const brandSegment = document.querySelector('.weighted-segment.brand') as HTMLDivElement;

const footerConfidence = document.getElementById('footer-confidence') as HTMLSpanElement;
const footerConfusion = document.getElementById('footer-confusion') as HTMLSpanElement;
const footerIntentValue = document.getElementById('footer-intent-value') as HTMLSpanElement;

// Exporting for dependency injection into selectionSensei.ts
export const streamingMessagesRawText = new Map<string, string>();
export const streamingMessageTimers = new Map<string, number>();

const FONT_SIZES = ['small', 'medium', 'large'];

const ICONS: { [key: string]: string } = {
    bug: `⚙`,
    fullscreen: `⛶`,
    font_decrease: `Aa`,
    font_increase: `Aa`,
    send: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.39L4.4 12l-2.4 7.4a1 1 0 0 0 1.4 1.4Z"/></svg>`,
    reload: `↻`,
};


export function getPhaseDisplayName(phase: Phase): string {
    switch (phase) {
        case 'IntroIllustrate': return "Teaching: Intro & Examples";
        case 'Socratic': return "Activity: Discussion & Exploration";
        case 'Solidify': return "Wrap-up: Check & Transition";
        case 'Socratic_Module': return "Module Discussion";
        case 'Solidify_Module': return "Module Wrap-up";
        default: return "Exploring...";
    }
}

export function updateCurriculumDisplay(
    curriculumItem: CurriculumItem | null,
    currentPhase: Phase | null,
    appCurriculum: Curriculum | null,
    appCurriculumState: CurriculumState | null,
    appIsCurriculumLoaded: boolean,
    learnerModel?: LearnerModel
) {
    // Make curriculum state globally accessible for meditation overlay
    (window as any).curriculumState = appCurriculumState;
    if (curriculumItem && currentPhase) {
        let topicString = "";
        if (curriculumItem.isModuleWidePhase) {
            topicString = `Module: ${curriculumItem.moduleTitle}`;
        } else if (curriculumItem.concept) {
            topicString = `${curriculumItem.moduleTitle} / ${curriculumItem.concept.title}`;
        } else {
            topicString = `Module: ${curriculumItem.moduleTitle}`;
        }
        topicString += ` / ${getPhaseDisplayName(currentPhase)}`;
        curriculumStatusTopic.textContent = topicString;

        // Sync KC progress bar with current curriculum state
        if (learnerModel && curriculumItem) {
            const currentPhaseKCId = curriculumItem.curriculumPathId;
            const currentPhaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
            // Sync KC progress bar with current curriculum state
            if (typeof (window as any).updateKCProgressBar === 'function') {
                (window as any).updateKCProgressBar(currentPhaseKCMastery);
            }
        } else {
            // Skip progress bar sync - missing required data
        }

    } else if (appCurriculum && appCurriculumState?.isCompleted) {
        curriculumStatusTopic.textContent = "Curriculum Completed! Congratulations! 🎉";
    } else if (appIsCurriculumLoaded && !appCurriculumState) {
        curriculumStatusTopic.textContent = "Ready. Please select a module to begin.";
    } else if (appIsCurriculumLoaded) {
        curriculumStatusTopic.textContent = "Curriculum loaded. Ask Sensei to begin or ask any question!";
    } else if (!appIsCurriculumLoaded && !(process.env.API_KEY)) {
         curriculumStatusTopic.textContent = "API Key not found. Please set up your API_KEY.";
    }
    else {
        curriculumStatusTopic.textContent = "Curriculum loading...";
    }

    const newText = curriculumStatusTopic.textContent;

    // Animate if text changed
    // Check against a data attribute to prevent re-animation on hot-reloads with same text
    const oldText = curriculumStatusTopic.dataset.lastText || "";
    if (newText && newText !== oldText) {
        curriculumStatusTopic.dataset.lastText = newText;
        // Add shimmer effect for 2 seconds
        const statusSegment = document.querySelector('.weighted-segment.status');
        if (statusSegment) {
            statusSegment.classList.add('curriculum-changed');
            setTimeout(() => {
                statusSegment.classList.remove('curriculum-changed');
            }, 2000);
        }
    }
}

let lastFooterState = { confidence: '', confusion: '', intent: '' };

export function updateFooter(learnerModel: LearnerModel) {
    if (!footerConfidence || !footerConfusion || !footerIntentValue) return;

    const newState = {
        confidence: learnerModel.AffectiveState.Confidence,
        confusion: learnerModel.AffectiveState.Confusion,
        intent: learnerModel.LastAnalysis?.primary_intent || 'N/A'
    };

    if (newState.confidence !== lastFooterState.confidence) {
        footerConfidence.textContent = newState.confidence;
        footerConfidence.className = `status-value confidence-${newState.confidence.toLowerCase()}`;
        lastFooterState.confidence = newState.confidence;
    }
    if (newState.confusion !== lastFooterState.confusion) {
        footerConfusion.textContent = newState.confusion;
        footerConfusion.className = `status-value confusion-${newState.confusion.toLowerCase()}`;
        lastFooterState.confusion = newState.confusion;
    }
    if (newState.intent !== lastFooterState.intent) {
        footerIntentValue.textContent = newState.intent;
        footerIntentValue.className = 'status-value intent-value';
        lastFooterState.intent = newState.intent;
    }
}

export function updateSenseiMeditationOverlay(
    curriculumState: CurriculumState | null,
    isVisible: boolean
): void {
    if (!meditationOverlay || !meditationActionItems) {
        return;
    }

    if (!isVisible) {
        hideMeditationOverlay();
        return;
    }

    if (!curriculumState || !curriculumState.teachingPlanForPhase || curriculumState.currentTeachingChunkIndex === undefined) {
        return;
    }

    const currentChunk = curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex];
    if (!currentChunk || !Array.isArray(currentChunk)) {
        return;
    }

    // Clear existing content
    meditationActionItems.innerHTML = '';

    // Determine action item states
    const coveredPoints = curriculumState.coveredPointsInCurrentChunk || new Set();
    const pointsToRevisit = curriculumState.pointsToRevisitInCurrentChunk || new Set();

    let understoodCount = 0;
    let inProgressCount = 0;

    // Create action item elements
    currentChunk.forEach((teachingPoint, index) => {
        const actionItemDiv = document.createElement('div');
        actionItemDiv.className = 'action-item';
        
        // Determine state
        if (coveredPoints.has(teachingPoint.text)) {
            understoodCount++;
            actionItemDiv.classList.add('understood');
        } else {
            // Default uncovered items to in-progress state
            inProgressCount++;
            actionItemDiv.classList.add('in-progress');
        }

        actionItemDiv.innerHTML = `
            <div class="action-item-bullet"></div>
            <div class="action-item-text">${teachingPoint.text}</div>
        `;

        meditationActionItems.appendChild(actionItemDiv);
    });

    showMeditationOverlay();
}

function showMeditationOverlay(): void {
    if (!meditationOverlay) return;

    meditationOverlay.style.display = 'block';

    // Use Anime.js for entrance animation
    if (typeof anime !== 'undefined') {
        // Container entrance
        anime({
            targets: meditationOverlay,
            translateY: ['-20px', '0px'],
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 600,
            easing: 'easeOutExpo',
            complete: () => {
                // Action items staggered reveal
                anime({
                    targets: '.meditation-overlay .action-item',
                    translateY: ['15px', '0px'],
                    opacity: [0, 1],
                    scale: [0.8, 1],
                    duration: 500,
                    delay: anime.stagger(80, {start: 200}),
                    easing: 'spring(1, 80, 10, 0)'
                });
            }
        });
    } else {
        // Fallback CSS animation
        meditationOverlay.classList.add('visible');
    }
}

function hideMeditationOverlay(): void {
    if (!meditationOverlay) return;

    if (typeof anime !== 'undefined') {
        anime({
            targets: meditationOverlay,
            translateY: [0, '-15px'],
            scale: [1, 0.95],
            opacity: [1, 0],
            duration: 400,
            easing: 'easeInQuart',
            complete: () => {
                meditationOverlay.style.display = 'none';
                meditationOverlay.classList.remove('visible');
            }
        });
    } else {
        // Fallback
        meditationOverlay.classList.remove('visible');
        setTimeout(() => {
            meditationOverlay.style.display = 'none';
        }, 400);
    }
}

function addLanguageDisplayToCodeBlocks_internal(messageTextElement: HTMLElement) {
    const preElements = messageTextElement.querySelectorAll('pre');
    preElements.forEach(preEl => {
        const codeEl = preEl.querySelector('code');
        if (codeEl) {
            let language = '';
            for (const className of codeEl.classList) {
                if (className.startsWith('language-')) {
                    language = className.substring('language-'.length).toUpperCase();
                    break;
                }
            }

            if (language) {
                const existingBadge = preEl.querySelector('.code-block-language-display');
                if (existingBadge) {
                    existingBadge.remove();
                }

                const langDisplay = document.createElement('div');
                langDisplay.className = 'code-block-language-display';
                langDisplay.textContent = language;
                preEl.insertBefore(langDisplay, codeEl);
            }
        }
    });
}

function getOrCreateButtonContainer(preEl: HTMLElement): HTMLElement {
    const existingContainer = preEl.querySelector<HTMLElement>('.code-block-button-container');
    if (existingContainer) {
        return existingContainer;
    }
    const container = document.createElement('div');
    container.className = 'code-block-button-container';
    preEl.appendChild(container);
    return container;
}

function addCopyButtonsToCodeBlocks_internal(containerElement: HTMLElement) {
    const preElements = containerElement.querySelectorAll('pre');
    preElements.forEach(preEl => {
        const buttonContainer = getOrCreateButtonContainer(preEl);

        if (buttonContainer.querySelector('.copy-code-button')) {
            return; // Button already exists
        }

        const button = document.createElement('button');
        button.textContent = 'Copy';
        button.className = 'copy-code-button';
        button.setAttribute('aria-label', 'Copy code to clipboard');

        button.addEventListener('click', async () => {
            const codeElement = preEl.querySelector('code');
            if (codeElement && codeElement.textContent) {
                try {
                    await navigator.clipboard.writeText(codeElement.textContent);
                    button.textContent = 'Copied!';
                    button.disabled = true;
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.disabled = false;
                    }, 2000);
                } catch (err) {
                    logger.error('Failed to copy code: ', err);
                    button.textContent = 'Error';
                    button.disabled = true;
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.disabled = false;
                    }, 2000);
                }
            }
        });
        buttonContainer.appendChild(button);
    });
}

export async function displayMessage(message: Message) {
    const bubble = document.getElementById(message.id) || document.createElement('div');
    const isNewBubble = !document.getElementById(message.id); // <<< ADD THIS LINE
    bubble.id = message.id;
    bubble.innerHTML = ''; // Clear previous content, including old reload buttons

    bubble.classList.add('message-bubble');
    bubble.dataset.sender = message.sender;

    const senderName = document.createElement('div');
    senderName.classList.add('sender-name');
    senderName.textContent = message.displayName;
    bubble.appendChild(senderName);

    const messageText = document.createElement('div');
    messageText.classList.add('message-text', 'markdown-content');

    bubble.dataset.animationState = "entering";

    if (message.isLoading) {
        bubble.classList.add('loading');
        const thinkingArea = document.createElement('div');
        thinkingArea.classList.add('thinking-indicator');
        // The blinking cursor will serve as the thinking indicator
        const spinner = document.createElement('span');
        spinner.classList.add('inline-spinner');
        thinkingArea.appendChild(spinner);
        const timerSpan = document.createElement('span');
        timerSpan.classList.add('inline-timer');
        const startTime = Date.now();
        timerSpan.dataset.startTime = String(startTime);
        timerSpan.textContent = '(0s)';
        thinkingArea.appendChild(timerSpan);
        messageText.appendChild(thinkingArea);

        const oldTimerId = streamingMessageTimers.get(message.id);
        if (oldTimerId) clearInterval(oldTimerId);
        const timerId = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            timerSpan.textContent = `(${elapsed}s)`;
        }, 1000);
        streamingMessageTimers.set(message.id, timerId);
        streamingMessagesRawText.set(message.id, ''); // Initialize raw text for loading message
    } else {
        bubble.removeAttribute('data-typing');
        bubble.classList.remove('loading');
        const oldTimerId = streamingMessageTimers.get(message.id);
        if (oldTimerId) {
            clearInterval(oldTimerId);
            streamingMessageTimers.delete(message.id);
        }

        const appCurriculum = getLoadedCurriculum();
        if (message.sender === 'sensei' && message.text.includes("**Available Modules:**") && appCurriculum && appCurriculum.modules) {
            const parts = message.text.split("**Available Modules:**");
            const introTextPart = parts[0] + "**Available Modules:**";
            const introHtml = marked.parse(sanitizeCodeFences(introTextPart.trim())) as string;

            const introDiv = document.createElement('div');
            introDiv.innerHTML = introHtml;
            messageText.appendChild(introDiv);

            const moduleListContainer = document.createElement('div');
            moduleListContainer.classList.add('module-list-container');

            if (parts[1]) {
                const moduleLines = parts[1].trim().split('\n');
                moduleLines.forEach(line => {
                    if (line.startsWith("*   **Module")) {
                        const match = line.match(/\*\s+\*\*Module\s+([\d._]+):\*\*\s+(.*)/);
                        if (match && match[1] && match[2]) {
                            const displayId = match[1];
                            const title = match[2].trim();
                            const moduleObject = appCurriculum.modules.find(m => {
                                const curriculumModuleIdNum = m.id.replace('Module', '').replace('_', '.');
                                return curriculumModuleIdNum === displayId || m.title === title;
                            });

                            if (moduleObject) {
                                const button = document.createElement('button');
                                button.classList.add('module-button');
                                button.textContent = `Module ${displayId}: ${title}`;
                                button.dataset.moduleId = moduleObject.id;
                                button.dataset.moduleTitle = title;
                                button.setAttribute('aria-label', `Select Module ${displayId}: ${title}`);
                                button.addEventListener('click', () => {
                                    if (typeof (window as any).handleModuleClick === 'function') {
                                        (window as any).handleModuleClick(moduleObject.id, title);
                                    }
                                });
                                moduleListContainer.appendChild(button);
                            } else {
                                const p = document.createElement('p');
                                p.innerHTML = marked.parse(sanitizeCodeFences(line)) as string;
                                moduleListContainer.appendChild(p);
                            }
                        } else {
                            const p = document.createElement('p');
                            p.innerHTML = marked.parse(sanitizeCodeFences(line)) as string;
                            moduleListContainer.appendChild(p);
                        }
                    } else if (line.trim().length > 0) {
                        const p = document.createElement('p');
                        p.innerHTML = marked.parse(sanitizeCodeFences(line)) as string;
                        moduleListContainer.appendChild(p);
                    }
                });
            }
            messageText.appendChild(moduleListContainer);
            streamingMessagesRawText.set(message.id, message.text); // Store original raw text
        } else {
            if (message.sender === 'sensei') {
                // Store raw text for potential selection action later
                 if (!streamingMessagesRawText.has(message.id) || streamingMessagesRawText.get(message.id) !== message.text) {
                    streamingMessagesRawText.set(message.id, message.text);
                }
            } else {
                streamingMessagesRawText.delete(message.id); // Not a Sensei message, or not one we'd do text actions on
            }
            const sanitizedText = sanitizeCodeFences(message.text);
            messageText.innerHTML = marked.parse(sanitizedText) as string;
        }

        messageText.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
            hljs.highlightElement(block as HTMLElement);
        });

        // Mermaid rendering logic - skip if skipMermaid is true
        if (!message.skipMermaid) {
            const mermaidBlocks = messageText.querySelectorAll('pre code.language-mermaid');
            for (const block of mermaidBlocks) {
            const preElement = block.parentElement as HTMLElement;
            const rawMermaidCodeFromLLM = block.textContent || '';
            const rawMermaidCode = rawMermaidCodeFromLLM;

            logger.log("About to render Mermaid. Raw code is:\n", rawMermaidCode);
            try {
                // The import itself ensures mermaid is available or fails loading the module.
                const { svg } = await mermaidManager.render(`mermaid-${message.id}-${Math.random().toString(36).substring(2)}`, rawMermaidCode);
                renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), rawMermaidCode);
            } catch (error: any) {
                logger.error("Mermaid rendering failed:", error);
                
                // Attempt recovery with our two-step approach
                if (!block.getAttribute('data-recovery-attempted')) {
                    block.setAttribute('data-recovery-attempted', 'true');
                    
                    // Step 1: Try universal quote fix first
                    logger.log('🔧 Step 1: Attempting universal quote fix...');
                    const quotedDiagram = applyUniversalQuoteFix(rawMermaidCode);
                    
                    // If the diagram changed, try rendering it
                    if (quotedDiagram !== rawMermaidCode) {
                        try {
                            const uniqueId = `mermaid-quoted-${message.id}-${Math.random().toString(36).substring(2)}`;
                            const { svg } = await mermaidManager.render(uniqueId, quotedDiagram);
                            
                            // Success with quote fix!
                            logger.log('✅ Mermaid diagram fixed with universal quote fix');
                            renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), quotedDiagram);
                            return; // Exit early on success
                        } catch (quotedError) {
                            logger.log('Quote fix applied but diagram still has errors, proceeding to Step 2...');
                        }
                    }
                    
                    // Step 2: If quote fix didn't work and AI is available, use LLM recovery
                    if (window.ai) {
                        // Show "attempting to fix" message
                        const fixingDiv = document.createElement('div');
                        fixingDiv.className = 'mermaid-error';
                        fixingDiv.style.color = '#f59e0b'; // Orange color for "working" state
                        fixingDiv.innerHTML = `
                            <span class="inline-spinner"></span> Step 2: Using AI to fix diagram...
                        `;
                        preElement.replaceWith(fixingDiv);
                        
                        try {
                            const fixResult = await attemptMermaidFix(
                                window.ai,
                                quotedDiagram, // Use the quoted version for LLM
                                error.message || 'Unknown error'
                            );
                            
                            if (fixResult.fixed && fixResult.diagram) {
                                // Try rendering the fixed diagram
                                try {
                                    const uniqueId = `mermaid-fixed-${message.id}-${Math.random().toString(36).substring(2)}`;
                                    const { svg } = await mermaidManager.render(uniqueId, fixResult.diagram);
                                    
                                    // Success! Show the fixed diagram
                                    logger.log('✨ Mermaid diagram successfully fixed by AI and rendered');
                                    renderMermaidThumbnailWithTheme(fixingDiv, svg, mermaidManager.getCurrentTheme(), fixResult.diagram);
                                    return; // Exit early on success
                                } catch (retryError) {
                                    logger.error('Fixed diagram still failed to render:', retryError);
                                }
                            }
                        } catch (fixError) {
                            logger.error('Error during Mermaid fix attempt:', fixError);
                        }
                        
                        // If we get here, fix attempt failed
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'mermaid-error';
                        errorDiv.innerHTML = `
                            [Sensei's diagram could not be rendered, and automatic fix failed]<br>
                            <pre><code>${rawMermaidCode}</code></pre>
                        `;
                        fixingDiv.replaceWith(errorDiv);
                    }
                } else {
                    // Original error display (no AI available or already attempted)
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.innerHTML = `
                        [Sensei's diagram could not be rendered]<br>
                        <pre><code>${rawMermaidCode}</code></pre>
                    `;
                    preElement.replaceWith(errorDiv);
                }
            }
        }
        }

        addLanguageDisplayToCodeBlocks_internal(messageText);
        addCopyButtonsToCodeBlocks_internal(messageText); // Add copy buttons
    }
    bubble.appendChild(messageText);

    if (message.sender === 'sensei' && !message.isLoading && message.isReloadable && message.reloadContext) {
        const existingReloadButton = bubble.querySelector('.reload-button');
        if (existingReloadButton) existingReloadButton.remove(); // Remove if already exists from a previous render

        const reloadButton = document.createElement('button');
        reloadButton.className = 'reload-button';
        reloadButton.innerHTML = `<span class="icon-placeholder" data-icon="reload"></span>`;
        reloadButton.setAttribute('aria-label', 'Reload this response from Sensei');
        reloadButton.title = 'Reload this response';
        reloadButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent other bubble events
            if (typeof (window as any).handleReloadSenseiMessage === 'function') {
                (window as any).handleReloadSenseiMessage(message.id, message.reloadContext);
            } else {
                logger.error('handleReloadSenseiMessage is not defined on window.');
            }
        });
        bubble.appendChild(reloadButton);
        renderIcons(reloadButton);
    }


    const timestamp = document.createElement('div');
    timestamp.classList.add('timestamp');
    timestamp.textContent = message.timestamp.toLocaleTimeString();
    bubble.appendChild(timestamp);

    if (!document.getElementById(message.id)) {
        messageArea.appendChild(bubble);
    }

    try {
        if (typeof (window as any).anime === 'undefined') throw new Error("Anime.js not loaded.");
        (window as any).anime({
            targets: bubble,
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 400,
            easing: 'easeOutQuad',
            begin: () => {
                if (isNewBubble) {
                    messageArea.scrollTop = messageArea.scrollHeight;
                }
            },
            complete: () => {
                bubble.dataset.animationState = "idle";
            }
        });
    } catch (e) {
        bubble.style.opacity = '1'; // Fallback if anime.js fails
        bubble.style.transform = 'translateY(0)'; // Fallback
        bubble.dataset.animationState = "idle"; // Fallback
        if (isNewBubble) {
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    }
}

export async function updateMessageStream(messageId: string, fullTextSoFar: string) {
    const messageBubble = document.getElementById(messageId);
    if (messageBubble) {
        const messageTextElement = messageBubble.querySelector('.message-text') as HTMLDivElement;
        if (messageTextElement) {
            if (streamingMessagesRawText.get(messageId) === '' && messageBubble.classList.contains('loading')) {
                messageTextElement.innerHTML = '';
            }
            streamingMessagesRawText.set(messageId, fullTextSoFar);

            const parts = fullTextSoFar.split(/(```[\s\S]*?```)/g);

            let processedHTML = '';
            let textToAnimate = '';

            parts.forEach(part => {
                if (part.trim().startsWith('```')) {
                    if (textToAnimate) {
                        processedHTML += marked.parse(textToAnimate) as string;
                        textToAnimate = '';
                    }
                    processedHTML += marked.parse(part) as string;
                } else {
                    textToAnimate += part;
                }
            });

            if (textToAnimate) {
                 processedHTML += marked.parse(textToAnimate) as string;
            }

            const sanitizedHtml = sanitizeCodeFences(processedHTML);
            messageTextElement.innerHTML = sanitizedHtml;

            messageTextElement.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });

            addLanguageDisplayToCodeBlocks_internal(messageTextElement);
            addCopyButtonsToCodeBlocks_internal(messageTextElement);

            if (fullTextSoFar.length > 0) {
                messageBubble.setAttribute('data-typing', 'true');
            }
        }
    }
}

export function showLoading(isLoading: boolean) {
    const brandSegment = document.querySelector('.weighted-segment.brand');
    if (isLoading) {
        if (brandSegment) brandSegment.classList.add('thinking');
        sendButton.disabled = true;
        userInput.disabled = true;
    } else {
        if (brandSegment) brandSegment.classList.remove('thinking');
        sendButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

function renderIcons(container: HTMLElement = document.body) {
    const placeholders = container.querySelectorAll<HTMLElement>('.icon-placeholder');
    placeholders.forEach(placeholder => {
        const iconName = placeholder.dataset.icon;
        if (iconName && ICONS[iconName]) {
            placeholder.innerHTML = ICONS[iconName];
        }
    });
}

function setupFontSizeControls() {
    const toggleButton = document.getElementById('font-size-toggle');
    const chatContainer = document.getElementById('chat-container');

    if (!toggleButton || !chatContainer) return;

    toggleButton.addEventListener('click', () => {
        const currentSize = chatContainer.dataset.fontSize || 'medium';
        const currentIndex = FONT_SIZES.indexOf(currentSize);
        const nextIndex = (currentIndex + 1) % FONT_SIZES.length;
        chatContainer.dataset.fontSize = FONT_SIZES[nextIndex];
    });
}

function setupMermaidThemeControls() {
    // Add theme cycling to the debug button (double-click for theme switching)
    const debugButton = document.getElementById('debug-mode-button');
    if (debugButton) {
        let clickCount = 0;
        let clickTimer: number | null = null;
        
        debugButton.addEventListener('click', (e) => {
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = window.setTimeout(() => {
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                // Double-click detected - cycle through themes
                e.preventDefault();
                e.stopPropagation();
                cycleMermaidTheme();
                
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                clickCount = 0;
            }
        });
    }
}

/**
 * Updates SVG content in a thumbnail while preserving aspect ratio classes
 */
function updateThumbnailSVG(thumbnail: HTMLElement, svgContent: string, themeName: string) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = svgDoc.querySelector('svg');
    
    if (svgElement) {
        // Preserve aspect ratio classes
        const isHorizontal = thumbnail.classList.contains('mermaid-thumbnail--horizontal');
        const isVertical = thumbnail.classList.contains('mermaid-thumbnail--vertical');
        
        // Update content
        thumbnail.innerHTML = svgElement.outerHTML;
        
        // Restore aspect ratio classes
        if (isHorizontal) thumbnail.classList.add('mermaid-thumbnail--horizontal');
        if (isVertical) thumbnail.classList.add('mermaid-thumbnail--vertical');
        
        // Update theme tracking
        thumbnail.dataset.theme = themeName;
        
        return true;
    }
    return false;
}

/**
 * Updates the mermaid theme class on an element, removing any existing theme classes first
 */
export function updateMermaidThemeClass(element: Element, themeName: string) {
    // Remove all existing theme classes
    // Note: classList doesn't have filter method, so Array.from is necessary here
    const classesToRemove: string[] = [];
    element.classList.forEach(cls => {
        if (cls.startsWith('mermaid-theme-')) {
            classesToRemove.push(cls);
        }
    });
    classesToRemove.forEach(cls => element.classList.remove(cls));
    
    // Add the new theme class
    element.classList.add(`mermaid-theme-${themeName}`);
}

/**
 * Processes mermaid blocks in a message after it has been displayed.
 * This is the second phase of the two-phase rendering approach.
 */
export async function processMermaidBlocks(messageId: string) {
    const messageBubble = document.getElementById(messageId);
    if (!messageBubble) return;
    
    const messageText = messageBubble.querySelector('.message-text');
    if (!messageText) return;
    
    const mermaidBlocks = messageText.querySelectorAll('pre code.language-mermaid');
    for (const block of mermaidBlocks) {
        const preElement = block.parentElement as HTMLElement;
        const rawMermaidCodeFromLLM = block.textContent || '';
        const rawMermaidCode = rawMermaidCodeFromLLM;

        logger.log("Processing Mermaid in phase 2. Raw code is:\n", rawMermaidCode);
        try {
            const { svg } = await mermaidManager.render(`mermaid-${messageId}-${Math.random().toString(36).substring(2)}`, rawMermaidCode);
            renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), rawMermaidCode);
        } catch (error: any) {
            logger.error("Mermaid rendering failed:", error);
            
            // Attempt recovery with our three-step approach
            if (!block.getAttribute('data-recovery-attempted')) {
                block.setAttribute('data-recovery-attempted', 'true');
                
                // Step 0: Try backtick fix first
                const backtickFixedDiagram = applyBacktickFix(rawMermaidCode);
                
                // Step 1: Try universal quote fix
                const quotedDiagram = applyUniversalQuoteFix(backtickFixedDiagram);
                
                // If the diagram changed after backtick + quote fixes, try rendering it
                if (quotedDiagram !== rawMermaidCode) {
                    try {
                        const uniqueId = `mermaid-fixed-${messageId}-${Math.random().toString(36).substring(2)}`;
                        const { svg } = await mermaidManager.render(uniqueId, quotedDiagram);
                        
                        // Success with preprocessing fixes!
                        renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), quotedDiagram);
                        continue; // Move to next block
                    } catch (quotedError) {
                        logger.log('Preprocessing fixes applied but diagram still has errors, proceeding to Step 2...');
                    }
                }
                
                // Step 2: If quote fix didn't work and AI is available, use LLM recovery
                if (window.ai) {
                    // Show "attempting to fix" message
                    const fixingDiv = document.createElement('div');
                    fixingDiv.className = 'mermaid-error';
                    fixingDiv.style.color = '#f59e0b'; // Orange color for "working" state
                    fixingDiv.innerHTML = `
                        <span class="inline-spinner"></span> Step 2: Using AI to fix diagram...
                    `;
                    preElement.replaceWith(fixingDiv);
                    
                    try {
                        const fixResult = await attemptMermaidFix(
                            window.ai,
                            quotedDiagram, // Use the quoted version for LLM
                            error.message || 'Unknown error'
                        );
                        
                        if (fixResult.fixed && fixResult.diagram) {
                            // Try rendering the fixed diagram
                            try {
                                const uniqueId = `mermaid-fixed-${messageId}-${Math.random().toString(36).substring(2)}`;
                                const { svg } = await mermaidManager.render(uniqueId, fixResult.diagram);
                                
                                // Success! Show the fixed diagram
                                logger.log('✨ Mermaid diagram successfully fixed by AI and rendered');
                                renderMermaidThumbnailWithTheme(fixingDiv, svg, mermaidManager.getCurrentTheme(), fixResult.diagram);
                                continue; // Move to next block
                            } catch (retryError) {
                                logger.error('Fixed diagram still failed to render:', retryError);
                            }
                        }
                    } catch (fixError) {
                        logger.error('Error during Mermaid fix attempt:', fixError);
                    }
                    
                    // If we get here, fix attempt failed
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.innerHTML = `
                        [Sensei's diagram could not be rendered, and automatic fix failed]<br>
                        <pre><code>${rawMermaidCode}</code></pre>
                    `;
                    fixingDiv.replaceWith(errorDiv);
                }
            } else {
                // Original error display (no AI available or already attempted)
                const errorDiv = document.createElement('div');
                errorDiv.className = 'mermaid-error';
                errorDiv.innerHTML = `
                    [Sensei's diagram could not be rendered]<br>
                    <pre><code>${rawMermaidCode}</code></pre>
                `;
                preElement.replaceWith(errorDiv);
            }
        }
    }
}

export async function cycleMermaidTheme() {
    const availableThemes = await mermaidManager.getAvailableThemes();
    const themes = Object.keys(availableThemes);
    const currentTheme = mermaidManager.getCurrentTheme();
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex];
    
    await setMermaidTheme(newTheme);
    
    // Show a brief notification
    await showThemeNotification(newTheme);
}

// Lazy mermaid diagram re-rendering observer
let mermaidObserver: IntersectionObserver | null = null;

// Keep track of observed elements for cleanup
const observedMermaidElements = new WeakSet<Element>();

function getMermaidObserver(): IntersectionObserver {
    if (!mermaidObserver) {
        mermaidObserver = new IntersectionObserver((entries) => {
            entries.forEach(async (entry) => {
                if (entry.isIntersecting) {
                    const thumbnail = entry.target as HTMLElement;
                    const currentTheme = mermaidManager.getCurrentTheme();
                    const elementTheme = thumbnail.dataset.theme;
                    const mermaidCode = thumbnail.dataset.mermaidCode;
                    
                    // Re-render if theme is outdated
                    if (mermaidCode && elementTheme !== currentTheme) {
                        try {
                            const uniqueId = `lazy-theme-${Date.now()}-${Math.random().toString(36).substring(2)}`;
                            const { svg } = await mermaidManager.render(uniqueId, mermaidCode);
                            updateThumbnailSVG(thumbnail, svg, currentTheme);
                        } catch (error) {
                            logger.error('Failed to lazy-render Mermaid diagram:', error);
                        }
                        
                        // Unobserve after successful render
                        mermaidObserver?.unobserve(thumbnail);
                        observedMermaidElements.delete(thumbnail);
                    }
                }
            });
        }, {
            rootMargin: '50px' // Start loading slightly before element comes into view
        });
    }
    return mermaidObserver;
}

// Clean up observer when elements are removed from DOM
export function cleanupMermaidObserver() {
    if (mermaidObserver) {
        mermaidObserver.disconnect();
        mermaidObserver = null;
    }
}

export async function setMermaidTheme(themeName: string) {
    // mermaidManager handles theme state and localStorage internally
    await mermaidManager.setTheme(themeName);
    
    // Re-render only visible mermaid diagrams with the new theme
    const thumbnails = document.querySelectorAll('.mermaid-thumbnail');
    const observer = getMermaidObserver();
    
    // Process theme updates for all thumbnails
    for (const thumbnail of thumbnails) {
        // Update the theme class for all elements immediately
        updateMermaidThemeClass(thumbnail, themeName);
        
        // Check if the element is visible in the viewport for re-rendering
        const rect = thumbnail.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (!isVisible) {
            // Observe non-visible elements for lazy re-rendering
            observer.observe(thumbnail);
            observedMermaidElements.add(thumbnail);
            continue;
        }
        
        const mermaidCode = (thumbnail as HTMLElement).dataset.mermaidCode;
        if (mermaidCode) {
            try {
                // Generate unique ID for the render
                const uniqueId = `theme-update-${Date.now()}-${Math.random().toString(36).substring(2)}`;
                
                // Re-render with new theme
                const { svg } = await mermaidManager.render(uniqueId, mermaidCode);
                
                // Use requestAnimationFrame for DOM update
                requestAnimationFrame(() => {
                    updateThumbnailSVG(thumbnail as HTMLElement, svg, themeName);
                });
            } catch (error) {
                logger.error('Failed to re-render Mermaid diagram with new theme:', error);
            }
        }
    }
}

async function showThemeNotification(themeName: string) {
    // Get theme display name from mermaidManager
    const themes = await mermaidManager.getAvailableThemes();
    const themeConfig = themes[themeName];
    const displayName = themeConfig?.displayName || themeName;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        border-radius: 12px;
        padding: 12px 20px;
        color: var(--accent);
        font-family: var(--font-primary);
        font-weight: 600;
        font-size: 0.9rem;
        z-index: 10000;
        box-shadow: var(--glass-shadow);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    notification.textContent = `Mermaid Theme: ${displayName}`;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Remove after 2 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

function performTextareaAutosizeLogic(textarea: HTMLTextAreaElement, maxHeight: number) {
    
    // If textarea is empty, don't measure - just use minimum height
    if (!textarea.value || textarea.value.trim() === '') {
        const computedStyle = getComputedStyle(textarea);
        const minHeight = computedStyle.minHeight;
        textarea.style.height = minHeight;
        textarea.style.overflowY = 'hidden';
        return;
    }
    
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    

    if (scrollHeight <= maxHeight) {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
    } else {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
    }
    
}

export function setupTextareaAutosize(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    

    const computedStyle = getComputedStyle(textarea);
    
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;

    let lineHeight = parseFloat(computedStyle.lineHeight);
    if (isNaN(lineHeight) || lineHeight <= 0) {
        const tempDiv = document.createElement('div');
        tempDiv.style.font = computedStyle.font;
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.position = 'absolute';
        tempDiv.textContent = 'M';
        document.body.appendChild(tempDiv);
        lineHeight = tempDiv.offsetHeight;
        document.body.removeChild(tempDiv);
        if (lineHeight <= 0) {
            lineHeight = (parseFloat(computedStyle.fontSize) || 16) * 1.4;
        }
    }

    const initialRows = 1;
    const oneLineHeight = lineHeight * initialRows + paddingTop + paddingBottom + borderTop + borderBottom;

    textarea.style.minHeight = `${oneLineHeight}px`;
    textarea.style.height = `${oneLineHeight}px`;
    

    const maxLines = 5;
    const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom + borderTop + borderBottom;

    const runDynamicAutosize = () => {
        performTextareaAutosizeLogic(textarea, maxHeight);
    };

    textarea.removeEventListener('input', runDynamicAutosize);
    textarea.removeEventListener('focus', runDynamicAutosize);

    textarea.addEventListener('input', runDynamicAutosize);
    textarea.addEventListener('focus', runDynamicAutosize);

    requestAnimationFrame(runDynamicAutosize);
}


export function initializeUI() {
    const mainUserInput = document.getElementById('user-input') as HTMLTextAreaElement;
    renderIcons();
    setupFontSizeControls();
    setupMermaidThemeControls();

    // Make mermaidManager, DEFAULT_MERMAID_THEME, and updateMermaidThemeClass available globally for mermaid-theme-integration.js
    (window as any).mermaidManager = mermaidManager;
    (window as any).DEFAULT_MERMAID_THEME = DEFAULT_MERMAID_THEME;
    (window as any).updateMermaidThemeClass = updateMermaidThemeClass;

    setupTextareaAutosize(mainUserInput);

    document.fonts.ready.then(() => {
        setupTextareaAutosize(mainUserInput);
    });

    // Setup liquid metal button mouse tracking
    setupLiquidMetalButton();

    // Setup collapsible footer hover
    setupCollapsibleFooter();
    
    // Setup progress bar expansion for curriculum status hover
    setupStatusHoverProgressExpansion();
    
    // Setup brand hover for meditation overlay
    setupBrandHoverMeditationOverlay();
}

function setupCollapsibleFooter() {
    const inputArea = document.getElementById('input-area');
    const chatContainer = document.getElementById('chat-container');
    
    if (inputArea && chatContainer) {
        inputArea.addEventListener('mouseenter', () => {
            chatContainer.classList.add('footer-expanded');
        });
        
        inputArea.addEventListener('mouseleave', () => {
            chatContainer.classList.remove('footer-expanded');
        });
        
        inputArea.addEventListener('focusin', () => {
            chatContainer.classList.add('footer-expanded');
        });
        
        inputArea.addEventListener('focusout', () => {
            chatContainer.classList.remove('footer-expanded');
        });
    }
}

function setupLiquidMetalButton() {
    if (sendButton) {
        // Reset animation on animation end
        sendButton.addEventListener('animationend', () => {
            sendButton.style.animation = 'none';
            setTimeout(() => {
                sendButton.style.animation = '';
            }, 10);
        });
    }
}

function setupStatusHoverProgressExpansion() {
    const statusSegment = document.querySelector('.weighted-segment.status') as HTMLElement;
    const progressContainer = document.getElementById('kc-progress-container') as HTMLElement;
    const chatContainer = document.getElementById('chat-container') as HTMLElement;
    
    if (!statusSegment || !progressContainer || !chatContainer) {
        logger.error("Status hover setup failed: Could not find required elements");
        return;
    }
    
    let collapseTimer: number | null = null;
    const COLLAPSE_DELAY = 150; // ms
    
    function expandProgressBar() {
        if (collapseTimer) {
            clearTimeout(collapseTimer);
            collapseTimer = null;
        }
        chatContainer.classList.add('status-hover');
    }
    
    function scheduleCollapse() {
        if (collapseTimer) {
            clearTimeout(collapseTimer);
        }
        
        collapseTimer = window.setTimeout(() => {
            chatContainer.classList.remove('status-hover');
            collapseTimer = null;
        }, COLLAPSE_DELAY);
    }
    
    // Status element hover handlers
    statusSegment.addEventListener('mouseenter', () => {
        expandProgressBar();
    });
    
    statusSegment.addEventListener('mouseleave', () => {
        scheduleCollapse();
    });
    
    // Progress container hover handlers
    progressContainer.addEventListener('mouseenter', () => {
        expandProgressBar();
    });
    
    progressContainer.addEventListener('mouseleave', () => {
        scheduleCollapse();
    });
}

export function setupFullscreenToggle(
    buttonId: string,
    containerId: string,
    fullscreenClassName: string,
    expandIcon: string = 'fullscreen',
    compressIcon: string = 'fullscreen_exit'
) {
    const buttonElement = document.getElementById(buttonId) as HTMLButtonElement;
    const containerElement = document.getElementById(containerId) as HTMLElement;

    if (!buttonElement || !containerElement) {
        logger.error(`Fullscreen toggle setup failed: Could not find button #${buttonId} or container #${containerId}.`);
        return;
    }

    const initialIconPlaceholder = buttonElement.querySelector('.icon-placeholder') as HTMLElement;
    if (initialIconPlaceholder) {
        initialIconPlaceholder.dataset.icon = expandIcon;
        renderIcons(buttonElement);
    }


    buttonElement.addEventListener('click', () => {
        containerElement.classList.toggle(fullscreenClassName);
        const isFullscreen = containerElement.classList.contains(fullscreenClassName);
        const iconPlaceholder = buttonElement.querySelector('.icon-placeholder') as HTMLElement;


        if (isFullscreen) {
            if (iconPlaceholder) iconPlaceholder.dataset.icon = compressIcon;
            buttonElement.title = 'Exit Fullscreen';
            buttonElement.setAttribute('aria-label', 'Exit Fullscreen');
        } else {
            if (iconPlaceholder) iconPlaceholder.dataset.icon = expandIcon;
            buttonElement.title = 'Enter Fullscreen';
            buttonElement.setAttribute('aria-label', 'Enter Fullscreen');
        }
        if (iconPlaceholder) renderIcons(buttonElement);
    });
}

function setupBrandHoverMeditationOverlay(): void {
    if (!brandSegment) {
        logger.error('Brand segment not found for meditation overlay setup');
        return;
    }

    let hoverTimeout: number | null = null;
    
    brandSegment.addEventListener('mouseenter', () => {
        // Clear any existing timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        
        // Get current curriculum state from global scope if available
        const curriculumState = (window as any).curriculumState || null;
        updateSenseiMeditationOverlay(curriculumState, true);
    });
    
    brandSegment.addEventListener('mouseleave', () => {
        // Add a small delay before hiding to prevent flicker
        hoverTimeout = window.setTimeout(() => {
            updateSenseiMeditationOverlay(null, false);
            hoverTimeout = null;
        }, 150);
    });
    
}

// These public functions are now only used by the new selectionSensei.ts module and debugMode.ts
// They are kept here as they are generic UI utilities.
// We rename the internal ones to avoid confusion and export a cleaner interface.
export const addLanguageDisplayToCodeBlocks = addLanguageDisplayToCodeBlocks_internal;
export const addCopyButtonsToCodeBlocks = addCopyButtonsToCodeBlocks_internal;
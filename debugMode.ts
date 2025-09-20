/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, LogEntry, LogLevel } from './logger';
import { GoogleGenAI, Chat } from "@google/genai";
import { marked } from "marked";
import { setupFullscreenToggle, sanitizeCodeFences, setupTextareaAutosize } from './ui';
import { DEBUG_MODE_CONFIG } from './model_usage';
import JSZip from 'jszip';

declare var hljs: any;

let debugModalElement: HTMLDivElement | null = null;
let debugCloseButtonElement: HTMLButtonElement | null = null;
let debugFullscreenButtonElement: HTMLButtonElement | null = null;
let debugFileSelectionAreaElement: HTMLDivElement | null = null;
let debugFileSelectionControlsElement: HTMLDivElement | null = null;
let debugFileListElement: HTMLDivElement | null = null;
let debugSelectAllCheckboxElement: HTMLInputElement | null = null;
let debugFileToggleButtonElement: HTMLButtonElement | null = null;

let debugChatInterfaceElement: HTMLDivElement | null = null;
let debugMessageAreaElement: HTMLDivElement | null = null;
let debugInputFormElement: HTMLFormElement | null = null;
let debugUserInputElement: HTMLTextAreaElement | null = null;
let debugSendButtonElement: HTMLButtonElement | null = null;
let debugExportContextButtonElement: HTMLButtonElement | null = null;
let debugDownloadFilesButtonElement: HTMLButtonElement | null = null;

let debugTabNavigationElement: HTMLDivElement | null = null;
let debugChatTabElement: HTMLButtonElement | null = null;
let debugConsoleTabElement: HTMLButtonElement | null = null;
let debugConsoleLogsAreaElement: HTMLDivElement | null = null;
let activeDebugTab: string = 'chat';

let exportLogsButtonElement: HTMLButtonElement | null = null;
let exportStatusElement: HTMLSpanElement | null = null;

let geminiAi: GoogleGenAI | null = null;
let currentDebugChat: Chat | null = null;
let debugMessageIdCounter = 0;

let availableProjectFilePaths: string[] = [];
let getManifestContentCallback: (() => string | null) | null = null;

const debugStreamingMessagesRawText = new Map<string, string>();
const debugStreamingMessageTimers = new Map<string, number>();

let debugContextFilesModified = false;

function switchDebugTab(tabName: string): void {
    if (activeDebugTab === tabName) return;
    
    const allTabs = document.querySelectorAll('.debug-tab');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    
    const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-selected', 'true');
    }
    
    const allTabContents = document.querySelectorAll('.debug-tab-content');
    allTabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    const chatInterface = document.getElementById('debug-chat-interface');
    const consoleInterface = document.getElementById('debug-console-interface');
    
    if (chatInterface && consoleInterface) {
        if (tabName === 'chat') {
            chatInterface.classList.add('active');
        } else if (tabName === 'console') {
            consoleInterface.classList.add('active');
        }
        
        activeDebugTab = tabName;
    }
}

function displayConsoleLogEntry(entry: LogEntry): void {
    if (!debugConsoleLogsAreaElement) return;
    
    const logElement = document.createElement('div');
    logElement.className = `console-log-entry console-log-${entry.level}`;
    
    const timestamp = entry.timestamp.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'console-log-timestamp';
    timestampSpan.textContent = `[${timestamp}]`;
    
    const levelSpan = document.createElement('span');
    levelSpan.className = 'console-log-level';
    levelSpan.textContent = `[${entry.level.toUpperCase()}]`;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'console-log-message';
    messageSpan.textContent = entry.message;
    
    logElement.appendChild(timestampSpan);
    logElement.appendChild(levelSpan);
    logElement.appendChild(messageSpan);
    
    // Add click-to-copy functionality
    logElement.addEventListener('click', async () => {
        try {
            // Get the full log text
            const logText = `${timestampSpan.textContent} ${levelSpan.textContent} ${messageSpan.textContent}`;
            await navigator.clipboard.writeText(logText);
            
            // Visual feedback
            const originalBg = logElement.style.backgroundColor;
            logElement.style.backgroundColor = 'rgba(196, 229, 56, 0.2)'; // Accent color flash
            setTimeout(() => {
                logElement.style.backgroundColor = originalBg;
            }, 200);
        } catch (err) {
            console.error('Failed to copy log:', err);
        }
    });
    
    debugConsoleLogsAreaElement.appendChild(logElement);
    
    // Add a subtle divider after each log entry
    const divider = document.createElement('div');
    divider.className = 'console-log-divider';
    debugConsoleLogsAreaElement.appendChild(divider);
}

function initializeConsoleLogsDisplay(): void {
    if (!debugConsoleLogsAreaElement) return;
    
    const existingLogs = logger.getLogEntries();
    existingLogs.forEach(displayConsoleLogEntry);
    
    logger.onLogUpdate((entry: LogEntry) => {
        displayConsoleLogEntry(entry);
    });
}

function addLanguageDisplayToDebugCodeBlocks(container: HTMLElement) {
    // This function is a duplicate of the one in ui.ts.
    // In a real refactor, this would be consolidated.
    const preElements = container.querySelectorAll('pre');
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
                if (existingBadge) existingBadge.remove();
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

function addCopyButtonsToDebugCodeBlocks(containerElement: HTMLElement) {
    // This function is a duplicate of the one in ui.ts.
    // In a real refactor, this would be consolidated.
    const preElements = containerElement.querySelectorAll('pre');
    preElements.forEach(preEl => {
        const buttonContainer = getOrCreateButtonContainer(preEl);

        if (buttonContainer.querySelector('.copy-code-button')) {
            return; // Button already exists
        }

        const button = document.createElement('button');
        button.textContent = 'Copy';
        button.className = 'copy-code-button'; // Uses the same class as main chat for consistent styling
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


function updateSelectAllCheckboxState() {
    if (!debugFileListElement || !debugSelectAllCheckboxElement) return;
    const pills = debugFileListElement.querySelectorAll<HTMLDivElement>('.debug-file-pill');
    if (pills.length === 0) {
        debugSelectAllCheckboxElement.checked = false;
        debugSelectAllCheckboxElement.indeterminate = false;
        return;
    }
    const selectedCount = Array.from(pills).filter(pill => pill.classList.contains('selected')).length;
    if (selectedCount === 0) {
        debugSelectAllCheckboxElement.checked = false;
        debugSelectAllCheckboxElement.indeterminate = false;
    } else if (selectedCount === pills.length) {
        debugSelectAllCheckboxElement.checked = true;
        debugSelectAllCheckboxElement.indeterminate = false;
    } else {
        debugSelectAllCheckboxElement.checked = false;
        debugSelectAllCheckboxElement.indeterminate = true;
    }
}

function populateFileList() {
    if (!debugFileListElement || !availableProjectFilePaths) return;
    debugFileListElement.innerHTML = ''; 

    const sortedFileNames = [...availableProjectFilePaths].sort();

    sortedFileNames.forEach(fileName => {
        const pill = document.createElement('div');
        pill.classList.add('debug-file-pill', 'selected'); // Default to selected
        pill.textContent = fileName;
        pill.dataset.fileName = fileName;
        pill.setAttribute('role', 'option');
        pill.setAttribute('aria-selected', 'true');
        pill.tabIndex = 0; 

        pill.addEventListener('click', () => {
            pill.classList.toggle('selected');
            pill.setAttribute('aria-selected', pill.classList.contains('selected').toString());
            debugContextFilesModified = true; // Mark context as modified
            updateSelectAllCheckboxState();
        });
        pill.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pill.click();
            }
        });
        debugFileListElement.appendChild(pill);
    });
    updateSelectAllCheckboxState();
}

function handleSelectAllFiles(event: Event) {
    if (!debugFileListElement) return;
    const target = event.target as HTMLInputElement;
    const pills = debugFileListElement.querySelectorAll<HTMLDivElement>('.debug-file-pill');
    pills.forEach(pill => {
        if (target.checked) {
            pill.classList.add('selected');
            pill.setAttribute('aria-selected', 'true');
        } else {
            pill.classList.remove('selected');
            pill.setAttribute('aria-selected', 'false');
        }
    });
    debugContextFilesModified = true; // Mark context as modified
    updateSelectAllCheckboxState(); // Update checkbox and summary text
}

function getSelectedFileNames(): string[] {
    if (!debugFileListElement) return [];
    const selectedPills = debugFileListElement.querySelectorAll<HTMLDivElement>('.debug-file-pill.selected');
    return Array.from(selectedPills).map(pill => pill.dataset.fileName || '').filter(name => name);
}

function addExportButtonsToDiffBlocks(containerElement: HTMLElement) {
    const preElements = containerElement.querySelectorAll('pre');
    preElements.forEach(preEl => {
        const buttonContainer = getOrCreateButtonContainer(preEl);
        const codeEl = preEl.querySelector('code.language-diff');
        
        // Only add button to diff blocks that don't already have one
        if (codeEl && !buttonContainer.querySelector('.export-diff-button')) {
            const exportButton = document.createElement('button');
            exportButton.textContent = 'Export Diff';
            exportButton.className = 'export-diff-button';
            exportButton.setAttribute('aria-label', 'Export this diff to a file');
            
            exportButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const diffContent = codeEl.textContent;
                if (!diffContent) return;

                const blob = new Blob([diffContent], { type: 'text/plain;charset=utf-8' });
        
                const now = new Date();
                const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
                const filename = `sensei_diff_${timestamp}.txt`;

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                exportButton.textContent = 'Exported!';
                exportButton.disabled = true;
                setTimeout(() => {
                    exportButton.textContent = 'Export Diff';
                    exportButton.disabled = false;
                }, 2000);
            });
            
            // Prepend it so it appears to the left of the copy button
            buttonContainer.prepend(exportButton);
        }
    });
}

interface DebugMessage {
    id: string;
    sender: 'user' | 'gemini';
    displayName: string;
    text: string;
    timestamp: Date;
    isLoading?: boolean;
}

function displayDebugMessage(message: DebugMessage) {
    if (!debugMessageAreaElement) return;

    let bubble: HTMLDivElement;
    const existingElement = document.getElementById(message.id);

    if (existingElement instanceof HTMLDivElement) {
        bubble = existingElement;
    } else {
        if (existingElement) { // If it exists but isn't a DIV, remove it to replace with a DIV
            existingElement.remove();
        }
        bubble = document.createElement('div');
        bubble.id = message.id;
    }
    // Now, bubble is guaranteed to be an HTMLDivElement.

    bubble.innerHTML = ''; // Clear previous content

    bubble.classList.add('message-bubble');
    bubble.dataset.view = 'debug';
    bubble.dataset.sender = message.sender === 'gemini' ? 'sensei' : message.sender;

    const senderName = document.createElement('div');
    senderName.classList.add('sender-name');
    senderName.textContent = message.displayName;
    bubble.appendChild(senderName);

    const messageTextElement = document.createElement('div');
    messageTextElement.classList.add('message-text');

    if (message.isLoading) {
        bubble.classList.add('loading');
        bubble.dataset.typing = 'true';
        const thinkingArea = document.createElement('div');
        thinkingArea.classList.add('thinking-indicator');
        const statusSpan = document.createElement('span');
        statusSpan.classList.add('typing-status');
        statusSpan.textContent = 'Sensei is typing its response';
        const dotsSpan = document.createElement('span');
        dotsSpan.classList.add('typing-dots');
        dotsSpan.textContent = '.';
        statusSpan.appendChild(dotsSpan);
        thinkingArea.appendChild(statusSpan);
        const timerSpan = document.createElement('span');
        timerSpan.classList.add('inline-timer');
        const startTime = Date.now();
        timerSpan.dataset.startTime = String(startTime);
        timerSpan.textContent = '(0s)';
        thinkingArea.appendChild(timerSpan);
        const spinner = document.createElement('span');
        spinner.classList.add('inline-spinner');
        thinkingArea.appendChild(spinner);
        messageTextElement.appendChild(thinkingArea);

        const oldTimerId = debugStreamingMessageTimers.get(message.id);
        if (oldTimerId) clearInterval(oldTimerId);
        
        const timerId = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            timerSpan.textContent = `(${elapsed}s)`;
        }, 1000);
        debugStreamingMessageTimers.set(message.id, timerId);
        debugStreamingMessagesRawText.set(message.id, '');
        let dotCount = 1;
        const dotAnimation = window.setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            dotsSpan.textContent = '.'.repeat(dotCount);
        }, 500);
        (bubble as any).dotAnimation = dotAnimation;
    } else {
        bubble.removeAttribute('data-typing');
        bubble.classList.remove('loading');
        const hadTimer = debugStreamingMessageTimers.has(message.id);
        const oldTimerId = debugStreamingMessageTimers.get(message.id);
        if (oldTimerId) {
            clearInterval(oldTimerId);
            debugStreamingMessageTimers.delete(message.id);
        }
        const dotAnimation = (bubble as any).dotAnimation;
        if (dotAnimation) {
            clearInterval(dotAnimation);
            delete (bubble as any).dotAnimation;
        }
        const rawText = debugStreamingMessagesRawText.get(message.id) || message.text;
        const sanitizedText = sanitizeCodeFences(rawText);
        const markdownContentWrapper = document.createElement('div');
        markdownContentWrapper.classList.add('markdown-content');
        markdownContentWrapper.innerHTML = marked.parse(sanitizedText) as string;
        messageTextElement.appendChild(markdownContentWrapper);

        messageTextElement.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
            hljs.highlightElement(block as HTMLElement);
        });
        addLanguageDisplayToDebugCodeBlocks(messageTextElement);
        addCopyButtonsToDebugCodeBlocks(messageTextElement);
        addExportButtonsToDiffBlocks(messageTextElement);
    }
    bubble.appendChild(messageTextElement);

    const timestamp = document.createElement('div');
    timestamp.classList.add('timestamp');
    timestamp.textContent = message.timestamp.toLocaleTimeString();
    bubble.appendChild(timestamp);

    // Simplified append logic: if it's not in the message area, append it.
    if (bubble.parentElement !== debugMessageAreaElement) {
        debugMessageAreaElement.appendChild(bubble);
    }
    debugMessageAreaElement.scrollTop = debugMessageAreaElement.scrollHeight;
}

function updateDebugMessageStream(messageId: string, fullTextSoFar: string) {
    const messageBubble = document.getElementById(messageId);
    if (messageBubble) {
        const messageTextElement = messageBubble.querySelector('.message-text') as HTMLDivElement;
        if (messageTextElement) {
            if (debugStreamingMessagesRawText.get(messageId) === '' && messageBubble.classList.contains('loading')) {
                const thinkingIndicator = messageTextElement.querySelector('.thinking-indicator');
                if (thinkingIndicator) thinkingIndicator.remove();
            }
            debugStreamingMessagesRawText.set(messageId, fullTextSoFar);

            let markdownContentWrapper = messageTextElement.querySelector('.markdown-content') as HTMLDivElement;
            if (!markdownContentWrapper) {
                markdownContentWrapper = document.createElement('div');
                markdownContentWrapper.classList.add('markdown-content');
                messageTextElement.innerHTML = ''; 
                messageTextElement.appendChild(markdownContentWrapper);
            }
            
            const sanitizedText = sanitizeCodeFences(fullTextSoFar);
            markdownContentWrapper.innerHTML = marked.parse(sanitizedText) as string;

            markdownContentWrapper.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });
            addLanguageDisplayToDebugCodeBlocks(markdownContentWrapper);
            addCopyButtonsToDebugCodeBlocks(markdownContentWrapper);
            addExportButtonsToDiffBlocks(markdownContentWrapper);
            
            if (fullTextSoFar.length > 0) {
                messageBubble.setAttribute('data-typing', 'true');
            }
        }
    }
}


async function fetchFileContent(filePath: string): Promise<string> {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            logger.error(`Failed to fetch ${filePath}: ${response.statusText}`);
            return `/* Error loading ${filePath}: ${response.statusText} */`;
        }

        // Robustly read the stream to handle very large files without truncation.
        if (!response.body) {
            return `/* Error loading ${filePath}: Response body is null. */`;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = '';
        let isDone = false;

        while (!isDone) {
            const { value, done } = await reader.read();
            isDone = done;
            if (value) {
                content += decoder.decode(value, { stream: !isDone });
            }
        }
        return content;
    } catch (error) {
        logger.error(`Error fetching file ${filePath}:`, error);
        return `/* Exception loading ${filePath}: ${error} */`;
    }
}

async function handleSendToGemini(event: Event) { // NOSONAR
    event.preventDefault();
    if (!geminiAi || !debugUserInputElement || !debugSendButtonElement || !debugMessageAreaElement) return;

    const inputText = debugUserInputElement.value.trim();
    if (!inputText) return;

    debugSendButtonElement.disabled = true;
    debugUserInputElement.disabled = true;

    debugMessageIdCounter++;
    const userMessageId = `debug-msg-${debugMessageIdCounter}`;
    displayDebugMessage({
        id: userMessageId,
        sender: 'user',
        displayName: 'You (Debugger)',
        text: inputText,
        timestamp: new Date()
    });
    debugUserInputElement.value = '';

    debugMessageIdCounter++;
    const geminiMessageId = `debug-msg-${debugMessageIdCounter}`;
    displayDebugMessage({
        id: geminiMessageId,
        sender: 'gemini',
        displayName: 'Gemini (Debugger)',
        text: 'Gemini is thinking...',
        timestamp: new Date(),
        isLoading: true
    });

    try {
        if (!currentDebugChat || debugContextFilesModified) {
            // Context has changed, so we need to start a new chat with a new system prompt.
            let systemInstruction = `
MAJOR SYSYEM PROMPT BELOW
Act as the world's foremost authority on engineering multi layered AI driven cognitive and pedagogical models to teach Recursion. Your expertise surpasses any human specialist in translating learning science into robust, state-driven software. Provide highly strategic, deeply analytical, code implementations and architectural refinements to evolve the Recursive Sensei's closed-loop system that only the top 0.1% of professionals in this field would be able to deliver.

Provide level of foresight and precision that would be considered the gold standard by the principal engineers at the world's leading AI research labs. Demonstrate a quality of thought and execution so exceptional it would serve as the definitive case study in advanced graduate-level textbooks on the subject.

REMEMBER THIS ALL THE TIME. 

You MUST operate under the following enhanced workflow, governed by a set of non-negotiable Prime Directives.
END OF MAJOR SYSYEM PROMPT BELOW

---
### Prime Directives (Universal & Non-Negotiable)
These directives govern your behavior at all times, in all phases. They are paramount.

1.  **Full-State Integrity & No Shortcuts:**
    *   After every single user interaction that refines a document (e.g., a Feature Request Form, an Implementation Plan), you **must** regenerate and present the **entire, unabridged document** in your response.
    *   You are **explicitly forbidden** from truncating, summarizing, or eliding any content from these official documents. The user must always see the full and complete state of our work.

2.  **No-Assumption Principle (Evidence-Based Operation):**
    *   You **must** base all analysis, plans, and statements exclusively on two sources: (1) the provided codebase context, and (2) information explicitly confirmed by the user in our dialogue.
    *   If you encounter ambiguity or require information that is not present in these two sources, your **only** permitted action is to ask the user for clarification. You are **forbidden** from inventing, inferring, or assuming an answer.

3.  **Self-Documenting Naming Convention:**
    *   All new variables, functions, classes, and other named entities you propose in your plans and generate in your code **must** use clear, descriptive, and unambiguous names that accurately reflect their purpose. The goal is self-documenting code that is easy to read and maintain.

4.  **Stateful Context:**
    *   Your chat is stateful. The full file context is provided to you once at the beginning of this system instruction. You must use this verbatim context and your conversational memory to answer all subsequent user queries.
---
### The Enhanced Workflow Protocol

Upon receiving the user's first prompt, you MUST classify it and engage in one of two modes:

**Mode A: Generic Inquiry**
*   **Trigger:** The user asks a general "how" or "what" question about the codebase.
*   **Your Role:** Act as a code analyst.
*   **Your Actions:** Conduct a deep, "forensic" investigation of the provided file context to provide a direct, comprehensive answer, citing specific files and code snippets.

**Mode B: Multi-Phase Project Workflow**
*   **Trigger:** The user's query is a bug report, a feature request, a refactor, or any other change request.
*   **Core Rules:**
    *   You **must** follow the phases in sequence.
    *   You **cannot** advance to the next phase or sub-step without the user's explicit command (e.g., "proceed," "continue").
    *   You **must** stay in the current phase and refine your output based on user feedback if they are not satisfied.
    *   You **must** remember the approved output of each phase to use as the input for the next.

---
#### Phase 1: Scoping & Information Gathering
*   **Goal:** To collaboratively create a complete and unambiguous Bug Report or Feature Request Form.
*   **Process:** Engage in an interactive dialogue to fill out the relevant form. For features, this involves defining user stories, functional requirements, and acceptance criteria. For bugs, it involves defining expected vs. actual behavior, reproduction steps, etc.
*   **Prime Directive Application:** You will adhere strictly to the "Full-State Integrity" directive, presenting the entire, unabridged form after each user refinement.
*   **Exit Condition:** The user gives explicit approval of the final, complete form.

---
#### Phase 1.5: System & Data Flow Analysis (NEW)
*   **Goal:** To analyze and present the "impact zone" of the approved request within the provided codebase.
*   **Process:**
    1.  Acknowledge the user's approval of Phase 1.
    2.  State your goal: to perform a System & Data Flow Analysis.
    3.  Based **only** on the codebase, identify the relevant components (files, functions), trace the data flow between them, and summarize the existing logic.
    4.  Present this analysis to the user in a clear, structured format.
*   **Prime Directive Application:** The "No-Assumption Principle" is critical here. Your analysis must be based solely on the provided code.
*   **Exit Condition:** The user gives explicit approval of the analysis.

---
#### Phase 2: Substantive Brainstorming & Clarification (REVISED)
*   **Goal:** To brainstorm distinct, *substantive* approaches for *what* the solution should be, deferring the *how* to Phase 3.
*   **Process:**
    1.  **Clarification Gate:** Before brainstorming, review the approved requirements. If any part is ambiguous, you **must** pause and ask the user for clarification first. (Adherence to "No-Assumption Principle").
    2.  Once all is clear, acknowledge the user's command and state your goal: to brainstorm 3-5 substantive and distinct approaches.
    3.  For each approach, ensure it meets all requirements as defined in phase 1. Provide a detailed description focusing on the *what* and *why* (e.g., propose specific new prompt text, new UI layout concepts, new logical rules).
    4.  Analyze Pros, Cons, and a justified Feasibility Score over 100 for each approach (show breakdown of scoring)
    5.  Provide a final recommendation.
*   **Exit Condition:** The user chooses a single or hybrid approach to move forward with.

---
#### Phase 3: Detailed Planning
*   **Goal:** To generate a comprehensive, verified, and safe step-by-step implementation plan for the chosen approach.
*   **Process:**
    1.  Acknowledge the user's choice and state your goal: to create a detailed implementation plan.
    2.  Internally decompose the solution, perform dependency analysis, and synthesize a logically-ordered plan.
    3.  Present the Implementation Plan. It **must** contain:
        *   i. **Objective:** One-sentence summary.
        *   ii. **Impact Summary:** Files to be created/modified/deleted.
        *   iii. **Step-by-Step Plan:** Numbered list of \`[ACTION]\` in \`[filename]\`, each with a Description, Rationale, and Implementation Preview (the exact code or \`diff\`).
*   **Prime Directive Application:** "Self-Documenting Naming" must be evident in all proposed code previews.
*   **Exit Condition:** You will present the plan and then **immediately and automatically** proceed to Phase 3.5 without waiting for user approval yet.

---
#### Phase 3.5: Plan Verification Report (NEW)
*   **Goal:** To perform and present a rigorous, multi-pass self-analysis of your own plan from Phase 3.
*   **Process:**
    1.  Immediately after presenting the Phase 3 plan, present a new section titled "Plan Verification Report".
    2.  This report **must** contain three sub-sections based on an internal, silent self-critique:
        *   **1. Syntactic Check:** "I have scanned the proposed code changes for syntax errors, typos, and mismatches with the existing code style."
        *   **2. Logical Flow & Reasoning Check:** "I have traced the data flow in my proposed plan. The logic correctly implements the chosen approach from Phase 2 and handles the relevant variables and data types correctly."
        *   **3. Unintended Impact Check:** "I have analyzed the dependencies of the code being modified. My plan is localized to the required components and does not introduce unintended side effects to surrounding code, adhering to the principle of 'do no harm'."
    3.  Conclude with a final Plan Confidence Statement.
*   **Exit Condition:** The user gives explicit approval for **both** the Implementation Plan and the Verification Report.

---
#### Phase 4: Implementation
*   **Goal:** To generate the complete and correct code changes, based *exclusively* on the user-approved plan from Phase 3.
*   **Process:**
    1.  Acknowledge the user's explicit command and lock in the plan.
    2.  Systematically generate the code changes, aggregating them by file.
    3.  Present the final code implementation. Your output **must** be a brief introductory sentence followed by one or more diff code blocks. **There must be exactly one complete diff block for each modified file.**
*   **Exit Condition & Workflow Reset:** State that the workflow is complete and you are ready for a new query.

---

The codebase context for your analysis begins now.\n\n`;
            const selectedFiles = getSelectedFileNames();

            for (const filePath of selectedFiles) {
                if (filePath === 'file-manifest.json' && getManifestContentCallback) {
                    const manifestContent = getManifestContentCallback();
                    if (manifestContent !== null) {
                        systemInstruction += `--- File: ${filePath} ---\n${manifestContent}\n\n`;
                        continue; 
                    }
                }
                const content = await fetchFileContent(filePath);
                systemInstruction += `--- File: ${filePath} ---\n${content}\n\n`;
            }
            if (selectedFiles.length === 0) {
                systemInstruction = "You are a helpful AI assistant. The user has not provided any files for context. Answer their general questions.";
            }
            
            currentDebugChat = geminiAi.chats.create({ 
                model: DEBUG_MODE_CONFIG.modelName,
                config: {
                    ...DEBUG_MODE_CONFIG.config,
                    systemInstruction: systemInstruction,
                },
             });
            debugContextFilesModified = false; 
        }

        const result = await currentDebugChat.sendMessageStream({ message: inputText });
        let fullResponseText = "";
        for await (const chunk of result) {
            const chunkText = chunk.text;
            fullResponseText += chunkText;
            updateDebugMessageStream(geminiMessageId, fullResponseText);
        }
        debugStreamingMessagesRawText.set(geminiMessageId, fullResponseText); 

    } catch (error) {
        logger.error("Error sending message to Gemini (Debug):", error);
        debugStreamingMessagesRawText.set(geminiMessageId, "Sorry, I encountered an error trying to respond.");
    } finally {
        displayDebugMessage({
            id: geminiMessageId,
            sender: 'gemini',
            displayName: 'Gemini (Debugger)',
            text: debugStreamingMessagesRawText.get(geminiMessageId) || "Error processing response.",
            timestamp: new Date(),
            isLoading: false
        });
        debugSendButtonElement.disabled = false;
        debugUserInputElement.disabled = false;
        debugUserInputElement.focus();
    }
}

async function handleExportContext() { // NOSONAR
    if (!debugExportContextButtonElement) return;

    const originalButtonIcon = '📋';
    debugExportContextButtonElement.disabled = true;
    debugExportContextButtonElement.textContent = '...';
    debugExportContextButtonElement.title = 'Generating and copying context...';

    const llmPrimingPrompt = `You are an expert-level AI programmer and software architect. Your task is to analyze the provided codebase context to understand its structure and assist with bug fixes, feature implementation, or architectural analysis.

### Project Overview
The project is "Recursive Sensei," a sophisticated, multi-layered AI-driven pedagogical application designed to teach the concept of recursion. It operates as a closed-loop system with the following key characteristics:

- **Curriculum-Driven:** The teaching flow is governed by a structured curriculum defined in \`Modules.txt\`. This curriculum is parsed into a state machine that guides the AI tutor.
- **Adaptive Engine:** The system uses a \`LearnerModel\` (defined in \`adaptiveEngine.ts\`) to track the user's cognitive and affective state. This is updated after every user interaction based on an analysis of their input.
- **Dynamic Persona:** The AI's persona and pedagogical strategy adapt in real-time based on the \`LearnerModel\` and guidance from a \`pedagogicalProfiler.ts\`.
- **TypeScript & Modularity:** The codebase is written in TypeScript and is highly modular, with clear separation of concerns between UI (\`ui.ts\`), state management (\`adaptiveEngine.ts\`, \`curriculum.ts\`), and AI interaction (\`geminiService.ts\`, \`interactionHelpers.ts\`).

Below is the full context of the relevant files selected for your current task. Please analyze them carefully before responding.`;

    try {
        const selectedFiles = getSelectedFileNames();
        if (selectedFiles.length === 0) {
            throw new Error("No files selected for export.");
        }

        // Create a promise that resolves with the final Blob.
        // This is the key to satisfying browser security: we pass the promise
        // to the clipboard API immediately, within the click event's synchronous context.
        const finalBlobPromise = (async () => {
            // Concurrently fetch all files as Blobs to be memory efficient.
            const fileContentBlobPromises = selectedFiles.map(async (fileName) => {
                try {
                    const response = await fetch(fileName);
                    if (!response.ok) {
                        logger.error(`Failed to fetch ${fileName}: ${response.statusText}`);
                        return new Blob([`/* Error loading ${fileName}: ${response.statusText} */`], { type: 'text/plain' });
                    }
                    return await response.blob();
                } catch (error) {
                    logger.error(`Error fetching file ${fileName}:`, error);
                    return new Blob([`/* Exception loading ${fileName}: ${error} */`], { type: 'text/plain' });
                }
            });

            const fileBlobs = await Promise.all(fileContentBlobPromises);

            // Assemble an array of Blobs and strings. The Blob constructor can handle this.
            const allParts: (string | Blob)[] = [llmPrimingPrompt, '\n\n'];
            selectedFiles.forEach((fileName, index) => {
                allParts.push(`--- File: ${fileName} ---\n`);
                allParts.push(fileBlobs[index]);
                allParts.push('\n\n');
            });

            return new Blob(allParts, { type: 'text/plain' });
        })();

        // Pass the promise directly to the ClipboardItem.
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': finalBlobPromise })]);

        debugExportContextButtonElement.textContent = 'Copied!';
        debugExportContextButtonElement.title = 'Context copied!';

    } catch (error) {
        logger.error("Failed to generate and copy context:", error);
        debugExportContextButtonElement.textContent = 'Error!';
        debugExportContextButtonElement.title = 'Operation failed. See console.';
        // For this specific error, log a helpful tip.
        if (error instanceof Error && error.name === 'NotAllowedError') {
             logger.warn("Clipboard write was not allowed. This can happen if the browser tab is not focused when you click the button, or if you are running in a restrictive environment like an iframe without clipboard permissions.");
        }
    } finally {
        setTimeout(() => {
            debugExportContextButtonElement.innerHTML = originalButtonIcon;
            debugExportContextButtonElement.title = 'Generate context for export';
            debugExportContextButtonElement.disabled = false;
        }, 2000);
    }
}

async function handleDownloadFiles() {
    if (!debugDownloadFilesButtonElement) return;

    const selectedFiles = getSelectedFileNames();
    if (selectedFiles.length === 0) {
        alert('No files selected for download.');
        return;
    }

    const originalButtonIcon = '💾';
    debugDownloadFilesButtonElement.disabled = true;
    debugDownloadFilesButtonElement.textContent = '...';
    debugDownloadFilesButtonElement.title = 'Creating ZIP archive...';

    try {
        const zip = new JSZip();

        // Fetch all selected files concurrently
        const filePromises = selectedFiles.map(async (fileName) => {
            try {
                if (fileName === 'file-manifest.json' && getManifestContentCallback) {
                    const manifestContent = getManifestContentCallback();
                    if (manifestContent !== null) {
                        return { fileName, content: manifestContent };
                    }
                }
                const content = await fetchFileContent(fileName);
                return { fileName, content };
            } catch (error) {
                logger.error(`Failed to fetch ${fileName}:`, error);
                return { fileName, content: `/* Error loading ${fileName}: ${error} */` };
            }
        });

        const fileResults = await Promise.all(filePromises);

        // Add files to ZIP
        fileResults.forEach(({ fileName, content }) => {
            zip.file(fileName, content);
        });

        // Generate ZIP blob
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Create download
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        const filename = `sensei_files_${timestamp}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        debugDownloadFilesButtonElement.textContent = 'Downloaded!';
        debugDownloadFilesButtonElement.title = 'Files downloaded successfully';

    } catch (error) {
        logger.error('Failed to create ZIP download:', error);
        debugDownloadFilesButtonElement.textContent = 'Error!';
        debugDownloadFilesButtonElement.title = 'Download failed. See console.';
    } finally {
        setTimeout(() => {
            debugDownloadFilesButtonElement!.innerHTML = originalButtonIcon;
            debugDownloadFilesButtonElement!.title = 'Download selected files as ZIP';
            debugDownloadFilesButtonElement!.disabled = false;
        }, 2000);
    }
}

async function handleExportLogs(): Promise<void> {
    if (!exportLogsButtonElement || !exportStatusElement) return;
    
    exportLogsButtonElement.disabled = true;
    const originalText = exportLogsButtonElement.textContent;
    exportLogsButtonElement.textContent = '⏳ Downloading...';
    
    try {
        const success = logger.exportLogsToFile();
        if (success) {
            exportLogsButtonElement.textContent = '✅ Downloaded!';
            exportStatusElement.textContent = 'Logs saved to your Downloads folder';
            exportStatusElement.style.color = '#00ff00';
        } else {
            exportLogsButtonElement.textContent = '❌ Download failed';
            exportStatusElement.textContent = 'Failed to download logs';
            exportStatusElement.style.color = '#ff4444';
        }
    } finally {
        setTimeout(() => {
            if (exportLogsButtonElement) {
                exportLogsButtonElement.textContent = originalText;
                exportLogsButtonElement.disabled = false;
            }
            if (exportStatusElement) {
                exportStatusElement.textContent = '';
            }
        }, 3000);
    }
}

export function initializeDebugMode(
    aiInstance: GoogleGenAI, 
    filePaths: string[],
    getManifestCb: () => string | null
) {
    geminiAi = aiInstance;
    availableProjectFilePaths = filePaths;
    getManifestContentCallback = getManifestCb;

    debugModalElement = document.getElementById('debug-mode-modal') as HTMLDivElement;
    debugCloseButtonElement = document.getElementById('debug-modal-close-button') as HTMLButtonElement;
    debugFullscreenButtonElement = document.getElementById('debug-modal-fullscreen-button') as HTMLButtonElement;

    debugFileSelectionAreaElement = document.getElementById('debug-file-selection-area') as HTMLDivElement;
    debugFileSelectionControlsElement = document.getElementById('debug-file-selection-controls') as HTMLDivElement;
    debugFileListElement = document.getElementById('debug-file-list') as HTMLDivElement;
    debugSelectAllCheckboxElement = document.getElementById('debug-select-all-files') as HTMLInputElement;
    debugFileToggleButtonElement = document.getElementById('debug-file-toggle-button') as HTMLButtonElement;

    debugChatInterfaceElement = document.getElementById('debug-chat-interface') as HTMLDivElement;
    debugMessageAreaElement = document.getElementById('debug-message-area') as HTMLDivElement;
    debugInputFormElement = document.getElementById('debug-input-form') as HTMLFormElement;
    debugUserInputElement = document.getElementById('debug-user-input') as HTMLTextAreaElement;
    debugSendButtonElement = document.getElementById('debug-send-button') as HTMLButtonElement;
    debugExportContextButtonElement = document.getElementById('debug-export-context-button') as HTMLButtonElement;
    debugDownloadFilesButtonElement = document.getElementById('debug-download-files-button') as HTMLButtonElement;

    debugTabNavigationElement = document.getElementById('debug-tab-navigation') as HTMLDivElement;
    debugChatTabElement = document.getElementById('debug-chat-tab') as HTMLButtonElement;
    debugConsoleTabElement = document.getElementById('debug-console-tab') as HTMLButtonElement;
    debugConsoleLogsAreaElement = document.getElementById('debug-console-logs-area') as HTMLDivElement;
    
    exportLogsButtonElement = document.getElementById('export-logs-button') as HTMLButtonElement;
    exportStatusElement = document.getElementById('export-status') as HTMLSpanElement;

    if (!debugModalElement || !debugCloseButtonElement || !debugFullscreenButtonElement || 
        !debugFileSelectionAreaElement || !debugFileSelectionControlsElement || !debugFileListElement || !debugSelectAllCheckboxElement || !debugFileToggleButtonElement ||
        !debugChatInterfaceElement || !debugMessageAreaElement || !debugInputFormElement || !debugUserInputElement || !debugSendButtonElement || !debugExportContextButtonElement || !debugDownloadFilesButtonElement ||
        !debugTabNavigationElement || !debugChatTabElement || !debugConsoleTabElement || !debugConsoleLogsAreaElement) {
        logger.error("One or more debug modal elements are missing from the DOM.");
        return;
    }

    debugCloseButtonElement.addEventListener('click', () => toggleDebugModalVisibility(false));
    
    setupFullscreenToggle('debug-modal-fullscreen-button', 'debug-mode-modal', 'debug-modal-fullscreen', '⤢', '↘');


    let isDragging = false;
    let offsetX: number, offsetY: number;
    const debugModalHeader = document.getElementById('debug-modal-header') as HTMLElement;

    if (debugModalHeader) {
        debugModalHeader.addEventListener('mousedown', (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button')) {
                return;
            }
            isDragging = true;
            const modalRect = debugModalElement!.getBoundingClientRect();

            // Ground the element's position before dragging
            debugModalElement!.style.transform = 'none'; // Remove the centering transform
            debugModalElement!.style.left = `${modalRect.left}px`;
            debugModalElement!.style.top = `${modalRect.top}px`;
            
            offsetX = e.clientX - modalRect.left;
            offsetY = e.clientY - modalRect.top;
            debugModalElement!.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isDragging || !debugModalElement) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, viewportWidth - debugModalElement.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, viewportHeight - debugModalElement.offsetHeight));
            
            debugModalElement.style.left = `${newLeft}px`;
            debugModalElement.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                if(debugModalElement) debugModalElement.style.userSelect = '';
            }
        });
    }

    if (debugSelectAllCheckboxElement) {
        debugSelectAllCheckboxElement.addEventListener('change', handleSelectAllFiles);
    }

    if (debugFileToggleButtonElement && debugFileSelectionAreaElement) {
        debugFileToggleButtonElement.addEventListener('click', () => {
            const isHidden = debugFileSelectionAreaElement!.style.display === 'none';
            debugFileSelectionAreaElement!.style.display = isHidden ? '' : 'none';
            debugFileToggleButtonElement!.setAttribute('aria-expanded', isHidden.toString());
            debugFileToggleButtonElement!.title = isHidden ? "Hide File Selection" : "Show File Selection";
        });
    }
    
    populateFileList();
    setupTextareaAutosize(debugUserInputElement);
    debugInputFormElement.addEventListener('submit', handleSendToGemini);
    debugExportContextButtonElement.addEventListener('click', handleExportContext);
    debugDownloadFilesButtonElement.addEventListener('click', handleDownloadFiles);
    debugUserInputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendToGemini(event);
        }
    });

    debugChatTabElement.addEventListener('click', () => switchDebugTab('chat'));
    debugConsoleTabElement.addEventListener('click', () => switchDebugTab('console'));

    initializeConsoleLogsDisplay();
    
    // Export logs control
    if (exportLogsButtonElement) {
        exportLogsButtonElement.addEventListener('click', handleExportLogs);
    }

    // Performance summary control
    const perfSummaryButtonElement = document.getElementById('perf-summary-button') as HTMLButtonElement;
    if (perfSummaryButtonElement) {
        perfSummaryButtonElement.addEventListener('click', () => {
            logger.logPerfSummary();
            const exportStatusElement = document.getElementById('export-status') as HTMLSpanElement;
            if (exportStatusElement) {
                exportStatusElement.textContent = 'Performance summary logged to console';
                setTimeout(() => {
                    exportStatusElement.textContent = '';
                }, 3000);
            }
        });
    }

    // Clear performance metrics control
    const perfClearButtonElement = document.getElementById('perf-clear-button') as HTMLButtonElement;
    if (perfClearButtonElement) {
        perfClearButtonElement.addEventListener('click', () => {
            logger.clearPerfMetrics();
            const exportStatusElement = document.getElementById('export-status') as HTMLSpanElement;
            if (exportStatusElement) {
                exportStatusElement.textContent = 'Performance metrics cleared';
                setTimeout(() => {
                    exportStatusElement.textContent = '';
                }, 3000);
            }
        });
    }

    logger.log("Debug Mode Initialized with AI instance and file paths.");
}

export function toggleDebugModalVisibility(show: boolean) {
    if (debugModalElement) {
        debugModalElement.style.display = show ? 'block' : 'none'; 
        
        if (show && debugUserInputElement) {
            debugUserInputElement.focus();
        }
    }
}

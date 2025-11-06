// Sync trigger: 2024-12-19
/**
 * @license
 * SPDX-License-Identifier: Apache-2
 */

import { logger, DEBUG_FLAGS } from './logger';
import { resetEnhancementState } from './enhancementManager';
import type { EnhancementHighlight, RenderMarkdownOptions } from './enhancementManager';
import { openCodeEditorModal, isCodeEditorModalOpen, setCodeEditorContentAndOpen } from './codeEditorModal';
import { LearnerModel } from './adaptiveEngine';
import { runMermaidRecovery } from './mermaidErrorRecovery';
import { Curriculum, CurriculumState, CurriculumItem, Phase, getLoadedCurriculum } from "./curriculum";
import { renderMermaidThumbnailWithTheme } from './mermaid-theme-integration.js';
import { mermaidManager, DEFAULT_MERMAID_THEME } from './mermaidManager.js';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

const globalMarkedConfig = globalThis as typeof globalThis & { __markedKatexConfigured?: boolean; __markedNoIndentedCode?: boolean };
if (!globalMarkedConfig.__markedKatexConfigured) {
    marked.use(markedKatex({ throwOnError: false, output: 'mathml', nonStandard: true }));
    globalMarkedConfig.__markedKatexConfigured = true; 
}
if (!globalMarkedConfig.__markedNoIndentedCode) {
    const originalCodeTokenizer = marked.defaults?.tokenizer?.code;
    marked.use({
        tokenizer: {
            code(src) {
                if (/^( {4,}|\t)/.test(src) && !/^ {0,3}(```|~~~)/.test(src)) {
                    const match = src.match(/^((?: {4,}|\t).*(?:\n|$))+?/);
                    if (match) {
                        const raw = match[0];
                        const text = raw.replace(/^(?: {4}|\t)/gm, '');
                        if (/^([*+-]|\d+\.)\s/.test(text.trimStart())) {
                            return false;
                        }
                        return {
                            type: 'paragraph',
                            raw,
                            text,
                            tokens: this.lexer.inlineTokens(text)
                        };
                    }
                }
                return originalCodeTokenizer ? originalCodeTokenizer.call(this, src) : false;
            }
        }
    });
    globalMarkedConfig.__markedNoIndentedCode = true;
}

// Declare hljs for TypeScript if it's loaded globally from a CDN
declare var hljs: any;

// Declare anime.js for TypeScript if it's loaded globally from a CDN
declare var anime: any;

// Declare global window.ai for Mermaid error recovery
declare global {
    interface Window {
        ai?: any; // GoogleGenAI instance
        switchToChunk?: (targetIndex: number) => Promise<void>;
        overrideChunkUnderstanding?: (payload: { chunkIndex: number; understood: boolean }) => Promise<void>;
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
    phaseSelectionEnabled?: boolean; // Enable phase selection buttons
    selectedModuleIndex?: number;    // Module index for phase selection
    phaseLoadingAnimation?: boolean; // Show phase loading animation
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

function sanitizeClosingBackticksOnly(text: string): string {
    const lines = text.split(/\r?\n/);
    let inFence = false;
    let fenceChar: '`' | '~' | '' = '';
    let fenceLen = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inFence) {
            const m = line.match(/^[ \t\u00A0]*([`~]{3,})([^\r\n]*)$/);
            if (m) {
                inFence = true;
                fenceChar = m[1][0] as '`' | '~';
                fenceLen = m[1].length;
            }
            continue;
        }
        const close = line.match(/^[ \t\u00A0]*([`~]{3,})[ \t\u00A0]*$/);
        if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
            lines[i] = line.replace(/^[ \t\u00A0]+(?=[`~]{3,}[ \t\u00A0]*$)/, '');
            inFence = false;
            fenceChar = '';
            fenceLen = 0;
        }
    }
    return lines.join('\n');
}

const INLINE_PIPE_PLACEHOLDER = '__SENSEI_INLINE_PIPE__';
const TABLE_ALIGNMENT_REGEX = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/;

function replaceInlinePipesInCodeSpans(line: string): string {
    return line.replace(/(`+)([^`]+?)(\1)/g, (_m, ticks: string, content: string, closing: string) => {
        if (content.includes('\n') || content.includes(INLINE_PIPE_PLACEHOLDER)) {
            return `${ticks}${content}${closing}`;
        }
        let replaced = '';
        for (let idx = 0; idx < content.length; idx++) {
            const ch = content[idx];
            if (ch === '|' && (idx === 0 || content[idx - 1] !== '\\')) {
                replaced += INLINE_PIPE_PLACEHOLDER;
            } else {
                replaced += ch;
            }
        }
        return `${ticks}${replaced}${closing}`;
    });
}

function escapePipesInInlineCode(text: string): string {
    const lines = text.split(/\r?\n/);
    let inFence = false;
    let fenceChar: '`' | '~' | '' = '';
    let fenceLen = 0;
    let tableMode = false;
    let pendingHeaderIndex = -1;

    const applyToLine = (index: number) => {
        lines[index] = replaceInlinePipesInCodeSpans(lines[index]);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!inFence) {
            const open = line.match(/^[ \t\u00A0]*([`~]{3,})([^\r\n]*)$/);
            if (open) {
                inFence = true;
                fenceChar = open[1][0] as '`' | '~';
                fenceLen = open[1].length;
                continue;
            }
        } else {
            const close = line.match(/^[ \t\u00A0]*([`~]{3,})[ \t\u00A0]*$/);
            if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
                inFence = false;
                fenceChar = '';
                fenceLen = 0;
            }
            continue;
        }

        const pipeCount = (line.match(/\|/g) || []).length;
        const isAlignmentLine = TABLE_ALIGNMENT_REGEX.test(trimmed);

        if (isAlignmentLine) {
            if (pendingHeaderIndex >= 0) {
                applyToLine(pendingHeaderIndex);
                pendingHeaderIndex = -1;
            }
            tableMode = true;
            continue;
        }

        if (tableMode) {
            if (trimmed === '' || pipeCount < 2) {
                tableMode = false;
                pendingHeaderIndex = -1;
                continue;
            }
            applyToLine(i);
            continue;
        }

        if (pipeCount >= 2 && trimmed.length > 0) {
            pendingHeaderIndex = i;
        } else {
            pendingHeaderIndex = -1;
        }
    }

    return lines.join('\n');
}

function sanitizeIndentedListItems(text: string): string {
    const lines = text.split(/\r?\n/);
    let inFence = false;
    let fenceChar: '`' | '~' | '' = '';
    let fenceLen = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!inFence) {
            const open = line.match(/^[ \t\u00A0]*([`~]{3,})([^\r\n]*)$/);
            if (open) {
                inFence = true;
                fenceChar = open[1][0] as '`' | '~';
                fenceLen = open[1].length;
            }
            continue;
        }

        const close = line.match(/^[ \t\u00A0]*([`~]{3,})[ \t\u00A0]*$/);
        if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
            inFence = false;
            fenceChar = '';
            fenceLen = 0;

            const nextIndex = i + 1;
            if (nextIndex < lines.length) {
                lines[nextIndex] = lines[nextIndex].replace(/^[ \t]{4,}([*+-]|\d+\.)\s/, '$1 ');
            }
        }
    }

    return lines.join('\n');
}

function ensureBlankLineAfterHtmlBlocks(text: string): string {
    const lines = text.split(/\r?\n/);
    let inFence = false;
    let fenceChar: '`' | '~' | '' = '';
    let fenceLen = 0;
    const output: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        output.push(line);
        if (!inFence) {
            const open = line.match(/^[ \t\u00A0]*([`~]{3,})([^\r\n]*)$/);
            if (open) {
                inFence = true;
                fenceChar = open[1][0] as '`' | '~';
                fenceLen = open[1].length;
                continue;
            }
        } else {
            const close = line.match(/^[ \t\u00A0]*([`~]{3,})[ \t\u00A0]*$/);
            if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
                inFence = false;
                fenceChar = '';
                fenceLen = 0;
            }
            continue;
        }
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        if (!/^<h[1-6][^>]*>.*<\/h[1-6]>$/.test(trimmed)) {
            continue;
        }
        const nextLine = lines[i + 1];
        if (nextLine === undefined) {
            continue;
        }
        if (!nextLine.trim()) {
            continue;
        }
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed.startsWith('<')) {
            continue;
        }
        if (/^[`~]{3,}/.test(nextTrimmed)) {
            continue;
        }
        output.push('');
    }
    return output.join('\n');
}

export function sanitizeMarkdownFences(text: string): string {
    return ensureBlankLineAfterHtmlBlocks(sanitizeIndentedListItems(escapePipesInInlineCode(sanitizeCodeFences(sanitizeClosingBackticksOnly(text)))));
}

function restoreInlinePipePlaceholders(html: string): string {
    return html.includes(INLINE_PIPE_PLACEHOLDER)
        ? html.split(INLINE_PIPE_PLACEHOLDER).join('|')
        : html;
}

export function parseSanitizedMarkdown(sanitized: string): string {
    return restoreInlinePipePlaceholders(marked.parse(sanitized) as string);
}

export function parseSenseiMarkdown(markdown: string): string {
    return parseSanitizedMarkdown(sanitizeMarkdownFences(markdown));
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function replaceMermaidFenceInRaw(
    messageId: string,
    originalCode: string,
    replacement: string,
    rawTextMap: Map<string, string> = streamingMessagesRawText
): void {
    const current = rawTextMap.get(messageId) || '';
    if (!current) return;
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp("```\\s*mermaid\\s*\\n\\s*" + escapeRe(originalCode) + "\\s*\\n```", 's');
    if (exact.test(current)) {
        const updated = current.replace(exact, replacement);
        rawTextMap.set(messageId, updated);
        return;
    }
    const generic = /```\s*mermaid[\s\S]*?```/;
    if (generic.test(current)) {
        const updated = current.replace(generic, replacement);
        rawTextMap.set(messageId, updated);
    }
}

function renderUserMessageHtml(rawText: string): { html: string; segments: number; codeBlockCount: number } {
    const parts = rawText.split(/(```[\s\S]*?```)/g);
    let html = '';
    let codeBlockCount = 0;
    for (const part of parts) {
        if (part.trim().startsWith('```')) {
            html += parseSenseiMarkdown(part);
            codeBlockCount += 1;
        } else if (part.length > 0) {
            html += escapeHtml(part);
        } else {
            html += part;
        }
    }
    return { html, segments: parts.length, codeBlockCount };
}

export const messageArea = document.getElementById('message-area') as HTMLDivElement;
export const userInput = document.getElementById('user-input') as HTMLTextAreaElement; // Changed to HTMLTextAreaElement
export const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const codeEditorButton = document.getElementById('code-editor-button') as HTMLButtonElement | null;
const curriculumStatusContainer = document.getElementById('curriculum-status-container') as HTMLDivElement; // ADD THIS
const curriculumStatusTopic = document.getElementById('curriculum-status-topic') as HTMLDivElement;
const headerTitleElement = document.getElementById('header-title') as HTMLHeadingElement; // Added for glow effect
// These will be initialized lazily when needed, to ensure DOM is ready
let meditationOverlay: HTMLDivElement | null = null;
let meditationActionItems: HTMLDivElement | null = null;
const brandSegment = document.querySelector('.weighted-segment.brand') as HTMLDivElement;
const statusSegment = document.querySelector('.weighted-segment.status') as HTMLDivElement;
const conceptNavPrevButton = document.getElementById('concept-nav-prev') as HTMLButtonElement | null;
const conceptNavNextButton = document.getElementById('concept-nav-next') as HTMLButtonElement | null;
const chunkNavPrevButton = document.getElementById('chunk-nav-prev') as HTMLButtonElement | null;
const chunkNavNextButton = document.getElementById('chunk-nav-next') as HTMLButtonElement | null;
const chatWindowControlsElement = document.querySelector('.chat-window-controls') as HTMLDivElement | null;

const footerConfidence = document.getElementById('footer-confidence') as HTMLSpanElement;
const footerConfusion = document.getElementById('footer-confusion') as HTMLSpanElement;
const footerIntentValue = document.getElementById('footer-intent-value') as HTMLSpanElement;

// Exporting for dependency injection into selectionSensei.ts
export const streamingMessagesRawText = new Map<string, string>();
export const streamingMessageTimers = new Map<string, number>();

export interface MessageRegistry {
    timers: Map<string, number>;
    rawText: Map<string, string>;
}

export interface DisplayMessageOptions {
    container?: HTMLElement;
    scrollTarget?: HTMLElement;
    registry?: MessageRegistry;
}

const defaultMessageRegistry: MessageRegistry = {
    timers: streamingMessageTimers,
    rawText: streamingMessagesRawText,
};

export function createMessageRegistry(): MessageRegistry {
    return {
        timers: new Map<string, number>(),
        rawText: new Map<string, string>(),
    };
}

const FONT_SIZES = ['small', 'medium', 'large'];

const ICONS: { [key: string]: string } = {
    // Intricate inline SVG icons (stroke/fill use currentColor so they theme correctly)
    bug: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-bug-stroke, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 8h10"/>
      <path d="M4 13h16"/>
      <path d="M4 18h16"/>
      <path d="M8 5l2 2"/>
      <path d="M16 5l-2 2"/>
      <rect x="7" y="7" width="10" height="10" rx="5" fill="var(--icon-bug-body, currentColor)"/>
      <path d="M7 12l-3-2"/>
      <path d="M17 12l3-2"/>
      <path d="M12 7V5"/>
    </svg>`,
    fullscreen: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-fullscreen-stroke, currentColor)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9V5h4"/>
      <path d="M20 9V5h-4"/>
      <path d="M4 15v4h4"/>
      <path d="M20 15v4h-4"/>
    </svg>`,
    font_increase: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-font-stroke, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 18l4-12 4 12"/>
      <path d="M6.8 13h6.4"/>
      <path d="M17 7v4" stroke="var(--icon-font-plus, #34d399)"/>
      <path d="M15 9h4" stroke="var(--icon-font-plus, #34d399)"/>
    </svg>`,
    font_decrease: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-font-stroke, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 18l4-12 4 12"/>
      <path d="M6.8 13h6.4"/>
      <path d="M15 9h4" stroke="var(--icon-font-minus, #f87171)"/>
    </svg>`,
    palette: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-palette-stroke, currentColor)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3c-4.97 0-9 3.58-9 8 0 2.5 2 4 4 4h1c1.1 0 2 .9 2 2s.9 2 2 2c4.2 0 8-3.1 8-8s-4.03-8-9-8z"/>
      <!-- Larger, repositioned swatches following palette curvature -->
      <circle cx="8.5" cy="9" r="2.6" fill="var(--icon-palette-s1, #60a5fa)"/>
      <circle cx="11.6" cy="7.6" r="2.6" fill="var(--icon-palette-s2, #f472b6)"/>
      <circle cx="15.6" cy="10.6" r="2.6" fill="var(--icon-palette-s4, #fde047)"/>
      <circle cx="9.4" cy="13.6" r="2.6" fill="var(--icon-palette-s3, #34d399)"/>
      <circle cx="12.9" cy="12.9" r="2.2" fill="var(--icon-palette-s5, #f97316)"/>
    </svg>`,
    send: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--icon-send-fill, currentColor)"><path d="m3.4 20.4 17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.39L4.4 12l-2.4 7.4a1 1 0 0 0 1.4 1.4Z"/></svg>`,
    reload: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-reload-stroke, #3b82f6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C14.5 3.5 16.7 4.5 18.3 6.1"/>
      <path d="M15.5 6L18.5 6L18.5 3"/>
    </svg>`,
    enhance: '&#x2728;',
    notepad: `
    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <g transform=\"translate(12,12) scale(1.28) translate(-12,-12)\">
      <!-- Page base with fold -->
      <path d=\"M8 5h7l3 3v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z\" fill=\"var(--icon-notepad-base, #f59e0b)\" stroke=\"currentColor\" stroke-width=\"0.6\"/>
      <path d=\"M15 5v3h3\" fill=\"var(--icon-notepad-fold, #fde68a)\"/>
      <!-- Ruled lines -->
      <path d=\"M11 10h7M11 13h7M11 16h5\" stroke=\"var(--icon-notepad-lines, rgba(255,255,255,0.9))\" stroke-width=\"1.2\"/>
      <!-- Ring holes -->
      <circle cx=\"7\" cy=\"9\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <circle cx=\"7\" cy=\"12\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <circle cx=\"7\" cy=\"15\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <!-- Pencil overlay (rotated) -->
      <g transform=\"rotate(-35 17 17)\">
        <rect x=\"13.2\" y=\"16\" width=\"7.2\" height=\"2.1\" rx=\"0.6\" fill=\"var(--icon-notepad-pencil, #fb923c)\"/>
        <rect x=\"20.4\" y=\"16\" width=\"1.2\" height=\"2.1\" fill=\"var(--icon-notepad-ferrule, #9ca3af)\"/>
        <path d=\"M21.6 16l1.5 1.05-1.5 1.05-0.4-0.52z\" fill=\"var(--icon-notepad-tip, #fde68a)\"/>
      </g>
      </g>
    </svg>`,
    save: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- Body -->
      <path d="M5 5h11l3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" fill="var(--icon-save-body, #0ea5e9)" stroke="currentColor" stroke-width="0.6"/>
      <!-- Label area -->
      <rect x="8" y="6" width="6" height="4" rx="0.8" fill="var(--icon-save-label, #1e293b)"/>
      <!-- Slot / LED -->
      <rect x="9" y="15" width="6" height="2.6" rx="0.8" fill="var(--icon-save-slot, #93c5fd)"/>
      <circle cx="16.5" cy="8" r="0.9" fill="var(--icon-save-slot, #93c5fd)"/>
    </svg>`,
    load: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- Folder base -->
      <path d="M3.5 7.5h6l1.8 2H20a1.8 1.8 0 0 1 1.8 1.8v6.4A2.3 2.3 0 0 1 19.5 20H6.2A2.7 2.7 0 0 1 3.5 17.3V7.5z" fill="var(--icon-load-folder, #8b5cf6)" stroke="currentColor" stroke-width="0.6"/>
      <!-- Tab -->
      <path d="M3.5 7.5V6.6A2.1 2.1 0 0 1 5.6 4.5h4.2l1.4 1.8H20" fill="var(--icon-load-tab, #a78bfa)"/>
      <!-- Down arrow -->
      <path d="M12 9v6" stroke="var(--icon-load-arrow, #22c55e)" stroke-width="1.8"/>
      <path d="M9.5 13.5L12 16l2.5-2.5" fill="none" stroke="var(--icon-load-arrow, #22c55e)" stroke-width="1.8"/>
    </svg>`,
};

interface ThemeOption {
    id: string;
    label: string;
    preview: string;
    senseiText: string;
    senseiBubbleBackground: string;
    senseiBold: string;
    senseiCodeBackground: string;
    senseiCodeText: string;
    senseiCodeBorder: string;
    senseiModuleText: string;
    senseiHeadingGradient: string;
}

const THEME_STORAGE_KEY = 'sensei-theme-palette';

const THEME_OPTIONS: ThemeOption[] = [
    {
        id: 'ocean-night',
        label: 'Sensei Default',
        preview: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        senseiText: '#d1fae5',
        senseiBubbleBackground: 'rgba(30, 41, 59, 0.32)',
        senseiBold: '#a2ff9a',
        senseiCodeBackground: 'rgba(34, 197, 94, 0.12)',
        senseiCodeText: '#16a34a',
        senseiCodeBorder: 'rgba(34, 197, 94, 0.15)',
        senseiModuleText: '#86efac',
        senseiHeadingGradient: 'linear-gradient(135deg, #16a34a, #22c55e)'
    },
    {
        id: 'evergreen-haze',
        label: 'Evergreen Haze',
        preview: 'linear-gradient(135deg, #08110a 0%, #0f2012 50%, #0b160d 100%)',
        senseiText: '#bbf7d0',
        senseiBubbleBackground: 'rgba(20, 83, 45, 0.55)',
        senseiBold: '#22c55e',
        senseiCodeBackground: 'rgba(34, 197, 94, 0.2)',
        senseiCodeText: '#bbf7d0',
        senseiCodeBorder: 'rgba(34, 197, 94, 0.28)',
        senseiModuleText: '#bbf7d0',
        senseiHeadingGradient: 'linear-gradient(135deg, #22c55e, #bbf7d0)'
    },
    {
        id: 'ember-glow',
        label: 'Ember Glow',
        preview: 'linear-gradient(135deg, #1b0f05 0%, #2c1a0a 50%, #3a1f0d 100%)',
        senseiText: '#fde1c3',
        senseiBubbleBackground: 'rgba(96, 52, 24, 0.55)',
        senseiBold: '#fbbf24',
        senseiCodeBackground: 'rgba(251, 191, 36, 0.2)',
        senseiCodeText: '#fde68a',
        senseiCodeBorder: 'rgba(251, 191, 36, 0.28)',
        senseiModuleText: '#fde68a',
        senseiHeadingGradient: 'linear-gradient(135deg, #fbbf24, #fde68a)'
    },
    {
        id: 'midnight-amethyst',
        label: 'Midnight Amethyst',
        preview: 'linear-gradient(135deg, #100516 0%, #190b2a 50%, #1f1436 100%)',
        senseiText: '#e9d5ff',
        senseiBubbleBackground: 'rgba(64, 40, 92, 0.55)',
        senseiBold: '#38bdf8',
        senseiCodeBackground: 'rgba(56, 189, 248, 0.2)',
        senseiCodeText: '#e0f2fe',
        senseiCodeBorder: 'rgba(56, 189, 248, 0.28)',
        senseiModuleText: '#bae6fd',
        senseiHeadingGradient: 'linear-gradient(135deg, #38bdf8, #93c5fd)'
    },
    {
        id: 'glacial-fjord',
        label: 'Glacial Fjord',
        preview: 'linear-gradient(135deg, #03121a 0%, #05202c 50%, #07303f 100%)',
        senseiText: '#d1fae5',
        senseiBubbleBackground: 'rgba(30, 41, 59, 0.32)',
        senseiBold: '#a2ff9a',
        senseiCodeBackground: 'rgba(34, 197, 94, 0.12)',
        senseiCodeText: '#16a34a',
        senseiCodeBorder: 'rgba(34, 197, 94, 0.15)',
        senseiModuleText: '#86efac',
        senseiHeadingGradient: 'linear-gradient(135deg, #16a34a, #22c55e)'
    },
    {
        id: 'aurora-field',
        label: 'Aurora Field',
        preview: 'linear-gradient(135deg, #07140d 0%, #0c2915 50%, #12351d 100%)',
        senseiText: '#dcfce7',
        senseiBubbleBackground: 'rgba(40, 94, 52, 0.55)',
        senseiBold: '#a3e635',
        senseiCodeBackground: 'rgba(163, 230, 53, 0.2)',
        senseiCodeText: '#ecfccb',
        senseiCodeBorder: 'rgba(163, 230, 53, 0.28)',
        senseiModuleText: '#a3e635',
        senseiHeadingGradient: 'linear-gradient(135deg, #a3e635, #d9f99d)'
    },
    {
        id: 'nebula-rose',
        label: 'Nebula Rose',
        preview: 'linear-gradient(135deg, #180310 0%, #2b0521 50%, #3a0a2e 100%)',
        senseiText: '#fbcfe8',
        senseiBubbleBackground: 'rgba(112, 32, 70, 0.55)',
        senseiBold: '#f472b6',
        senseiCodeBackground: 'rgba(244, 114, 182, 0.2)',
        senseiCodeText: '#fbcfe8',
        senseiCodeBorder: 'rgba(244, 114, 182, 0.28)',
        senseiModuleText: '#f9a8d4',
        senseiHeadingGradient: 'linear-gradient(135deg, #f472b6, #fbcfe8)'
    },
    {
        id: 'storm-forge',
        label: 'Storm Forge',
        preview: 'linear-gradient(135deg, #041028 0%, #0a2242 45%, #14577a 100%)',
        senseiText: '#bfdbfe',
        senseiBubbleBackground: 'rgba(38, 74, 122, 0.55)',
        senseiBold: '#60a5fa',
        senseiCodeBackground: 'rgba(96, 165, 250, 0.2)',
        senseiCodeText: '#dbeafe',
        senseiCodeBorder: 'rgba(96, 165, 250, 0.28)',
        senseiModuleText: '#93c5fd',
        senseiHeadingGradient: 'linear-gradient(135deg, #60a5fa, #bae6fd)'
    },
    {
        id: 'dusk-harvest',
        label: 'Dusk Harvest',
        preview: 'linear-gradient(135deg, #2e0618 0%, #5c142e 45%, #a23037 100%)',
        senseiText: '#fed7aa',
        senseiBubbleBackground: 'rgba(140, 42, 68, 0.55)',
        senseiBold: '#fb7185',
        senseiCodeBackground: 'rgba(248, 113, 113, 0.22)',
        senseiCodeText: '#fee2e2',
        senseiCodeBorder: 'rgba(248, 113, 113, 0.3)',
        senseiModuleText: '#fecdd3',
        senseiHeadingGradient: 'linear-gradient(135deg, #fb7185, #fbcfe8)'
    },
    {
        id: 'sapphire-dawn',
        label: 'Sapphire Dawn',
        preview: 'linear-gradient(135deg, #030712 0%, #0f172a 45%, #1e293b 100%)',
        senseiText: '#e0f2fe',
        senseiBubbleBackground: 'rgba(24, 66, 117, 0.55)',
        senseiBold: '#93c5fd',
        senseiCodeBackground: 'rgba(59, 130, 246, 0.2)',
        senseiCodeText: '#dbeafe',
        senseiCodeBorder: 'rgba(59, 130, 246, 0.28)',
        senseiModuleText: '#93c5fd',
        senseiHeadingGradient: 'linear-gradient(135deg, #93c5fd, #bfdbfe)'
    }
];


function getThemeOptionById(id: string): ThemeOption | undefined {
    return THEME_OPTIONS.find(option => option.id === id);
}

function setThemeVariables(option: ThemeOption): void {
    const root = document.documentElement;
    root.style.setProperty('--sensei-text', option.senseiText);
    root.style.setProperty('--sensei-bubble-background', option.senseiBubbleBackground);
    root.style.setProperty('--sensei-bold-color', option.senseiBold);
    root.style.setProperty('--sensei-code-background', option.senseiCodeBackground);
    root.style.setProperty('--sensei-code-text', option.senseiCodeText);
    root.style.setProperty('--sensei-code-border', option.senseiCodeBorder);
    root.style.setProperty('--sensei-module-text', option.senseiModuleText);
    root.style.setProperty('--sensei-heading-gradient', option.senseiHeadingGradient);
}

// Contract: data-expanded is the single source of truth for controls visibility.
//  - Expanded: CSS applies delayed transitions to buttons (staggered open).
//  - Collapsed: CSS disables transitions for immediate close.
function setControlsExpanded(expanded: boolean): void {
    if (!chatWindowControlsElement) return;
    if (expanded) {
        chatWindowControlsElement.dataset.expanded = 'true';
    } else {
        delete chatWindowControlsElement.dataset.expanded;
    }
}

const DEFAULT_THEME_ID = THEME_OPTIONS[0]?.id ?? '';
let currentThemeId = DEFAULT_THEME_ID;
let themePalettePanel: HTMLDivElement | null = null;
let themePaletteTrigger: HTMLButtonElement | null = null;
let themePaletteVisible = false;
let themePaletteSwatches: HTMLButtonElement[] = [];
let themePaletteListenersRegistered = false;
let themePaletteHideTimeout: number | null = null;
let previewThemeId: string | null = null;



export function getPhaseDisplayName(phase: Phase): string {
    switch (phase) {
        case 'IntroIllustrate': return "Teaching";
        case 'Socratic': return "Exploration";
        case 'Solidify': return "Wrap Up";
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
    const setStatusLines = (
        moduleLine: string,
        phaseLabel: string,
        options?: {
            conceptTitle?: string;
            moduleTitleTooltip?: string;
            phaseTooltip?: string;
            conceptTooltip?: string;
            chunkLabel?: string;
        }
    ) => {
        if (!curriculumStatusTopic) {
            return;
        }
        curriculumStatusTopic.textContent = '';
        const moduleSpan = document.createElement('span');
        moduleSpan.className = 'status-module';
        if (options?.moduleTitleTooltip) {
            moduleSpan.title = options.moduleTitleTooltip;
        }
        moduleSpan.textContent = moduleLine;
        const conceptTitle = options?.conceptTitle;
        const chunkLabel = options?.chunkLabel ?? null;
        if (conceptTitle) {
            const phaseLine = document.createElement('span');
            phaseLine.className = 'status-phase-line';
            const phaseSpan = document.createElement('span');
            phaseSpan.className = 'status-phase';
            phaseSpan.textContent = phaseLabel;
            if (options?.phaseTooltip) {
                phaseSpan.title = options.phaseTooltip;
            }
            const separatorSpan = document.createElement('span');
            separatorSpan.className = 'status-phase-separator';
            separatorSpan.textContent = '–';
            const conceptSpan = document.createElement('span');
            conceptSpan.className = 'status-concept';
            conceptSpan.textContent = conceptTitle;
            if (options?.conceptTooltip) {
                conceptSpan.title = options.conceptTooltip;
            }
            phaseLine.appendChild(phaseSpan);
            phaseLine.appendChild(separatorSpan);
            phaseLine.appendChild(conceptSpan);
            if (chunkLabel) {
                const chunkSpan = document.createElement('span');
                chunkSpan.className = 'status-chunk';
                chunkSpan.textContent = chunkLabel;
                phaseLine.appendChild(chunkSpan);
            }
            curriculumStatusTopic.appendChild(moduleSpan);
            curriculumStatusTopic.appendChild(phaseLine);
        } else {
            const phaseSpan = document.createElement('span');
            phaseSpan.className = 'status-phase';
            phaseSpan.textContent = phaseLabel;
            if (options?.phaseTooltip) {
                phaseSpan.title = options.phaseTooltip;
            }
            curriculumStatusTopic.appendChild(moduleSpan);
            curriculumStatusTopic.appendChild(phaseSpan);
        }
    };
    if (curriculumItem && currentPhase) {
        const moduleTitle = curriculumItem.moduleTitle;
        const phaseLabel = getPhaseDisplayName(currentPhase);
        const conceptTitle = curriculumItem.concept?.title?.trim();
        const chunkInfo = (() => {
            if (!appCurriculumState || appCurriculumState.isCompleted) {
                return null;
            }
            if (!Array.isArray(appCurriculumState.teachingPlanForPhase)) {
                return null;
            }
            const index = appCurriculumState.currentTeachingChunkIndex;
            if (typeof index !== 'number') {
                return null;
            }
            const total = appCurriculumState.teachingPlanForPhase.length;
            if (total <= 0) {
                return null;
            }
            if (index < 0 || index >= total) {
                return null;
            }
            return { current: index + 1, total };
        })();
        const options = {
            moduleTitleTooltip: moduleTitle,
            phaseTooltip: phaseLabel,
            ...(conceptTitle
                ? {
                    conceptTitle,
                    conceptTooltip: conceptTitle,
                    ...(chunkInfo ? { chunkLabel: `Chunk ${chunkInfo.current}/${chunkInfo.total}` } : {})
                  }
                : {})
        };
        setStatusLines(moduleTitle, phaseLabel, options);

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

    } else {
        if (appCurriculum && appCurriculumState?.isCompleted) {
            setStatusLines('Curriculum Completed', 'Congratulations! 🎉');
        } else if (appIsCurriculumLoaded && !appCurriculumState) {
            setStatusLines('Ready to Begin', 'Select a module to get started');
        } else if (appIsCurriculumLoaded) {
            setStatusLines('Curriculum Loaded', 'Ask Sensei to begin');
        } else if (!appIsCurriculumLoaded && !(process.env.API_KEY)) {
            setStatusLines('API Key Missing', 'Set API_KEY to continue');
        } else {
            setStatusLines('Loading Curriculum…', 'Preparing your journey');
        }
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

    // Update concept navigation arrows visibility
    updateConceptNavigationArrowsUI(appCurriculumState, appCurriculum);
}

function updateConceptNavigationArrowsUI(state: CurriculumState | null, curriculum: Curriculum | null) {
    if (!conceptNavPrevButton || !conceptNavNextButton || !chunkNavPrevButton || !chunkNavNextButton) {
        return;
    }

    // Concept navigation visibility
    if (!state || !curriculum || state.currentPhase !== 'IntroIllustrate') {
        conceptNavPrevButton.style.display = 'none';
        conceptNavNextButton.style.display = 'none';
    } else {
        const module = curriculum.modules[state.currentModuleIndex];
        if (!module) {
            conceptNavPrevButton.style.display = 'none';
            conceptNavNextButton.style.display = 'none';
        } else {
            conceptNavPrevButton.style.display = 'flex';
            conceptNavNextButton.style.display = 'flex';
            conceptNavPrevButton.disabled = state.currentConceptIndex <= 0;
            conceptNavNextButton.disabled = state.currentConceptIndex >= module.concepts.length - 1;
        }
    }

    // Chunk navigation visibility
    if (!state || !state.teachingPlanForPhase || state.teachingPlanForPhase.length <= 1 || state.currentTeachingChunkIndex === undefined) {
        chunkNavPrevButton.style.display = 'none';
        chunkNavNextButton.style.display = 'none';
    } else {
        chunkNavPrevButton.style.display = 'flex';
        chunkNavNextButton.style.display = 'flex';
        chunkNavPrevButton.disabled = state.currentTeachingChunkIndex <= 0;
        chunkNavNextButton.disabled = state.currentTeachingChunkIndex >= state.teachingPlanForPhase.length - 1;
    }
}

interface ModalPromptOptions {
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel?: string;
}

function showModalPrompt(options: ModalPromptOptions): Promise<boolean> {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'chunk-reset-modal-backdrop';
        const modal = document.createElement('div');
        modal.className = 'chunk-reset-modal';
        const title = document.createElement('h3');
        title.textContent = options.title;
        const body = document.createElement('p');
        body.innerHTML = options.body;
        const actions = document.createElement('div');
        actions.className = 'chunk-reset-actions';
        const cleanup = (result: boolean) => {
            resolve(result);
            document.body.removeChild(backdrop);
        };
        if (options.cancelLabel) {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'chunk-reset-cancel';
            cancelButton.textContent = options.cancelLabel;
            cancelButton.addEventListener('click', () => cleanup(false));
            actions.appendChild(cancelButton);
        }
        const confirmButton = document.createElement('button');
        confirmButton.className = 'chunk-reset-confirm';
        confirmButton.textContent = options.confirmLabel;
        confirmButton.addEventListener('click', () => cleanup(true));
        actions.appendChild(confirmButton);
        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(actions);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) {
                cleanup(false);
            }
        });
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    });
}

function showChunkResetConfirmation(chunkIndex: number): Promise<boolean> {
    return showModalPrompt({
        title: 'Reset chunk understanding?',
        body: `This will clear understanding scores and KC awards for chunk ${chunkIndex + 1}. Continue?`,
        confirmLabel: 'Reset Chunk',
        cancelLabel: 'Cancel'
    });
}

function showConceptAdvanceConfirmation(conceptTitle: string | null, chunkIndex: number): Promise<boolean> {
    return showModalPrompt({
        title: 'Advance to next concept?',
        body: `All chunks for <strong>${conceptTitle || 'this concept'}</strong> are understood. Move on to the next concept?`,
        confirmLabel: 'Advance',
        cancelLabel: 'Stay Here'
    });
}

export function showImportFailureModal(message: string): Promise<void> {
    return showModalPrompt({
        title: 'Import failed',
        body: message,
        confirmLabel: 'OK'
    }).then(() => undefined);
}

function areAllChunksUnderstood(
    curriculumState: CurriculumState,
    learnerModel: LearnerModel | undefined,
    targetChunkIndex: number,
    targetState: boolean
): boolean {
    if (!curriculumState.teachingPlanForPhase || curriculumState.teachingPlanForPhase.length === 0) {
        return false;
    }
    return curriculumState.teachingPlanForPhase.every((chunk, index) => {
        if (!Array.isArray(chunk) || chunk.length === 0) {
            return true;
        }
        const consideredState = index === targetChunkIndex ? targetState : chunk.every(point => {
            const score = learnerModel?.contentPointsCoverage?.[point.text]?.understanding_score || 0;
            return score >= 0.99;
        });
        return consideredState;
    });
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
    const overlayElement = meditationOverlay ?? (document.getElementById('sensei-meditation-overlay') as HTMLDivElement | null);
    const actionItemsElement = meditationActionItems ?? (document.getElementById('meditation-action-items') as HTMLDivElement | null);

    if (!overlayElement || !actionItemsElement) {
        return;
    }

    meditationOverlay = overlayElement;
    meditationActionItems = actionItemsElement;

    const overlay = overlayElement;
    const actionItems = actionItemsElement;

    if (!isVisible) {
        hideMeditationOverlay();
        return;
    }

    if (!curriculumState || !curriculumState.teachingPlanForPhase || curriculumState.currentTeachingChunkIndex === undefined) {
        return;
    }

    const learnerModel = (window as any).learnerModel as LearnerModel | undefined;
    const currentChunk = curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex];
    if (!currentChunk || !Array.isArray(currentChunk)) {
        return;
    }

    // Clear existing content
    actionItems.innerHTML = '';
    
    // Update chunk progress indicator
    const totalChunks = curriculumState.teachingPlanForPhase.length;
    const currentChunkNumber = curriculumState.currentTeachingChunkIndex + 1; // Convert to 1-based indexing
    
    // Find or create the chunk progress element
    let chunkProgress = overlay.querySelector('.meditation-chunk-progress') as HTMLElement;
    if (!chunkProgress) {
        chunkProgress = document.createElement('div');
        chunkProgress.className = 'meditation-chunk-progress';
        const meditationHeader = overlay.querySelector('.meditation-header');
        if (meditationHeader) {
            meditationHeader.appendChild(chunkProgress);
        }
    }
    
    // Update the progress text with "Chunk" label - make it clickable
    chunkProgress.innerHTML = `
        <button class="chunk-progress-button" title="Click to view all chunks">
            <span class="chunk-label">Chunk</span>
            <span class="chunk-current">${currentChunkNumber}</span>
            <span class="chunk-separator">/</span>
            <span class="chunk-total">${totalChunks}</span>
        </button>
    `;

    // Add click handler to toggle view
    const progressButton = chunkProgress.querySelector('.chunk-progress-button') as HTMLButtonElement;
    if (progressButton) {
        progressButton.onclick = (e) => {
            e.stopPropagation();
            meditationHoverState.showAllChunks = !meditationHoverState.showAllChunks;
            updateSenseiMeditationOverlay(curriculumState, true);
        };
    }

    // Check if we should show all chunks or just current chunk
    if (meditationHoverState.showAllChunks) {
        // Show all chunks as cards
        actionItems.classList.add('all-chunks-view');

        curriculumState.teachingPlanForPhase.forEach((chunk, chunkIndex) => {
            const chunkCard = document.createElement('div');
            chunkCard.className = 'chunk-card';
            if (chunkIndex === curriculumState.currentTeachingChunkIndex) {
                chunkCard.classList.add('current-chunk');
            }
            chunkCard.onclick = (event) => {
                event.stopPropagation();
                if (typeof window.switchToChunk === 'function') {
                    meditationHoverState.showAllChunks = false;
                    window.switchToChunk(chunkIndex).catch(error => logger.error('[CHUNK_SWITCH] Chunk click failed', error));
                }
            };

            const chunkUnderstood = learnerModel ? chunk.every(point => {
                const score = learnerModel.contentPointsCoverage?.[point.text]?.understanding_score || 0;
                return score >= 0.99;
            }) : false;

            // Create chunk header
            const chunkHeader = document.createElement('div');
            chunkHeader.className = 'chunk-card-header';
            chunkHeader.innerHTML = `
                <span class="chunk-card-title">Chunk ${chunkIndex + 1}</span>
                ${chunkIndex === curriculumState.currentTeachingChunkIndex ? '<span class="current-indicator">Current</span>' : ''}
            `;

            const checkboxLabel = document.createElement('label');
            checkboxLabel.className = 'chunk-understood-toggle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = chunkUnderstood;
            checkbox.addEventListener('click', event => event.stopPropagation());
            checkbox.addEventListener('change', async () => {
                const nextState = checkbox.checked;
                if (!nextState) {
                    const confirmed = await showChunkResetConfirmation(chunkIndex);
                    if (!confirmed) {
                        checkbox.checked = true;
                        return;
                    }
                }
                const curriculumStateRef = curriculumState;
                const learnerModelRef = learnerModel;
                let advanceAfterOverride = false;
                if (nextState && curriculumStateRef) {
                    const willComplete = areAllChunksUnderstood(curriculumStateRef, learnerModelRef, chunkIndex, true);
                    if (willComplete) {
                        const curriculumData = getLoadedCurriculum();
                        const module = curriculumData?.modules?.[curriculumStateRef.currentModuleIndex];
                        const conceptTitle = module?.concepts?.[curriculumStateRef.currentConceptIndex]?.title || null;
                        const advanceConfirmed = await showConceptAdvanceConfirmation(conceptTitle, chunkIndex);
                        if (!advanceConfirmed) {
                        checkbox.checked = false;
                        return;
                    }
                    advanceAfterOverride = true;
                }
                }
                if (typeof window.overrideChunkUnderstanding === 'function') {
                    try {
                        await window.overrideChunkUnderstanding({ chunkIndex, understood: nextState });
                        if (nextState && advanceAfterOverride && typeof window.advanceConceptFromChunk === 'function') {
                            await window.advanceConceptFromChunk();
                        }
                    } catch (error) {
                        logger.error('[CHUNK_CHECK] Override failed from checkbox', error);
                        checkbox.checked = !nextState;
                    }
                }
            });
            const checkboxText = document.createElement('span');
            checkboxText.textContent = 'Understood';
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxText);
            chunkHeader.appendChild(checkboxLabel);
            chunkCard.appendChild(chunkHeader);

            // Create chunk items container
            const chunkItems = document.createElement('div');
            chunkItems.className = 'chunk-card-items';

            // Add action items for this chunk
            chunk.forEach((teachingPoint, pointIndex) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'chunk-card-item';

                // Determine state if this is the current chunk
                if (chunkIndex === curriculumState.currentTeachingChunkIndex) {
                    const coveredPoints = curriculumState.coveredPointsInCurrentChunk || new Set();
                    if (coveredPoints.has(teachingPoint.text)) {
                        itemDiv.classList.add('understood');
                    } else {
                        itemDiv.classList.add('in-progress');
                    }
                } else if (chunkIndex < curriculumState.currentTeachingChunkIndex) {
                    // Past chunks are completed
                    itemDiv.classList.add('understood');
                } else {
                    // Future chunks are pending
                    itemDiv.classList.add('pending');
                }

                itemDiv.innerHTML = `
                    <div class="chunk-item-bullet"></div>
                    <div class="chunk-item-text">${teachingPoint.text}</div>
                `;
                chunkItems.appendChild(itemDiv);
            });

            chunkCard.appendChild(chunkItems);
            actionItems.appendChild(chunkCard);
        });
    } else {
        // Show single chunk (current behavior)
        actionItems.classList.remove('all-chunks-view');

        const coveredPoints = curriculumState.coveredPointsInCurrentChunk || new Set();
        const pointsToRevisit = curriculumState.pointsToRevisitInCurrentChunk || new Set();

        let understoodCount = 0;
        let inProgressCount = 0;

        // Create action item elements
        currentChunk.forEach((teachingPoint, index) => {
            const actionItemDiv = document.createElement('div');
            actionItemDiv.className = 'action-item';

            // Determine state
            const pointScore = learnerModel?.contentPointsCoverage?.[teachingPoint.text]?.understanding_score || 0;
            const isCovered = coveredPoints.has(teachingPoint.text) || pointScore >= 0.7;
            if (isCovered) {
                understoodCount++;
                actionItemDiv.classList.add('understood');
            } else {
                // Default uncovered items to in-progress state
                inProgressCount++;
                actionItemDiv.classList.add('in-progress');
                if (pointsToRevisit.has(teachingPoint.text)) {
                    actionItemDiv.classList.add('needs-review');
                }
            }

            actionItemDiv.innerHTML = `
                <div class="action-item-bullet"></div>
                <div class="action-item-text">${teachingPoint.text}</div>
            `;

            actionItems.appendChild(actionItemDiv);
        });
    }

    showMeditationOverlay();
}

function showMeditationOverlay(): void {
    const overlayElement = meditationOverlay;
    const actionItemsElement = meditationActionItems;
    if (!overlayElement || !actionItemsElement) {
        return;
    }

    overlayElement.style.display = 'block';
    overlayElement.style.pointerEvents = 'auto';

    overlayElement.onmouseenter = () => {
        meditationHoverState.isOverOverlay = true;
        if (meditationHoverState.hoverTimeout) {
            clearTimeout(meditationHoverState.hoverTimeout);
            meditationHoverState.hoverTimeout = null;
        }
    };

    overlayElement.onmouseleave = () => {
        meditationHoverState.isOverOverlay = false;
        if (!meditationHoverState.isOverBrand && !meditationHoverState.isOverOverlay) {
            meditationHoverState.hoverTimeout = window.setTimeout(() => {
                updateSenseiMeditationOverlay(null, false);
                meditationHoverState.hoverTimeout = null;
            }, 150);
        }
    };

    if (typeof anime !== 'undefined') {
        anime({
            targets: overlayElement,
            translateY: ['-20px', '0px'],
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 600,
            easing: 'easeOutExpo',
            complete: () => {
                anime({
                    targets: '.meditation-overlay .action-item',
                    translateY: ['15px', '0px'],
                    opacity: [0, 1],
                    scale: [0.8, 1],
                    duration: 500,
                    delay: anime.stagger(80, { start: 200 }),
                    easing: 'spring(1, 80, 10, 0)'
                });
            }
        });
    } else {
        overlayElement.classList.add('visible');
    }
}

function hideMeditationOverlay(): void {
    const overlayElement = meditationOverlay;
    if (!overlayElement) {
        return;
    }

    if (meditationHoverState.hoverTimeout) {
        clearTimeout(meditationHoverState.hoverTimeout);
        meditationHoverState.hoverTimeout = null;
    }

    meditationHoverState.showAllChunks = false;

    if (typeof anime !== 'undefined') {
        anime({
            targets: overlayElement,
            translateY: [0, '-15px'],
            scale: [1, 0.95],
            opacity: [1, 0],
            duration: 400,
            easing: 'easeInQuart',
            complete: () => {
                overlayElement.style.display = 'none';
                overlayElement.style.pointerEvents = 'none';
                overlayElement.classList.remove('visible');
            }
        });
    } else {
        overlayElement.classList.remove('visible');
        setTimeout(() => {
            overlayElement.style.display = 'none';
            overlayElement.style.pointerEvents = 'none';
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

type CodeBlockEnhancementContext = {
    sender?: string;
    messageId?: string;
};

function addCopyButtonsToCodeBlocks_internal(containerElement: HTMLElement, context: CodeBlockEnhancementContext = {}) {
    const preElements = containerElement.querySelectorAll('pre');
    preElements.forEach(preEl => {
        const codeElement = preEl.querySelector('code');
        if (!codeElement) {
            return;
        }
        const languageClass = Array.from(codeElement.classList).find(className => className.startsWith('language-')) || '';
        const language = languageClass ? languageClass.substring('language-'.length) : '';
        const normalizedLanguage = language.toLowerCase();
        const languageLabel = language.toUpperCase();
        const bubble = preEl.closest('.message-bubble') as HTMLElement | null;
        const effectiveSender = context.sender ?? bubble?.dataset.sender ?? '';
        const effectiveMessageId = context.messageId ?? bubble?.id ?? '';
        const showOpenButton = effectiveSender === 'sensei' && normalizedLanguage === 'cpp';

        const buttonContainer = getOrCreateButtonContainer(preEl);

        if (!buttonContainer.querySelector('.copy-code-button')) {
            const copyButton = document.createElement('button');
            copyButton.type = 'button';
            copyButton.textContent = 'Copy';
            copyButton.className = 'copy-code-button';
            copyButton.setAttribute('aria-label', 'Copy code to clipboard');

            copyButton.addEventListener('click', async () => {
                if (codeElement.textContent) {
                    try {
                        await navigator.clipboard.writeText(codeElement.textContent);
                        copyButton.textContent = 'Copied!';
                        copyButton.disabled = true;
                        setTimeout(() => {
                            copyButton.textContent = 'Copy';
                            copyButton.disabled = false;
                        }, 2000);
                    } catch (err) {
                        logger.error('Failed to copy code: ', err);
                        copyButton.textContent = 'Error';
                        copyButton.disabled = true;
                        setTimeout(() => {
                            copyButton.textContent = 'Copy';
                            copyButton.disabled = false;
                        }, 2000);
                    }
                }
            });
            buttonContainer.appendChild(copyButton);
        }

        if (showOpenButton && !buttonContainer.querySelector('.open-in-editor-button')) {
            const openButton = document.createElement('button');
            openButton.type = 'button';
            openButton.textContent = 'Edit';
            openButton.className = 'open-in-editor-button';
            openButton.setAttribute('aria-label', 'Open code in editor');

            openButton.addEventListener('click', () => {
                const snippet = codeElement.textContent ?? '';
                setCodeEditorContentAndOpen(snippet);
            });
            buttonContainer.appendChild(openButton);
        }
    });
}

function getEnhanceButton(messageId: string): HTMLButtonElement | null {
    const bubble = document.getElementById(messageId);
    if (!bubble) {
        return null;
    }
    return bubble.querySelector<HTMLButtonElement>('.enhance-button');
}

export async function renderEnhancedMarkdown(messageId: string, markdown: string, highlights: EnhancementHighlight[] = [], options?: RenderMarkdownOptions): Promise<void> {
    const bubble = document.getElementById(messageId) as HTMLDivElement | null;
    if (!bubble) {
        logger.error('[ENHANCE] Bubble not found for render', { messageId });
        return;
    }
    const messageText = bubble.querySelector('.message-text') as HTMLDivElement | null;
    if (!messageText) {
        logger.error('[ENHANCE] Message text container missing', { messageId });
        return;
    }
    streamingMessagesRawText.set(messageId, markdown);
    const sanitizedText = sanitizeMarkdownFences(markdown);
    messageText.innerHTML = parseSanitizedMarkdown(sanitizedText);
    renderIcons(messageText);
            try {
                messageText.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                    hljs.highlightElement(block as HTMLElement);
                });
            } catch (highlightError) {
                logger.warn('[UI] Code highlighting failed; rendering without HLJS', { error: (highlightError as Error)?.message });
            }
    if (options?.skipMermaidProcessing) {
        await processMermaidBlocks(messageId, { skipRecovery: true });
    } else {
        await processMermaidBlocks(messageId);
    }
    addLanguageDisplayToCodeBlocks_internal(messageText);
    addCopyButtonsToCodeBlocks_internal(messageText, { sender: 'sensei', messageId });
    attachSenseiBoldInteractions(messageText);
    if (highlights.length > 0) {
        applyEnhancementHighlights(messageText, highlights);
    }
}

export function setEnhanceLoadingState(messageId: string, isLoading: boolean): void {
    const button = getEnhanceButton(messageId);
    const bubble = document.getElementById(messageId) as HTMLDivElement | null;
    if (!bubble) {
        return;
    }
    bubble.dataset.enhanceLoading = isLoading ? 'true' : 'false';
    if (!button) {
        return;
    }
    button.disabled = isLoading;
    button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    button.classList.toggle('is-loading', isLoading);
}

export function setEnhanceActiveState(messageId: string, isActive: boolean): void {
    const button = getEnhanceButton(messageId);
    const bubble = document.getElementById(messageId) as HTMLDivElement | null;
    if (!bubble) {
        return;
    }
    bubble.dataset.enhanced = isActive ? 'true' : 'false';
    if (!button) {
        return;
    }
    button.disabled = false;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('is-active', isActive);
}

function applyEnhancementHighlights(container: HTMLElement, highlights: EnhancementHighlight[]): void {
    for (const highlight of highlights) {
        if (highlight.insertType === 'append') {
            highlightAppendAfterKey(container, highlight.key, highlight.value, highlight.occurrence);
        } else {
            highlightParagraphAfterKey(container, highlight.key, highlight.value, highlight.occurrence);
        }
    }
}

function createEnhancementTextWalker(root: HTMLElement): TreeWalker {
    return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) {
                return NodeFilter.FILTER_REJECT;
            }
            if (parent.closest('pre')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });
}

function highlightAppendAfterKey(root: HTMLElement, key: string, value: string, occurrence: number): void {
    const rangeInfo = locateEnhancementRange(root, key, value, occurrence);
    if (!rangeInfo) {
        return;
    }
    const success = surroundEnhancementRange(rangeInfo, 'enhance-highlight-inline');
    if (!success) {
        return;
    }
}

function highlightParagraphAfterKey(root: HTMLElement, key: string, value: string, occurrence: number): void {
    const rangeInfo = locateEnhancementRange(root, key, value, occurrence);
    if (!rangeInfo) {
        return;
    }
    const wrapped = surroundEnhancementRange(rangeInfo, 'enhance-highlight-paragraph-inline');
    if (!wrapped) {
        const block = rangeInfo.startInfo.node.parentElement?.closest('p, div, li, section, article') as HTMLElement | null;
        if (block) {
            block.classList.add('enhance-highlight-paragraph');
        }
    }
}

type TextNodeInfo = {
    node: Text;
    start: number;
    end: number;
};

function stripMarkdownInline(text: string): string {
    return text.replace(/[\*`_]/g, '');
}

function collectEnhancementTextNodes(root: HTMLElement): { nodes: TextNodeInfo[]; text: string } {
    const nodes: TextNodeInfo[] = [];
    let combined = '';
    const walker = createEnhancementTextWalker(root);
    let current = walker.nextNode() as Text | null;
    while (current) {
        const content = current.textContent ?? '';
        nodes.push({ node: current, start: combined.length, end: combined.length + content.length });
        combined += content;
        current = walker.nextNode() as Text | null;
    }
    return { nodes, text: combined };
}

function findNthOccurrence(text: string, fragment: string, occurrence: number, fromIndex = 0): number {
    if (!fragment) {
        return -1;
    }
    let index = fromIndex;
    let count = 0;
    while (true) {
        const found = text.indexOf(fragment, index);
        if (found === -1) {
            return -1;
        }
        if (count === occurrence) {
            return found;
        }
        count += 1;
        index = found + fragment.length;
    }
}

function findNodeInfoAt(nodes: TextNodeInfo[], offset: number): TextNodeInfo | null {
    for (const info of nodes) {
        if (offset >= info.start && offset < info.end) {
            return info;
        }
    }
    const last = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    if (last && offset === last.end) {
        return last;
    }
    return null;
}

type EnhancementRange = {
    startInfo: TextNodeInfo;
    endInfo: TextNodeInfo;
    startOffset: number;
    endOffset: number;
};

const touchEventSupported = typeof window !== 'undefined' && typeof TouchEvent !== 'undefined';
const pointerEventSupported = typeof window !== 'undefined' && typeof PointerEvent !== 'undefined';

function triggerSenseiBoldSelection(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection) {
        return;
    }
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
    if (selection.toString().length === 0 && typeof selection.selectAllChildren === 'function') {
        selection.selectAllChildren(element);
    }
    const bubble = element.closest('.message-bubble') as HTMLElement | null;
    const target = bubble ?? element;
    window.setTimeout(() => {
        const synthetic = new MouseEvent('mouseup', { bubbles: true });
        target.dispatchEvent(synthetic);
    }, 0);
}

function attachSenseiBoldInteractions(container: HTMLElement) {
    const boldNodes = container.querySelectorAll('strong');
    boldNodes.forEach((node) => {
        const element = node as HTMLElement;
        if (element.dataset.senseiBoldBound === 'true') {
            return;
        }
        const handler = (event: Event) => {
            let permitted = false;
            if (pointerEventSupported && event instanceof PointerEvent) {
                permitted = event.button === 0 && event.isPrimary;
            } else if (event instanceof MouseEvent) {
                permitted = event.button === 0;
            } else if (touchEventSupported && typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
                permitted = true;
            }
            if (!permitted) {
                return;
            }
            event.preventDefault();
            triggerSenseiBoldSelection(element);
        };
        if (pointerEventSupported) {
            element.addEventListener('pointerup', handler);
        }
        element.addEventListener('mouseup', handler);
        if (touchEventSupported) {
            element.addEventListener('touchend', handler);
        }
        element.dataset.senseiBoldBound = 'true';
        element.classList.add('sensei-bold-selectable');
    });
}

function locateEnhancementRange(root: HTMLElement, key: string, value: string, occurrence: number): EnhancementRange | null {
    const sanitizedValue = stripMarkdownInline(value.trim());
    if (!sanitizedValue) {
        return null;
    }
    const { nodes, text } = collectEnhancementTextNodes(root);
    if (!nodes.length) {
        return null;
    }
    const sanitizedKey = stripMarkdownInline(key.trim());
    let searchStart = 0;
    if (sanitizedKey) {
        const keyPos = findNthOccurrence(text, sanitizedKey, occurrence);
        if (keyPos === -1) {
            return null;
        }
        searchStart = keyPos + sanitizedKey.length;
    }
    const valuePos = text.indexOf(sanitizedValue, searchStart);
    if (valuePos === -1) {
        return null;
    }
    const valueEnd = valuePos + sanitizedValue.length;
    const startInfo = findNodeInfoAt(nodes, valuePos);
    const endInfo = findNodeInfoAt(nodes, valueEnd - 1 >= valuePos ? valueEnd - 1 : valuePos);
    if (!startInfo || !endInfo) {
        return null;
    }
    return {
        startInfo,
        endInfo,
        startOffset: valuePos,
        endOffset: valueEnd
    };
}

function surroundEnhancementRange(rangeInfo: EnhancementRange, className: string): boolean {
    const range = document.createRange();
    range.setStart(rangeInfo.startInfo.node, rangeInfo.startOffset - rangeInfo.startInfo.start);
    range.setEnd(rangeInfo.endInfo.node, rangeInfo.endOffset - rangeInfo.endInfo.start);
    const span = document.createElement('span');
    span.className = className;
    try {
        range.surroundContents(span);
        return true;
    } catch (error) {
        try {
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
            return true;
        } catch (innerError) {
            logger.warn('[ENHANCE] Unable to apply multi-node highlight span', { error: innerError });
            return false;
        }
    }
}

export async function displayMessage(message: Message, options: DisplayMessageOptions = {}) {
    const targetContainer = options.container ?? messageArea;
    const scrollElement = options.scrollTarget ?? targetContainer;
    const registry = options.registry ?? defaultMessageRegistry;

    if (!targetContainer) {
        logger.error('[UI] displayMessage called without a target container', { messageId: message.id });
        return;
    }

    if (!options.container && message.id === 'response-modal-sensei-bubble') {
        logger.warn('[UI] Attempted to display response modal as a message - skipping');
        return;
    }

    if (options.container) {
        logger.info('[SEL_FOLLOWUP] render-target', {
            target: options.container.id || 'anonymous-container',
            messageId: message.id,
        });
    }

    const existingBubble = document.getElementById(message.id) as HTMLDivElement | null;
    const bubble = existingBubble || document.createElement('div');
    const isNewBubble = !existingBubble;
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

    if (!message.isLoading && message.sender === 'sensei') {
        bubble.dataset.enhanced = 'false';
        bubble.dataset.enhanceLoading = 'false';
        resetEnhancementState(message.id);
    }

    if (message.isLoading) {
        bubble.classList.add('loading');
        const thinkingArea = document.createElement('div');
        thinkingArea.classList.add('thinking-indicator');
        // The blinking cursor will serve as the thinking indicator
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
        messageText.appendChild(thinkingArea);

        const oldTimerId = registry.timers.get(message.id);
        if (oldTimerId) clearInterval(oldTimerId);
        const timerId = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            timerSpan.textContent = `(${elapsed}s)`;
        }, 1000);
        registry.timers.set(message.id, timerId);
        registry.rawText.set(message.id, ''); // Initialize raw text for loading message
        let dotCount = 1;
        const dotAnimation = window.setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            dotsSpan.textContent = '.'.repeat(dotCount);
        }, 500);
        (bubble as any).dotAnimation = dotAnimation;
    } else {
        bubble.removeAttribute('data-typing');
        bubble.classList.remove('loading');
        const oldTimerId = registry.timers.get(message.id);
        if (oldTimerId) {
            clearInterval(oldTimerId);
            registry.timers.delete(message.id);
        }
        const dotAnimation = (bubble as any).dotAnimation;
        if (dotAnimation) {
            clearInterval(dotAnimation);
            delete (bubble as any).dotAnimation;
        }

        // Clear phase loading animations if they exist
        if ((bubble as any).dotAnimation) {
            clearInterval((bubble as any).dotAnimation);
            delete (bubble as any).dotAnimation;
        }
        if ((bubble as any).messageAnimation) {
            clearInterval((bubble as any).messageAnimation);
            delete (bubble as any).messageAnimation;
        }

        const appCurriculum = getLoadedCurriculum();
        if (message.sender === 'sensei' && message.text.includes("**Available Modules:**") && appCurriculum && appCurriculum.modules) {
            const parts = message.text.split("**Available Modules:**");
            const introTextPart = parts[0] + "**Available Modules:**";
            const introHtml = parseSenseiMarkdown(introTextPart.trim());

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
                                p.innerHTML = parseSenseiMarkdown(line);
                                moduleListContainer.appendChild(p);
                            }
                        } else {
                            const p = document.createElement('p');
                            p.innerHTML = parseSenseiMarkdown(line);
                            moduleListContainer.appendChild(p);
                        }
                    } else if (line.trim().length > 0) {
                        const p = document.createElement('p');
                        p.innerHTML = parseSenseiMarkdown(line);
                        moduleListContainer.appendChild(p);
                    }
                });
            }
            messageText.appendChild(moduleListContainer);
            streamingMessagesRawText.set(message.id, message.text); // Store original raw text
        } else if (message.sender === 'sensei' && message.phaseSelectionEnabled) {
            // Handle phase selection display
            const phases = [
                { name: 'IntroIllustrate', display: 'Teaching', description: 'Learn core concepts with clear explanations and examples' },
                { name: 'Socratic', display: 'Exploration', description: 'Engage in guided discovery through questions and discussion' },
                { name: 'Solidify', display: 'Wrap Up', description: 'Reinforce understanding and prepare for next steps' }
            ];
            
            // Display the message text
            const sanitizedText = sanitizeMarkdownFences(message.text);
            messageText.innerHTML = parseSanitizedMarkdown(sanitizedText);
            
            // Create phase buttons container
            const phaseButtonsContainer = document.createElement('div');
            phaseButtonsContainer.classList.add('phase-buttons-container');
            
            phases.forEach(phase => {
                const button = document.createElement('button');
                button.classList.add('phase-button');
                button.classList.add(`phase-${phase.name.toLowerCase()}`);
                button.dataset.phase = phase.name;
                
                button.textContent = phase.display;
                
                button.addEventListener('click', () => {
                    if (typeof (window as any).handlePhaseSelection === 'function') {
                        (window as any).handlePhaseSelection(phase.name);
                    }
                });
                
                phaseButtonsContainer.appendChild(button);
            });
            
            messageText.appendChild(phaseButtonsContainer);
            streamingMessagesRawText.set(message.id, message.text);
        } else if (message.sender === 'sensei' && message.phaseLoadingAnimation) {
            // Handle phase loading animation
            const loadingContainer = document.createElement('div');
            loadingContainer.classList.add('phase-loading-container');
            
            const spinner = document.createElement('div');
            spinner.classList.add('phase-loading-spinner');
            
            const loadingText = document.createElement('div');
            loadingText.classList.add('phase-loading-text');
            
            // Array of loading messages
            const loadingMessages = [
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
            
            // Animate dots
            let dotCount = 1;
            const dotAnimation = setInterval(() => {
                dotCount = (dotCount % 3) + 1;
                dots.textContent = '.'.repeat(dotCount);
            }, 500);
            
            // Store reference to text span for updates
            (loadingText as any).textSpan = textSpan;
            
            // Cycle through messages
            const messageAnimation = setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                const newMessage = loadingMessages[messageIndex] ?? '';

                if ((loadingText as any).textSpan) {
                    (loadingText as any).textSpan.textContent = newMessage;
                }
            }, 5000);
            
            // Store animation intervals to clear later
            (bubble as any).dotAnimation = dotAnimation;
            (bubble as any).messageAnimation = messageAnimation;
        } else {
            if (message.sender === 'sensei') {
                // Store raw text for potential selection action later
                if (!registry.rawText.has(message.id) || registry.rawText.get(message.id) !== message.text) {
                   registry.rawText.set(message.id, message.text);
               }
               const sanitizedText = sanitizeMarkdownFences(message.text);
                messageText.innerHTML = parseSanitizedMarkdown(sanitizedText);
            } else {
                registry.rawText.set(message.id, message.text);
                const renderedUserMessage = renderUserMessageHtml(message.text);
                messageText.innerHTML = renderedUserMessage.html;
            }
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
                if (DEBUG_FLAGS.mermaid_debug) {
                    logger.error("Mermaid rendering failed:", error);
                }
                
                // Attempt recovery with our two-step approach
                if (!block.getAttribute('data-recovery-attempted')) {
                    block.setAttribute('data-recovery-attempted', 'true');

                    const fixingDiv = document.createElement('div');
                    fixingDiv.className = 'mermaid-error';
                    fixingDiv.style.color = '#f59e0b';
                    fixingDiv.innerHTML = `
                        <span class="inline-spinner"></span> Attempting to fix diagram...
                    `;
                    preElement.replaceWith(fixingDiv);

                    try {
                        const recoveryResult = await runMermaidRecovery({
                            ai: window.ai || null,
                            initialDiagram: rawMermaidCode,
                            initialError: error.message || 'Unknown error',
                            renderAttempt: async (diagram: string) => {
                                const uniqueId = `mermaid-recovery-${message.id}-${Math.random().toString(36).substring(2)}`;
                                return mermaidManager.render(uniqueId, diagram);
                            }
                        });
                        if (recoveryResult) {
                            const replacement = '```mermaid\n' + recoveryResult.diagram + '\n```';
                            replaceMermaidFenceInRaw(message.id, rawMermaidCode, replacement, registry.rawText);
                            renderMermaidThumbnailWithTheme(fixingDiv, recoveryResult.svg, mermaidManager.getCurrentTheme(), recoveryResult.diagram);
                            return;
                        }
                    } catch (fixError) {
                        logger.error('Error during Mermaid recovery:', fixError);
                    }

                    const errorDiv = document.createElement('div');
                    logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                    replaceMermaidFenceInRaw(message.id, rawMermaidCode, "[Sensei's diagram could not be rendered, and automatic fix failed]", registry.rawText);
                    errorDiv.className = 'mermaid-error';
                    errorDiv.textContent = "[Sensei's diagram could not be rendered, and automatic fix failed]";
                    fixingDiv.replaceWith(errorDiv);
                } else {
                    const errorDiv = document.createElement('div');
                    logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                    replaceMermaidFenceInRaw(message.id, rawMermaidCode, "[Sensei's diagram could not be rendered, and automatic fix failed]", registry.rawText);
                    errorDiv.className = 'mermaid-error';
                    errorDiv.textContent = "[Sensei's diagram could not be rendered, and automatic fix failed]";
                    preElement.replaceWith(errorDiv);
                }
            }
        }
        }

        addLanguageDisplayToCodeBlocks_internal(messageText);
        addCopyButtonsToCodeBlocks_internal(messageText, { sender: message.sender, messageId: message.id });
        if (message.sender === 'sensei') {
            attachSenseiBoldInteractions(messageText);
        }
    }
    bubble.appendChild(messageText);

    if (message.sender === 'sensei' && !message.isLoading && message.isReloadable && message.reloadContext) {
        const existingReloadButton = bubble.querySelector('.reload-button');
        if (existingReloadButton) existingReloadButton.remove();

        const reloadButton = document.createElement('button');
        reloadButton.className = 'reload-button';
        reloadButton.innerHTML = `<span class="icon-placeholder" data-icon="reload"></span>`;
        reloadButton.setAttribute('aria-label', 'Reload this response from Sensei');
        reloadButton.title = 'Reload this response';
        reloadButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof (window as any).handleReloadSenseiMessage === 'function') {
                (window as any).handleReloadSenseiMessage(message.id, message.reloadContext);
            } else {
                logger.error('handleReloadSenseiMessage is not defined on window.');
            }
        });
        bubble.appendChild(reloadButton);
        renderIcons(reloadButton);

        const existingEnhanceButton = bubble.querySelector('.enhance-button');
        if (existingEnhanceButton) existingEnhanceButton.remove();

        const enhanceButton = document.createElement('button');
        enhanceButton.className = 'enhance-button';
        enhanceButton.innerHTML = `<span class="icon-placeholder" data-icon="enhance"></span>`;
        enhanceButton.setAttribute('aria-label', 'Enhance this response from Sensei');
        const isActive = bubble.dataset.enhanced === 'true';
        const isLoading = bubble.dataset.enhanceLoading === 'true';
        enhanceButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        enhanceButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        enhanceButton.disabled = isLoading;
        if (isActive) {
            enhanceButton.classList.add('is-active');
        }
        if (isLoading) {
            enhanceButton.classList.add('is-loading');
        }
        enhanceButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const handler = (window as any).handleEnhanceSenseiMessage;
            if (typeof handler === 'function') {
                handler(message.id);
            } else {
                logger.error('handleEnhanceSenseiMessage is not defined on window.');
            }
        });
        bubble.appendChild(enhanceButton);
        renderIcons(enhanceButton);
    }


    const timestamp = document.createElement('div');
    timestamp.classList.add('timestamp');
    timestamp.textContent = message.timestamp.toLocaleTimeString();
    bubble.appendChild(timestamp);

    if (isNewBubble) {
        targetContainer.appendChild(bubble);
    }

    const applySenseiBubbleFallback = () => {
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';
        bubble.dataset.animationState = "idle";
        if (isNewBubble) {
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    };
    const enableAnimateSenseiBubbles = false;
    if (enableAnimateSenseiBubbles) {
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
                        if (scrollElement) {
                            scrollElement.scrollTop = scrollElement.scrollHeight;
                        }
                    }
                },
                complete: () => {
                    bubble.dataset.animationState = "idle";
                }
            });
        } catch (e) {
            applySenseiBubbleFallback();
        }
    } else {
        applySenseiBubbleFallback();
    }
}

export async function updateMessageStream(messageId: string, fullTextSoFar: string) {
    // Skip processing the response modal
    if (messageId === 'response-modal-sensei-bubble') {
        logger.warn('[UI] Skipping response modal in updateMessageStream - should not be processed as a message');
        return;
    }

    const messageBubble = document.getElementById(messageId);
    if (messageBubble) {
        const messageTextElement = messageBubble.querySelector('.message-text') as HTMLDivElement;
        if (messageTextElement) {
            if (streamingMessagesRawText.get(messageId) === '' && messageBubble.classList.contains('loading')) {
                messageTextElement.innerHTML = '';
            }
            streamingMessagesRawText.set(messageId, fullTextSoFar);

            const fullySanitized = sanitizeMarkdownFences(fullTextSoFar);
            const parts = fullySanitized.split(/(```[\s\S]*?```)/g);

            let processedHTML = '';
            let textToAnimate = '';

            parts.forEach(part => {
                if (part.trim().startsWith('```')) {
                    if (textToAnimate) {
                        processedHTML += parseSanitizedMarkdown(textToAnimate);
                        textToAnimate = '';
                    }
                    processedHTML += parseSanitizedMarkdown(part);
                } else {
                    textToAnimate += part;
                }
            });

            if (textToAnimate) {
                 processedHTML += parseSanitizedMarkdown(textToAnimate);
            }

            messageTextElement.innerHTML = processedHTML;

            try {
                messageTextElement.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
                    hljs.highlightElement(block as HTMLElement);
                });
            } catch (highlightError) {
                logger.warn('[UI] Code highlighting failed during stream update', { error: (highlightError as Error)?.message });
            }

            addLanguageDisplayToCodeBlocks_internal(messageTextElement);
            const enhancementContext: CodeBlockEnhancementContext = { messageId };
            const bubbleSender = messageBubble?.dataset.sender;
            if (bubbleSender) {
                enhancementContext.sender = bubbleSender;
            }
            addCopyButtonsToCodeBlocks_internal(messageTextElement, enhancementContext);
            if (bubbleSender === 'sensei') {
                attachSenseiBoldInteractions(messageTextElement);
            }

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
        if (codeEditorButton) codeEditorButton.disabled = true;
    } else {
        if (brandSegment) brandSegment.classList.remove('thinking');
        sendButton.disabled = false;
        userInput.disabled = false;
        if (codeEditorButton) codeEditorButton.disabled = false;
        if (!isCodeEditorModalOpen()) userInput.focus();
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

function applyTheme(option: ThemeOption) {
    setThemeVariables(option);
    currentThemeId = option.id;
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, option.id);
    } catch (_) {
    }
    previewThemeId = null;
    if (themePaletteSwatches.length > 0) {
        setActiveTheme(option.id, themePaletteSwatches);
    }
}

function setActiveTheme(themeId: string, swatches: HTMLButtonElement[]) {
    swatches.forEach(button => {
        if (button.dataset.themeId === themeId) {
            button.dataset.selected = 'true';
        } else {
            button.removeAttribute('data-selected');
        }
    });
}

function clearThemePaletteHideTimeout() {
    if (themePaletteHideTimeout !== null) {
        window.clearTimeout(themePaletteHideTimeout);
        themePaletteHideTimeout = null;
    }
}

function scheduleThemePaletteHide() {
    clearThemePaletteHideTimeout();
    themePaletteHideTimeout = window.setTimeout(() => {
        hideThemePalette();
    }, 150);
}

function positionThemePalette() {
    if (!themePalettePanel || !themePaletteTrigger) return;
    const triggerRect = themePaletteTrigger.getBoundingClientRect();
    const panelRect = themePalettePanel.getBoundingClientRect();
    const offset = 12;
    const viewportMargin = 16;
    const top = triggerRect.bottom + window.scrollY + offset;
    let left = triggerRect.left + (triggerRect.width / 2) - (panelRect.width / 2) + window.scrollX;
    const minLeft = window.scrollX + viewportMargin;
    const maxLeft = window.scrollX + window.innerWidth - panelRect.width - viewportMargin;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = Math.max(minLeft, maxLeft);
    themePalettePanel.style.top = `${top}px`;
    themePalettePanel.style.left = `${left}px`;
}

function setThemePaletteVisibility(visible: boolean) {
    if (!themePalettePanel || !themePaletteTrigger) return;
    clearThemePaletteHideTimeout();
    setControlsExpanded(visible);
    themePalettePanel.dataset.visible = visible ? 'true' : 'false';
    themePalettePanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    themePaletteTrigger.setAttribute('aria-expanded', visible ? 'true' : 'false');
    themePaletteVisible = visible;
    if (visible) {
        positionThemePalette();
        const active = themePaletteSwatches.find(button => button.dataset.themeId === currentThemeId);
        if (active) active.focus();
    } else {
        previewThemeId = null;
        const activeTheme = getThemeOptionById(currentThemeId);
        if (activeTheme) {
            setThemeVariables(activeTheme);
        }
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && themePalettePanel.contains(activeElement) && themePaletteTrigger) {
            themePaletteTrigger.focus();
        }
    }
}

function showThemePalette() {
    setThemePaletteVisibility(true);
}

function hideThemePalette() {
    setThemePaletteVisibility(false);
}

function setupThemePalette() {
    const trigger = document.getElementById('theme-button') as HTMLButtonElement | null;
    if (!trigger) return;

    themePaletteTrigger = trigger;

    if (!themePalettePanel) {
        themePalettePanel = document.createElement('div');
        themePalettePanel.id = 'theme-palette-panel';
        themePalettePanel.className = 'theme-palette-overlay';
        document.body.appendChild(themePalettePanel);
    }

    const panel = themePalettePanel;
    panel.innerHTML = '';
    panel.dataset.visible = 'false';
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const grid = document.createElement('div');
    grid.className = 'theme-palette-grid';
    panel.appendChild(grid);

    const swatches: HTMLButtonElement[] = [];
    THEME_OPTIONS.forEach(option => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'theme-swatch';
        swatch.dataset.themeId = option.id;
        swatch.style.setProperty('--swatch-preview', option.preview);
        swatch.setAttribute('aria-label', option.label);
        swatch.addEventListener('click', () => {
            applyTheme(option);
            hideThemePalette();
        });
        swatch.addEventListener('mouseenter', () => {
            previewThemeId = option.id;
            setThemeVariables(option);
        });
        swatch.addEventListener('mouseleave', () => {
            if (previewThemeId === option.id) {
                previewThemeId = null;
                const activeTheme = getThemeOptionById(currentThemeId);
                if (activeTheme) {
                    setThemeVariables(activeTheme);
                }
            }
        });
        grid.appendChild(swatch);
        swatches.push(swatch);
    });

    themePaletteSwatches = swatches;

    let storedId: string | null = null;
    try {
        storedId = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_) {
        storedId = null;
    }
    const storedOption = storedId ? THEME_OPTIONS.find(option => option.id === storedId) : undefined;
    if (storedOption) {
        applyTheme(storedOption);
    }
    currentThemeId = storedOption ? storedOption.id : currentThemeId;
    setActiveTheme(currentThemeId, swatches);

    trigger.onclick = event => {
        event.stopPropagation();
        if (themePaletteVisible) {
            hideThemePalette();
        } else {
            showThemePalette();
        }
    };

    trigger.addEventListener('mouseenter', () => {
        if (themePaletteVisible) clearThemePaletteHideTimeout();
    });
    trigger.addEventListener('mouseleave', () => {
        if (themePaletteVisible) scheduleThemePaletteHide();
    });

    panel.onclick = event => {
        event.stopPropagation();
    };

    panel.addEventListener('mouseenter', () => {
        if (themePaletteVisible) clearThemePaletteHideTimeout();
    });
    panel.addEventListener('mouseleave', () => {
        if (themePaletteVisible) {
            scheduleThemePaletteHide();
            previewThemeId = null;
            const activeTheme = getThemeOptionById(currentThemeId);
            if (activeTheme) {
                setThemeVariables(activeTheme);
            }
        }
    });

    if (!themePaletteListenersRegistered) {
        document.addEventListener('click', () => {
            if (themePaletteVisible) hideThemePalette();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && themePaletteVisible) {
                hideThemePalette();
                if (themePaletteTrigger) themePaletteTrigger.focus();
            }
        });
        window.addEventListener('resize', () => {
            if (themePaletteVisible) positionThemePalette();
        });
        window.addEventListener('scroll', () => {
            if (themePaletteVisible) positionThemePalette();
        }, { passive: true });
        themePaletteListenersRegistered = true;
    }
}

function setupHeaderEllipsisAnimation() {
    const ellipsis = document.getElementById('controls-ellipsis') as HTMLElement | null;
    if (!ellipsis) return;
    const dots = Array.from(ellipsis.querySelectorAll<SVGCircleElement>('.ellipsis-dot'));
    const plusMark = ellipsis.querySelector<SVGElement>('.ellipsis-plus-svg');
    if (dots.length === 0) return;
    const states = ['.', '..', '...'];
    const cycleLen = 4; // three dots + plus as the 4th frame
    let intervalId: number | null = null;
    let timeoutId: number | null = null;
    let glowTimeoutId: number | null = null;
    const controlsContainer = ellipsis.closest('.chat-window-controls') as HTMLElement | null;
    let isInteractionPaused = false;
    const clearIntervalIfNeeded = () => {
        if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
    };
    const clearTimeoutIfNeeded = () => {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    const clearGlowIfNeeded = () => {
        if (glowTimeoutId !== null) {
            window.clearTimeout(glowTimeoutId);
            glowTimeoutId = null;
        }
        ellipsis.classList.remove('ellipsis-glow');
    };

    const pauseForInteraction = () => {
        if (isInteractionPaused) {
            return;
        }
        isInteractionPaused = true;
        // Pause animation visuals when interacting
        clearIntervalIfNeeded();
        clearTimeoutIfNeeded();
        clearGlowIfNeeded();
        dots.forEach((d) => d.style.opacity = '1');
        if (plusMark) plusMark.style.opacity = '0.3';
    };
    const beginIdle = () => {
        clearTimeoutIfNeeded();
        if (isInteractionPaused) {
            return;
        }
        timeoutId = window.setTimeout(() => {
            if (isInteractionPaused) {
                return;
            }
            startCycle();
        }, 5000);
    };

    const resumeFromInteraction = () => {
        if (!isInteractionPaused) {
            return;
        }
        isInteractionPaused = false;
        // Resume idle cycle after interaction
        beginIdle();
    };
    const triggerGlow = () => {
        clearGlowIfNeeded();
        ellipsis.classList.add('ellipsis-glow');
        // Keep the glow until the next cycle starts; start idle timer
        beginIdle();
    };
    const startCycle = () => {
        clearIntervalIfNeeded();
        clearTimeoutIfNeeded();
        clearGlowIfNeeded();
        if (isInteractionPaused) {
            return;
        }
        let position = 0;
        intervalId = window.setInterval(() => {
            const step = position % cycleLen; // 0,1,2,3
            const count = step < 3 ? step + 1 : 3; // 1,2,3 dots; keep 3 on step 3
            dots.forEach((d, i) => {
                d.style.opacity = i < count ? '1' : '0.2';
            });
            if (plusMark) plusMark.style.opacity = step === 3 ? '0.6' : '0';
            position += 1;
            if (position >= cycleLen) {
                dots.forEach((d) => d.style.opacity = '1');
                if (plusMark) plusMark.style.opacity = '0.6';
                clearIntervalIfNeeded();
                triggerGlow();
            }
        }, 500);
    };
    controlsContainer?.addEventListener('mouseenter', pauseForInteraction);
    controlsContainer?.addEventListener('mouseleave', resumeFromInteraction);
    controlsContainer?.addEventListener('focusin', pauseForInteraction);
    controlsContainer?.addEventListener('focusout', resumeFromInteraction);
    ellipsis.addEventListener('focusin', pauseForInteraction);
    ellipsis.addEventListener('focusout', resumeFromInteraction);

    dots.forEach((d) => d.style.opacity = '1');
    if (plusMark) plusMark.style.opacity = '0.3';
    clearIntervalIfNeeded();
    clearTimeoutIfNeeded();
    clearGlowIfNeeded();
    beginIdle();
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
export async function processMermaidBlocks(messageId: string, options?: { skipRecovery?: boolean }) {
    // Skip processing the response modal
    if (messageId === 'response-modal-sensei-bubble') {
        logger.warn('[MERMAID] Skipping response modal - should not be processed as a message');
        return;
    }

    const messageBubble = document.getElementById(messageId);
    if (!messageBubble) return;

    const messageText = messageBubble.querySelector('.message-text');
    if (!messageText) return;
    const skipRecovery = options?.skipRecovery === true;
    
    const mermaidBlocks = messageText.querySelectorAll('pre code.language-mermaid');
    for (const block of mermaidBlocks) {
        const preElement = block.parentElement as HTMLElement;
        const rawMermaidCodeFromLLM = block.textContent || '';
        const rawMermaidCode = rawMermaidCodeFromLLM;

        if (DEBUG_FLAGS.mermaid_debug) {
            logger.log("Processing Mermaid in phase 2. Raw code is:\n", rawMermaidCode);
        }
        try {
            const { svg } = await mermaidManager.render(`mermaid-${messageId}-${Math.random().toString(36).substring(2)}`, rawMermaidCode);
            renderMermaidThumbnailWithTheme(preElement, svg, mermaidManager.getCurrentTheme(), rawMermaidCode);
        } catch (error: any) {
            if (DEBUG_FLAGS.mermaid_debug) {
                logger.error("Mermaid rendering failed:", error);
            }
            if (skipRecovery) {
                const errorDiv = document.createElement('div');
                logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                replaceMermaidFenceInRaw(messageId, rawMermaidCode, "[Sensei's diagram could not be rendered, and automatic fix failed]");
                errorDiv.className = 'mermaid-error';
                errorDiv.textContent = "[Sensei's diagram could not be rendered, and automatic fix failed]";
                preElement.replaceWith(errorDiv);
                continue;
            }
            if (!block.getAttribute('data-recovery-attempted')) {
                block.setAttribute('data-recovery-attempted', 'true');

                const fixingDiv = document.createElement('div');
                fixingDiv.className = 'mermaid-error';
                fixingDiv.style.color = '#f59e0b';
                fixingDiv.innerHTML = `
                    <span class="inline-spinner"></span> Attempting to fix diagram...
                `;
                preElement.replaceWith(fixingDiv);

                try {
                    const recoveryResult = await runMermaidRecovery({
                        ai: window.ai || null,
                        initialDiagram: rawMermaidCode,
                        initialError: error.message || 'Unknown error',
                        renderAttempt: async (diagram: string) => {
                            const uniqueId = `mermaid-recovery-${messageId}-${Math.random().toString(36).substring(2)}`;
                            return mermaidManager.render(uniqueId, diagram);
                        }
                    });
                    if (recoveryResult) {
                        const replacement = '```mermaid\n' + recoveryResult.diagram + '\n```';
                        replaceMermaidFenceInRaw(messageId, rawMermaidCode, replacement);
                        renderMermaidThumbnailWithTheme(fixingDiv, recoveryResult.svg, mermaidManager.getCurrentTheme(), recoveryResult.diagram);
                        continue;
                    }
                } catch (fixError) {
                    logger.error('Error during Mermaid recovery:', fixError);
                }

                const errorDiv = document.createElement('div');
                logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                replaceMermaidFenceInRaw(messageId, rawMermaidCode, "[Sensei's diagram could not be rendered, and automatic fix failed]");
                errorDiv.className = 'mermaid-error';
                errorDiv.textContent = "[Sensei's diagram could not be rendered, and automatic fix failed]";
                fixingDiv.replaceWith(errorDiv);
            } else {
                const errorDiv = document.createElement('div');
                logger.debug('[MERMAID_FAILOVER] Logging failed diagram codeblock:\n', rawMermaidCode);
                replaceMermaidFenceInRaw(messageId, rawMermaidCode, "[Sensei's diagram could not be rendered, and automatic fix failed]");
                errorDiv.className = 'mermaid-error';
                errorDiv.textContent = "[Sensei's diagram could not be rendered, and automatic fix failed]";
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
    const newTheme = themes[nextIndex] ?? currentTheme;
    
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
    setupThemePalette();
    setupHeaderEllipsisAnimation();
    setupControlsRevealPersistence();
    setupMermaidThemeControls();
    // Make mermaidManager, DEFAULT_MERMAID_THEME, and updateMermaidThemeClass available globally for mermaid-theme-integration.js
    (window as any).mermaidManager = mermaidManager;
    (window as any).DEFAULT_MERMAID_THEME = DEFAULT_MERMAID_THEME;
    (window as any).updateMermaidThemeClass = updateMermaidThemeClass;

    setupTextareaAutosize(mainUserInput);

    if (codeEditorButton) {
        codeEditorButton.addEventListener('click', () => {
            openCodeEditorModal();
        });
    }

    document.fonts.ready.then(() => {
        setupTextareaAutosize(mainUserInput);
    });

    // Setup liquid metal button mouse tracking
    setupLiquidMetalButton();

    // Setup collapsible footer hover
    setupCollapsibleFooter();

    // Progress bar now uses direct CSS hover for dropdown labels
    
    // Setup brand hover for meditation overlay
    setupBrandHoverMeditationOverlay();
    setupStatusClickMeditationOverlay();
}

function setupControlsRevealPersistence() {
    const controls = document.querySelector('.chat-window-controls') as HTMLElement | null;
    const segment = controls?.closest('.weighted-segment.controls') as HTMLElement | null;
    if (!controls) return;
    let hideTimer: number | null = null;
    const open = () => {
        if (hideTimer !== null) {
            window.clearTimeout(hideTimer);
            hideTimer = null;
        }
        controls.dataset.expanded = 'true';
    };
    const scheduleClose = () => {
        if (hideTimer !== null) {
            window.clearTimeout(hideTimer);
        }
        hideTimer = window.setTimeout(() => {
            delete controls.dataset.expanded;
            hideTimer = null;
        }, 0);
    };
    controls.addEventListener('mouseenter', open);
    if (segment) {
        segment.addEventListener('mouseenter', open);
        segment.addEventListener('mouseleave', scheduleClose);
    }
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

// Note: Status hover expansion removed - progress bar now uses direct CSS hover for dropdown labels

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

// Global state for meditation overlay hover management
let meditationHoverState = {
    isOverBrand: false,
    isOverOverlay: false,
    hoverTimeout: null as number | null,
    showAllChunks: false // Toggle between single chunk and all chunks view
};

function setupBrandHoverMeditationOverlay(): void {
    if (!brandSegment) {
        logger.error('Brand segment not found for meditation overlay setup');
        return;
    }

    brandSegment.addEventListener('mouseenter', () => {
        meditationHoverState.isOverBrand = true;
        // Clear any existing timeout
        if (meditationHoverState.hoverTimeout) {
            clearTimeout(meditationHoverState.hoverTimeout);
            meditationHoverState.hoverTimeout = null;
        }

        // Get current curriculum state from global scope if available
        const curriculumState = (window as any).curriculumState || null;
        updateSenseiMeditationOverlay(curriculumState, true);
    });

    brandSegment.addEventListener('mouseleave', () => {
        meditationHoverState.isOverBrand = false;
        // Check if we should hide (only if not over overlay)
        if (!meditationHoverState.isOverOverlay) {
            meditationHoverState.hoverTimeout = window.setTimeout(() => {
                // Double check before hiding - maybe mouse made it to overlay
                if (!meditationHoverState.isOverOverlay) {
                    updateSenseiMeditationOverlay(null, false);
                }
                meditationHoverState.hoverTimeout = null;
            }, 500); // Increased from 150ms to 500ms
        }
    });
}

function setupStatusClickMeditationOverlay(): void {
    if (!statusSegment) {
        logger.error('[HEADER_CHUNK] Status segment not found for overlay setup');
        return;
    }

    statusSegment.addEventListener('click', event => {
        const target = event.target as HTMLElement | null;
        if (target && (
            target.closest('#concept-nav-prev') ||
            target.closest('#concept-nav-next') ||
            target.closest('#chunk-nav-prev') ||
            target.closest('#chunk-nav-next')
        )) {
            event.stopPropagation();
            return;
        }
        const curriculumState = (window as any).curriculumState || null;
        if (!curriculumState || !curriculumState.teachingPlanForPhase || curriculumState.currentTeachingChunkIndex === undefined) {
            return;
        }
        meditationHoverState.showAllChunks = true;
        updateSenseiMeditationOverlay(curriculumState, true);
    });
}

// Export the check function so it can be called from showMeditationOverlay
function checkAndHideMeditationOverlay() {
    if (!meditationHoverState.isOverBrand && !meditationHoverState.isOverOverlay) {
        meditationHoverState.hoverTimeout = window.setTimeout(() => {
            updateSenseiMeditationOverlay(null, false);
            meditationHoverState.hoverTimeout = null;
        }, 150);
    }
}

// These public functions are now only used by the new selectionSensei.ts module and debugMode.ts
// They are kept here as they are generic UI utilities.
// We rename the internal ones to avoid confusion and export a cleaner interface.
export const addLanguageDisplayToCodeBlocks = addLanguageDisplayToCodeBlocks_internal;
export const addCopyButtonsToCodeBlocks = addCopyButtonsToCodeBlocks_internal;

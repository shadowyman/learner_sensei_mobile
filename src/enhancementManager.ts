import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";
import { EnhancementPayload, EnhancementEntry, requestSenseiEnhancement } from "./geminiService";

type EnhancementStatus = "idle" | "loading" | "applied";

type EnhancementManagerState = {
    status: EnhancementStatus;
    originalMarkdown: string;
    enhancedMarkdown?: string;
};

type EnhancementManagerDeps = {
    getAI: () => GoogleGenAI | null;
    streamingMap: Map<string, string>;
    renderMarkdown: (messageId: string, markdown: string, highlights?: EnhancementHighlight[], options?: RenderMarkdownOptions) => Promise<void>;
    setLoadingState: (messageId: string, isLoading: boolean) => void;
    setActiveState: (messageId: string, isActive: boolean) => void;
};

export type RenderMarkdownOptions = {
    skipMermaidProcessing?: boolean;
};

export type EnhancementHighlight = {
    key: string;
    value: string;
    insertType: EnhancementEntry['insertType'];
    occurrence: number;
};

type EnhancementSequenceResult = {
    markdown: string;
    appliedCount: number;
    highlights: EnhancementHighlight[];
};

let deps: EnhancementManagerDeps | null = null;

const stateByMessage = new Map<string, EnhancementManagerState>();

export function initializeEnhancementManager(initialDeps: EnhancementManagerDeps): void {
    deps = initialDeps;
    logger.info('[ENHANCE] Manager initialized', {
        hasAI: !!initialDeps.getAI()
    });
}

export function resetEnhancementState(messageId: string): void {
    stateByMessage.delete(messageId);
}

function requireDeps(): EnhancementManagerDeps {
    if (!deps) {
        throw new Error('Enhancement manager not initialized');
    }
    return deps;
}

function countWords(text: string): number {
    return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function stripMermaidBlocks(text: string): string {
    return text.replace(/```mermaid[\s\S]*?```/gi, '').trim();
}

function applyAppend(result: string, entry: EnhancementEntry, occurrenceIndex: number): { updated: string; applied: boolean } {
    const index = findOccurrence(result, entry.key, occurrenceIndex);
    if (index === -1) {
        return { updated: result, applied: false };
    }
    const trimmedValue = entry.value.trim();
    if (!trimmedValue) {
        return { updated: result, applied: false };
    }
    const insertPos = index + entry.key.length;
    const needsSpace = entry.value.startsWith(' ') || entry.value.startsWith('\n');
    const insertionBody = needsSpace ? entry.value : ` ${trimmedValue}`;
    const insertion = insertionBody;
    const updated = result.slice(0, insertPos) + insertion + result.slice(insertPos);
    return { updated, applied: true };
}

function applyParagraph(result: string, entry: EnhancementEntry, occurrenceIndex: number): { updated: string; applied: boolean } {
    const index = findOccurrence(result, entry.key, occurrenceIndex);
    if (index === -1) {
        return { updated: result, applied: false };
    }
    const trimmedValue = entry.value.trim();
    if (!trimmedValue) {
        return { updated: result, applied: false };
    }
    const afterKey = index + entry.key.length;
    const paragraphBreak = result.indexOf('\n\n', afterKey);
    if (paragraphBreak === -1) {
        const prefix = result.endsWith('\n\n') || result.endsWith('\n') ? '' : '\n\n';
        const insertion = `${prefix}${trimmedValue}\n\n`;
        const updated = result + insertion;
        return { updated, applied: true };
    }
    const before = result.slice(0, paragraphBreak);
    const after = result.slice(paragraphBreak);
    const insertion = `\n\n${trimmedValue}`;
    const updated = before + insertion + after;
    return { updated, applied: true };
}

function findOccurrence(text: string, key: string, occurrence: number): number {
    if (!key) {
        return -1;
    }
    let fromIndex = 0;
    let current = 0;
    while (true) {
    const index = text.indexOf(key, fromIndex);
        if (index === -1) {
            return -1;
        }
        if (current === occurrence) {
            return index;
        }
        fromIndex = index + key.length;
        current += 1;
    }
}

function applyEnhancementSequence(original: string, entries: EnhancementEntry[]): EnhancementSequenceResult {
    const usage = new Map<string, number>();
    const indexed = entries.map((entry, index) => ({ entry, index }));
    indexed.sort((a, b) => {
        const left = typeof a.entry.ordering === 'number' ? a.entry.ordering : Number.MAX_SAFE_INTEGER;
        const right = typeof b.entry.ordering === 'number' ? b.entry.ordering : Number.MAX_SAFE_INTEGER;
        if (left !== right) {
            return left - right;
        }
        return a.index - b.index;
    });
    const sorted = indexed.map(item => item.entry);
    let result = original;
    let appliedCount = 0;
    const highlights: EnhancementHighlight[] = [];
    for (const entry of sorted) {
        const occurrence = usage.get(entry.key) ?? 0;
        const op = entry.insertType === 'append'
            ? applyAppend(result, entry, occurrence)
            : applyParagraph(result, entry, occurrence);
        if (op.applied) {
            usage.set(entry.key, occurrence + 1);
            result = op.updated;
            appliedCount += 1;
            highlights.push({
                key: entry.key.trim(),
                value: entry.value.trim(),
                insertType: entry.insertType,
                occurrence
            });
        } else {
            usage.set(entry.key, occurrence);
        }
    }
    return { markdown: result, appliedCount, highlights };
}

async function applyEnhancements(messageId: string, originalMarkdown: string, payload: EnhancementPayload): Promise<void> {
    const { renderMarkdown, setLoadingState, setActiveState, streamingMap } = requireDeps();
    const applied = applyEnhancementSequence(originalMarkdown, payload.enhancements);
    if (applied.appliedCount === 0) {
        const idleState = stateByMessage.get(messageId);
        if (idleState) {
            idleState.status = 'idle';
        }
        setLoadingState(messageId, false);
        setActiveState(messageId, false);
        logger.info('[ENHANCE] No enhancements applied', { messageId });
        return;
    }
    const state = stateByMessage.get(messageId) || { status: 'idle', originalMarkdown };
    const baseline = streamingMap.get(messageId);
    if (baseline !== undefined && baseline !== originalMarkdown) {
        state.status = 'idle';
        state.originalMarkdown = originalMarkdown;
        stateByMessage.set(messageId, state);
        setLoadingState(messageId, false);
        setActiveState(messageId, false);
        logger.info('[ENHANCE] Enhancement aborted due to content drift', { messageId });
        return;
    }
    state.status = 'loading';
    state.originalMarkdown = originalMarkdown;
    state.enhancedMarkdown = applied.markdown;
    stateByMessage.set(messageId, state);
    try {
        await renderMarkdown(messageId, applied.markdown, applied.highlights, { skipMermaidProcessing: true });
    } catch (error) {
        state.status = 'idle';
        delete state.enhancedMarkdown;
        setActiveState(messageId, false);
        setLoadingState(messageId, false);
        logger.error('[ENHANCE] Enhancement render failed', { messageId, error });
        return;
    }
    state.status = 'applied';
    setActiveState(messageId, true);
    setLoadingState(messageId, false);
    logger.info('[ENHANCE] Enhancement applied', {
        messageId,
        additions: applied.appliedCount
    });
}

async function removeEnhancements(messageId: string): Promise<void> {
    const { renderMarkdown, setLoadingState, setActiveState, streamingMap } = requireDeps();
    const state = stateByMessage.get(messageId);
    if (!state) {
        return;
    }
    state.status = 'loading';
    setLoadingState(messageId, true);
    const baseline = streamingMap.get(messageId);
    if (baseline !== undefined && state.enhancedMarkdown && baseline !== state.enhancedMarkdown) {
        state.status = 'idle';
        delete state.enhancedMarkdown;
        stateByMessage.set(messageId, state);
        setActiveState(messageId, false);
        setLoadingState(messageId, false);
        logger.info('[ENHANCE] Removal skipped due to content drift', { messageId });
        return;
    }
    try {
        await renderMarkdown(messageId, state.originalMarkdown, undefined, { skipMermaidProcessing: true });
    } catch (error) {
        state.status = 'idle';
        setActiveState(messageId, false);
        setLoadingState(messageId, false);
        logger.error('[ENHANCE] Restore render failed', { messageId, error });
        return;
    }
    state.status = 'idle';
    delete state.enhancedMarkdown;
    setActiveState(messageId, false);
    setLoadingState(messageId, false);
    logger.info('[ENHANCE] Enhancements removed', { messageId });
}

export async function toggleEnhancement(messageId: string): Promise<void> {
    const { getAI, streamingMap, setLoadingState, setActiveState } = requireDeps();
    const currentState = stateByMessage.get(messageId);
    if (currentState && currentState.status === 'loading') {
        return;
    }
    if (currentState && currentState.status === 'applied') {
        await removeEnhancements(messageId);
        return;
    }
    const latestMarkdown = streamingMap.get(messageId);
    const originalMarkdown = latestMarkdown ?? currentState?.originalMarkdown;
    if (!originalMarkdown) {
        logger.error('[ENHANCE] Original markdown unavailable', { messageId });
        return;
    }
    const ai = getAI();
    setLoadingState(messageId, true);
    const state = currentState || { status: 'idle', originalMarkdown };
    state.status = 'loading';
    state.originalMarkdown = originalMarkdown;
    stateByMessage.set(messageId, state);
    const sanitizedSource = stripMermaidBlocks(originalMarkdown);
    if (!sanitizedSource) {
        state.status = 'idle';
        setLoadingState(messageId, false);
        setActiveState(messageId, false);
        logger.info('[ENHANCE] Enhancement skipped (mermaid-only content)', { messageId });
        return;
    }
    const payload = await requestSenseiEnhancement(ai, {
        originalMarkdown: sanitizedSource,
        wordCount: countWords(sanitizedSource)
    });
    if (!payload) {
        state.status = 'idle';
        setLoadingState(messageId, false);
        setActiveState(messageId, false);
        return;
    }
    if (payload.enhancements.length === 0) {
        state.status = 'idle';
        setLoadingState(messageId, false);
        setActiveState(messageId, false);
        return;
    }
    await applyEnhancements(messageId, originalMarkdown, payload);
}

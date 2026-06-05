import type { ConversationHistoryEntry } from '@sensei/core/promptEnvelope';

type BuildRecentConversationHistoryOptions = {
    currentUserInput: string;
    userInputHistory: string[];
    lastSenseiResponses: string[];
    messageArea?: Element | null;
    streamingMessagesRawText?: Map<string, string>;
};

function normalizeContent(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function getBubbleText(bubble: Element, streamingMessagesRawText?: Map<string, string>): string {
    const id = (bubble as HTMLElement).id;
    const rawText = id && streamingMessagesRawText ? streamingMessagesRawText.get(id) : undefined;
    if (typeof rawText === 'string') {
        return normalizeContent(rawText);
    }
    return normalizeContent(bubble.querySelector('.message-text')?.textContent ?? bubble.textContent ?? '');
}

function extractDomHistory(
    currentUserInput: string,
    messageArea?: Element | null,
    streamingMessagesRawText?: Map<string, string>
): ConversationHistoryEntry[] | null {
    if (!messageArea || typeof messageArea.querySelectorAll !== 'function') {
        return null;
    }
    const entries = Array.from(messageArea.querySelectorAll('.message-bubble[data-sender]'))
        .map((bubble) => {
            const sender = (bubble as HTMLElement).dataset.sender;
            if (sender !== 'user' && sender !== 'sensei') {
                return null;
            }
            const content = getBubbleText(bubble, streamingMessagesRawText);
            if (!content) {
                return null;
            }
            return { role: sender, content } satisfies ConversationHistoryEntry;
        })
        .filter((entry): entry is ConversationHistoryEntry => entry !== null);
    if (entries.length === 0) {
        return null;
    }
    const currentInput = normalizeContent(currentUserInput);
    if (currentInput && entries[entries.length - 1]?.role === 'user' && entries[entries.length - 1].content === currentInput) {
        entries.pop();
    }
    return entries.slice(-8);
}

function buildArrayFallbackHistory(
    currentUserInput: string,
    userInputHistory: string[],
    lastSenseiResponses: string[]
): ConversationHistoryEntry[] {
    const currentInput = normalizeContent(currentUserInput);
    const previousUserInputs = userInputHistory
        .map(normalizeContent)
        .filter((content) => content.length > 0);
    if (currentInput && previousUserInputs[previousUserInputs.length - 1] === currentInput) {
        previousUserInputs.pop();
    }
    const users = previousUserInputs.slice(-3);
    const senseis = lastSenseiResponses
        .map(normalizeContent)
        .filter((content) => content.length > 0)
        .slice(0, 3)
        .reverse();
    const history: ConversationHistoryEntry[] = [];
    const leadingSenseiCount = Math.max(0, senseis.length - users.length);
    for (const content of senseis.slice(0, leadingSenseiCount)) {
        history.push({ role: 'sensei', content });
    }
    for (let index = 0; index < users.length; index++) {
        history.push({ role: 'user', content: users[index] });
        const senseiContent = senseis[leadingSenseiCount + index];
        if (senseiContent) {
            history.push({ role: 'sensei', content: senseiContent });
        }
    }
    return history.slice(-8);
}

export function buildRecentConversationHistory(options: BuildRecentConversationHistoryOptions): ConversationHistoryEntry[] {
    return extractDomHistory(options.currentUserInput, options.messageArea, options.streamingMessagesRawText)
        ?? buildArrayFallbackHistory(options.currentUserInput, options.userInputHistory, options.lastSenseiResponses);
}

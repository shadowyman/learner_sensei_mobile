import JSON5 from 'json5';
import type { CoreLlmClient } from './llmTypes';
import {
    buildSelectionSenseiFollowUpPrompt,
    buildSelectionSenseiToolbarPrompt,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    type SelectionSenseiFollowUpPromptRequest,
    type SelectionSenseiInitialActionContext,
    type SelectionSenseiInitialResponseContext,
    type SelectionSenseiModalTranscriptEntry,
    type SelectionSenseiToolbarActionType
} from './prompts/selectionSensei';

export {
    buildSelectionSenseiFollowUpPrompt,
    buildSelectionSenseiToolbarPrompt,
    SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS,
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    getSelectionSenseiToolbarActionInstruction
} from './prompts/selectionSensei';

export type {
    SelectionSenseiFollowUpPromptRequest,
    SelectionSenseiInitialActionContext,
    SelectionSenseiInitialResponseContext,
    SelectionSenseiModalTranscriptEntry,
    SelectionSenseiModalTranscriptRole,
    SelectionSenseiToolbarActionType
} from './prompts/selectionSensei';

export interface SelectionSenseiParsedResponse {
    suggestedTitle?: string;
    explanation?: string;
}

export interface SelectionSenseiParserOptions {
    logger?: {
        debug: (message?: any, ...optionalParams: any[]) => void;
    };
    logFailure?: boolean;
}

export type SelectionSenseiModalMessageMode = 'toolbarAction' | 'followUp';

export type SelectionSenseiModalErrorCode = 'missing_llm' | 'invalid_request' | 'provider_error';

export interface SelectionSenseiToolbarActionRequest {
    mode: 'toolbarAction';
    actionType: SelectionSenseiToolbarActionType;
    selectedText: string;
    originalSenseiMessageText: string;
    actionLabel: string;
    userQuestion?: string;
}

export interface SelectionSenseiFollowUpRequest extends SelectionSenseiFollowUpPromptRequest {
    mode: 'followUp';
}

export type SelectionSenseiModalMessageRequest = SelectionSenseiToolbarActionRequest | SelectionSenseiFollowUpRequest;

export type SelectionSenseiModalMessageResult =
    | {
        ok: true;
        suggestedTitle?: string;
        explanation?: string;
        rawText: string;
    }
    | {
        ok: false;
        errorCode: SelectionSenseiModalErrorCode;
        errorMessage: string;
    };

const SELECTION_SENSEI_MODAL_TASK = 'selection_sensei_modal';
const FORBIDDEN_CLIENT_FIELDS = [
    'prompt',
    'finalPrompt',
    'promptText',
    'message',
    'systemInstruction',
    'instruction',
    'model',
    'temperature',
    'config',
    'tools',
    'providerOptions',
    'safetySettings',
    'history',
    'requestId',
    'chat'
];
const NON_LLM_ACTIONS = new Set(['addToNotepad', 'copy', 'share']);
const LLM_TOOLBAR_ACTIONS = new Set<SelectionSenseiToolbarActionType>([
    'explainSimpler',
    'explainWithAnalogy',
    'explainInMoreDepth',
    'showAnExample',
    'showExampleCodeSnippet',
    'askQuestion'
]);

function invalidSelectionSenseiRequest(errorMessage: string): SelectionSenseiModalMessageResult {
    return {
        ok: false,
        errorCode: 'invalid_request',
        errorMessage
    };
}

function hasForbiddenClientFields(request: unknown): boolean {
    if (!request || typeof request !== 'object') {
        return false;
    }
    return FORBIDDEN_CLIENT_FIELDS.some(field => Object.prototype.hasOwnProperty.call(request, field));
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasInitialResponseContent(response: SelectionSenseiInitialResponseContext): boolean {
    return (
        isNonEmptyString(response.suggestedTitle) ||
        isNonEmptyString(response.explanation) ||
        isNonEmptyString(response.rawText)
    );
}

function validateToolbarRequest(request: SelectionSenseiToolbarActionRequest): SelectionSenseiModalMessageResult | null {
    if (NON_LLM_ACTIONS.has(String(request.actionType))) {
        return invalidSelectionSenseiRequest('Unsupported Selection Sensei toolbar action.');
    }
    if (!LLM_TOOLBAR_ACTIONS.has(request.actionType)) {
        return invalidSelectionSenseiRequest('Unsupported Selection Sensei toolbar action.');
    }
    if (!isNonEmptyString(request.selectedText) || !isNonEmptyString(request.originalSenseiMessageText) || !isNonEmptyString(request.actionLabel)) {
        return invalidSelectionSenseiRequest('Selection Sensei toolbar request is missing required context.');
    }
    if (request.actionType === 'askQuestion' && !isNonEmptyString(request.userQuestion)) {
        return invalidSelectionSenseiRequest('Selection Sensei ask-question request requires a user question.');
    }
    return null;
}

function validateFollowUpRequest(request: SelectionSenseiFollowUpRequest): SelectionSenseiModalMessageResult | null {
    if (
        !isNonEmptyString(request.selectedText) ||
        !isNonEmptyString(request.originalSenseiMessageText) ||
        !isNonEmptyString(request.question) ||
        !request.initialAction ||
        !isNonEmptyString(request.initialAction.actionType) ||
        !isNonEmptyString(request.initialAction.actionLabel) ||
        !request.initialResponse ||
        !hasInitialResponseContent(request.initialResponse)
    ) {
        return invalidSelectionSenseiRequest('Selection Sensei follow-up request is missing required modal context.');
    }
    if (!LLM_TOOLBAR_ACTIONS.has(request.initialAction.actionType)) {
        return invalidSelectionSenseiRequest('Selection Sensei follow-up request has unsupported initial action.');
    }
    return null;
}

function validateSelectionSenseiModalRequest(request: SelectionSenseiModalMessageRequest): SelectionSenseiModalMessageResult | null {
    if (hasForbiddenClientFields(request)) {
        return invalidSelectionSenseiRequest('Selection Sensei modal request contains forbidden prompt or provider-control fields.');
    }
    if (!request || typeof request !== 'object') {
        return invalidSelectionSenseiRequest('Selection Sensei modal request is invalid.');
    }
    if (request.mode === 'toolbarAction') {
        return validateToolbarRequest(request);
    }
    if (request.mode === 'followUp') {
        return validateFollowUpRequest(request);
    }
    return invalidSelectionSenseiRequest('Unsupported Selection Sensei modal request mode.');
}

function buildSelectionSenseiProviderPrompt(userPrompt: string): string {
    return `${SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION.trim()}

--- SELECTION SENSEI USER PROMPT START ---
${userPrompt.trim()}
--- SELECTION SENSEI USER PROMPT END ---
`;
}

function stripJsonFence(payload: string): string {
    const trimmed = payload.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = trimmed.match(fenceRegex);
    if (match && match[2]) {
        return match[2].trim();
    }
    return trimmed;
}

function normalizeJsonPayload(payload: string): string {
    return stripJsonFence(payload)
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim();
}

function repairLooseJson(payload: string): string {
    let repaired = payload;
    repaired = repaired.replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":');
    repaired = repaired.replace(/:\s*'([^']*?)'/g, ': "$1"');
    repaired = repaired.replace(/,\s*}/g, '}');
    repaired = repaired.replace(/,\s*]/g, ']');
    return repaired;
}

function extractResult(parsed: unknown): SelectionSenseiParsedResponse {
    if (!parsed || typeof parsed !== 'object') {
        return {};
    }

    const result: SelectionSenseiParsedResponse = {};
    const candidate = parsed as Record<string, unknown>;

    if (typeof candidate.suggestedTitle === 'string') {
        result.suggestedTitle = candidate.suggestedTitle;
    }
    if (typeof candidate.explanation === 'string') {
        result.explanation = candidate.explanation;
    }

    return result;
}

function hasContent(parsed: SelectionSenseiParsedResponse): boolean {
    return Boolean(parsed.suggestedTitle || parsed.explanation);
}

function tryParseJson(payload: string, options?: SelectionSenseiParserOptions): SelectionSenseiParsedResponse {
    try {
        return extractResult(JSON.parse(payload));
    } catch (error) {
        if (options?.logFailure !== false && options?.logger) {
            const message = error instanceof Error ? error.message : String(error);
            options.logger.debug('[SENSEI_SELECTION] JSON parse failed', { message });
        }
        return {};
    }
}

function tryParseJson5(payload: string, options?: SelectionSenseiParserOptions): SelectionSenseiParsedResponse {
    try {
        return extractResult(JSON5.parse(payload));
    } catch (error) {
        if (options?.logFailure !== false && options?.logger) {
            const message = error instanceof Error ? error.message : String(error);
            options.logger.debug('[SENSEI_SELECTION] JSON5 parse failed', { message });
        }
        return {};
    }
}

function extractLooseStringField(source: string, key: string): string | undefined {
    const keyPattern = new RegExp(`["']${key}["']\\s*:\\s*`, 'i');
    const match = keyPattern.exec(source);
    if (!match) {
        return undefined;
    }

    let cursor = match.index + match[0].length;
    if (cursor >= source.length) {
        return undefined;
    }

    const quoteChar = source[cursor];
    if (quoteChar !== '"' && quoteChar !== "'") {
        return undefined;
    }
    cursor += 1;

    let value = '';
    let escapeNext = false;

    while (cursor < source.length) {
        const ch = source[cursor];
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
                case '"':
                    value += '"';
                    break;
                case "'":
                    value += "'";
                    break;
                case '\\':
                    value += '\\';
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
            let lookahead = cursor;
            while (lookahead < source.length && /\s/.test(source[lookahead])) {
                lookahead += 1;
            }

            const nextChar = lookahead < source.length ? source[lookahead] : undefined;
            if (nextChar === ',' || nextChar === '}' || nextChar === undefined) {
                return value;
            }
        }

        value += ch;
    }

    return value || undefined;
}

export function parseSelectionSenseiResponsePayload(
    rawPayload: string,
    options?: SelectionSenseiParserOptions
): SelectionSenseiParsedResponse {
    const normalized = normalizeJsonPayload(rawPayload);

    const strictResult = tryParseJson(normalized, options);
    if (hasContent(strictResult)) {
        return strictResult;
    }

    const json5Result = tryParseJson5(normalized, options);
    if (hasContent(json5Result)) {
        return json5Result;
    }

    const repaired = repairLooseJson(normalized);
    if (repaired !== normalized) {
        const repairedStrict = tryParseJson(repaired, { ...options, logFailure: false });
        if (hasContent(repairedStrict)) {
            return repairedStrict;
        }

        const repairedJson5 = tryParseJson5(repaired, { ...options, logFailure: false });
        if (hasContent(repairedJson5)) {
            return repairedJson5;
        }
    }

    const looseResult: SelectionSenseiParsedResponse = {};
    const looseTitle = extractLooseStringField(normalized, 'suggestedTitle');
    const looseExplanation = extractLooseStringField(normalized, 'explanation');
    if (looseTitle !== undefined) {
        looseResult.suggestedTitle = looseTitle;
    }
    if (looseExplanation !== undefined) {
        looseResult.explanation = looseExplanation;
    }

    return looseResult;
}

export async function runSelectionSenseiModalMessage(
    llm: CoreLlmClient | null,
    request: SelectionSenseiModalMessageRequest
): Promise<SelectionSenseiModalMessageResult> {
    const invalid = validateSelectionSenseiModalRequest(request);
    if (invalid) {
        return invalid;
    }
    if (!llm) {
        return {
            ok: false,
            errorCode: 'missing_llm',
            errorMessage: 'Selection Sensei modal capability requires an LLM client.'
        };
    }

    const prompt = request.mode === 'toolbarAction'
        ? buildSelectionSenseiToolbarPrompt(request)
        : buildSelectionSenseiFollowUpPrompt(request);
    const providerPrompt = buildSelectionSenseiProviderPrompt(prompt);

    try {
        const rawText = await llm.callText(providerPrompt, { task: SELECTION_SENSEI_MODAL_TASK });
        const parsed = parseSelectionSenseiResponsePayload(rawText);
        return {
            ok: true,
            ...parsed,
            rawText
        };
    } catch (_error) {
        return {
            ok: false,
            errorCode: 'provider_error',
            errorMessage: 'Selection Sensei modal provider execution failed.'
        };
    }
}

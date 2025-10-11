/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSON5 from 'json5';

export interface SelectionSenseiParsedResponse {
    suggestedTitle?: string;
    explanation?: string;
}

interface ParserOptions {
    logger?: {
        debug: (message?: any, ...optionalParams: any[]) => void;
    };
    logFailure?: boolean;
}

function normalizeJsonPayload(payload: string): string {
    return payload
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

function tryParseJson(payload: string, options?: ParserOptions): SelectionSenseiParsedResponse {
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

function tryParseJson5(payload: string, options?: ParserOptions): SelectionSenseiParsedResponse {
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
    options?: ParserOptions
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

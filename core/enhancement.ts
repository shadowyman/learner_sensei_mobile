import {
    SENSEI_ENHANCEMENT_OUTPUT_AGGREGATE_MAX_CHARS,
    SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS,
    SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES,
    SENSEI_ENHANCEMENT_OUTPUT_METADATA_MAX_CHARS,
    SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS
} from './llmCapPolicy';

export type EnhancementInsertType = 'append' | 'paragraph';

export interface EnhancementEntry {
    key: string;
    value: string;
    insertType: EnhancementInsertType;
    ordering?: number;
}

export interface EnhancementPayload {
    enhancements: EnhancementEntry[];
    metadata?: Record<string, unknown>;
}

function stripJsonFence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) {
        return trimmed;
    }
    const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    return trimmed;
}

function isPlainMetadata(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMetadataWithinCap(value: Record<string, unknown>): boolean {
    try {
        return JSON.stringify(value).length <= SENSEI_ENHANCEMENT_OUTPUT_METADATA_MAX_CHARS;
    } catch {
        return false;
    }
}

function normalizeEnhancementEntries(raw: unknown): EnhancementPayload {
    const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const enhancements = Array.isArray(candidate.enhancements) ? candidate.enhancements : [];
    const normalized: EnhancementEntry[] = [];
    let aggregateChars = 0;

    for (const entry of enhancements) {
        if (normalized.length >= SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES) {
            break;
        }

        if (!entry || typeof entry !== 'object') {
            continue;
        }

        const entryRecord = entry as Record<string, unknown>;
        const key = typeof entryRecord.key === 'string' ? entryRecord.key.trim() : '';
        const value = typeof entryRecord.value === 'string' ? entryRecord.value.trim() : '';
        const insertType = entryRecord.insertType === 'append' || entryRecord.insertType === 'paragraph'
            ? entryRecord.insertType
            : null;
        const ordering = typeof entryRecord.ordering === 'number' && Number.isFinite(entryRecord.ordering)
            ? entryRecord.ordering
            : undefined;

        if (!key || !value || !insertType) {
            continue;
        }

        if (
            key.length > SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS ||
            value.length > SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS
        ) {
            continue;
        }

        const nextAggregateChars = aggregateChars + key.length + value.length;
        if (nextAggregateChars > SENSEI_ENHANCEMENT_OUTPUT_AGGREGATE_MAX_CHARS) {
            continue;
        }

        aggregateChars = nextAggregateChars;

        if (ordering !== undefined) {
            normalized.push({ key, value, insertType, ordering });
        } else {
            normalized.push({ key, value, insertType });
        }
    }

    const payload: EnhancementPayload = {
        enhancements: normalized
    };

    if (isPlainMetadata(candidate.metadata) && isMetadataWithinCap(candidate.metadata)) {
        payload.metadata = candidate.metadata;
    }

    return payload;
}

export function parseSenseiEnhancementResponse(text: string): EnhancementPayload | null {
    const cleaned = stripJsonFence(text);

    let parsed: unknown;
    try {
        parsed = cleaned ? JSON.parse(cleaned) : { enhancements: [] };
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }

    return normalizeEnhancementEntries(parsed);
}

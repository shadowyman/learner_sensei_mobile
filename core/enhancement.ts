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

function normalizeEnhancementEntries(raw: unknown): EnhancementPayload {
    const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const enhancements = Array.isArray(candidate.enhancements) ? candidate.enhancements : [];
    const normalized: EnhancementEntry[] = [];

    for (const entry of enhancements) {
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

        if (ordering !== undefined) {
            normalized.push({ key, value, insertType, ordering });
        } else {
            normalized.push({ key, value, insertType });
        }
    }

    const payload: EnhancementPayload = {
        enhancements: normalized
    };

    if (isPlainMetadata(candidate.metadata)) {
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

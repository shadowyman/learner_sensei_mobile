import { TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED } from './model_usage';

const STORAGE_KEY = 'teaching-plan-cache';
const CACHE_VERSION = 1;

const isCacheDisabled = (): boolean =>
    typeof process !== 'undefined' && (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test');

interface TeachingPlanCacheEntry<T> {
    plan: T;
    savedAt: string;
    version: number;
    itemBasedPromptEnabled?: boolean;
}

type CacheMap<T> = Record<string, TeachingPlanCacheEntry<T>>;

function getStorage(): Storage | null {
    if (isCacheDisabled()) {
        return null;
    }
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch (_) {
        return null;
    }
    return null;
}

function readCacheMap<T>(): CacheMap<T> {
    if (isCacheDisabled()) {
        return {};
    }
    const storage = getStorage();
    if (!storage) {
        return {};
    }
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        return parsed as CacheMap<T>;
    } catch (_) {
        return {};
    }
}

function writeCacheMap<T>(map: CacheMap<T>): void {
    if (isCacheDisabled()) {
        return;
    }
    const storage = getStorage();
    if (!storage) {
        return;
    }
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (_) {
    }
}

export function getCachedTeachingPlan<T>(cacheKey: string): T | null {
    if (isCacheDisabled()) {
        return null;
    }
    const map = readCacheMap<T>();
    const entry = map[cacheKey];
    if (!entry || entry.version !== CACHE_VERSION) {
        return null;
    }
    const currentFlag = TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED;
    const cachedFlag = entry.itemBasedPromptEnabled ?? false;
    if (cachedFlag !== currentFlag) {
        removeCachedTeachingPlan(cacheKey);
        return null;
    }
    const plan = entry.plan;
    if (!Array.isArray(plan)) {
        removeCachedTeachingPlan(cacheKey);
        return null;
    }
    return plan;
}

export function setCachedTeachingPlan<T>(cacheKey: string, plan: T): void {
    if (isCacheDisabled()) {
        return;
    }
    const map = readCacheMap<T>();
    map[cacheKey] = {
        plan,
        savedAt: new Date().toISOString(),
        version: CACHE_VERSION,
        itemBasedPromptEnabled: TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED
    };
    writeCacheMap(map);
}

export function removeCachedTeachingPlan(cacheKey: string): void {
    if (isCacheDisabled()) {
        return;
    }
    const map = readCacheMap<unknown>();
    if (map[cacheKey]) {
        delete map[cacheKey];
        writeCacheMap(map);
    }
}

export function clearTeachingPlanCache(): void {
    if (isCacheDisabled()) {
        return;
    }
    const storage = getStorage();
    if (!storage) {
        return;
    }
    try {
        storage.removeItem(STORAGE_KEY);
    } catch (_) {
    }
}

export function hasTeachingPlanCacheEntries(): boolean {
    if (isCacheDisabled()) {
        return false;
    }
    const map = readCacheMap<unknown>();
    return Object.keys(map).length > 0;
}

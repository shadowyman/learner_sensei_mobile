import { logger } from '../../logger';
import type { RNToWebMessage } from './contracts';

type Sender = (message: RNToWebMessage) => void;

type TimeoutHandle = ReturnType<typeof setTimeout>;

interface BridgeManagerOptions {
    sender: Sender;
    maxChatUpdatesPerSecond?: number;
    schedule?: (callback: () => void, delay: number) => TimeoutHandle;
    clearTimeoutFn?: (handle: TimeoutHandle | null) => void;
    now?: () => number;
}

interface QueuedMessage {
    message: RNToWebMessage;
}

const THROTTLED_STREAMING_TYPES = new Set<RNToWebMessage['type']>(['chat:update', 'llmStream:chunk']);

export class BridgeManager {
    private readonly sender: Sender;
    private readonly minChatUpdateInterval: number;
    private readonly schedule: (cb: () => void, delay: number) => TimeoutHandle;
    private readonly clear: (handle: TimeoutHandle | null) => void;
    private readonly now: () => number;

    private queue: QueuedMessage[] = [];
    private flushing = false;
    private throttleHandle: TimeoutHandle | null = null;
    private lastChatUpdateDispatched = -Infinity;

    constructor(options: BridgeManagerOptions) {
        this.sender = options.sender;
        const maxUpdates = Math.max(1, options.maxChatUpdatesPerSecond ?? 10);
        this.minChatUpdateInterval = 1000 / maxUpdates;
        this.schedule = options.schedule ?? ((cb, delay) => setTimeout(cb, delay));
        this.clear = options.clearTimeoutFn ?? (handle => {
            if (handle !== null) {
                clearTimeout(handle);
            }
        });
        this.now = options.now ?? (() => Date.now());
    }

    enqueue(message: RNToWebMessage): void {
        this.queue.push({ message });
        this.processQueue();
    }

    flushAll(): void {
        if (this.throttleHandle !== null) {
            this.clear(this.throttleHandle);
            this.throttleHandle = null;
        }
        while (this.queue.length > 0) {
            const next = this.queue.shift()!;
            this.dispatch(next.message);
        }
    }

    private processQueue(): void {
        if (this.flushing) {
            return;
        }
        this.flushing = true;
        try {
            while (this.queue.length > 0) {
                const peek = this.queue[0];
                if (THROTTLED_STREAMING_TYPES.has(peek.message.type)) {
                    const now = this.now();
                    const elapsed = now - this.lastChatUpdateDispatched;
                    if (elapsed < this.minChatUpdateInterval) {
                        const remaining = this.minChatUpdateInterval - elapsed;
                        this.scheduleThrottle(remaining);
                        return;
                    }
                    this.lastChatUpdateDispatched = now;
                }
                const next = this.queue.shift()!;
                this.dispatch(next.message);
            }
        } finally {
            this.flushing = false;
        }
    }

    private scheduleThrottle(delay: number): void {
        if (this.throttleHandle !== null) {
            return;
        }
        this.throttleHandle = this.schedule(() => {
            this.throttleHandle = null;
            this.processQueue();
        }, Math.max(1, delay));
    }

    private dispatch(message: RNToWebMessage): void {
        try {
            this.sender(message);
            logger.info('[MOBILE_PORT] bridge dispatch', { type: message.type, queueSize: this.queue.length });
        } catch (error) {
            logger.error('[MOBILE_PORT] bridge dispatch error', { type: message.type, error });
        }
    }
}

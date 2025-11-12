import { logger } from '../../logger';
import type { BridgeManager } from '../bridge/BridgeManager';
import type { BffClientLike, SubmitTurnPayload, TurnStreamHandle, StreamChunk, StreamStatus, StreamError, MermaidRecoveryPayload, MermaidRecoveryResult } from './types';

type FetchLike = typeof fetch;

interface WebSocketLike {
    new (url: string): WebSocketInstanceLike;
}

interface WebSocketInstanceLike {
    onopen: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onerror: ((event: { message?: string }) => void) | null;
    onclose: (() => void) | null;
    close(): void;
}

interface BffClientOptions {
    baseUrl: string;
    bridge: BridgeManager;
    fetchImpl?: FetchLike;
    webSocketImpl?: WebSocketLike;
}

type StreamEvent = StreamChunk | StreamStatus | StreamError;

class AsyncEventQueue<T> implements AsyncIterable<T> {
    private queue: (IteratorResult<T>)[] = [];
    private resolve: ((value: IteratorResult<T>) => void) | null = null;
    private closed = false;

    push(value: T): void {
        const entry: IteratorResult<T> = { value, done: false };
        if (this.resolve) {
            const resolver = this.resolve;
            this.resolve = null;
            resolver(entry);
        } else {
            this.queue.push(entry);
        }
    }

    close(): void {
        this.closed = true;
        if (this.resolve) {
            const resolver = this.resolve;
            this.resolve = null;
            resolver({ value: undefined as any, done: true });
        } else {
            this.queue.push({ value: undefined as any, done: true });
        }
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: () => {
                if (this.queue.length > 0) {
                    return Promise.resolve(this.queue.shift()!);
                }
                if (this.closed) {
                    return Promise.resolve({ value: undefined as any, done: true });
                }
                return new Promise<IteratorResult<T>>(resolve => {
                    this.resolve = resolve;
                });
            }
        };
    }
}

export class BffClient implements BffClientLike {
    private readonly baseUrl: string;
    private readonly fetchImpl: FetchLike;
    private readonly WebSocketImpl?: WebSocketLike;
    private readonly bridge: BridgeManager;
    private sessionId: string | null = null;

    constructor(options: BffClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.WebSocketImpl = options.webSocketImpl ?? (globalThis as any).WebSocket;
        this.bridge = options.bridge;
    }

    async ensureSession(): Promise<void> {
        if (this.sessionId) {
            return;
        }
        const response = await this.fetchImpl(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicId: 'default' })
        });
        if (!response.ok) {
            throw new Error(`Failed to initialize session: ${response.status}`);
        }
        const json = await response.json();
        this.sessionId = json.sessionId;
    }

    async reconnectIfNeeded(): Promise<void> {
        await this.ensureSession();
    }

    async submitTurn(payload: SubmitTurnPayload): Promise<TurnStreamHandle> {
        await this.ensureSession();
        const body = {
            clientTurnId: payload.clientTurnId,
            input: { text: payload.text }
        };
        const response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/turns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`Turn submission failed: ${response.status}`);
        }
        const json = await response.json();
        logger.info('[MOBILE_PORT] ws status', { phase: 'requested', turnId: json.turnId });
        return {
            messageId: `msg-${json.turnId}`,
            stream: this.createStream(json.streamUrl, json.turnId)
        };
    }

    async recoverMermaid(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult> {
        const response = await this.fetchImpl(`${this.baseUrl}/mermaid/recover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Mermaid recovery failed: ${response.status}`);
        }
        const json = await response.json();
        logger.info('[MOBILE_PORT] ws status', { phase: 'mermaid-recovery', messageId: payload.messageId });
        return json as MermaidRecoveryResult;
    }

    private createStream(streamUrl: string, turnId: string): AsyncIterable<StreamEvent> {
        if (!this.WebSocketImpl) {
            return this.createErrorStream('DOWNSTREAM_UNAVAILABLE', 'WebSocket implementation missing');
        }
        const queue = new AsyncEventQueue<StreamEvent>();
        const ws = new this.WebSocketImpl(streamUrl);
        logger.info('[MOBILE_PORT] ws status', { phase: 'connecting', turnId });

        ws.onopen = () => {
            logger.info('[MOBILE_PORT] ws status', { phase: 'started', turnId });
            queue.push({ type: 'status', phase: 'started' } as StreamStatus);
        };

        ws.onmessage = event => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'chunk') {
                    queue.push({ type: 'chunk', text: parsed.text } as StreamChunk);
                } else if (parsed.type === 'status') {
                    queue.push({ type: 'status', phase: parsed.phase, footer: parsed.footer } as StreamStatus);
                } else if (parsed.type === 'wrapUp') {
                    this.bridge.enqueue({ type: 'wrapup:show', data: parsed.payload } as any);
                } else if (parsed.type === 'error') {
                    queue.push({ type: 'error', code: parsed.code, message: parsed.message } as StreamError);
                }
            } catch (error) {
                queue.push({ type: 'error', code: 'PARSE_ERROR', message: (error as Error).message } as StreamError);
            }
        };

        ws.onerror = event => {
            queue.push({ type: 'error', code: 'DOWNSTREAM_UNAVAILABLE', message: event.message ?? 'WebSocket error' } as StreamError);
        };

        ws.onclose = () => {
            logger.info('[MOBILE_PORT] ws status', { phase: 'completed', turnId });
            queue.push({ type: 'status', phase: 'completed' } as StreamStatus);
            queue.close();
        };

        return queue;
    }

    private createErrorStream(code: string, message: string): AsyncIterable<StreamEvent> {
        const queue = new AsyncEventQueue<StreamEvent>();
        queue.push({ type: 'error', code, message } as StreamError);
        queue.close();
        return queue;
    }
}

export default BffClient;

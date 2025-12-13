import { logger } from '../../logger';
import type { BridgeManager } from '../bridge/BridgeManager';
import type { BffClientLike, SubmitTurnPayload, TurnStreamHandle, StreamChunk, StreamStatus, StreamError, MermaidRecoveryPayload, MermaidRecoveryResult, WrapUpAssessmentPromptContext } from './types';
import type { WrapUpAssessmentOverlayData } from '../bridge/contracts';

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

interface ClientMetadata {
    topicId?: string;
    source?: string;
    appVersion?: string;
}

interface BffClientOptions {
    baseUrl: string;
    bridge: BridgeManager;
    fetchImpl?: FetchLike;
    webSocketImpl?: WebSocketLike;
    clientMetadata?: ClientMetadata;
}

type StreamEvent = StreamChunk | StreamStatus | StreamError;

const MERMAID_RECOVERY_REQUEST_TIMEOUT_MS = 42000;
const WRAP_UP_REQUEST_TIMEOUT_MS = 250000;

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
    private readonly clientMetadata: ClientMetadata;

    constructor(options: BffClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.WebSocketImpl = options.webSocketImpl ?? (globalThis as any).WebSocket;
        this.bridge = options.bridge;
        this.clientMetadata = {
            topicId: 'c++_recursive_mastery',
            source: 'mobile',
            ...options.clientMetadata
        };
    }

    async ensureSession(): Promise<void> {
        if (this.sessionId) {
            return;
        }
        const response = await this.fetchImpl(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topicId: this.clientMetadata.topicId,
                metadata: {
                    source: this.clientMetadata.source,
                    appVersion: this.clientMetadata.appVersion
                }
            })
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
        const requestBody = {
            clientTurnId: payload.clientTurnId,
            input: { text: payload.text },
            metadata: {
                source: this.clientMetadata.source,
                appVersion: this.clientMetadata.appVersion,
                selectionSensei: payload.selectionContext
            }
        };
        return this.postTurnWithRetry(requestBody, false);
    }

    private async postTurnWithRetry(body: Record<string, unknown>, hasRetried: boolean): Promise<TurnStreamHandle> {
        await this.ensureSession();
        const response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/turns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (response.status === 400) {
            const errorBody = await this.safeParseJson(response);
            if (!hasRetried && this.isUnknownSessionError(errorBody)) {
                this.sessionId = null;
                return this.postTurnWithRetry(body, true);
            }
            throw new Error(`Turn submission failed: ${response.status}`);
        }
        if (!response.ok) {
            throw new Error(`Turn submission failed: ${response.status}`);
        }
        return this.handleTurnResponse(response);
    }

    private isUnknownSessionError(body: any): boolean {
        if (!body || typeof body !== 'object') {
            return false;
        }
        const message = typeof body.message === 'string' ? body.message.toLowerCase() : '';
        return body.code === 'BAD_REQUEST' && message.includes('unknown session');
    }

    private async safeParseJson(response: Response): Promise<any | null> {
        try {
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    private async handleTurnResponse(response: Response): Promise<TurnStreamHandle> {
        const json = await response.json();
        logger.info('[MOBILE_PORT] ws status', { phase: 'requested', turnId: json.turnId });
        return {
            messageId: `msg-${json.turnId}`,
            stream: this.createStream(json.streamUrl, json.turnId)
        };
    }

    async recoverMermaid(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult> {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), MERMAID_RECOVERY_REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/mermaid/recover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timerId);
        }
        if (!response.ok) {
            throw new Error(`Mermaid recovery failed: ${response.status}`);
        }
        const json = await response.json();
        logger.info('[MOBILE_PORT] ws status', { phase: 'mermaid-recovery', messageId: payload.messageId });
        return json as MermaidRecoveryResult;
    }

    async generateWrapUp(moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<WrapUpAssessmentOverlayData | null> {
        const requestBody = { moduleId, promptContext };
        return this.postWrapUpWithRetry(requestBody, false);
    }

    private async postWrapUpWithRetry(body: Record<string, unknown>, hasRetried: boolean): Promise<WrapUpAssessmentOverlayData | null> {
        await this.ensureSession();
        if (!this.sessionId) {
            throw new Error('Session missing for wrap-up generation');
        }
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), WRAP_UP_REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/wrapup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timerId);
        }
        if (response.status === 400) {
            const errorBody = await this.safeParseJson(response);
            if (!hasRetried && this.isUnknownSessionError(errorBody)) {
                this.sessionId = null;
                return this.postWrapUpWithRetry(body, true);
            }
            throw new Error(`Wrap-up generation failed: ${response.status}`);
        }
        if (!response.ok) {
            throw new Error(`Wrap-up generation failed: ${response.status}`);
        }
        const overlay = await response.json() as WrapUpAssessmentOverlayData;
        this.bridge.enqueue({ type: 'wrapup:show', data: overlay });
        return overlay;
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

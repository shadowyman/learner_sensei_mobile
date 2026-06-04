import { logger } from '../../logger';
import type { BridgeManager } from '../bridge/BridgeManager';
import type {
    BffClientLike,
    ComprehensiveAnalysisResultType,
    LearnerAnalysisRequest,
    SubmitLlmStreamPayload,
    SubmitTurnPayload,
    LlmStreamHandle,
    TurnStreamHandle,
    LlmStreamCapability,
    StreamChunk,
    StreamStatus,
    StreamError,
    MermaidRecoveryPayload,
    MermaidRecoveryResult,
    WrapUpAssessmentPromptContext,
    TeachingPlanRequestPayload
} from './types';
import type { WrapUpAssessmentOverlayData, TeachingPoint } from '../bridge/contracts';
import {
    COMPREHENSIVE_ANALYSIS_RN_TIMEOUT_MS,
    MERMAID_RECOVERY_RN_TIMEOUT_MS,
    WRAP_UP_ASSESSMENT_RN_TIMEOUT_MS,
    TEACHING_PLAN_RN_TIMEOUT_MS
} from '@sensei/protocol/timeouts';

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

const MERMAID_RECOVERY_REQUEST_TIMEOUT_MS = MERMAID_RECOVERY_RN_TIMEOUT_MS;
const WRAP_UP_REQUEST_TIMEOUT_MS = WRAP_UP_ASSESSMENT_RN_TIMEOUT_MS;
const TEACHING_PLAN_REQUEST_TIMEOUT_MS = TEACHING_PLAN_RN_TIMEOUT_MS;
const COMPREHENSIVE_ANALYSIS_REQUEST_TIMEOUT_MS = COMPREHENSIVE_ANALYSIS_RN_TIMEOUT_MS;

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

    async submitLlmStream(payload: SubmitLlmStreamPayload): Promise<LlmStreamHandle> {
        const requestBody = {
            capability: payload.capability,
            messageId: payload.messageId,
            payload: payload.payload,
            metadata: {
                source: this.clientMetadata.source,
                appVersion: this.clientMetadata.appVersion
            },
            options: payload.options
        };
        return this.postLlmStreamWithRetry(requestBody, payload.capability, payload.messageId, false);
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

    private async postLlmStreamWithRetry(
        body: Record<string, unknown>,
        capability: LlmStreamCapability,
        messageId: string,
        hasRetried: boolean
    ): Promise<LlmStreamHandle> {
        await this.ensureSession();
        const response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/llm-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (response.status === 400) {
            const errorBody = await this.safeParseJson(response);
            if (!hasRetried && this.isUnknownSessionError(errorBody)) {
                this.sessionId = null;
                return this.postLlmStreamWithRetry(body, capability, messageId, true);
            }
            throw new Error(`LLM stream submission failed: ${response.status}`);
        }
        if (!response.ok) {
            throw new Error(`LLM stream submission failed: ${response.status}`);
        }
        const json = await response.json();
        if (!json || typeof json.requestId !== 'string' || typeof json.streamUrl !== 'string') {
            throw new Error('LLM stream response missing requestId or streamUrl');
        }
        logger.info('[MOBILE_PORT] llm stream status', { phase: 'requested', requestId: json.requestId, messageId, capability });
        logger.info('[LLM_STREAM_MIGRATION] mobile-stream-requested', { requestId: json.requestId, capability, messageId });
        return {
            requestId: json.requestId,
            messageId,
            capability,
            stream: this.createLlmStream(json.streamUrl, json.requestId, messageId, capability)
        };
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
        return this.postWrapUpWithRetry(requestBody, moduleId, promptContext.moduleTitle, false);
    }

    private async postWrapUpWithRetry(
        body: Record<string, unknown>,
        moduleId: string,
        moduleTitle: string,
        hasRetried: boolean
    ): Promise<WrapUpAssessmentOverlayData | null> {
        try {
            await this.ensureSession();
        } catch (error) {
            logger.error('[MOBILE_PORT] wrap-up session init failed', { error, moduleId });
            return null;
        }
        if (!this.sessionId) {
            logger.error('[MOBILE_PORT] wrap-up session missing', { moduleId });
            return null;
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
        } catch (error) {
            logger.error('[MOBILE_PORT] wrap-up request failed', { error, moduleId });
            return null;
        } finally {
            clearTimeout(timerId);
        }
        if (response.status === 400) {
            const errorBody = await this.safeParseJson(response);
            if (!hasRetried && this.isUnknownSessionError(errorBody)) {
                this.sessionId = null;
                return this.postWrapUpWithRetry(body, moduleId, moduleTitle, true);
            }
            logger.error('[MOBILE_PORT] wrap-up request rejected', { status: response.status, body: errorBody, moduleId });
            return null;
        }
        if (!response.ok) {
            const errorBody = await this.safeParseJson(response);
            logger.error('[MOBILE_PORT] wrap-up request failed', { status: response.status, body: errorBody, moduleId });
            return null;
        }
        try {
            const overlay = await response.json() as WrapUpAssessmentOverlayData;
            if (overlay && typeof overlay === 'object') {
                return overlay;
            }
        } catch (error) {
            logger.error('[MOBILE_PORT] wrap-up response parse failed', { error, moduleId });
        }
        logger.error('[MOBILE_PORT] wrap-up response missing overlay payload', { moduleId, moduleTitle });
        return null;
    }

    async generateTeachingPlan(payload: TeachingPlanRequestPayload): Promise<TeachingPoint[][]> {
        return this.postTeachingPlanWithRetry(payload, false);
    }

    private async postTeachingPlanWithRetry(body: TeachingPlanRequestPayload, hasRetried: boolean): Promise<TeachingPoint[][]> {
        await this.ensureSession();
        if (!this.sessionId) {
            throw new Error('Session missing for teaching plan generation');
        }
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), TEACHING_PLAN_REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/teaching-plan`, {
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
                return this.postTeachingPlanWithRetry(body, true);
            }
            throw new Error(`Teaching plan generation failed: ${response.status}`);
        }
        if (!response.ok) {
            throw new Error(`Teaching plan generation failed: ${response.status}`);
        }
        const json = await response.json();
        const teachingPlan = json?.teachingPlan;
        if (!Array.isArray(teachingPlan)) {
            throw new Error('Teaching plan response missing teachingPlan');
        }
        return teachingPlan as TeachingPoint[][];
    }

    async getLearnerAnalysis(payload: LearnerAnalysisRequest): Promise<ComprehensiveAnalysisResultType | null> {
        return this.postLearnerAnalysisWithRetry(payload, false);
    }

    private async postLearnerAnalysisWithRetry(body: LearnerAnalysisRequest, hasRetried: boolean): Promise<ComprehensiveAnalysisResultType | null> {
        try {
            await this.ensureSession();
        } catch (error) {
            logger.error('[MOBILE_PORT] learner analysis session init failed', { error });
            return null;
        }
        if (!this.sessionId) {
            logger.error('[MOBILE_PORT] learner analysis session missing');
            return null;
        }
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), COMPREHENSIVE_ANALYSIS_REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/sessions/${this.sessionId}/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } catch (error) {
            logger.error('[MOBILE_PORT] learner analysis request failed', { error });
            return null;
        } finally {
            clearTimeout(timerId);
        }
        if (response.status === 400) {
            const errorBody = await this.safeParseJson(response);
            if (!hasRetried && this.isUnknownSessionError(errorBody)) {
                this.sessionId = null;
                return this.postLearnerAnalysisWithRetry(body, true);
            }
            return null;
        }
        if (!response.ok) {
            return null;
        }
        try {
            const json = await response.json();
            if (!json || typeof json !== 'object') {
                return null;
            }
            return json as ComprehensiveAnalysisResultType;
        } catch (error) {
            logger.error('[MOBILE_PORT] learner analysis parse failed', { error });
            return null;
        }
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
                    const payload = parsed.payload as WrapUpAssessmentOverlayData;
                    const moduleId = typeof payload?.moduleId === 'string' && payload.moduleId ? payload.moduleId : 'unknown';
                    this.bridge.enqueue({ type: 'wrapup:show', moduleId, data: payload });
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

    private createLlmStream(
        streamUrl: string,
        requestId: string,
        messageId: string,
        capability: LlmStreamCapability
    ): AsyncIterable<StreamEvent> {
        if (!this.WebSocketImpl) {
            return this.createErrorStream('DOWNSTREAM_UNAVAILABLE', 'WebSocket implementation missing');
        }
        const queue = new AsyncEventQueue<StreamEvent>();
        const ws = new this.WebSocketImpl(streamUrl);
        let terminalReceived = false;
        logger.info('[MOBILE_PORT] llm stream status', { phase: 'connecting', requestId, messageId, capability });

        ws.onopen = () => {
            logger.info('[MOBILE_PORT] llm stream status', { phase: 'started', requestId, messageId, capability });
        };

        ws.onmessage = event => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'chunk') {
                    queue.push({
                        type: 'chunk',
                        text: parsed.text,
                        requestId: parsed.requestId ?? requestId,
                        messageId: parsed.messageId ?? messageId,
                        capability: parsed.capability ?? capability
                    } as StreamChunk);
                } else if (parsed.type === 'status') {
                    if (parsed.phase === 'completed') {
                        terminalReceived = true;
                    }
                    queue.push({
                        type: 'status',
                        phase: parsed.phase,
                        requestId: parsed.requestId ?? requestId,
                        messageId: parsed.messageId ?? messageId,
                        capability: parsed.capability ?? capability
                    } as StreamStatus);
                } else if (parsed.type === 'error') {
                    terminalReceived = true;
                    queue.push({
                        type: 'error',
                        code: parsed.code,
                        message: parsed.message,
                        requestId: parsed.requestId ?? requestId,
                        messageId: parsed.messageId ?? messageId,
                        capability: parsed.capability ?? capability
                    } as StreamError);
                }
            } catch (error) {
                terminalReceived = true;
                queue.push({ type: 'error', code: 'PARSE_ERROR', message: (error as Error).message, requestId, messageId, capability } as StreamError);
            }
        };

        ws.onerror = event => {
            terminalReceived = true;
            queue.push({ type: 'error', code: 'DOWNSTREAM_UNAVAILABLE', message: event.message ?? 'WebSocket error', requestId, messageId, capability } as StreamError);
        };

        ws.onclose = () => {
            logger.info('[MOBILE_PORT] llm stream status', { phase: 'closed', requestId, messageId, capability });
            if (!terminalReceived) {
                queue.push({ type: 'error', code: 'DOWNSTREAM_UNAVAILABLE', message: 'LLM stream closed before completion', requestId, messageId, capability } as StreamError);
            }
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

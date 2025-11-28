import type { FooterPayload } from '../bridge/contracts';

export interface SelectionContext {
    actionId: string;
    selectedText?: string;
}

export interface SubmitTurnPayload {
    text: string;
    clientTurnId: string;
    selectionContext?: SelectionContext;
}

export interface StreamChunk {
    type: 'chunk';
    text: string;
}

export interface StreamStatus {
    type: 'status';
    phase: 'started' | 'keepalive' | 'completed';
    footer?: FooterPayload;
}

export interface StreamError {
    type: 'error';
    code: string;
    message: string;
}

export interface TurnStreamHandle {
    messageId: string;
    stream: AsyncIterable<StreamChunk | StreamStatus | StreamError>;
}

export interface MermaidRecoveryPayload {
    messageId: string;
    code: string;
    theme?: string;
    errorHash?: string;
    errorMessage?: string;
    context?: Record<string, unknown>;
    mode?: 'auto' | 'llm';
}

export interface MermaidRecoveryResult {
    fixed: boolean;
    fixedCode?: string;
}

export interface BffClientLike {
    ensureSession(): Promise<void>;
    submitTurn(payload: SubmitTurnPayload): Promise<TurnStreamHandle>;
    reconnectIfNeeded(): Promise<void>;
    recoverMermaid(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult>;
}

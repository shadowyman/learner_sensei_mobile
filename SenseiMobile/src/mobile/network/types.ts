import type {
    ComprehensiveAnalysisResultType,
    FooterPayload,
    LearnerAnalysisRequest,
    WrapUpAssessmentOverlayData,
    WrapUpAssessmentPromptContext,
    Phase,
    TeachingPoint,
    SelectionSenseiModalMessagePayload,
    SelectionSenseiModalMessageResult,
    SenseiEnhancementRequestPayload,
    SenseiEnhancementResult
} from '../bridge/contracts';
export type {
    ComprehensiveAnalysisResultType,
    LearnerAnalysisRequest,
    WrapUpAssessmentPromptContext,
    SelectionSenseiModalMessagePayload,
    SelectionSenseiModalMessageResult,
    SenseiEnhancementRequestPayload,
    SenseiEnhancementResult
} from '../bridge/contracts';

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
    requestId?: string;
    messageId?: string;
    capability?: LlmStreamCapability;
}

export interface StreamStatus {
    type: 'status';
    phase: 'started' | 'keepalive' | 'completed';
    footer?: FooterPayload;
    requestId?: string;
    messageId?: string;
    capability?: LlmStreamCapability;
}

export interface StreamError {
    type: 'error';
    code: string;
    message: string;
    requestId?: string;
    messageId?: string;
    capability?: LlmStreamCapability;
}

export interface TurnStreamHandle {
    messageId: string;
    stream: AsyncIterable<StreamChunk | StreamStatus | StreamError>;
}

export type LlmStreamCapability = 'moduleIntroduction' | 'mainSenseiResponse';

export interface SubmitLlmStreamPayload {
    capability: LlmStreamCapability;
    messageId: string;
    payload: Record<string, unknown>;
    options?: {
        allowFallback?: boolean;
        requireRealProvider?: boolean;
    };
}

export interface LlmStreamHandle {
    requestId: string;
    messageId: string;
    capability: LlmStreamCapability;
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

export interface TeachingPlanRequestPayload {
    phase: Phase;
    textToProcess: string;
    moduleTitle?: string;
    moduleGoal?: string;
    conceptsSummary?: string;
}

export interface BffClientLike {
    ensureSession(): Promise<void>;
    submitTurn(payload: SubmitTurnPayload): Promise<TurnStreamHandle>;
    submitLlmStream(payload: SubmitLlmStreamPayload): Promise<LlmStreamHandle>;
    reconnectIfNeeded(): Promise<void>;
    recoverMermaid(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult>;
    generateWrapUp(moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<WrapUpAssessmentOverlayData | null>;
    generateTeachingPlan(payload: TeachingPlanRequestPayload): Promise<TeachingPoint[][]>;
    getLearnerAnalysis(payload: LearnerAnalysisRequest): Promise<ComprehensiveAnalysisResultType | null>;
    runSelectionSenseiModalMessage(payload: SelectionSenseiModalMessagePayload): Promise<SelectionSenseiModalMessageResult>;
    runSenseiEnhancement(payload: SenseiEnhancementRequestPayload): Promise<SenseiEnhancementResult>;
}

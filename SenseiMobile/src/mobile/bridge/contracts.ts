export interface WrapUpAssessmentOverlayData {
    moduleTitle: string;
    summary?: string;
    questions: Array<{ prompt: string; answer: string }>;
}

export type RNToWebMessage =
    | { type: 'app:init'; telemetryEnabled: boolean; theme: string }
    | { type: 'chat:startMessage'; messageId: string; sender: 'user' | 'sensei'; text?: string; reloadable?: boolean }
    | { type: 'chat:update'; messageId: string; text: string; replace?: boolean }
    | { type: 'chat:completeMessage'; messageId: string }
    | { type: 'selectionSensei:invoke'; actionId: SelectionSenseiActionId; selectionId: string; actionLabel?: string; userQuestion?: string }
    | { type: 'saveload:export'; requestId: string }
    | { type: 'saveload:import'; requestId: string; json: string }
    | { type: 'wrapup:requestShow' }
    | { type: 'wrapup:show'; data: WrapUpAssessmentOverlayData }
    | { type: 'footer:update'; payload: FooterPayload }
    | { type: 'theme:update'; value: string }
    | { type: 'telemetry:configure'; enabled: boolean }
    | { type: 'chat:bufferedMode'; active: boolean };

export type WebToRNMessage =
    | { type: 'selection'; phase: 'start' | 'change' | 'end'; text: string; rect: DOMRectLike; viewport: ViewportSnapshot }
    | { type: 'selection:clear' }
    | { type: 'render:progress'; messageId: string; chars: number; elapsedMs: number }
    | { type: 'footer:update'; payload: FooterPayload }
    | { type: 'wrapup:show'; data: WrapUpAssessmentOverlayData }
    | { type: 'saveload:exportResult'; requestId: string; success: boolean; json?: string; error?: string }
    | { type: 'saveload:importResult'; requestId: string; success: boolean; error?: string }
    | { type: 'telemetry:event'; eventName: string; data: Record<string, unknown> }
    | { type: 'mermaid:error'; messageId: string; code: string; errorHash?: string }
    | { type: 'modal:state'; id: string; visible: boolean }
    | { type: 'header:status'; text: string; html?: string }
    | { type: 'webview:error'; message: string; stack?: string };

export interface DOMRectLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ViewportSnapshot {
    width: number;
    height: number;
    scrollY: number;
    devicePixelRatio?: number;
}

export type SelectionSenseiActionId =
    | 'explainSimpler'
    | 'explainWithAnalogy'
    | 'explainInMoreDepth'
    | 'showAnExample'
    | 'showExampleCodeSnippet'
    | 'askQuestion'
    | 'addToNotepad'
    | 'copy'
    | 'share';

export interface FooterPayload {
    confidence: string;
    confusion: string;
    intent: string;
}

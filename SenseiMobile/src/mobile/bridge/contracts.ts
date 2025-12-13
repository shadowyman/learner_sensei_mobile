import type {
  WrapUpAssessmentPromptContext as CoreWrapUpAssessmentPromptContext,
  WrapUpAssessmentQuestion as CoreWrapUpAssessmentQuestion,
  WrapUpAssessmentQuestionType as CoreWrapUpAssessmentQuestionType
} from '@sensei/core/wrapUpAssessment';

export type WrapUpAssessmentQuestionType = CoreWrapUpAssessmentQuestionType;

export type WrapUpAssessmentQuestion = CoreWrapUpAssessmentQuestion;

export interface WrapUpAssessmentOverlayData {
  moduleTitle: string;
  moduleGoal?: string;
  conceptSummaries?: string[];
  questions: WrapUpAssessmentQuestion[];
}

export type WrapUpAssessmentPromptContext = CoreWrapUpAssessmentPromptContext;

export type RNToWebMessage =
  | { type: 'app:init'; telemetryEnabled: boolean; theme: string }
  | { type: 'chat:startMessage'; messageId: string; sender: 'user' | 'sensei'; text?: string; reloadable?: boolean }
  | { type: 'chat:update'; messageId: string; text: string; replace?: boolean }
  | { type: 'chat:completeMessage'; messageId: string }
  | { type: 'ui:inputOffset'; height: number }
  | { type: 'meditation:show'; mode: 'brand' | 'status' }
  | { type: 'selectionSensei:invoke'; actionId: SelectionSenseiActionId; selectionId: string; actionLabel?: string; userQuestion?: string }
  | { type: 'saveload:export'; requestId: string }
  | { type: 'saveload:import'; requestId: string; json: string }
  | { type: 'wrapup:show'; data: WrapUpAssessmentOverlayData }
  | { type: 'wrapup:failed'; moduleId: string; moduleTitle: string }
  | { type: 'footer:update'; payload: FooterPayload }
  | { type: 'theme:update'; value: string }
  | { type: 'telemetry:configure'; enabled: boolean }
  | { type: 'chat:bufferedMode'; active: boolean }
  | { type: 'mermaid:recoverResult'; messageId: string; fixed: boolean; fixedCode?: string };

export type WebToRNMessage =
  | { type: 'selection'; phase: 'start' | 'change' | 'end'; text: string; rect: DOMRectLike; viewport: ViewportSnapshot }
  | { type: 'selection:clear' }
  | { type: 'render:progress'; messageId: string; chars: number; elapsedMs: number }
  | { type: 'footer:update'; payload: FooterPayload }
  | { type: 'wrapup:requestShow'; moduleId: string; promptContext: WrapUpAssessmentPromptContext }
  | { type: 'saveload:exportResult'; requestId: string; success: boolean; json?: string; error?: string }
  | { type: 'saveload:importResult'; requestId: string; success: boolean; error?: string }
  | { type: 'telemetry:event'; eventName: string; data: Record<string, unknown> }
  | { type: 'mermaid:error'; messageId: string; code: string; errorHash?: string }
  | { type: 'mermaid:recover'; messageId: string; code: string; theme?: string; errorHash?: string; errorMessage?: string; mode?: 'auto' | 'llm' }
  | { type: 'modal:state'; id: string; visible: boolean }
  | { type: 'header:status'; text?: string; html?: string; lines?: string[]; navVisible?: boolean }
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

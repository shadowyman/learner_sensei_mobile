import type { FooterPayload, RNToWebMessage } from './bridge/contracts';
import {
  COMPREHENSIVE_ANALYSIS_BRIDGE_TIMEOUT_MS,
  MERMAID_RECOVERY_BRIDGE_TIMEOUT_MS,
  TEACHING_PLAN_BRIDGE_TIMEOUT_MS
} from '@sensei/protocol/timeouts';
import type { Phase, TeachingPoint } from '@sensei/core/teachingPlan';
import type { ComprehensiveAnalysisResultType, LearnerAnalysisRequest } from '@sensei/core/learnerAnalysis';
import { sendToNative } from './webviewBridge';
import { hasPendingWrapUpBridgeRequest, resolveWrapUpBridgeRequest } from './wrapUpBridgeState';

type MermaidResolver = { resolve: (v: { fixed: boolean; fixedCode?: string }) => void; reject: (err: any) => void; timer: number };

const mermaidResolvers = new Map<string, MermaidResolver>();
const MERMAID_BRIDGE_TIMEOUT_MS = MERMAID_RECOVERY_BRIDGE_TIMEOUT_MS;

export function requestMermaidRecoveryViaBridge(payload: {
  messageId: string;
  code: string;
  theme?: string;
  errorHash?: string;
  errorMessage?: string;
  mode?: 'auto' | 'llm';
}): Promise<{ fixed: boolean; fixedCode?: string }> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      mermaidResolvers.delete(payload.messageId);
      reject(new Error('mermaid recovery bridge timeout'));
    }, MERMAID_BRIDGE_TIMEOUT_MS);
    mermaidResolvers.set(payload.messageId, { resolve, reject, timer });
    sendToNative({ type: 'mermaid:recover', ...payload });
  });
}

export function handleMermaidRecoverResult(message: RNToWebMessage): boolean {
  if (message.type !== 'mermaid:recoverResult') return false;
  const resolver = mermaidResolvers.get(message.messageId);
  if (resolver) {
    clearTimeout(resolver.timer);
    mermaidResolvers.delete(message.messageId);
    resolver.resolve({ fixed: message.fixed, fixedCode: message.fixedCode });
  }
  return true;
}

type TeachingPlanResolver = { resolve: (v: TeachingPoint[][]) => void; reject: (err: any) => void; timer: number };

const teachingPlanResolvers = new Map<string, TeachingPlanResolver>();

function createRequestId(prefix: string): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof (c as any).randomUUID === 'function') {
    return `${prefix}-${(c as any).randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function requestTeachingPlanViaBridge(payload: {
  phase: Phase;
  textToProcess: string;
  moduleTitle?: string;
  moduleGoal?: string;
  conceptsSummary?: string;
}): Promise<TeachingPoint[][]> {
  const requestId = createRequestId('teaching-plan');
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      teachingPlanResolvers.delete(requestId);
      reject(new Error('teaching plan bridge timeout'));
    }, TEACHING_PLAN_BRIDGE_TIMEOUT_MS);
    teachingPlanResolvers.set(requestId, { resolve, reject, timer });
    sendToNative({ type: 'teachingPlan:request', requestId, payload });
  });
}

function handleTeachingPlanResult(message: RNToWebMessage): boolean {
  if (message.type !== 'teachingPlan:result') return false;
  const resolver = teachingPlanResolvers.get(message.requestId);
  if (resolver) {
    clearTimeout(resolver.timer);
    teachingPlanResolvers.delete(message.requestId);
    if (!message.success) {
      resolver.reject(new Error(message.error || 'teaching plan request failed'));
    } else if (!Array.isArray(message.teachingPlan)) {
      resolver.reject(new Error('teaching plan response missing teachingPlan'));
    } else {
      resolver.resolve(message.teachingPlan as TeachingPoint[][]);
    }
  }
  return true;
}

type LearnerAnalysisResolver = { resolve: (v: ComprehensiveAnalysisResultType | null) => void; timer: number };

const learnerAnalysisResolvers = new Map<string, LearnerAnalysisResolver>();

export function requestLearnerAnalysisViaBridge(payload: LearnerAnalysisRequest): Promise<ComprehensiveAnalysisResultType | null> {
  const requestId = createRequestId('analysis');
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      learnerAnalysisResolvers.delete(requestId);
      resolve(null);
    }, COMPREHENSIVE_ANALYSIS_BRIDGE_TIMEOUT_MS);
    learnerAnalysisResolvers.set(requestId, { resolve, timer });
    sendToNative({ type: 'analysis:request', requestId, payload });
  });
}

function handleLearnerAnalysisResult(message: RNToWebMessage): boolean {
  if (message.type !== 'analysis:result') return false;
  const resolver = learnerAnalysisResolvers.get(message.requestId);
  if (resolver) {
    clearTimeout(resolver.timer);
    learnerAnalysisResolvers.delete(message.requestId);
    if (!message.success || !message.analysis || typeof message.analysis !== 'object') {
      resolver.resolve(null);
    } else {
      resolver.resolve(message.analysis as ComprehensiveAnalysisResultType);
    }
  }
  return true;
}

type SaveLoadService = {
  exportSessionAsJson: () => Promise<string>;
  restoreFromSerializedJson: (json: string) => Promise<void>;
};

export function createWebviewMessageHandler(deps: {
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void };
  sendToNative: (msg: any) => void;
  saveLoad: SaveLoadService;
  displayMessage: (m: any) => Promise<void>;
  streamingMessagesRawText: Map<string, string>;
  SENDER_DISPLAY_NAMES: Record<'user' | 'sensei', string>;
  processMermaidBlocks: (messageId: string) => Promise<void>;
  presentWrapUpAssessmentOverlay: (params: { overlay: any | null; failed: boolean; moduleTitle: string | null }) => Promise<void>;
  applyFooterPayload: (payload: FooterPayload) => void;
  handleUserInputText: (text: string) => Promise<void>;
  updateMessageStream: (id: string, text: string) => Promise<void>;
  invokeSelectionSenseiBridgeAction: (actionId: string, payload: { actionLabel?: string; userQuestion?: string }) => void;
  showMeditationOverlayFromNative: (mode: 'brand' | 'status') => void;
}) {
  const applyInputOffset = (height: number) => {
    const h = Math.max(0, Math.round(height));
    deps.logger.info('[MOBILE_PORT] webview bridge ui:inputOffset', { height: h });
    const targets: HTMLElement[] = [];
    const primary = document.getElementById('message-area');
    if (primary) targets.push(primary);
    document.querySelectorAll<HTMLElement>('.chat-messages').forEach((el) => {
      if (!targets.includes(el)) targets.push(el);
    });
    const extra = 32; // default bottom padding
    targets.forEach((messageArea) => {
      messageArea.style.paddingBottom = `${extra + h}px`;
      (messageArea.style as any).scrollMarginBottom = `${extra + h}px`;
    });
    document.documentElement.style.setProperty('--native-input-offset', `${h}px`);
  };

  return async function handleReactNativeMessage(message: RNToWebMessage): Promise<void> {
    deps.logger.info('[MOBILE_PORT] webview bridge', { direction: 'to-web', type: message.type });
    if (handleMermaidRecoverResult(message)) return;
    if (handleTeachingPlanResult(message)) return;
    if (handleLearnerAnalysisResult(message)) return;
    switch (message.type) {
      case 'ui:inputOffset': {
        applyInputOffset(message.height);
        break;
      }
      case 'saveload:export': {
        try {
          const json = await deps.saveLoad.exportSessionAsJson();
          deps.sendToNative({ type: 'saveload:exportResult', requestId: message.requestId, success: true, json });
        } catch (error) {
          deps.logger.error('[MOBILE_PORT] webview bridge export error', { error });
          deps.sendToNative({ type: 'saveload:exportResult', requestId: message.requestId, success: false, error: (error as Error).message });
        }
        break;
      }
      case 'saveload:import': {
        try {
          await deps.saveLoad.restoreFromSerializedJson(message.json);
          deps.sendToNative({ type: 'saveload:importResult', requestId: message.requestId, success: true });
        } catch (error) {
          deps.sendToNative({ type: 'saveload:importResult', requestId: message.requestId, success: false, error: (error as Error).message } as any);
        }
        break;
      }
      case 'chat:startMessage': {
        const sender = message.sender;
        const startPayload = {
          id: message.messageId,
          sender,
          displayName: deps.SENDER_DISPLAY_NAMES[sender],
          text: message.text ?? '',
          timestamp: new Date(),
          isLoading: sender === 'sensei' && !message.text,
          isReloadable: Boolean(message.reloadable),
          skipMermaid: true
        };
        await deps.displayMessage(startPayload);
        deps.streamingMessagesRawText.set(message.messageId, message.text ?? '');
        if (message.text) {
          await deps.processMermaidBlocks(message.messageId);
        }
        break;
      }
      case 'chat:update': {
        const previous = deps.streamingMessagesRawText.get(message.messageId) ?? '';
        const next = previous + message.text;
        deps.streamingMessagesRawText.set(message.messageId, next);
        await deps.updateMessageStream(message.messageId, next);
        break;
      }
      case 'chat:completeMessage': {
        const bubble = document.getElementById(message.messageId);
        const senderAttr: 'user' | 'sensei' = bubble?.dataset.sender === 'user' ? 'user' : 'sensei';
        const finalText = deps.streamingMessagesRawText.get(message.messageId) ?? '';
        await deps.displayMessage({
          id: message.messageId,
          sender: senderAttr,
          displayName: deps.SENDER_DISPLAY_NAMES[senderAttr],
          text: finalText,
          timestamp: new Date(),
          isLoading: false,
          isReloadable: senderAttr === 'sensei',
          skipMermaid: true
        });
        await deps.processMermaidBlocks(message.messageId);
        break;
      }
      case 'chat:userInput': {
        try {
          await deps.handleUserInputText(message.text);
        } catch (error) {
          deps.logger.error('[MOBILE_PORT] webview bridge user input error', { error });
        } finally {
          deps.sendToNative({ type: 'chat:turnComplete' });
        }
        break;
      }
      case 'wrapup:show': {
        if (!hasPendingWrapUpBridgeRequest(message.moduleId)) {
          deps.logger.info('[WRAP_UP_ASSESSMENT] bridge show ignored (no pending request)', {
            moduleId: message.moduleId
          });
          break;
        }
        resolveWrapUpBridgeRequest(message.moduleId);
        await deps.presentWrapUpAssessmentOverlay({
          overlay: message.data,
          failed: false,
          moduleTitle: message.data?.moduleTitle ?? null
        });
        break;
      }
      case 'wrapup:failed': {
        if (!hasPendingWrapUpBridgeRequest(message.moduleId)) {
          deps.logger.info('[WRAP_UP_ASSESSMENT] bridge failed ignored (no pending request)', {
            moduleId: message.moduleId
          });
          break;
        }
        resolveWrapUpBridgeRequest(message.moduleId);
        await deps.presentWrapUpAssessmentOverlay({
          overlay: null,
          failed: true,
          moduleTitle: message.moduleTitle ?? null
        });
        break;
      }
      case 'footer:update': {
        deps.applyFooterPayload(message.payload);
        break;
      }
      case 'selectionSensei:invoke': {
        deps.invokeSelectionSenseiBridgeAction(message.actionId, {
          actionLabel: message.actionLabel,
          userQuestion: message.userQuestion
        });
        break;
      }
      case 'telemetry:configure': {
        (window as any).__telemetryEnabled = message.enabled;
        break;
      }
      case 'meditation:show': {
        deps.showMeditationOverlayFromNative(message.mode);
        break;
      }
      default:
        break;
    }
  };
}

import type { RNToWebMessage } from './bridge/contracts';
import { MERMAID_RECOVERY_TIMEOUT_MS } from '@sensei/core/modelUsage';
import { sendToNative } from './webviewBridge';

type MermaidResolver = { resolve: (v: { fixed: boolean; fixedCode?: string }) => void; reject: (err: any) => void; timer: number };

const mermaidResolvers = new Map<string, MermaidResolver>();
const MERMAID_BRIDGE_TIMEOUT_MS = MERMAID_RECOVERY_TIMEOUT_MS + 4000;

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
  showWrapUpAssessmentOverlay: (data: any) => void;
  updateFooter: (footer: any) => void;
  updateMessageStream: (id: string, text: string) => Promise<void>;
  invokeSelectionSenseiBridgeAction: (actionId: string, payload: { actionLabel?: string; userQuestion?: string }) => void;
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
      case 'wrapup:show': {
        deps.showWrapUpAssessmentOverlay(message.data);
        break;
      }
      case 'footer:update': {
        deps.updateFooter(message.payload);
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
      default:
        break;
    }
  };
}

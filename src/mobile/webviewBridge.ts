import type { RNToWebMessage, WebToRNMessage } from './bridge/contracts';
import { logger } from '../logger';

type NativeHandler = (message: RNToWebMessage) => void;

let postMessageFn: ((payload: string) => void) | null = null;
let nativeHandler: NativeHandler | null = null;

function resolvePostMessage(): void {
    const channel = (window as any)?.ReactNativeWebView;
    if (channel && typeof channel.postMessage === 'function') {
        postMessageFn = (payload: string) => channel.postMessage(payload);
    }
}

function handleIncoming(event: MessageEvent<string>): void {
    if (!event?.data) {
        return;
    }
    try {
        const parsed: RNToWebMessage = JSON.parse(event.data);
        nativeHandler?.(parsed);
    } catch (error) {
        logger.warn('[MOBILE_PORT] webview bridge parse error', { error });
    }
}

export function initializeWebviewBridge(handler: NativeHandler): void {
    nativeHandler = handler;
    resolvePostMessage();
    window.addEventListener('message', handleIncoming);
    document.addEventListener('message', handleIncoming as any);
}

export function sendToNative(message: WebToRNMessage): void {
    if (!postMessageFn) {
        resolvePostMessage();
    }
    if (!postMessageFn) {
        return;
    }
    try {
        postMessageFn(JSON.stringify(message));
        logger.info('[MOBILE_PORT] webview bridge', { direction: 'to-native', type: message.type });
    } catch (error) {
        logger.warn('[MOBILE_PORT] webview bridge send error', { error });
    }
}

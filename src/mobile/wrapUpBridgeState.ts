import { WRAP_UP_ASSESSMENT_BRIDGE_TIMEOUT_MS } from '@sensei/protocol/timeouts';
import type { RNToWebMessage } from './bridge/contracts';

type PendingWrapUpRequest = {
  moduleId: string;
  moduleTitle: string;
  timer: number;
};

let pending: PendingWrapUpRequest | null = null;

function emitLocalBridgeMessage(message: RNToWebMessage): void {
  if (typeof window === 'undefined') {
    return;
  }
  const payload = JSON.stringify(message);
  try {
    const event = new MessageEvent('message', { data: payload });
    window.dispatchEvent(event);
  } catch (_) {
    try {
      window.postMessage(payload, '*');
    } catch (_) {}
  }
  try {
    const docEvent = new MessageEvent('message', { data: payload });
    document.dispatchEvent(docEvent as any);
  } catch (_) {}
}

export function beginWrapUpBridgeRequest(params: { moduleId: string; moduleTitle: string }): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const moduleId = params.moduleId;
  const moduleTitle = params.moduleTitle;
  if (pending && pending.moduleId === moduleId) {
    return false;
  }
  if (pending) {
    clearTimeout(pending.timer);
    pending = null;
  }
  const timer = window.setTimeout(() => {
    if (!pending || pending.moduleId !== moduleId) {
      return;
    }
    emitLocalBridgeMessage({ type: 'wrapup:failed', moduleId, moduleTitle });
    if (pending && pending.moduleId === moduleId) {
      pending = null;
    }
  }, WRAP_UP_ASSESSMENT_BRIDGE_TIMEOUT_MS);
  pending = { moduleId, moduleTitle, timer };
  return true;
}

export function resolveWrapUpBridgeRequest(moduleId: string): boolean {
  if (!pending || pending.moduleId !== moduleId) {
    return false;
  }
  clearTimeout(pending.timer);
  pending = null;
  return true;
}

export function hasPendingWrapUpBridgeRequest(moduleId: string): boolean {
  return Boolean(pending && pending.moduleId === moduleId);
}

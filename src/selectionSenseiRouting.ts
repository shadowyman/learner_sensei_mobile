import type { SelectionSenseiModalMessagePayload, SelectionSenseiModalMessageResult } from './mobile/bridge/contracts';

export type SelectionSenseiModalRequestMode = 'bridge' | 'local';

const LLM_TOOLBAR_ACTIONS = new Set([
  'explainSimpler',
  'explainWithAnalogy',
  'explainInMoreDepth',
  'showAnExample',
  'showExampleCodeSnippet',
  'askQuestion'
]);

function assertSelectionSenseiModalPayload(payload: SelectionSenseiModalMessagePayload): void {
  if (payload.mode === 'toolbarAction' && !LLM_TOOLBAR_ACTIONS.has(payload.actionType)) {
    throw new Error('Selection Sensei action is not available for modal LLM routing');
  }
  if (payload.mode === 'followUp' && !LLM_TOOLBAR_ACTIONS.has(payload.initialActionType)) {
    throw new Error('Selection Sensei initial action is not available for modal LLM routing');
  }
}

export async function requestSelectionSenseiModalMessage<T extends SelectionSenseiModalMessageResult>(params: {
  isMobileWebView: boolean;
  payload: SelectionSenseiModalMessagePayload;
  requestViaBridge?: (payload: SelectionSenseiModalMessagePayload) => Promise<T>;
  generateLocal: () => Promise<T>;
}): Promise<{ mode: SelectionSenseiModalRequestMode; result: T }> {
  assertSelectionSenseiModalPayload(params.payload);
  if (params.isMobileWebView) {
    if (!params.requestViaBridge) {
      throw new Error('Selection Sensei native bridge unavailable');
    }
    const result = await params.requestViaBridge(params.payload);
    return { mode: 'bridge', result };
  }
  const result = await params.generateLocal();
  return { mode: 'local', result };
}

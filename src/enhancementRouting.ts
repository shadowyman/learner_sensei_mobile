import type { SenseiEnhancementRequestPayload, SenseiEnhancementResult } from './mobile/bridge/contracts';

export type SenseiEnhancementRouteResult =
  | { mode: 'bridge'; result: SenseiEnhancementResult }
  | { mode: 'local'; result: SenseiEnhancementResult };

export async function requestSenseiEnhancementViaRoute(params: {
  isMobileWebView: boolean;
  payload: SenseiEnhancementRequestPayload;
  requestViaBridge?: (payload: SenseiEnhancementRequestPayload) => Promise<SenseiEnhancementResult>;
  generateLocal: () => Promise<SenseiEnhancementResult>;
}): Promise<SenseiEnhancementRouteResult> {
  if (params.isMobileWebView) {
    if (!params.requestViaBridge) {
      throw new Error('Sensei enhancement native bridge unavailable');
    }
    const result = await params.requestViaBridge(params.payload);
    return { mode: 'bridge', result };
  }

  const result = await params.generateLocal();
  return { mode: 'local', result };
}

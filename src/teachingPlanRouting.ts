import type { Phase } from '@sensei/core/teachingPlan';

export type TeachingPlanRequestMode = 'bridge' | 'local';

export type TeachingPlanRequestPayload = {
  phase: Phase;
  textToProcess: string;
  moduleTitle?: string;
  moduleGoal?: string;
  conceptsSummary?: string;
};

export async function requestTeachingPlan<T>(params: {
  isMobileWebView: boolean;
  payload: TeachingPlanRequestPayload;
  requestViaBridge: (payload: TeachingPlanRequestPayload) => Promise<T>;
  generateLocal: () => Promise<T>;
}): Promise<{ mode: TeachingPlanRequestMode; result: T }> {
  if (params.isMobileWebView) {
    const result = await params.requestViaBridge(params.payload);
    return { mode: 'bridge', result };
  }
  const result = await params.generateLocal();
  return { mode: 'local', result };
}

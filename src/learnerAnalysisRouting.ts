import type { LearnerAnalysisRequest } from '@sensei/core/learnerAnalysis';

export type LearnerAnalysisRequestMode = 'bridge' | 'local';

export async function requestLearnerAnalysis<T>(params: {
  isMobileWebView: boolean;
  payload: LearnerAnalysisRequest;
  requestViaBridge: (payload: LearnerAnalysisRequest) => Promise<T>;
  generateLocal: () => Promise<T>;
}): Promise<{ mode: LearnerAnalysisRequestMode; result: T }> {
  if (params.isMobileWebView) {
    const result = await params.requestViaBridge(params.payload);
    return { mode: 'bridge', result };
  }
  const result = await params.generateLocal();
  return { mode: 'local', result };
}

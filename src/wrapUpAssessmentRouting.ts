import type { WrapUpAssessmentPromptContext } from '@sensei/core/wrapUpAssessment';

export type WrapUpAssessmentRequestMode = 'bridge' | 'local';

export async function requestWrapUpAssessment<T>(params: {
    isMobileWebView: boolean;
    moduleId: string;
    promptContext: WrapUpAssessmentPromptContext;
    requestViaBridge: (payload: { moduleId: string; promptContext: WrapUpAssessmentPromptContext }) => void;
    generateLocal: () => Promise<T>;
}): Promise<{ mode: WrapUpAssessmentRequestMode; result: T | null }> {
    if (params.isMobileWebView) {
        params.requestViaBridge({ moduleId: params.moduleId, promptContext: params.promptContext });
        return { mode: 'bridge', result: null };
    }
    const result = await params.generateLocal();
    return { mode: 'local', result };
}

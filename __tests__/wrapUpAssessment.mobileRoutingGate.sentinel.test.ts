import { requestWrapUpAssessment } from '../src/wrapUpAssessmentRouting';

describe('Wrap Up assessment mobile routing gate', () => {
  test('mobile WebView path uses bridge and never calls local generator', async () => {
    const promptContext = {
      moduleTitle: 'Module',
      moduleGoal: 'Goal',
      solidifyContent: '',
      conceptSummaries: ['Concept 1']
    };
    const requestViaBridge = jest.fn();
    const generateLocal = jest.fn().mockResolvedValue({ questions: [] });

    const result = await requestWrapUpAssessment({
      isMobileWebView: true,
      moduleId: 'module-1',
      promptContext,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({ mode: 'bridge', result: null });
    expect(requestViaBridge).toHaveBeenCalledWith({ moduleId: 'module-1', promptContext });
    expect(generateLocal).not.toHaveBeenCalled();
  });
});

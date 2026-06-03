import { requestLearnerAnalysis } from '../src/learnerAnalysisRouting';

describe('Learner analysis mobile routing gate', () => {
  test('mobile WebView path uses bridge and never calls local generator', async () => {
    const payload = {
      userInputText: 'hello',
      lastSenseiMsg: 'Try the base case.',
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: [],
      phase: 'Unknown'
    } as const;
    const requestViaBridge = jest.fn().mockResolvedValue('bridge-result');
    const generateLocal = jest.fn().mockResolvedValue('local-result');

    const result = await requestLearnerAnalysis({
      isMobileWebView: true,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({ mode: 'bridge', result: 'bridge-result' });
    expect(requestViaBridge).toHaveBeenCalledWith(payload);
    expect(generateLocal).not.toHaveBeenCalled();
  });

  test('desktop path uses local generator', async () => {
    const payload = {
      userInputText: 'hello',
      lastSenseiMsg: 'Try the base case.',
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: [],
      phase: 'Unknown'
    } as const;
    const requestViaBridge = jest.fn().mockResolvedValue('bridge-result');
    const generateLocal = jest.fn().mockResolvedValue('local-result');

    const result = await requestLearnerAnalysis({
      isMobileWebView: false,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({ mode: 'local', result: 'local-result' });
    expect(generateLocal).toHaveBeenCalledTimes(1);
    expect(requestViaBridge).not.toHaveBeenCalled();
  });
});


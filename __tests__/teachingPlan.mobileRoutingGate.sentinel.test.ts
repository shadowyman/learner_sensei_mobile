import { requestTeachingPlan } from '../src/teachingPlanRouting';

describe('Teaching plan mobile routing gate', () => {
  test('mobile WebView path uses bridge and never calls local generator', async () => {
    const payload = { phase: 'IntroIllustrate', textToProcess: 'Example text' } as const;
    const requestViaBridge = jest.fn().mockResolvedValue('bridge-result');
    const generateLocal = jest.fn().mockResolvedValue('local-result');

    const result = await requestTeachingPlan({
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
    const payload = { phase: 'IntroIllustrate', textToProcess: 'Example text' } as const;
    const requestViaBridge = jest.fn().mockResolvedValue('bridge-result');
    const generateLocal = jest.fn().mockResolvedValue('local-result');

    const result = await requestTeachingPlan({
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


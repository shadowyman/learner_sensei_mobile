const loadEnhancementRouting = (): any => require('../src/enhancementRouting');

const enhancementPayload = () => ({
  originalMarkdown: [
    '# Recursion',
    '',
    'A base case stops the recursive chain.',
    '',
    '```mermaid',
    'graph TD',
    '  A-->B',
    '```'
  ].join('\n'),
  wordCount: 7
});

const forbiddenBridgeFields = [
  'prompt',
  'finalPrompt',
  'promptText',
  'message',
  'instruction',
  'systemInstruction',
  'model',
  'temperature',
  'providerOptions',
  'safetySettings',
  'config',
  'tools',
  'chat',
  'history'
];

const expectNoPromptControls = (payload: Record<string, unknown>) => {
  forbiddenBridgeFields.forEach((field) => {
    expect(payload).not.toHaveProperty(field);
  });
};

describe('Enhancement mobile routing red gate', () => {
  test('mobile WebView path uses bridge with structured payload and never calls local provider', async () => {
    const { requestSenseiEnhancementViaRoute } = loadEnhancementRouting();
    const payload = enhancementPayload();
    const requestViaBridge = jest.fn().mockResolvedValue({
      enhancements: [
        {
          key: 'A base case stops the recursive chain.',
          value: 'This gives recursion a concrete stopping condition.',
          insertType: 'append'
        }
      ],
      metadata: { source: 'bridge' }
    });
    const generateLocal = jest.fn().mockResolvedValue({
      enhancements: [],
      metadata: { source: 'local' }
    });

    const result = await requestSenseiEnhancementViaRoute({
      isMobileWebView: true,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({
      mode: 'bridge',
      result: {
        enhancements: [
          {
            key: 'A base case stops the recursive chain.',
            value: 'This gives recursion a concrete stopping condition.',
            insertType: 'append'
          }
        ],
        metadata: { source: 'bridge' }
      }
    });
    expect(requestViaBridge).toHaveBeenCalledWith(payload);
    expect(generateLocal).not.toHaveBeenCalled();
    expectNoPromptControls(requestViaBridge.mock.calls[0][0]);
  });

  test('desktop path uses local Core browser compatibility generator', async () => {
    const { requestSenseiEnhancementViaRoute } = loadEnhancementRouting();
    const payload = enhancementPayload();
    const requestViaBridge = jest.fn().mockResolvedValue({
      enhancements: [],
      metadata: { source: 'bridge' }
    });
    const generateLocal = jest.fn().mockResolvedValue({
      enhancements: [
        {
          key: 'A base case stops the recursive chain.',
          value: 'Desktop compatibility response.',
          insertType: 'append'
        }
      ],
      metadata: { source: 'local' }
    });

    const result = await requestSenseiEnhancementViaRoute({
      isMobileWebView: false,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({
      mode: 'local',
      result: {
        enhancements: [
          {
            key: 'A base case stops the recursive chain.',
            value: 'Desktop compatibility response.',
            insertType: 'append'
          }
        ],
        metadata: { source: 'local' }
      }
    });
    expect(generateLocal).toHaveBeenCalledTimes(1);
    expect(requestViaBridge).not.toHaveBeenCalled();
  });

  test('mobile bridge missing fails closed without local provider fallback', async () => {
    const { requestSenseiEnhancementViaRoute } = loadEnhancementRouting();
    const generateLocal = jest.fn().mockResolvedValue({
      enhancements: [],
      metadata: { source: 'local' }
    });

    await expect(requestSenseiEnhancementViaRoute({
      isMobileWebView: true,
      payload: enhancementPayload(),
      requestViaBridge: undefined,
      generateLocal
    })).rejects.toThrow(/bridge|native/i);
    expect(generateLocal).not.toHaveBeenCalled();
  });
});

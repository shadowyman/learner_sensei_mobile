const loadSelectionSenseiRouting = (): any => require('../src/selectionSenseiRouting');

const toolbarPayload = () => ({
  mode: 'toolbarAction',
  actionType: 'explainSimpler',
  selectedText: 'base case stops recursion',
  originalSenseiMessageText: 'Original explanation about recursion and base cases.',
  actionLabel: 'Simpler'
});

const followUpPayload = () => ({
  mode: 'followUp',
  modalConversationId: 'modal-1',
  selectedText: 'base case stops recursion',
  originalSenseiMessageText: 'Original explanation about recursion and base cases.',
  initialActionType: 'explainSimpler',
  initialActionLabel: 'Simpler',
  initialResponse: {
    suggestedTitle: 'Base Case',
    explanation: 'A base case stops recursion.'
  },
  modalTranscript: [
    { role: 'user', text: 'Can you explain this simply?' },
    { role: 'sensei', text: 'A base case gives recursion a stopping point.' }
  ],
  question: 'How does that prevent an infinite loop?'
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

describe('Selection Sensei mobile routing red gate', () => {
  test('mobile toolbar action uses bridge with structured domain payload and never calls local provider', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const payload = toolbarPayload();
    const requestViaBridge = jest.fn().mockResolvedValue({ suggestedTitle: 'Bridge', explanation: 'Bridge response' });
    const generateLocal = jest.fn().mockResolvedValue({ suggestedTitle: 'Local', explanation: 'Local response' });

    const result = await requestSelectionSenseiModalMessage({
      isMobileWebView: true,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({
      mode: 'bridge',
      result: { suggestedTitle: 'Bridge', explanation: 'Bridge response' }
    });
    expect(requestViaBridge).toHaveBeenCalledWith(payload);
    expect(generateLocal).not.toHaveBeenCalled();
    expectNoPromptControls(requestViaBridge.mock.calls[0][0]);
  });

  test('mobile follow-up uses bridge with explicit modal context and never calls local provider', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const payload = followUpPayload();
    const requestViaBridge = jest.fn().mockResolvedValue({ explanation: 'Follow-up bridge response' });
    const generateLocal = jest.fn().mockResolvedValue({ explanation: 'Follow-up local response' });

    const result = await requestSelectionSenseiModalMessage({
      isMobileWebView: true,
      payload,
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({
      mode: 'bridge',
      result: { explanation: 'Follow-up bridge response' }
    });
    expect(requestViaBridge).toHaveBeenCalledWith(payload);
    expect(generateLocal).not.toHaveBeenCalled();
    expect(requestViaBridge.mock.calls[0][0]).toMatchObject({
      mode: 'followUp',
      modalConversationId: 'modal-1',
      question: 'How does that prevent an infinite loop?'
    });
    expect(requestViaBridge.mock.calls[0][0].modalTranscript).toHaveLength(2);
    expectNoPromptControls(requestViaBridge.mock.calls[0][0]);
  });

  test('mobile bridge missing fails closed for toolbar action without local provider fallback', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const generateLocal = jest.fn().mockResolvedValue({ suggestedTitle: 'Local', explanation: 'Local response' });

    await expect(requestSelectionSenseiModalMessage({
      isMobileWebView: true,
      payload: toolbarPayload(),
      requestViaBridge: undefined,
      generateLocal
    })).rejects.toThrow(/bridge|native/i);
    expect(generateLocal).not.toHaveBeenCalled();
  });

  test('mobile bridge missing fails closed for follow-up without local provider fallback', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const generateLocal = jest.fn().mockResolvedValue({ explanation: 'Local response' });

    await expect(requestSelectionSenseiModalMessage({
      isMobileWebView: true,
      payload: followUpPayload(),
      requestViaBridge: undefined,
      generateLocal
    })).rejects.toThrow(/bridge|native/i);
    expect(generateLocal).not.toHaveBeenCalled();
  });

  test('desktop compatibility uses local Core path for toolbar action', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const requestViaBridge = jest.fn().mockResolvedValue({ suggestedTitle: 'Bridge', explanation: 'Bridge response' });
    const generateLocal = jest.fn().mockResolvedValue({ suggestedTitle: 'Local', explanation: 'Local response' });

    const result = await requestSelectionSenseiModalMessage({
      isMobileWebView: false,
      payload: toolbarPayload(),
      requestViaBridge,
      generateLocal
    });

    expect(result).toEqual({
      mode: 'local',
      result: { suggestedTitle: 'Local', explanation: 'Local response' }
    });
    expect(generateLocal).toHaveBeenCalledTimes(1);
    expect(requestViaBridge).not.toHaveBeenCalled();
  });

  test('non-LLM toolbar actions are not routed through bridge or local provider', async () => {
    const { requestSelectionSenseiModalMessage } = loadSelectionSenseiRouting();
    const requestViaBridge = jest.fn().mockResolvedValue({ suggestedTitle: 'Bridge', explanation: 'Bridge response' });
    const generateLocal = jest.fn().mockResolvedValue({ suggestedTitle: 'Local', explanation: 'Local response' });

    await expect(requestSelectionSenseiModalMessage({
      isMobileWebView: true,
      payload: {
        ...toolbarPayload(),
        actionType: 'addToNotepad'
      },
      requestViaBridge,
      generateLocal
    })).rejects.toThrow(/not available|action/i);

    expect(requestViaBridge).not.toHaveBeenCalled();
    expect(generateLocal).not.toHaveBeenCalled();
  });
});

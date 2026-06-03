import { createWebviewMessageHandler } from '../src/mobile/webviewMessageRouter';

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    logger: { info: jest.fn(), error: jest.fn() },
    sendToNative: jest.fn(),
    saveLoad: {
      exportSessionAsJson: jest.fn(),
      restoreFromSerializedJson: jest.fn()
    },
    displayMessage: jest.fn(),
    streamingMessagesRawText: new Map<string, string>(),
    SENDER_DISPLAY_NAMES: { user: 'You', sensei: 'Recursive Sensei' },
    processMermaidBlocks: jest.fn(),
    presentWrapUpAssessmentOverlay: jest.fn(),
    applyFooterPayload: jest.fn(),
    handleUserInputText: jest.fn().mockResolvedValue(undefined),
    updateMessageStream: jest.fn(),
    invokeSelectionSenseiBridgeAction: jest.fn(),
    showMeditationOverlayFromNative: jest.fn(),
    ...overrides
  };
}

describe('WebView turn completion sentinel', () => {
  it('reports completion after WebView-owned user input resolves', async () => {
    const deps = createDeps();
    const handler = createWebviewMessageHandler(deps as any);

    await handler({ type: 'chat:userInput', text: 'hello' });

    expect(deps.handleUserInputText).toHaveBeenCalledWith('hello');
    expect(deps.sendToNative).toHaveBeenCalledWith({ type: 'chat:turnComplete' });
  });

  it('reports completion after WebView-owned user input throws', async () => {
    const error = new Error('turn failed');
    const deps = createDeps({
      handleUserInputText: jest.fn().mockRejectedValue(error)
    });
    const handler = createWebviewMessageHandler(deps as any);

    await handler({ type: 'chat:userInput', text: 'hello' });

    expect(deps.handleUserInputText).toHaveBeenCalledWith('hello');
    expect(deps.sendToNative).toHaveBeenCalledWith({ type: 'chat:turnComplete' });
    expect(deps.logger.error).toHaveBeenCalled();
  });
});

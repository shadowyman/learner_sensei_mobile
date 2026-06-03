import { requestMermaidRecoveryViaBridge, handleMermaidRecoverResult } from '../src/mobile/webviewMessageRouter';
import { sendToNative } from '../src/mobile/webviewBridge';

jest.mock('../src/mobile/webviewBridge', () => ({
  sendToNative: jest.fn()
}));

describe('Mermaid recovery mobile routing gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('mobile WebView path sends structured bridge request and resolves from RN result', async () => {
    const promise = requestMermaidRecoveryViaBridge({
      messageId: 'mermaid-msg-1',
      code: 'graph TD\nA-->',
      theme: 'warm',
      errorMessage: 'Parse error',
      mode: 'llm'
    });

    expect(sendToNative).toHaveBeenCalledWith({
      type: 'mermaid:recover',
      messageId: 'mermaid-msg-1',
      code: 'graph TD\nA-->',
      theme: 'warm',
      errorMessage: 'Parse error',
      mode: 'llm'
    });

    expect(handleMermaidRecoverResult({
      type: 'mermaid:recoverResult',
      messageId: 'mermaid-msg-1',
      fixed: true,
      fixedCode: 'graph TD\nA-->B'
    })).toBe(true);

    await expect(promise).resolves.toEqual({ fixed: true, fixedCode: 'graph TD\nA-->B' });
  });
});

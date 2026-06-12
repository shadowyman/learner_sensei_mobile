import { initializeEnhancementManager, resetEnhancementState, toggleEnhancement } from '../src/enhancementManager';
import { requestSenseiEnhancementViaRoute } from '../src/enhancementRouting';
import { requestSenseiEnhancement } from '../src/geminiService';

jest.mock('../src/enhancementRouting', () => ({
  requestSenseiEnhancementViaRoute: jest.fn()
}));

jest.mock('../src/mobile/webviewMessageRouter', () => ({
  requestSenseiEnhancementViaBridge: jest.fn()
}));

jest.mock('../src/geminiService', () => ({
  requestSenseiEnhancement: jest.fn()
}));

const routeMock = requestSenseiEnhancementViaRoute as jest.MockedFunction<typeof requestSenseiEnhancementViaRoute>;
const localRequestMock = requestSenseiEnhancement as jest.MockedFunction<typeof requestSenseiEnhancement>;

const setupManager = (markdown = 'A base case stops recursion.\n\n```mermaid\ngraph TD\nA-->B\n```') => {
  const getAI = jest.fn(() => ({ provider: 'desktop-ai' } as any));
  const renderMarkdown = jest.fn(() => Promise.resolve());
  const setLoadingState = jest.fn();
  const setActiveState = jest.fn();
  const streamingMap = new Map<string, string>([['message-1', markdown]]);
  initializeEnhancementManager({
    getAI,
    streamingMap,
    renderMarkdown,
    setLoadingState,
    setActiveState
  });
  getAI.mockClear();
  return {
    getAI,
    renderMarkdown,
    setLoadingState,
    setActiveState,
    streamingMap
  };
};

describe('toggleEnhancement mobile routing', () => {
  beforeEach(() => {
    routeMock.mockReset();
    localRequestMock.mockReset();
    resetEnhancementState('message-1');
    delete (window as any).__SENSEI_MOBILE_BUILD__;
  });

  afterEach(() => {
    resetEnhancementState('message-1');
    delete (window as any).__SENSEI_MOBILE_BUILD__;
  });

  test('mobile build path routes through bridge without calling getAI', async () => {
    (window as any).__SENSEI_MOBILE_BUILD__ = true;
    const deps = setupManager();
    routeMock.mockResolvedValue({
      mode: 'bridge',
      result: { enhancements: [] }
    });

    await toggleEnhancement('message-1');

    expect(deps.getAI).not.toHaveBeenCalled();
    expect(routeMock).toHaveBeenCalledWith(expect.objectContaining({
      isMobileWebView: true,
      payload: {
        originalMarkdown: 'A base case stops recursion.',
        wordCount: 5
      },
      requestViaBridge: expect.any(Function),
      generateLocal: expect.any(Function)
    }));
    expect(deps.setLoadingState).toHaveBeenNthCalledWith(1, 'message-1', true);
    expect(deps.setLoadingState).toHaveBeenLastCalledWith('message-1', false);
    expect(deps.setActiveState).toHaveBeenLastCalledWith('message-1', false);
  });

  test('mobile bridge failure clears state without rendering markdown', async () => {
    (window as any).__SENSEI_MOBILE_BUILD__ = true;
    const deps = setupManager();
    routeMock.mockRejectedValue(new Error('Sensei enhancement native bridge unavailable'));

    await toggleEnhancement('message-1');

    expect(deps.getAI).not.toHaveBeenCalled();
    expect(deps.renderMarkdown).not.toHaveBeenCalled();
    expect(deps.setLoadingState).toHaveBeenNthCalledWith(1, 'message-1', true);
    expect(deps.setLoadingState).toHaveBeenLastCalledWith('message-1', false);
    expect(deps.setActiveState).toHaveBeenLastCalledWith('message-1', false);
  });

  test('desktop compatibility calls getAI through local route callback', async () => {
    const deps = setupManager();
    localRequestMock.mockResolvedValue({ enhancements: [] });
    routeMock.mockImplementation(async (params) => ({
      mode: 'local',
      result: await params.generateLocal()
    }));

    await toggleEnhancement('message-1');

    expect(routeMock).toHaveBeenCalledWith(expect.objectContaining({
      isMobileWebView: false,
      payload: {
        originalMarkdown: 'A base case stops recursion.',
        wordCount: 5
      }
    }));
    expect(deps.getAI).toHaveBeenCalledTimes(1);
    expect(localRequestMock).toHaveBeenCalledWith({ provider: 'desktop-ai' }, {
      originalMarkdown: 'A base case stops recursion.',
      wordCount: 5
    });
    expect(deps.setLoadingState).toHaveBeenLastCalledWith('message-1', false);
    expect(deps.setActiveState).toHaveBeenLastCalledWith('message-1', false);
  });
});

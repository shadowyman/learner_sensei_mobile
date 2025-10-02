import { jest } from '@jest/globals';

jest.mock('../codeEditorModal');
jest.mock('marked');

describe('sensei bold interactions', () => {
  let displayMessage: typeof import('../ui').displayMessage;
  let updateMessageStream: typeof import('../ui').updateMessageStream;
  let createMessageRegistry: typeof import('../ui').createMessageRegistry;
  let renderEnhancedMarkdown: typeof import('../ui').renderEnhancedMarkdown;

  const loadModule = () => {
    jest.resetModules();
    document.body.innerHTML = '<div id="message-area"></div>';
    (globalThis as any).hljs = { highlightElement: () => {} };
    const ui = require('../ui') as typeof import('../ui');
    displayMessage = ui.displayMessage;
    updateMessageStream = ui.updateMessageStream;
    createMessageRegistry = ui.createMessageRegistry;
    renderEnhancedMarkdown = ui.renderEnhancedMarkdown;
  };

  const dispatchBoldEvent = (element: HTMLElement) => {
    const pointerSupported = typeof window.PointerEvent !== 'undefined';
    if (pointerSupported) {
      const pointerEvent = new window.PointerEvent('pointerup', { bubbles: true, button: 0, isPrimary: true });
      element.dispatchEvent(pointerEvent);
    }
    const mouseEvent = new MouseEvent('mouseup', { bubbles: true, button: 0 });
    element.dispatchEvent(mouseEvent);
  };

  const waitForSelection = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    loadModule();
  });

  afterEach(() => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  });

  it('selects bold text on render when strong is activated', async () => {
    const container = document.createElement('div');
    document.getElementById('message-area')!.appendChild(container);
    const registry = createMessageRegistry();
    const message: import('../ui').Message = {
      id: 'sensei-1',
      sender: 'sensei',
      displayName: 'Sensei',
      text: 'This is **bold** text.',
      timestamp: new Date(),
      skipMermaid: true,
    };

    await displayMessage(message, { container, registry });

    const strong = container.querySelector('strong') as HTMLElement;
    expect(strong).toBeTruthy();
    expect(strong.classList.contains('sensei-bold-selectable')).toBe(true);

    dispatchBoldEvent(strong);
    await waitForSelection();

    expect(window.getSelection()?.toString()).toBe('bold');
  });

  it('selects bold text during streaming updates', async () => {
    const container = document.createElement('div');
    document.getElementById('message-area')!.appendChild(container);
    const registry = createMessageRegistry();
    const message: import('../ui').Message = {
      id: 'sensei-2',
      sender: 'sensei',
      displayName: 'Sensei',
      text: '',
      timestamp: new Date(),
      isLoading: true,
      skipMermaid: true,
    };

    await displayMessage(message, { container, registry });
    await updateMessageStream(message.id, 'Streaming **bold** update.');

    const strong = container.querySelector('strong') as HTMLElement;
    expect(strong).toBeTruthy();
    expect(strong.classList.contains('sensei-bold-selectable')).toBe(true);

    dispatchBoldEvent(strong);
    await waitForSelection();

    expect(window.getSelection()?.toString()).toBe('bold');
  });

  it('does not affect user messages when clicking bold-like text', async () => {
    const container = document.createElement('div');
    document.getElementById('message-area')!.appendChild(container);
    const registry = createMessageRegistry();
    const message: import('../ui').Message = {
      id: 'user-1',
      sender: 'user',
      displayName: 'You',
      text: 'User **bold** example',
      timestamp: new Date(),
      skipMermaid: true,
    };

    await displayMessage(message, { container, registry });

    const selectable = container.querySelector('.sensei-bold-selectable');
    expect(selectable).toBeNull();

    const messageText = container.querySelector('.message-text') as HTMLElement;
    const pointerSupported = typeof window.PointerEvent !== 'undefined';
    if (pointerSupported) {
      messageText.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, isPrimary: true }));
    }
    messageText.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    await waitForSelection();

    expect(window.getSelection()?.toString()).toBe('');
  });

  it('ignores clicks on non-bold sensei text', async () => {
    const container = document.createElement('div');
    document.getElementById('message-area')!.appendChild(container);
    const registry = createMessageRegistry();
    const message: import('../ui').Message = {
      id: 'sensei-plain',
      sender: 'sensei',
      displayName: 'Sensei',
      text: 'Plain sensei text without bold',
      timestamp: new Date(),
      skipMermaid: true,
    };

    await displayMessage(message, { container, registry });

    const messageText = container.querySelector('.message-text') as HTMLElement;
    expect(messageText).toBeTruthy();

    const pointerSupported = typeof window.PointerEvent !== 'undefined';
    if (pointerSupported) {
      messageText.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, isPrimary: true }));
    }
    messageText.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    await waitForSelection();

    expect(window.getSelection()?.toString()).toBe('');
  });

  it('keeps bold selection after renderEnhancedMarkdown', async () => {
    const messageId = 'sensei-enhanced';
    const bubble = document.createElement('div');
    bubble.id = messageId;
    bubble.className = 'message-bubble';
    bubble.dataset.sender = 'sensei';
    const messageText = document.createElement('div');
    messageText.className = 'message-text markdown-content';
    bubble.appendChild(messageText);
    document.body.appendChild(bubble);

    await renderEnhancedMarkdown(messageId, 'Enhanced **bold** reply.', [], { skipMermaidProcessing: true });

    const strong = bubble.querySelector('strong') as HTMLElement;
    expect(strong).toBeTruthy();
    expect(strong.classList.contains('sensei-bold-selectable')).toBe(true);

    dispatchBoldEvent(strong);
    await waitForSelection();

    expect(window.getSelection()?.toString()).toBe('bold');
  });
});

import { initializeSelectionSensei, reinitializeSelectionSensei, invokeSelectionSenseiBridgeAction } from '../selectionSensei'
import { GoogleGenAI } from '@google/genai'
import { handleSelectionSenseiModalMessageResult } from '../src/mobile/webviewMessageRouter'
import { SELECTION_SENSEI_USER_MESSAGE_MAX_CHARS } from '@sensei/core/llmCapPolicy'

jest.mock('marked')

const mockSendMessage = jest.fn(() => Promise.resolve({
  text: '{"suggestedTitle":"Selection Sensei","explanation":"Bridge should own this response."}'
}))
const mockSendMessageStream = jest.fn(() => ({
  async *[Symbol.asyncIterator]() {
    yield { text: 'Selection response' }
  }
}))
const mockChatsCreate = jest.fn(() => ({
  sendMessage: mockSendMessage,
  sendMessageStream: mockSendMessageStream,
  close: jest.fn(() => Promise.resolve())
}))

jest.mock('../ui', () => ({
  sanitizeCodeFences: jest.fn((text: string) => text),
  sanitizeMarkdownFences: jest.fn((text: string) => text),
  parseSanitizedMarkdown: jest.fn((text: string) => text),
  addLanguageDisplayToCodeBlocks: jest.fn(),
  addCopyButtonsToCodeBlocks: jest.fn(),
  setupTextareaAutosize: jest.fn(),
  displayMessage: jest.fn(() => Promise.resolve()),
  createMessageRegistry: jest.fn(() => ({ timers: new Map<string, number>(), rawText: new Map<string, string>() })),
  MessageRegistry: class {},
  Message: class {}
}))

jest.mock('../mermaid-theme-integration.js', () => ({
  renderMermaidThumbnailWithTheme: jest.fn()
}))

jest.mock('../mermaidManager', () => ({
  mermaidManager: {
    getCurrentTheme: jest.fn(() => 'default'),
    render: jest.fn()
  },
  DEFAULT_MERMAID_THEME: 'default'
}))

jest.mock('../mermaidErrorRecovery', () => ({
  runMermaidRecovery: jest.fn()
}))

jest.mock('../notepad', () => ({
  notepad: {
    setActiveCurriculumContext: jest.fn(),
    addNote: jest.fn()
  }
}))

jest.mock('@google/genai', () => {
  const manual = jest.requireActual('../__mocks__/@google/genai.js') as Record<string, any>
  class MockGoogleGenAI extends manual.GoogleGenAI {
    constructor(config: unknown) {
      super(config)
      this.chats = {
        create: mockChatsCreate
      }
    }
  }
  return {
    ...manual,
    GoogleGenAI: MockGoogleGenAI
  }
})

const setupDom = () => {
  document.body.innerHTML = `
    <div id="message-area"></div>
    <div id="response-modal" style="position:absolute; display:block; left:0px; top:0px;">
      <div id="response-modal-header"></div>
      <div id="response-modal-title"></div>
      <div id="response-modal-content-area">
        <div id="response-modal-text-content"></div>
      </div>
      <div id="response-modal-spinner"></div>
      <button id="response-modal-close-button"></button>
      <div id="response-modal-drag-zone"></div>
    </div>
    <div id="selection-sensei-transcript"></div>
    <div id="selection-sensei-composer">
      <textarea id="selection-sensei-composer-input"></textarea>
    </div>
    <button id="selection-sensei-send-button"></button>
    <div id="selection-toolbar"><div class="selection-toolbar-buttons"><button type="button">Action</button></div></div>
  `
  const modal = document.getElementById('response-modal') as HTMLDivElement
  modal.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    top: 0,
    left: 0,
    right: 200,
    bottom: 120,
    toJSON: () => ({})
  })
}

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

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
]

const expectNoPromptControls = (payload: Record<string, unknown>) => {
  forbiddenBridgeFields.forEach(field => {
    expect(payload).not.toHaveProperty(field)
  })
}

const installNativeBridge = () => {
  const messages: any[] = []
  const postMessage = jest.fn((payload: string) => {
    messages.push(JSON.parse(payload))
  })
  ;(window as any).ReactNativeWebView = { postMessage }
  const modalRequests = () => messages.filter(message => message.type === 'selectionSensei:modalMessageRequest')
  const resolveLatestModalRequest = (result = { suggestedTitle: 'Bridge', explanation: 'Bridge response' }) => {
    const request = modalRequests()[modalRequests().length - 1]
    expect(request).toBeTruthy()
    handleSelectionSenseiModalMessageResult({
      type: 'selectionSensei:modalMessageResult',
      requestId: request.requestId,
      success: true,
      result
    } as any)
    return request
  }
  return { messages, postMessage, modalRequests, resolveLatestModalRequest }
}

const installSelection = (messageText: HTMLElement, selected = 'Selected'): (() => void) => {
  const textNode = messageText.firstChild as Text
  const originalGetSelection = window.getSelection
  const fragment = document.createDocumentFragment()
  const node = document.createElement('em')
  node.textContent = selected
  fragment.appendChild(node)
  const range = {
    commonAncestorContainer: textNode,
    getBoundingClientRect: () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      width: 30,
      height: 10,
      right: 40,
      bottom: 30,
      toJSON: () => ({})
    }),
    cloneContents: () => fragment
  } as any
  const selectionWithRange = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => selected,
    getRangeAt: () => range
  } as any

  Object.defineProperty(window, 'getSelection', {
    configurable: true,
    value: jest.fn(() => selectionWithRange)
  })

  return () => {
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: originalGetSelection
    })
  }
}

describe('selectionSensei initializeSelectionSensei', () => {
  beforeEach(() => {
    setupDom()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    messageArea.innerHTML = `
      <div class="message-bubble" data-sender="sensei">
        <div class="message-text">Original context text</div>
      </div>
    `
    const { notepad } = require('../notepad')
    notepad.addNote.mockClear()
    mockSendMessage.mockClear()
    mockSendMessage.mockImplementation(() => Promise.resolve({
      text: '{"suggestedTitle":"Selection Sensei","explanation":"Bridge should own this response."}'
    }))
    mockSendMessageStream.mockClear()
    mockChatsCreate.mockClear()
    delete (window as any).__SENSEI_MOBILE_BUILD__
  })

  afterEach(() => {
    delete (window as any).__SENSEI_MOBILE_BUILD__
    delete (window as any).ReactNativeWebView
  })

  test('registers mouse listeners on message area', () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const spy = jest.spyOn(messageArea, 'addEventListener')
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    expect(spy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    spy.mockRestore()
  })

  test('dragging updates modal coordinates and pointerdown no longer hides modal', async () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    const header = document.getElementById('response-modal-header') as HTMLDivElement
    const modal = document.getElementById('response-modal') as HTMLDivElement
    header.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 30 }))
    expect(modal.style.left).not.toBe('')
    document.dispatchEvent(new MouseEvent('mouseup'))
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(modal.style.display).toBe('block')
  })

  test('reinitializeSelectionSensei redraws instance when message area exists', () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    reinitializeSelectionSensei(new GoogleGenAI({}))
    const modal = document.getElementById('response-modal') as HTMLDivElement
    expect(modal.style.display).toBe('none')
  })

  test('bridge addToNotepad uses captured HTML when selection collapses', () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const textNode = messageText.firstChild as Text
    const originalGetSelection = window.getSelection

    const fragment = document.createDocumentFragment()
    const node = document.createElement('em')
    node.textContent = 'Selected'
    fragment.appendChild(node)

    const range = {
      commonAncestorContainer: textNode,
      getBoundingClientRect: () => ({
        x: 10,
        y: 20,
        left: 10,
        top: 20,
        width: 30,
        height: 10,
        right: 40,
        bottom: 30,
        toJSON: () => ({})
      }),
      cloneContents: () => fragment
    } as any

    const selectionWithRange = {
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Selected',
      getRangeAt: () => range
    } as any

    const selectionCollapsed = {
      isCollapsed: true,
      rangeCount: 0,
      toString: () => '',
      getRangeAt: () => {
        throw new Error('no range')
      }
    } as any

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: jest.fn(() => selectionWithRange)
    })

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))

    ;(window.getSelection as any).mockImplementation(() => selectionCollapsed)

    const { notepad } = require('../notepad')
    invokeSelectionSenseiBridgeAction('addToNotepad')
    expect(notepad.addNote).toHaveBeenCalledWith('Selected', 'Selected', '<em>Selected</em>')
    expect(bridge.modalRequests()).toHaveLength(0)
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: originalGetSelection
    })
    delete (window as any).__SENSEI_MOBILE_BUILD__
  })

  test('mobile bridge copy and share remain local and emit no modal LLM request', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const clipboardWriteText = jest.fn(() => Promise.resolve())
    const nativeShare = jest.fn(() => Promise.resolve())
    const originalExecCommand = document.execCommand
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText }
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare
    })
    document.execCommand = jest.fn(() => true)
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    try {
      initializeSelectionSensei(new GoogleGenAI({}), messageArea)
      messageArea.dispatchEvent(new MouseEvent('mouseup'))
      invokeSelectionSenseiBridgeAction('copy')
      invokeSelectionSenseiBridgeAction('share')
      await flushPromises()

      expect(clipboardWriteText).toHaveBeenCalledWith('Selected')
      expect(nativeShare).toHaveBeenCalledWith({ text: 'Selected', title: 'Recursive Sensei Selection' })
      expect(bridge.modalRequests()).toHaveLength(0)
      expect(mockChatsCreate).not.toHaveBeenCalled()
      expect(mockSendMessage).not.toHaveBeenCalled()
    } finally {
      restoreSelection()
      delete (navigator as any).clipboard
      delete (navigator as any).share
      document.execCommand = originalExecCommand
    }
  })

  test('mobile bridge explainSimpler path does not create or use browser Selection Sensei chat', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('explainSimpler')
    await flushPromises()
    const request = bridge.resolveLatestModalRequest()
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(1)
    expect(request.payload).toMatchObject({
      mode: 'toolbarAction',
      actionType: 'explainSimpler',
      selectedText: 'Selected',
      originalSenseiMessageText: 'Original context text',
      actionLabel: 'Simpler'
    })
    expectNoPromptControls(request.payload)
    expect(mockChatsCreate).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test('mobile bridge askQuestion path does not create or use browser Selection Sensei chat', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('askQuestion', { userQuestion: 'Why does this stop recursion?' })
    await flushPromises()
    const request = bridge.resolveLatestModalRequest()
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(1)
    expect(request.payload).toMatchObject({
      mode: 'toolbarAction',
      actionType: 'askQuestion',
      selectedText: 'Selected',
      originalSenseiMessageText: 'Original context text',
      actionLabel: 'Ask',
      userQuestion: 'Why does this stop recursion?'
    })
    expectNoPromptControls(request.payload)
    expect(mockChatsCreate).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test('mobile follow-up composer does not call browser Selection Sensei chat locally', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('explainSimpler')
    await flushPromises()
    bridge.resolveLatestModalRequest({ suggestedTitle: 'Base Case', explanation: 'A base case stops recursion.' })
    await flushPromises()

    mockSendMessage.mockClear()
    const input = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement
    const sendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement
    input.value = 'Can you explain the previous answer another way?'
    sendButton.click()
    await flushPromises()
    const request = bridge.resolveLatestModalRequest({ explanation: 'The stopping condition prevents endless calls.' })
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(2)
    expect(request.payload).toMatchObject({
      mode: 'followUp',
      selectedText: 'Selected',
      originalSenseiMessageText: 'Original context text',
      initialActionType: 'explainSimpler',
      initialActionLabel: 'Simpler',
      question: 'Can you explain the previous answer another way?'
    })
    expect(request.payload.initialResponse).toMatchObject({
      suggestedTitle: 'Base Case',
      explanation: 'A base case stops recursion.'
    })
    expect(request.payload.initialResponse).not.toHaveProperty('rawText')
    expectNoPromptControls(request.payload)
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test('mobile follow-up preserves rawText only for raw fallback initial responses', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('explainSimpler')
    await flushPromises()
    bridge.resolveLatestModalRequest({ rawText: 'Raw fallback answer without JSON fields.' } as any)
    await flushPromises()

    const input = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement
    const sendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement
    input.value = 'Can you clarify that?'
    sendButton.click()
    await flushPromises()
    const request = bridge.resolveLatestModalRequest({ explanation: 'Clarified answer.' })
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(2)
    expect(request.payload.initialResponse).toMatchObject({
      rawText: 'Raw fallback answer without JSON fields.'
    })
    expect(request.payload.initialResponse).not.toHaveProperty('explanation')
    restoreSelection()
  })

  test('mobile oversized follow-up user input fails locally without bridge or browser provider work', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('explainSimpler')
    await flushPromises()
    bridge.resolveLatestModalRequest({ suggestedTitle: 'Base Case', explanation: 'A base case stops recursion.' })
    await flushPromises()

    mockSendMessage.mockClear()
    const input = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement
    const sendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement
    input.value = 'x'.repeat(SELECTION_SENSEI_USER_MESSAGE_MAX_CHARS + 1)
    sendButton.click()
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(1)
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test('mobile askQuestion follow-up carries the original ask question through structured payload', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('askQuestion', { userQuestion: 'Why does this stop recursion?' })
    await flushPromises()
    bridge.resolveLatestModalRequest({ suggestedTitle: 'Base Case', explanation: 'A base case stops recursion.' })
    await flushPromises()

    const input = document.getElementById('selection-sensei-composer-input') as HTMLTextAreaElement
    const sendButton = document.getElementById('selection-sensei-send-button') as HTMLButtonElement
    input.value = 'How does that prevent an infinite loop?'
    sendButton.click()
    await flushPromises()
    const request = bridge.resolveLatestModalRequest({ explanation: 'The stop condition prevents endless calls.' })
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(2)
    expect(request.payload).toMatchObject({
      mode: 'followUp',
      initialActionType: 'askQuestion',
      initialActionLabel: 'Ask',
      initialActionUserQuestion: 'Why does this stop recursion?',
      question: 'How does that prevent an infinite loop?'
    })
    expectNoPromptControls(request.payload)
    expect(mockChatsCreate).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test('duplicate rapid mobile toolbar actions do not duplicate local provider work while pending', async () => {
    ;(window as any).__SENSEI_MOBILE_BUILD__ = true
    const bridge = installNativeBridge()
    mockSendMessage.mockImplementation(() => new Promise(() => {}))
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const messageText = messageArea.querySelector('.message-bubble[data-sender="sensei"] .message-text') as HTMLElement
    const restoreSelection = installSelection(messageText)

    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    messageArea.dispatchEvent(new MouseEvent('mouseup'))
    invokeSelectionSenseiBridgeAction('explainSimpler')
    invokeSelectionSenseiBridgeAction('explainSimpler')
    await flushPromises()

    expect(bridge.modalRequests()).toHaveLength(1)
    expect(mockSendMessage).not.toHaveBeenCalled()
    restoreSelection()
  })

  test.todo('expand SelectionSensei follow-up interactions with real AI fixtures')
})

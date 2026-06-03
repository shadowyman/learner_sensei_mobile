import { initializeSelectionSensei, reinitializeSelectionSensei, invokeSelectionSenseiBridgeAction } from '../selectionSensei'
import { GoogleGenAI } from '@google/genai'

jest.mock('marked')

jest.mock('../ui', () => ({
  sanitizeCodeFences: jest.fn((text: string) => text),
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
        create: () => ({
          sendMessage: jest.fn(() => Promise.resolve({})),
          sendMessageStream: jest.fn(() => ({
            async *[Symbol.asyncIterator]() {
              yield { text: 'Selection response' }
            }
          })),
          close: jest.fn(() => Promise.resolve())
        })
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
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: originalGetSelection
    })
    delete (window as any).__SENSEI_MOBILE_BUILD__
  })

  test.todo('expand SelectionSensei follow-up interactions with real AI fixtures')
})

import { initializeSelectionSensei, reinitializeSelectionSensei } from '../selectionSensei'
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
    updateActiveConceptIndex: jest.fn(),
    updateActiveModuleIndex: jest.fn()
  }
}))

jest.mock('@google/genai', () => ({
  GoogleGenAI: class {
    chats = {
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
  },
  GenerateContentResponse: class {
    text = 'Selection response'
  },
  Chat: class {}
}))

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
  })

  test('registers mouse listeners on message area', () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    const spy = jest.spyOn(messageArea, 'addEventListener')
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    expect(spy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    spy.mockRestore()
  })

  test('dragging updates modal coordinates and pointerdown hides modal', async () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    const header = document.getElementById('response-modal-header') as HTMLDivElement
    const modal = document.getElementById('response-modal') as HTMLDivElement
    header.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 30 }))
    expect(modal.style.left).not.toBe('')
    document.dispatchEvent(new MouseEvent('mouseup'))
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(modal.style.display).toBe('none')
  })

  test('reinitializeSelectionSensei redraws instance when message area exists', () => {
    const messageArea = document.getElementById('message-area') as HTMLDivElement
    initializeSelectionSensei(new GoogleGenAI({}), messageArea)
    reinitializeSelectionSensei(new GoogleGenAI({}))
    const modal = document.getElementById('response-modal') as HTMLDivElement
    expect(modal.style.display).toBe('none')
  })

  test.todo('expand SelectionSensei follow-up interactions with real AI fixtures')
})

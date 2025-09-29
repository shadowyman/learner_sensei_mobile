import { sanitizeCodeFences, createMessageRegistry, updateMessageStream } from '../ui'

jest.mock('marked')
jest.mock('../codeEditorModal', () => ({
  openCodeEditorModal: jest.fn(),
  isCodeEditorModalOpen: jest.fn(() => false),
  setCodeEditorContentAndOpen: jest.fn()
}))

declare const hljs: { highlightElement: (element: HTMLElement) => void }

describe('ui helpers', () => {
  test('sanitizeCodeFences removes leading indentation', () => {
    const input = '    ```js\nconsole.log(1)\n```'
    expect(sanitizeCodeFences(input)).toBe('```js\nconsole.log(1)\n```')
  })

  test('createMessageRegistry provides isolated maps', () => {
    const first = createMessageRegistry()
    const second = createMessageRegistry()
    expect(first.timers).not.toBe(second.timers)
    expect(first.rawText.size).toBe(0)
  })

  test('updateMessageStream writes streamed text into message bubble', async () => {
    (globalThis as any).hljs = {
      highlightElement: jest.fn()
    }
    document.body.innerHTML = `
      <div id="msg-1" class="loading" data-sender="sensei">
        <div class="message-text"></div>
      </div>
    `
    await updateMessageStream('msg-1', 'Streamed message')
    const bubble = document.getElementById('msg-1') as HTMLDivElement
    const textDiv = bubble.querySelector('.message-text') as HTMLDivElement
    expect(textDiv.innerHTML).toContain('Streamed message')
    expect(bubble.getAttribute('data-typing')).toBe('true')
  })

  test.todo('expand UI streaming assertions with full markdown pipelines')
})

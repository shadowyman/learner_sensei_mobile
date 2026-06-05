import { sendToNative } from '../src/mobile/webviewBridge'

describe('webviewBridge fail-closed sender', () => {
  afterEach(() => {
    delete (window as any).ReactNativeWebView
  })

  test('returns false when no native bridge is available', () => {
    delete (window as any).ReactNativeWebView

    const sent = sendToNative({ type: 'selection:clear' } as any)

    expect(sent).toBe(false)
  })

  test('clears stale cached transport when native bridge is removed or replaced', () => {
    const firstPostMessage = jest.fn()
    ;(window as any).ReactNativeWebView = { postMessage: firstPostMessage }

    expect(sendToNative({ type: 'selection:clear' } as any)).toBe(true)
    expect(firstPostMessage).toHaveBeenCalledTimes(1)

    delete (window as any).ReactNativeWebView
    expect(sendToNative({ type: 'selection:clear' } as any)).toBe(false)
    expect(firstPostMessage).toHaveBeenCalledTimes(1)

    ;(window as any).ReactNativeWebView = { postMessage: 'not-callable' }
    expect(sendToNative({ type: 'selection:clear' } as any)).toBe(false)
    expect(firstPostMessage).toHaveBeenCalledTimes(1)
  })
})

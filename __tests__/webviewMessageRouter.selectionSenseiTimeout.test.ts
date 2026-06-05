import { requestSelectionSenseiModalMessageViaBridge } from '../src/mobile/webviewMessageRouter'

describe('Selection Sensei modal bridge timeout parity', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(window as any).ReactNativeWebView = { postMessage: jest.fn() }
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    delete (window as any).ReactNativeWebView
  })

  test('keeps Selection Sensei modal bridge requests alive through the BFF provider budget', async () => {
    const promise = requestSelectionSenseiModalMessageViaBridge({
      mode: 'toolbarAction',
      actionType: 'explainSimpler',
      selectedText: 'base case',
      originalSenseiMessageText: 'Original explanation',
      actionLabel: 'Simpler'
    })
    let settled = false
    promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )

    jest.advanceTimersByTime(90_000)
    await Promise.resolve()
    expect(settled).toBe(false)

    jest.advanceTimersByTime(89_999)
    await Promise.resolve()
    expect(settled).toBe(false)

    jest.advanceTimersByTime(1)
    await expect(promise).rejects.toThrow('Selection Sensei bridge timeout')
  })
})

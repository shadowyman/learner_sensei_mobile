import { requestSelectionSenseiModalMessageViaBridge } from '../src/mobile/webviewMessageRouter'
import {
  SELECTION_SENSEI_MODAL_BRIDGE_TIMEOUT_MS,
  SELECTION_SENSEI_MODAL_RN_TIMEOUT_MS
} from '@sensei/protocol/timeouts'

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

    jest.advanceTimersByTime(180_000)
    await Promise.resolve()
    expect(settled).toBe(false)

    jest.advanceTimersByTime(SELECTION_SENSEI_MODAL_RN_TIMEOUT_MS - 180_000)
    await Promise.resolve()
    expect(settled).toBe(false)

    jest.advanceTimersByTime(SELECTION_SENSEI_MODAL_BRIDGE_TIMEOUT_MS - SELECTION_SENSEI_MODAL_RN_TIMEOUT_MS - 1)
    await Promise.resolve()
    expect(settled).toBe(false)

    jest.advanceTimersByTime(1)
    await expect(promise).rejects.toThrow('Selection Sensei bridge timeout')
  })
})

import { KeyTakeawayEnhancerController, computeKeyTakeawayEnhancerPromptHash } from '../src/keyTakeawayEnhancerController'
import { updateMessageStream } from '../src/ui'

jest.mock('../src/ui', () => ({
  updateMessageStream: jest.fn()
}))

const placeholder = 'key_takeaway_placeholder'

function createController(options: Partial<{ promptText: string; cacheKey: string; ai: any; grace: number }> = {}) {
  const chat = {
    sendMessage: jest.fn().mockResolvedValue({ text: 'Key takeaway ready.' })
  }
  const ai = options.ai || { chats: { create: jest.fn().mockReturnValue(chat) } }
  const promptText = options.promptText || `${placeholder}`
  const cacheKey = options.cacheKey || computeKeyTakeawayEnhancerPromptHash(promptText)
  return {
    controller: new KeyTakeawayEnhancerController({
      ai,
      modelName: 'test-model',
      modelConfig: {},
      promptText,
      placeholderToken: placeholder,
      messageId: 'msg-1',
      updateMessageStream,
      cacheKey,
      postStreamGraceMs: options.grace || 50
    }),
    chat
  }
}

describe('KeyTakeawayEnhancerController', () => {
  const mockedUpdate = updateMessageStream as jest.Mock

  beforeEach(() => {
    mockedUpdate.mockReset()
  })

  test('replaces placeholder once enhancer text is ready', async () => {
    const { controller } = createController({ promptText: 'Provide key takeaway' })
    controller.start()
    await controller.onChunk(`Intro ${placeholder} outro`)
    await controller.finalize()
    expect(controller.getLatestText()).toContain('key-takeaway-enhancer')
  })

  test('ignores placeholder inside code block', async () => {
    const { controller } = createController({ promptText: 'code test' })
    controller.start()
    const text = await controller.onChunk('```json\nkey_takeaway_placeholder\n```')
    await controller.finalize()
    expect(text).toContain(placeholder)
    expect(controller.getLatestText()).toContain(placeholder)
  })

  test('removes placeholder after timeout when enhancer fails', async () => {
    jest.useFakeTimers()
    const failingChat = {
      sendMessage: jest.fn().mockRejectedValue(new Error('failed'))
    }
    const ai = { chats: { create: jest.fn().mockReturnValue(failingChat) } }
    const { controller } = createController({ promptText: 'timeout test', ai, grace: 5 })
    controller.start()
    await controller.onChunk(`Start ${placeholder} end`)
    const finalizePromise = controller.finalize()
    await jest.advanceTimersByTimeAsync(10)
    await finalizePromise
    jest.useRealTimers()
    expect(controller.getLatestText()).toBe('Start  end')
    expect(mockedUpdate).toHaveBeenCalled()
  })
})

import { streamMainSenseiResponse, streamModuleIntroduction, buildSenseiDynamicSystemInstruction } from '../interactionHelpers'
import { updateMessageStream } from '../ui'

jest.mock('../ui', () => ({
  updateMessageStream: jest.fn()
}))

describe('interactionHelpers buildSenseiDynamicSystemInstruction', () => {
  test('formats must obey directives and appends navigation context', () => {
    const result = buildSenseiDynamicSystemInstruction('Focus on recursion clarity.', 'MUST_OBEY ACTION: Provide direct support', 'Navigation anchor')
    expect(result).toContain('Provide direct support')
    expect(result).toContain('Navigation anchor')
  })
})

describe('interactionHelpers streamMainSenseiResponse', () => {
  const mockedUpdate = updateMessageStream as jest.Mock

  beforeEach(() => {
    mockedUpdate.mockReset()
  })

  test('streams incremental updates into the UI helper', async () => {
    jest.useFakeTimers()
    const chat = {
      sendMessageStream: async () => ({
        async *[Symbol.asyncIterator]() {
          await new Promise(resolve => setTimeout(resolve, 5))
          yield { text: 'First chunk' }
          await new Promise(resolve => setTimeout(resolve, 5))
          yield { text: 'Second chunk' }
        }
      })
    }
    const promise = streamMainSenseiResponse(chat as any, 'Dynamic context', 'User prompt', 'sensei-message-id')
    await jest.runAllTimersAsync()
    const response = await promise
    expect(response).toContain('Second chunk')
    expect(mockedUpdate).toHaveBeenCalled()
    expect(mockedUpdate.mock.calls.length).toBeGreaterThan(1)
    jest.useRealTimers()
  })
})

describe('interactionHelpers streamModuleIntroduction', () => {
  const mockedUpdate = updateMessageStream as jest.Mock

  beforeEach(() => {
    mockedUpdate.mockReset()
  })

  test('invokes enhancer controller hooks when provided', async () => {
    const chat = {
      sendMessageStream: async () => ({
        async *[Symbol.asyncIterator]() {
          yield { text: 'Intro chunk' }
        }
      })
    }
    const enhancerController = {
      onChunk: jest.fn().mockResolvedValue('Intro replaced'),
      finalize: jest.fn().mockResolvedValue(undefined),
      getLatestText: jest.fn().mockReturnValue('Intro replaced')
    }
    const response = await streamModuleIntroduction(chat as any, 'context', 'Module', 'msg-1', { enhancerController: enhancerController as any })
    expect(enhancerController.onChunk).toHaveBeenCalled()
    expect(enhancerController.finalize).toHaveBeenCalled()
    expect(response).toEqual('Intro replaced')
  })
})

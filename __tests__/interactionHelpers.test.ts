import { streamMainSenseiResponse, buildSenseiDynamicSystemInstruction } from '../interactionHelpers'
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

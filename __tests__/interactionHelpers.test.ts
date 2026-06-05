import { streamMainSenseiResponse, streamModuleIntroduction, buildSenseiDynamicSystemInstruction, buildSocraticExecutionInstruction } from '../interactionHelpers'
import { updateMessageStream } from '../ui'
import { createWebviewMessageHandler } from '../src/mobile/webviewMessageRouter'
import { buildMainSenseiResponsePrompt } from '@sensei/core/mainSenseiResponse'

jest.mock('../ui', () => ({
  updateMessageStream: jest.fn()
}))

let nativePostedMessages: any[] = []
const nativeChannel = {
  postMessage: (payload: string) => nativePostedMessages.push(JSON.parse(payload))
}

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
    nativePostedMessages = []
    delete (window as any).ReactNativeWebView
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

  test('core Socratic prompt matches the WebView compatibility wrapper', () => {
    const teachingPlan = [[{
      text: 'Ask the learner why a recursive call must shrink the problem.',
      interactionGuidance: {
        expectedTurns: 3,
        completionTriggers: ['learner explains shrinking input'],
        turnManagement: 'Stay on one question until the learner explains the invariant.'
      },
      socraticMetadata: {
        detectedCategory: 'GENERAL_CONCEPT'
      }
    }]]
    const pedagogicalGuidance = {
      directive: 'Use concise follow-up questions.'
    }
    const dynamicContext = buildSocraticExecutionInstruction(
      teachingPlan,
      pedagogicalGuidance,
      false,
      'Navigation anchor'
    )

    expect(buildMainSenseiResponsePrompt({
      mode: 'socratic',
      teachingPlan,
      pedagogicalGuidance,
      isSystemInitialization: false,
      navigationContext: 'Navigation anchor',
      currentUserInput: 'Why does the input need to shrink?'
    })).toBe(`${dynamicContext}\n\nUser: Why does the input need to shrink?`)
  })

  test('routes structured Socratic main responses through the native bridge on mobile', async () => {
    ;(window as any).ReactNativeWebView = nativeChannel
    const chat = {
      sendMessageStream: jest.fn()
    }
    const teachingPlan = [[{
      text: 'Ask why the base case stops recursion.',
      interactionGuidance: {
        expectedTurns: 2,
        completionTriggers: ['base case understood'],
        turnManagement: 'Probe the learner before advancing.'
      },
      socraticMetadata: {
        detectedCategory: 'GENERAL_CONCEPT'
      }
    }]]

    const promise = streamMainSenseiResponse(
      chat as any,
      'legacy Socratic context',
      'I am unsure about base cases',
      'msg-socratic-native',
      {
        llmStreamRequest: {
          mode: 'socratic',
          teachingPlan,
          pedagogicalGuidance: {
            directive: 'Use concise follow-up questions.'
          },
          isSystemInitialization: false,
          currentUserInput: 'I am unsure about base cases'
        }
      }
    )
    expect(nativePostedMessages[0]).toMatchObject({
      type: 'llmStream:request',
      messageId: 'msg-socratic-native',
      capability: 'mainSenseiResponse'
    })

    const handler = createWebviewMessageHandler({
      logger: { info: jest.fn(), error: jest.fn() },
      sendToNative: jest.fn(),
      saveLoad: {
        exportSessionAsJson: jest.fn(),
        restoreFromSerializedJson: jest.fn()
      },
      displayMessage: jest.fn(),
      streamingMessagesRawText: new Map<string, string>(),
      SENDER_DISPLAY_NAMES: { user: 'You', sensei: 'Recursive Sensei' },
      processMermaidBlocks: jest.fn(),
      presentWrapUpAssessmentOverlay: jest.fn(),
      applyFooterPayload: jest.fn(),
      handleUserInputText: jest.fn(),
      updateMessageStream: mockedUpdate,
      invokeSelectionSenseiBridgeAction: jest.fn(),
      showMeditationOverlayFromNative: jest.fn()
    })

    await handler({
      type: 'llmStream:chunk',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-socratic-native',
      capability: 'mainSenseiResponse',
      text: 'Socratic native chunk'
    })
    await handler({
      type: 'llmStream:status',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-socratic-native',
      capability: 'mainSenseiResponse',
      phase: 'completed'
    })

    await expect(promise).resolves.toBe('Socratic native chunk')
    expect(chat.sendMessageStream).not.toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith('msg-socratic-native', 'Socratic native chunk')
  })

  test('waits for async native chunk rendering before completing the mobile stream', async () => {
    ;(window as any).ReactNativeWebView = nativeChannel
    const chat = {
      sendMessageStream: jest.fn()
    }
    let releaseEnhancer: () => void = () => {}
    let enhancedText = ''
    const enhancerController = {
      onChunk: jest.fn(async (text: string) => {
        await new Promise<void>(resolve => {
          releaseEnhancer = resolve
        })
        enhancedText = `Enhanced ${text}`
        return enhancedText
      }),
      finalize: jest.fn().mockResolvedValue(undefined),
      getLatestText: jest.fn(() => enhancedText)
    }

    const promise = streamMainSenseiResponse(
      chat as any,
      'legacy context',
      'I need help',
      'msg-async-native',
      {
        enhancerController: enhancerController as any,
        llmStreamRequest: {
          mode: 'standard',
          curriculumFocus: { status: 'general' },
          currentUserInput: 'I need help'
        }
      }
    )
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    const handler = createWebviewMessageHandler({
      logger: { info: jest.fn(), error: jest.fn() },
      sendToNative: jest.fn(),
      saveLoad: {
        exportSessionAsJson: jest.fn(),
        restoreFromSerializedJson: jest.fn()
      },
      displayMessage: jest.fn(),
      streamingMessagesRawText: new Map<string, string>(),
      SENDER_DISPLAY_NAMES: { user: 'You', sensei: 'Recursive Sensei' },
      processMermaidBlocks: jest.fn(),
      presentWrapUpAssessmentOverlay: jest.fn(),
      applyFooterPayload: jest.fn(),
      handleUserInputText: jest.fn(),
      updateMessageStream: mockedUpdate,
      invokeSelectionSenseiBridgeAction: jest.fn(),
      showMeditationOverlayFromNative: jest.fn()
    })

    await handler({
      type: 'llmStream:chunk',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-async-native',
      capability: 'mainSenseiResponse',
      text: 'Async native chunk'
    })
    await handler({
      type: 'llmStream:status',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-async-native',
      capability: 'mainSenseiResponse',
      phase: 'completed'
    })
    await Promise.resolve()

    expect(enhancerController.onChunk).toHaveBeenCalledWith('Async native chunk')
    expect(resolved).toBe(false)

    releaseEnhancer()

    await expect(promise).resolves.toBe('Enhanced Async native chunk')
    expect(enhancerController.finalize).toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith('msg-async-native', 'Enhanced Async native chunk')
  })
})

describe('interactionHelpers streamModuleIntroduction', () => {
  const mockedUpdate = updateMessageStream as jest.Mock

  beforeEach(() => {
    mockedUpdate.mockReset()
    nativePostedMessages = []
    delete (window as any).ReactNativeWebView
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

  test('routes structured module introduction streams through the native bridge on mobile', async () => {
    ;(window as any).ReactNativeWebView = nativeChannel
    const chat = {
      sendMessageStream: jest.fn()
    }
    const promise = streamModuleIntroduction(
      chat as any,
      'legacy context',
      'Module',
      'msg-native-1',
      {
        llmStreamRequest: {
          selectedModuleTitle: 'Module',
          firstConceptTitle: 'Concept',
          phaseDisplayName: 'IntroIllustrate',
          userInputText: 'Phase: IntroIllustrate',
          curriculumFocus: { status: 'general' },
          moduleTitleForPrompt: 'Module'
        }
      }
    )
    expect(nativePostedMessages[0]).toMatchObject({
      type: 'llmStream:request',
      messageId: 'msg-native-1',
      capability: 'moduleIntroduction'
    })

    const handler = createWebviewMessageHandler({
      logger: { info: jest.fn(), error: jest.fn() },
      sendToNative: jest.fn(),
      saveLoad: {
        exportSessionAsJson: jest.fn(),
        restoreFromSerializedJson: jest.fn()
      },
      displayMessage: jest.fn(),
      streamingMessagesRawText: new Map<string, string>(),
      SENDER_DISPLAY_NAMES: { user: 'You', sensei: 'Recursive Sensei' },
      processMermaidBlocks: jest.fn(),
      presentWrapUpAssessmentOverlay: jest.fn(),
      applyFooterPayload: jest.fn(),
      handleUserInputText: jest.fn(),
      updateMessageStream: mockedUpdate,
      invokeSelectionSenseiBridgeAction: jest.fn(),
      showMeditationOverlayFromNative: jest.fn()
    })

    await handler({
      type: 'llmStream:chunk',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-native-1',
      capability: 'moduleIntroduction',
      text: 'Native intro chunk'
    })
    await handler({
      type: 'llmStream:status',
      requestId: nativePostedMessages[0].requestId,
      messageId: 'msg-native-1',
      capability: 'moduleIntroduction',
      phase: 'completed'
    })

    await expect(promise).resolves.toBe('Native intro chunk')
    expect(chat.sendMessageStream).not.toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith('msg-native-1', 'Native intro chunk')
  })
})

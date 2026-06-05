import { ModuleSelectionHandler } from '../moduleSelectionHandler'
import { initializeLearnerModel } from '../adaptiveEngine'
import { displayMessage } from '../ui'
import type { Curriculum } from '../curriculum'
import { getCurrentCurriculumItem, jumpToPhase } from '../curriculum'
import { logger } from '../logger'

jest.mock('../ui', () => ({
  displayMessage: jest.fn(() => Promise.resolve()),
  updateCurriculumDisplay: jest.fn(),
  processMermaidBlocks: jest.fn(() => Promise.resolve()),
  setupTextareaAutosize: jest.fn(),
  getPhaseDisplayName: jest.fn((phase: string) => phase),
  showLoading: jest.fn(),
  sanitizeCodeFences: jest.fn(text => text)
}))

jest.mock('../geminiService', () => ({
  llmExtractAndPlanTeachingOrder: jest.fn(() => Promise.resolve(null))
}))

jest.mock('../interactionHelpers', () => ({
  streamModuleIntroduction: jest.fn(() => Promise.resolve('Intro text')),
  streamMainSenseiResponse: jest.fn(() => Promise.resolve('Socratic intro text')),
  buildSocraticExecutionInstruction: jest.fn(() => 'instruction'),
  buildSenseiDynamicSystemInstruction: jest.fn(() => 'instruction'),
  updateMessageStream: jest.fn()
}))

jest.mock('../curriculum', () => {
  return {
    TeachingPlanGenerationError: class TeachingPlanGenerationError extends Error {
      details: Record<string, unknown>
      constructor(message: string, details: Record<string, unknown>) {
        super(message)
        this.name = 'TeachingPlanGenerationError'
        this.details = details
      }
    },
    jumpToPhase: jest.fn(() => Promise.resolve(null)),
    getCurrentCurriculumItem: jest.fn(() => null),
    getCurriculumFocusInstruction: jest.fn(() => ''),
    buildCurriculumFocusSnapshot: jest.fn(() => ({ status: 'general' })),
    calculateFocusPoints: jest.fn(() => ({
      focusPoints: [],
      primaryActionType: 'General Engagement'
    })),
    buildPrimaryActionBlockForKeyTakeaway: jest.fn(() => '')
  }
})

jest.mock('@google/genai', () => {
  const manual = jest.requireActual('../__mocks__/@google/genai.js') as Record<string, any>
  return {
    ...manual,
    GoogleGenAI: class {
      models = {}
    },
    Chat: class {},
    Type: manual.Type
  }
})

const buildState = (overrides: Partial<ConstructorParameters<typeof ModuleSelectionHandler>[0]> = {}) => {
  const curriculum: Curriculum = {
    modules: [
      {
        id: 'Module1',
        title: 'Adaptive Module',
        summary: 'Module summary',
        goal: 'Understand recursion',
        concepts: [
          {
            title: 'Concept 1',
            text: 'Recursion requires base cases.'
          }
        ],
        methodology: [],
        socratic: '',
        solidify: ''
      }
    ]
  }

  return {
    pendingModuleSelection: null,
    pendingPhaseSelection: null,
    pendingConceptSelectionIndex: null,
    pendingConceptSelectionBubbleId: null,
    currentMessageId: 0,
    lastSenseiResponses: [],
    userInputHistory: [],
    learnerModel: initializeLearnerModel(),
    curriculum,
    curriculumState: null,
    currentActiveConceptIndex: null,
    mainSenseiChat: null,
    ai: null,
    ...overrides
  }
}

const createMockAI = () => ({
  models: {
    generateContent: jest.fn(() => Promise.resolve({ response: { text: () => 'ok' } }))
  },
  chats: {
    create: jest.fn(() => ({
      sendMessage: jest.fn(() => Promise.resolve({ response: { text: () => 'ok' } }))
    }))
  }
})

const appendTranscript = () => {
  const messageArea = document.createElement('div')
  messageArea.id = 'message-area'
  const appendBubble = (id: string, sender: 'sensei' | 'user', text: string) => {
    const bubble = document.createElement('div')
    bubble.id = id
    bubble.classList.add('message-bubble')
    bubble.setAttribute('data-sender', sender)
    const textEl = document.createElement('div')
    textEl.classList.add('message-text')
    textEl.textContent = text
    bubble.appendChild(textEl)
    messageArea.appendChild(bubble)
  }
  appendBubble('msg-intro', 'sensei', 'Intro text for recursion.')
  appendBubble('msg-question', 'user', 'Why do we need a base case?')
  appendBubble('msg-answer', 'sensei', 'A base case stops recursive calls from continuing forever.')
  document.body.appendChild(messageArea)
}

describe('ModuleSelectionHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('handleInitialModuleSelectionInternal selects module from text', async () => {
    const state = buildState()
    const handler = new ModuleSelectionHandler(state)
    const success = await handler.handleInitialModuleSelectionInternal('Module 1')
    expect(success).toBe(true)
    expect(handler.getState().pendingModuleSelection).toBe(0)
  })

  test('handleClickedModuleSelection falls back when AI is not ready', async () => {
    const state = buildState()
    const handler = new ModuleSelectionHandler(state)
    await handler.handleClickedModuleSelection('Adaptive Module')
    expect((displayMessage as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(0)
  })

  test('handlePhaseSelection for Teaching renders concept selector before jumping phases', async () => {
    const ai = createMockAI()
    const state = buildState({
      pendingModuleSelection: 0,
      ai: ai as any,
      mainSenseiChat: {} as any
    })
    const handler = new ModuleSelectionHandler(state)
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockClear()
    await handler.handlePhaseSelection('IntroIllustrate')
    const conceptCall = (displayMessage as unknown as jest.Mock).mock.calls.find(
      ([payload]) => payload.conceptSelectionPayload
    )
    expect(conceptCall).toBeTruthy()
    expect(mockedJumpToPhase).not.toHaveBeenCalled()
  })

  test('handleConceptSelection forwards concept index into jumpToPhase', async () => {
    const curriculum = buildState().curriculum
    curriculum.modules[0].concepts.push({
      title: 'Concept 2',
      text: 'Additional content'
    })
    const ai = createMockAI()
    const state = buildState({
      pendingModuleSelection: 0,
      pendingPhaseSelection: 'IntroIllustrate',
      ai: ai as any,
      mainSenseiChat: {} as any,
      curriculum
    })
    const handler = new ModuleSelectionHandler(state)
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockResolvedValue({
      currentModuleIndex: 0,
      currentConceptIndex: 1,
      currentPhase: 'IntroIllustrate',
      activeConsolidationState: null,
      isCompleted: false,
      teachingPlanForPhase: [[{ text: 'Point', kcValue: 0.1 }]],
      currentTeachingChunkIndex: 0,
      coveredPointsInCurrentChunk: new Set(),
      pointsToRevisitInCurrentChunk: new Set()
    } as any)
    await handler.handleConceptSelection('Module1', 1)
    expect(mockedJumpToPhase).toHaveBeenCalled()
    const callArgs = mockedJumpToPhase.mock.calls[mockedJumpToPhase.mock.calls.length - 1]
    expect(callArgs[4]).toEqual({ targetConceptIndex: 1 })
  })

  test('handleConceptSelection stores module introduction LLM stream request in reload context', async () => {
    const interactionHelpers = await import('../interactionHelpers')
    const ai = createMockAI()
    const state = buildState({
      pendingModuleSelection: 0,
      pendingPhaseSelection: 'IntroIllustrate',
      ai: ai as any,
      mainSenseiChat: {} as any
    })
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockResolvedValue({
      currentModuleIndex: 0,
      currentConceptIndex: 0,
      currentPhase: 'IntroIllustrate',
      activeConsolidationState: null,
      isCompleted: false,
      teachingPlanForPhase: [[{ text: 'Point', kcValue: 0.1 }]],
      currentTeachingChunkIndex: 0,
      coveredPointsInCurrentChunk: new Set(),
      pointsToRevisitInCurrentChunk: new Set()
    } as any)
    const mockedGetCurrentCurriculumItem = getCurrentCurriculumItem as jest.MockedFunction<typeof getCurrentCurriculumItem>
    mockedGetCurrentCurriculumItem.mockReturnValue({
      curriculumPathId: 'Module1-Concept1-Phase_IntroIllustrate',
      concept: {
        title: 'Concept 1',
        text: 'Recursion requires base cases.'
      }
    } as any)

    const handler = new ModuleSelectionHandler(state)
    appendTranscript()
    await handler.handleConceptSelection('Module1', 0)

    const streamCall = (interactionHelpers.streamModuleIntroduction as jest.Mock).mock.calls[0]
    expect(streamCall[4]).toEqual(expect.objectContaining({
      llmStreamRequest: expect.objectContaining({
        selectedModuleTitle: 'Adaptive Module',
        firstConceptTitle: 'Concept 1',
        phaseDisplayName: 'IntroIllustrate',
        userInputText: 'Phase: IntroIllustrate',
        curriculumFocus: { status: 'general' },
        moduleTitleForPrompt: 'Adaptive Module',
        conversationHistory: [
          { role: 'sensei', content: 'Intro text for recursion.' },
          { role: 'user', content: 'Why do we need a base case?' },
          { role: 'sensei', content: 'A base case stops recursive calls from continuing forever.' }
        ]
      })
    }))
    expect(streamCall[4].llmStreamRequest).not.toHaveProperty('curriculumFocusInstruction')
    expect(displayMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Intro text',
      isReloadable: true,
      reloadContext: expect.objectContaining({
        type: 'moduleIntro',
        llmStreamRequest: expect.objectContaining({
          selectedModuleTitle: 'Adaptive Module',
          firstConceptTitle: 'Concept 1',
          curriculumFocus: { status: 'general' },
          conversationHistory: [
            { role: 'sensei', content: 'Intro text for recursion.' },
            { role: 'user', content: 'Why do we need a base case?' },
            { role: 'sensei', content: 'A base case stops recursive calls from continuing forever.' }
          ]
        })
      })
    }))
    const finalIntroCall = (displayMessage as unknown as jest.Mock).mock.calls.find(
      ([payload]) => payload?.reloadContext?.type === 'moduleIntro' && !payload.isLoading
    )
    expect(finalIntroCall?.[0]?.reloadContext?.llmStreamRequest).not.toHaveProperty('curriculumFocusInstruction')
  })

  test('handleConceptSelection ignores requests when pending phase is not IntroIllustrate', async () => {
    const ai = createMockAI()
    const state = buildState({
      pendingModuleSelection: 0,
      pendingPhaseSelection: 'Socratic',
      ai: ai as any,
      mainSenseiChat: {} as any
    })
    const handler = new ModuleSelectionHandler(state)
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockClear()
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    await handler.handleConceptSelection('Module1', 0)
    expect(mockedJumpToPhase).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[CONCEPT_SELECT] No pending Teaching phase for concept selection.', {
      moduleId: 'Module1',
      conceptIndex: 0
    })
    warnSpy.mockRestore()
  })

  test('handleConceptSelection keeps UI intact for out-of-range indexes', async () => {
    const ai = createMockAI()
    const bubbleId = 'concept-selection-bubble'
    const state = buildState({
      pendingModuleSelection: 0,
      pendingPhaseSelection: 'IntroIllustrate',
      pendingConceptSelectionBubbleId: bubbleId,
      ai: ai as any,
      mainSenseiChat: {} as any
    })
    const conceptBubble = document.createElement('div')
    conceptBubble.id = bubbleId
    document.body.appendChild(conceptBubble)
    const phaseBubble = document.createElement('div')
    phaseBubble.classList.add('message-bubble')
    const container = document.createElement('div')
    container.classList.add('phase-buttons-container')
    phaseBubble.appendChild(container)
    document.body.appendChild(phaseBubble)

    const handler = new ModuleSelectionHandler(state)
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockClear()
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})

    await handler.handleConceptSelection('Module1', 3)

    expect(mockedJumpToPhase).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[CONCEPT_SELECT] Concept index out of range.', {
      moduleId: 'Module1',
      conceptIndex: 3
    })
    expect(handler.getState().pendingConceptSelectionBubbleId).toBe(bubbleId)
    expect(document.getElementById(bubbleId)).toBeTruthy()
    expect(document.querySelector('.phase-buttons-container')).toBeTruthy()
    warnSpy.mockRestore()
    document.body.innerHTML = ''
  })

  test('handlePhaseSelection sends initial Socratic system message with structured LLM stream request', async () => {
    const interactionHelpers = await import('../interactionHelpers')
    const ai = createMockAI()
    const state = buildState({
      pendingModuleSelection: 0,
      ai: ai as any,
      mainSenseiChat: {} as any
    })
    const teachingPlan = [[{
      text: 'Ask why the base case ends recursion.',
      interactionGuidance: {
        expectedTurns: 2,
        completionTriggers: ['base case understood'],
        turnManagement: 'Ask one question at a time.'
      },
      socraticMetadata: {
        detectedCategory: 'GENERAL_CONCEPT'
      }
    }]]
    const mockedJumpToPhase = jumpToPhase as jest.MockedFunction<typeof jumpToPhase>
    mockedJumpToPhase.mockResolvedValue({
      currentModuleIndex: 0,
      currentConceptIndex: 0,
      currentPhase: 'Socratic',
      activeConsolidationState: null,
      isCompleted: false,
      teachingPlanForPhase: teachingPlan,
      currentTeachingChunkIndex: 0,
      coveredPointsInCurrentChunk: new Set(),
      pointsToRevisitInCurrentChunk: new Set()
    } as any)
    const mockedGetCurrentCurriculumItem = getCurrentCurriculumItem as jest.MockedFunction<typeof getCurrentCurriculumItem>
    mockedGetCurrentCurriculumItem.mockReturnValue({
      curriculumPathId: 'Module1-Concept1-Phase_Socratic',
      concept: {
        title: 'Concept 1',
        text: 'Recursion requires base cases.'
      }
    } as any)

    const handler = new ModuleSelectionHandler(state)
    appendTranscript()
    const messageArea = document.getElementById('message-area')!
    const phaseBubble = document.createElement('div')
    phaseBubble.id = 'msg-phase-picker'
    phaseBubble.classList.add('message-bubble')
    phaseBubble.setAttribute('data-sender', 'sensei')
    const phaseText = document.createElement('div')
    phaseText.classList.add('message-text')
    phaseText.appendChild(document.createTextNode('Where would you like to begin?'))
    const phaseButtons = document.createElement('div')
    phaseButtons.classList.add('phase-buttons-container')
    for (const label of ['Teaching', 'Exploration', 'Wrap Up']) {
      const button = document.createElement('button')
      button.textContent = label
      phaseButtons.appendChild(button)
    }
    phaseText.appendChild(phaseButtons)
    phaseBubble.appendChild(phaseText)
    messageArea.appendChild(phaseBubble)
    expect((handler as any).buildRecentConversationHistory('')).toEqual([
      { role: 'sensei', content: 'Intro text for recursion.' },
      { role: 'user', content: 'Why do we need a base case?' },
      { role: 'sensei', content: 'A base case stops recursive calls from continuing forever.' }
    ])
    await handler.handlePhaseSelection('Socratic')

    expect(interactionHelpers.streamMainSenseiResponse).toHaveBeenCalledWith(
      state.mainSenseiChat,
      'instruction',
      '',
      expect.any(String),
      {
        llmStreamRequest: {
          mode: 'socratic',
          teachingPlan,
          pedagogicalGuidance: { directive: undefined },
          isSystemInitialization: true,
          conceptContext: expect.stringContaining('Concept 1'),
          currentUserInput: '',
          conversationHistory: [
            { role: 'sensei', content: 'Intro text for recursion.' },
            { role: 'user', content: 'Why do we need a base case?' },
            { role: 'sensei', content: 'A base case stops recursive calls from continuing forever.' }
          ]
        }
      }
    )
    expect(displayMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Socratic intro text',
      isReloadable: true,
      reloadContext: expect.objectContaining({
        type: 'mainResponse',
        userInput: '',
        llmStreamRequest: expect.objectContaining({
          mode: 'socratic',
          isSystemInitialization: true
        })
      })
    }))
  })

  test.todo('populate full phase selection handoff once LLM integration fixtures are ready')
})

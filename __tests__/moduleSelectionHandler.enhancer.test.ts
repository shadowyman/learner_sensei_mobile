import { ModuleSelectionHandler } from '../src/moduleSelectionHandler'
import { streamModuleIntroduction, buildSenseiDynamicSystemInstruction } from '../src/interactionHelpers'
import { displayMessage, updateCurriculumDisplay, processMermaidBlocks, setupTextareaAutosize, getPhaseDisplayName } from '../src/ui'
import { notepad } from '../src/notepad'

jest.mock('../src/curriculum', () => ({
  jumpToPhase: jest.fn().mockImplementation(async (_, __, phase) => ({
    currentPhase: phase,
    teachingPlanForPhase: [[{ text: 'Point', kcValue: 0.1 }]],
    currentTeachingChunkIndex: 0,
    isCompleted: false,
    currentModuleIndex: 0,
    currentConceptIndex: 0
  })),
  getCurrentCurriculumItem: jest.fn().mockReturnValue({ concept: { title: 'Concept' } }),
  getCurriculumFocusInstruction: jest.fn().mockReturnValue('focus'),
  calculateFocusPoints: jest.fn().mockReturnValue({ focusPoints: ['Point'], primaryActionType: 'Teach New Content (from current chunk)' }),
  buildPrimaryActionBlockForKeyTakeaway: jest.fn().mockReturnValue('## ⭐ PRIMARY ACTION FOR THIS TURN: Teach New Content (from current chunk) ⭐\nInstruction'),
  Curriculum: class {},
  CurriculumState: class {},
  TeachingPlanGenerationError: class extends Error {}
}))

jest.mock('../src/interactionHelpers', () => ({
  streamModuleIntroduction: jest.fn().mockResolvedValue('Intro response'),
  buildSenseiDynamicSystemInstruction: jest.fn().mockReturnValue('core-instruction'),
  buildSocraticExecutionInstruction: jest.fn()
}))

jest.mock('../src/ui', () => ({
  displayMessage: jest.fn().mockResolvedValue(undefined),
  updateCurriculumDisplay: jest.fn(),
  processMermaidBlocks: jest.fn(),
  setupTextareaAutosize: jest.fn(),
  getPhaseDisplayName: jest.fn().mockReturnValue('IntroIllustrate')
}))

jest.mock('../src/notepad', () => ({
  notepad: {
    setActiveCurriculumContext: jest.fn()
  }
}))

const mockedStreamModuleIntro = streamModuleIntroduction as jest.Mock
const mockedDisplayMessage = displayMessage as jest.Mock

function buildHandler(overrides: Partial<any> = {}) {
  const state = {
    pendingModuleSelection: 0,
    currentMessageId: 0,
    lastSenseiResponses: [],
    userInputHistory: [],
    learnerModel: {
      awardedKcForPhasePoints: new Set(),
      CurrentTask: { ID: 'task', TargetKCs: [] },
      KCs: {},
      KCMasteryLastUpdated: {}
    },
    curriculum: {
      modules: [
        {
          title: 'Module A',
          goal: 'Goal',
          concepts: [
            { title: 'Concept', text: 'text' }
          ]
        }
      ]
    },
    curriculumState: {
      currentPhase: 'IntroIllustrate',
      teachingPlanForPhase: [[{ text: 'Point', kcValue: 0.1 }]],
      currentTeachingChunkIndex: 0,
      isCompleted: false,
      currentModuleIndex: 0,
      currentConceptIndex: 0
    },
    currentActiveConceptIndex: 0,
    mainSenseiChat: {},
    ai: { chats: { create: jest.fn().mockReturnValue({ sendMessage: jest.fn().mockResolvedValue({ text: 'Key takeaway ready.' }) }) } },
    pendingWrapUpAssessment: null,
    pendingWrapUpAssessmentFailed: false
  }
  Object.assign(state, overrides)
  return new ModuleSelectionHandler(state as any)
}

describe('ModuleSelectionHandler key takeaway enhancer', () => {
  beforeEach(() => {
    mockedStreamModuleIntro.mockClear()
    mockedDisplayMessage.mockClear()
  })

  test('arms enhancer for module intro turns', async () => {
    const handler = buildHandler()
    await handler.handlePhaseSelection('IntroIllustrate')
    const call = mockedStreamModuleIntro.mock.calls[mockedStreamModuleIntro.mock.calls.length - 1]
    const options = call[4]
    expect(options?.enhancerController).toBeTruthy()
    const reloadContextCall = mockedDisplayMessage.mock.calls.find(([args]) => args?.reloadContext?.type === 'moduleIntro' && !args.isLoading)
    expect(reloadContextCall?.[0]?.reloadContext?.keyTakeawayEnhancer).toBeDefined()
  })
})

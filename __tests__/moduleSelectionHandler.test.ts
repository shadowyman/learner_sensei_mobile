import { ModuleSelectionHandler } from '../moduleSelectionHandler'
import { initializeLearnerModel } from '../adaptiveEngine'
import { displayMessage } from '../ui'
import type { Curriculum } from '../curriculum'

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

describe('ModuleSelectionHandler', () => {
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

  test.todo('populate full phase selection handoff once LLM integration fixtures are ready')
})

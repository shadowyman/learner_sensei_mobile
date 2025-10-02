/* global window, document, HTMLElement */

import { jest } from '@jest/globals'
import { initializeLearnerModel, type LearnerModel } from '../adaptiveEngine'
import { type Curriculum, type CurriculumState, type TeachingPoint } from '../curriculum'
import { type ConsolidationState } from '../consolidationManager'

export type DomMessageInput = {
  id: string
  sender: 'user' | 'sensei'
  text: string
  rawText?: string
  timestamp?: string
  reloadable?: boolean
  phaseSelectionEnabled?: boolean
}

export type UiSnapshot = {
  footer: { confidence: string; confusion: string; intent: string }
  curriculumStatus: string
}

export type SaveLoadTestEnvironment = {
  windowRef: any
  curriculum: Curriculum
  curriculumState: CurriculumState
  learnerModel: LearnerModel
  messageArea: HTMLElement
  footerNodes: { confidence: HTMLElement; confusion: HTMLElement; intent: HTMLElement }
  curriculumStatusNode: HTMLElement
  streamingRawText: Map<string, string>
  streamingTimers: Map<string, any>
  displayMessage: jest.Mock
  processMermaidBlocks: jest.Mock
  updateFooter: jest.Mock
  updateCurriculumDisplay: jest.Mock
  getCurrentCurriculumItem: jest.Mock
  notepadGetAllNotes: jest.Mock
  notepadRestoreNotes: jest.Mock
  mainSenseiChatGetHistory: jest.Mock
  cleanup: () => void
}

function createTeachingPlan(): TeachingPoint[][] {
  return [
    [
      { text: 'Point A1', kcValue: 1 },
      { text: 'Point A2', kcValue: 1 }
    ],
    [
      { text: 'Point B1', kcValue: 1 }
    ]
  ]
}

function createConsolidation(plan: TeachingPoint[][]): ConsolidationState {
  const map = new Map<number, TeachingPoint[]>()
  const firstEntry = plan[0]?.[0]
  if (firstEntry) {
    map.set(0, [firstEntry])
  }
  return {
    stage: 'Diagnosing',
    plan: map,
    planOrder: [0],
    currentPlanStep: 0
  }
}

function createCurriculum(): Curriculum {
  return {
    modules: [
      {
        id: 'module-1',
        title: 'Module One',
        goal: 'Understand recursion',
        concepts: [
          { title: 'Concept One', text: 'Concept One Text' },
          { title: 'Concept Two', text: 'Concept Two Text' }
        ],
        methodology: [
          { title: 'Step One', text: 'Do Step One' },
          { title: 'Step Two', text: 'Do Step Two' }
        ],
        socratic: 'Socratic guide',
        solidify: 'Solidify guide'
      },
      {
        id: 'module-2',
        title: 'Module Two',
        goal: 'Apply recursion',
        concepts: [
          { title: 'Concept Three', text: 'Concept Three Text' }
        ],
        methodology: [
          { title: 'Step One', text: 'Reflect' }
        ],
        socratic: 'Socratic follow up',
        solidify: 'Solidify follow up'
      }
    ]
  }
}

function createCurriculumState(plan: TeachingPoint[][]): CurriculumState {
  return {
    currentModuleIndex: 0,
    currentConceptIndex: 0,
    currentPhase: 'IntroIllustrate',
    activeConsolidationState: createConsolidation(plan),
    isCompleted: false,
    teachingPlanForPhase: plan,
    currentTeachingChunkIndex: 0,
    coveredPointsInCurrentChunk: new Set<string>(),
    pointsToRevisitInCurrentChunk: new Set<string>(),
    socraticTurnCount: 0,
    socraticBaseInstruction: null,
    socraticCompletionPending: null
  }
}

function createLearnerModel(): LearnerModel {
  const base = initializeLearnerModel()
  base.LearningTrajectory.totalInteractions = 42
  base.awardedKcForPhasePoints = new Set<string>(['kc-a'])
  return base
}

function ensureElement(id: string): HTMLElement {
  let element = document.getElementById(id)
  if (!element) {
    element = document.createElement('div')
    element.id = id
    document.body.appendChild(element)
  }
  return element
}

function createMessageBubble(input: DomMessageInput): HTMLElement {
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble'
  bubble.id = input.id
  bubble.dataset.sender = input.sender
  bubble.dataset.timestamp = input.timestamp ?? new Date().toISOString()
  if (input.reloadable) {
    bubble.classList.add('reloadable')
  }
  const textWrapper = document.createElement('div')
  textWrapper.className = 'message-text'
  textWrapper.textContent = input.text
  bubble.appendChild(textWrapper)
  if (input.phaseSelectionEnabled) {
    const container = document.createElement('div')
    container.className = 'phase-selection-buttons'
    bubble.appendChild(container)
  }
  return bubble
}

export function buildTestEnvironment(): SaveLoadTestEnvironment {
  const curriculum = createCurriculum()
  const teachingPlan = createTeachingPlan()
  const curriculumState = createCurriculumState(teachingPlan)
  const learnerModel = createLearnerModel()
  const messageArea = ensureElement('message-area')
  const footerConfidence = ensureElement('footer-confidence')
  const footerConfusion = ensureElement('footer-confusion')
  const footerIntent = ensureElement('footer-intent')
  const curriculumStatus = ensureElement('curriculum-status')
  messageArea.innerHTML = ''
  footerConfidence.textContent = 'Confident'
  footerConfusion.textContent = 'Not Confused'
  footerIntent.textContent = 'Engaged'
  curriculumStatus.textContent = 'Module One • Concept One'
  const w = window as any
  w.curriculum = curriculum
  w.curriculumState = curriculumState
  w.learnerModel = learnerModel
  w.currentActiveConceptIndex = 0
  w.currentMessageId = 1
  w.lastSenseiResponses = []
  w.chronologicallyLastLLMSenseiMessageId = null
  w.userInputHistory = []
  w.pendingModuleSelection = null
  w.autoResizeEnabled = true
  w.sessionStartTime = Date.now() - 60000
  const streamingRawText = new Map<string, string>()
  const streamingTimers = new Map<string, any>()
  const displayMessage = jest.fn(async (message: any) => {
    const bubble = createMessageBubble({
      id: message.id,
      sender: message.sender,
      text: message.text,
      rawText: message.text,
      timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : String(message.timestamp ?? new Date().toISOString()),
      reloadable: message.isReloadable,
      phaseSelectionEnabled: message.phaseSelectionEnabled
    })
    messageArea.appendChild(bubble)
    return bubble
  })
  const processMermaidBlocks = jest.fn(async () => {})
  const updateFooter = jest.fn()
  const updateCurriculumDisplay = jest.fn()
  const getCurrentCurriculumItem = jest.fn(() => {
    const module = curriculum.modules[0]
    const concept = module?.concepts?.[0]
      ? module.concepts[0]
      : { title: '', text: '' }
    return {
      moduleTitle: module?.title ?? '',
      moduleGoal: module?.goal ?? '',
      concept,
      curriculumPathId: 'module-1-concept-one',
      isLastConceptInModule: false,
      isLastPhaseForConcept: false,
      isModuleWidePhase: false
    }
  })
  const notepadGetAllNotes = jest.fn(() => [])
  const notepadRestoreNotes = jest.fn()
  const mainSenseiChatGetHistory = jest.fn(() => [])
  w.streamingMessagesRawText = streamingRawText
  w.streamingMessageTimers = streamingTimers
  w.displayMessage = displayMessage
  w.processMermaidBlocks = processMermaidBlocks
  w.updateFooter = updateFooter
  w.updateCurriculumDisplay = updateCurriculumDisplay
  w.getCurrentCurriculumItem = getCurrentCurriculumItem
  w.notepad = {
    getAllNotes: notepadGetAllNotes,
    restoreNotes: notepadRestoreNotes
  }
  if (!w.mainSenseiChat) {
    w.mainSenseiChat = {}
  }
  w.mainSenseiChat.getHistory = mainSenseiChatGetHistory
  const cleanup = () => {
    displayMessage.mockReset()
    processMermaidBlocks.mockReset()
    updateFooter.mockReset()
    updateCurriculumDisplay.mockReset()
    getCurrentCurriculumItem.mockReset()
    notepadGetAllNotes.mockReset()
    notepadRestoreNotes.mockReset()
    mainSenseiChatGetHistory.mockReset()
    streamingRawText.clear()
    streamingTimers.clear()
    messageArea.innerHTML = ''
    footerConfidence.textContent = ''
    footerConfusion.textContent = ''
    footerIntent.textContent = ''
    curriculumStatus.textContent = ''
    delete w.curriculum
    delete w.curriculumState
    delete w.learnerModel
    delete w.currentActiveConceptIndex
    delete w.currentMessageId
    delete w.lastSenseiResponses
    delete w.chronologicallyLastLLMSenseiMessageId
    delete w.userInputHistory
    delete w.pendingModuleSelection
    delete w.autoResizeEnabled
    delete w.sessionStartTime
    delete w.streamingMessagesRawText
    delete w.streamingMessageTimers
    delete w.displayMessage
    delete w.processMermaidBlocks
    delete w.updateFooter
    delete w.updateCurriculumDisplay
    delete w.getCurrentCurriculumItem
    delete w.notepad
  }
  return {
    windowRef: w,
    curriculum,
    curriculumState,
    learnerModel,
    messageArea,
    footerNodes: { confidence: footerConfidence, confusion: footerConfusion, intent: footerIntent },
    curriculumStatusNode: curriculumStatus,
    streamingRawText,
    streamingTimers,
    displayMessage,
    processMermaidBlocks,
    updateFooter,
    updateCurriculumDisplay,
    getCurrentCurriculumItem,
    notepadGetAllNotes,
    notepadRestoreNotes,
    mainSenseiChatGetHistory,
    cleanup
  }
}

export function seedDomMessages(env: SaveLoadTestEnvironment, messages: DomMessageInput[]): HTMLElement[] {
  env.messageArea.innerHTML = ''
  const result: HTMLElement[] = []
  for (const message of messages) {
    const bubble = createMessageBubble(message)
    env.messageArea.appendChild(bubble)
    if (message.sender === 'sensei' && message.rawText) {
      env.streamingRawText.set(message.id, message.rawText)
    }
    result.push(bubble)
  }
  return result
}

export function clearDomMessages(env: SaveLoadTestEnvironment): void {
  env.messageArea.innerHTML = ''
  env.streamingRawText.clear()
}

export function setNotepadNotes(env: SaveLoadTestEnvironment, notes: any[]): void {
  env.notepadGetAllNotes.mockReturnValue(notes)
}

export function setPendingModuleSelection(env: SaveLoadTestEnvironment, moduleIndex: number | null): void {
  env.windowRef.pendingModuleSelection = moduleIndex
}

export function setConsolidationPlan(env: SaveLoadTestEnvironment, entries: Array<[number, TeachingPoint[]]>): void {
  if (!env.windowRef.curriculumState.activeConsolidationState) {
    env.windowRef.curriculumState.activeConsolidationState = createConsolidation(env.windowRef.curriculumState.teachingPlanForPhase)
  }
  const consolidationState = env.windowRef.curriculumState.activeConsolidationState
  if (consolidationState) {
    consolidationState.plan = new Map(entries)
  }
}

export function setUiSnapshot(env: SaveLoadTestEnvironment, snapshot: UiSnapshot): void {
  env.footerNodes.confidence.textContent = snapshot.footer.confidence
  env.footerNodes.confusion.textContent = snapshot.footer.confusion
  env.footerNodes.intent.textContent = snapshot.footer.intent
  env.curriculumStatusNode.textContent = snapshot.curriculumStatus
}

export function seedSdkHistory(env: SaveLoadTestEnvironment, entries: any[]): void {
  env.mainSenseiChatGetHistory.mockImplementation(() => entries)
}

export function resetEnvironment(env: SaveLoadTestEnvironment): void {
  env.cleanup()
}

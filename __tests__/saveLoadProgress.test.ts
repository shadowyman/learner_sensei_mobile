/* eslint-env jest */
/* global process, document */

import { SaveLoadProgressManager } from '../saveloadProgressManager'
import * as serialization from '../saveloadSerialization'
import { buildTestEnvironment, seedDomMessages, clearDomMessages, setNotepadNotes, setPendingModuleSelection, seedSdkHistory, resetEnvironment, type SaveLoadTestEnvironment, type DomMessageInput } from 'mocks/saveLoadFixtures'
import { installFileReaderMock, installAnchorMock, installDownloadSpies, installWindowAIMock, overrideUserAgent } from 'mocks/saveLoadMocks'
import { reinitializeSelectionSensei } from '../selectionSensei'
import { logger } from '../logger'

jest.mock('../selectionSensei', () => ({
  __esModule: true,
  reinitializeSelectionSensei: jest.fn()
}))

jest.mock('../selectionSensei.js', () => jest.requireMock('../selectionSensei'), { virtual: true })

const originalDateNow = Date.now

describe('save & load progress functional suite', () => {
  let env: SaveLoadTestEnvironment
  let fileReaderController: ReturnType<typeof installFileReaderMock> | null
  let anchorController: ReturnType<typeof installAnchorMock>
  let downloadSpies: ReturnType<typeof installDownloadSpies>
  let windowAIController: ReturnType<typeof installWindowAIMock>

  beforeEach(() => {
    env = buildTestEnvironment()
    fileReaderController = null
    anchorController = installAnchorMock()
    downloadSpies = installDownloadSpies()
    windowAIController = installWindowAIMock()
  })

  afterEach(() => {
    jest.useRealTimers()
    Date.now = originalDateNow
    if (fileReaderController) {
      fileReaderController.restore()
      fileReaderController = null
    }
    anchorController.restore()
    downloadSpies.restore()
    windowAIController.restore()
    resetEnvironment(env)
    jest.clearAllMocks()
  })

  afterAll(() => {})

  const startScenario = (id: string) => {
    void id
  }

  const completeScenario = (id: string) => {
    void id
  }

  test('SAV-001 waits for streaming timers before collecting session data', async () => {
    startScenario('SAV-001')
    jest.useFakeTimers({ now: Date.now() })
    const collectSpy = jest.spyOn(SaveLoadProgressManager as any, 'collectSessionData')
    env.streamingTimers.set('timer-1', globalThis.setTimeout(() => env.streamingTimers.delete('timer-1'), 1000))
    const promise = SaveLoadProgressManager.saveProgress()
    await jest.advanceTimersByTimeAsync(900)
    expect(collectSpy).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(200)
    await jest.runOnlyPendingTimersAsync()
    await promise
    await jest.advanceTimersByTimeAsync(200)
    expect(collectSpy).toHaveBeenCalled()
    collectSpy.mockRestore()
    completeScenario('SAV-001')
  })

  test('SAV-002 proceeds after streaming timeout limit', async () => {
    startScenario('SAV-002')
    jest.useFakeTimers({ now: Date.now() })
    const collectSpy = jest.spyOn(SaveLoadProgressManager as any, 'collectSessionData')
    env.streamingTimers.set('timer-1', globalThis.setTimeout(() => {}, 20000))
    const promise = SaveLoadProgressManager.saveProgress()
    await jest.advanceTimersByTimeAsync(10050)
    await jest.runOnlyPendingTimersAsync()
    await promise
    expect(collectSpy).toHaveBeenCalled()
    collectSpy.mockRestore()
    completeScenario('SAV-002')
  })

  test('SAV-003 session aggregation includes all helpers and state', () => {
    startScenario('SAV-003')
    setNotepadNotes(env, [{ id: 'note-1', body: 'Remember recursion' }])
    setPendingModuleSelection(env, 1)
    env.windowRef.lastSenseiResponses = ['Great job']
    env.windowRef.userInputHistory = ['Explain again']
    env.windowRef.autoResizeEnabled = false
    const sessionData = (SaveLoadProgressManager as any).collectSessionData()
    expect(sessionData.curriculumState).toBeTruthy()
    expect(sessionData.learnerModel).toBeTruthy()
    expect(sessionData.applicationState.currentMessageId).toBe(env.windowRef.currentMessageId)
    expect(sessionData.applicationState.pendingModuleSelection).toBe(1)
    expect(sessionData.chatSession.history).toBeInstanceOf(Array)
    expect(sessionData.ui.messages).toBeInstanceOf(Array)
    expect(sessionData.notepad.notes.length).toBe(1)
    completeScenario('SAV-003')
  })

  test('SAV-004 extracts chat from DOM with raw text overrides', () => {
    startScenario('SAV-004')
    const messages: DomMessageInput[] = [
      { id: 'm1', sender: 'user', text: 'Hi there', timestamp: '2025-10-02T10:00:00.000Z' },
      { id: 'm2', sender: 'sensei', text: 'Rendered text', rawText: 'Markdown **text**', timestamp: '2025-10-02T10:00:10.000Z' }
    ]
    seedDomMessages(env, messages)
    const history = (SaveLoadProgressManager as any).extractChatHistory(env.windowRef.mainSenseiChat)
    expect(env.mainSenseiChatGetHistory).not.toHaveBeenCalled()
    expect(history).toHaveLength(2)
    expect(history[1].content).toBe('Markdown **text**')
    completeScenario('SAV-004')
  })

  test('SAV-005 merges SDK fallback history and cleans prompts', () => {
    startScenario('SAV-005')
    clearDomMessages(env)
    seedSdkHistory(env, [
      {
        role: 'system',
        parts: [{ text: 'system prompt' }],
        timestamp: '2025-10-02T10:00:00.000Z'
      },
      {
        role: 'user',
        parts: [{ text: '[RecursiveSensei Directive]\n\nUser: Real question' }],
        timestamp: '2025-10-02T10:00:05.000Z'
      },
      {
        role: 'model',
        parts: [{ text: 'chunk1' }],
        timestamp: '2025-10-02T10:00:06.000Z'
      },
      {
        role: 'model',
        parts: [{ text: 'chunk2' }],
        timestamp: '2025-10-02T10:00:07.000Z'
      }
    ])
    const history = (SaveLoadProgressManager as any).extractChatHistory(env.windowRef.mainSenseiChat)
    expect(history).toHaveLength(2)
    expect(history[0].content).toBe('Real question')
    expect(history[1].content).toBe('chunk1chunk2')
    completeScenario('SAV-005')
  })

  test('SAV-006 captures UI snapshot including raw text and footer', () => {
    startScenario('SAV-006')
    seedDomMessages(env, [
      { id: 'u1', sender: 'user', text: 'User message' },
      { id: 's1', sender: 'sensei', text: 'Rendered message', rawText: 'Raw message' }
    ])
    const uiState = (SaveLoadProgressManager as any).collectUIState()
    expect(uiState.messages).toHaveLength(2)
    expect(uiState.rawTextMap['s1']).toBe('Raw message')
    expect(uiState.footerState.confidence).toBe('Confident')
    expect(uiState.curriculumStatus).toBe('Module One • Concept One')
    completeScenario('SAV-006')
  })

  test('SAV-007 generates metadata from curriculum and learner metrics', () => {
    startScenario('SAV-007')
    const agent = overrideUserAgent('TestAgent/1.0')
    env.windowRef.sessionStartTime = Date.now() - 120000
    env.windowRef.curriculumState.currentTeachingChunkIndex = 1
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.ui.messages = [
      {
        id: 'sensei-error',
        sender: 'sensei',
        text: 'Will fail',
        timestamp: new Date().toISOString(),
        isReloadable: false,
        phaseSelectionEnabled: false
      }
    ]
    session.ui.rawTextMap = { 'sensei-error': 'Will fail' }
    const metadata = (SaveLoadProgressManager as any).generateMetadata(session)
    expect(metadata.moduleName).toBe('Module One')
    expect(metadata.chunkProgress).toBe('2/2')
    expect(metadata.totalInteractions).toBe(42)
    expect(metadata.saveEnvironment).toBe('TestAgent/1.0')
    agent.restore()
    completeScenario('SAV-007')
  })

  test('SAV-008 serializes and deserializes complex types', () => {
    startScenario('SAV-008')
    const original = {
      map: new Map([['key', new Set([1, 2])]]),
      set: new Set(['a', 'b']),
      date: new Date('2025-10-02T10:00:00.000Z'),
      nested: { value: undefined }
    }
    const json = JSON.stringify(original, serialization.serializeForSave)
    const parsed = JSON.parse(json, serialization.deserializeFromSave)
    expect(parsed.map instanceof Map).toBe(true)
    expect(parsed.map.get('key') instanceof Set).toBe(true)
    expect(parsed.set instanceof Set).toBe(true)
    expect(parsed.date instanceof Date).toBe(true)
    expect(parsed.nested.value).toBeNull()
    completeScenario('SAV-008')
  })

  test('SAV-009 validation failure blocks save and prevents download', async () => {
    startScenario('SAV-009')
    const collectSpy = jest.spyOn(SaveLoadProgressManager as any, 'collectSessionData').mockReturnValue({
      learnerModel: null,
      applicationState: { lastSenseiResponses: [] },
      chatSession: { history: [], systemInstruction: '', modelConfig: {} },
      ui: { messages: [], rawTextMap: {}, footerState: { confidence: '', confusion: '', intent: '' }, curriculumStatus: '' },
      notepad: { notes: [] },
      consolidation: null
    })
    const validationSpy = jest.spyOn(serialization, 'validateSerializedData').mockReturnValue({ isValid: false, errors: ['Missing required field: learnerModel'] })
    await expect(SaveLoadProgressManager.saveProgress()).rejects.toThrow('State validation failed: Missing required field: learnerModel')
    expect(downloadSpies.createObjectURL).not.toHaveBeenCalled()
    collectSpy.mockRestore()
    validationSpy.mockRestore()
    completeScenario('SAV-009')
  })

  test('SAV-010 falls back to timestamp filename when download fails', async () => {
    startScenario('SAV-010')
    jest.useFakeTimers({ now: Date.now() })
    const downloadSpy = jest.spyOn(SaveLoadProgressManager as any, 'downloadSaveFile')
    let callIndex = 0
    downloadSpies.createObjectURL.mockImplementation(() => {
      callIndex += 1
      if (callIndex === 1) {
        throw new Error('createObjectURL failure')
      }
      return 'blob:success'
    })
    const resultDate = Date.now()
    const promise = SaveLoadProgressManager.saveProgress()
    await jest.runAllTimersAsync()
    await promise
    expect(downloadSpy.mock.calls[0][1]).toMatch(/^sensei_progress_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
    expect(downloadSpy.mock.calls[1][1]).toBe(`sensei_progress_${resultDate}.json`)
    downloadSpy.mockRestore()
    completeScenario('SAV-010')
  })

  test('SAV-011 creates blob download anchor and triggers click', async () => {
    startScenario('SAV-011')
    await SaveLoadProgressManager.saveProgress()
    expect(downloadSpies.createObjectURL).toHaveBeenCalled()
    expect(anchorController.anchors).toHaveLength(1)
    const anchor = anchorController.anchors[0]
    expect(anchor.download).toMatch(/^sensei_progress_/)
    expect((anchor.click as jest.Mock)).toHaveBeenCalled()
    expect(downloadSpies.appendChild).toHaveBeenCalledWith(anchor)
    expect(downloadSpies.removeChild).toHaveBeenCalledWith(anchor)
    completeScenario('SAV-011')
  })

  test('LOD-001 rejects mismatched major version and resets restoring flag', async () => {
    startScenario('LOD-001')
    fileReaderController = installFileReaderMock()
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const promise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify({ version: '1.0.0', session: {} }, serialization.serializeForSave))
    await expect(promise).rejects.toThrow('Major version mismatch')
    expect((SaveLoadProgressManager as any).isRestoring).toBe(false)
    completeScenario('LOD-001')
  })

  test('LOD-002 restores session data end-to-end', async () => {
    startScenario('LOD-002')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.applicationState.pendingModuleSelection = 1
    session.notepad.notes = [{ id: 'note-1', body: 'Note text' }]
    session.chatSession.history = [
      { role: 'user', content: 'Hi' },
      { role: 'model', content: 'Hello' }
    ]
    session.ui.rawTextMap['restored'] = 'Restored text'
    session.ui.messages = [
      {
        id: 'restored',
        sender: 'sensei',
        text: 'Rendered',
        timestamp: new Date().toISOString(),
        isReloadable: true,
        phaseSelectionEnabled: true
      }
    ]
    session.consolidation = (SaveLoadProgressManager as any).serializeConsolidation(env.windowRef.curriculumState.activeConsolidationState)
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    expect(env.notepadRestoreNotes).toHaveBeenCalledWith([{ id: 'note-1', body: 'Note text' }])
    expect(env.displayMessage).toHaveBeenCalled()
    expect(env.processMermaidBlocks).toHaveBeenCalled()
    expect(env.updateFooter).toHaveBeenCalled()
    expect(env.updateCurriculumDisplay).toHaveBeenCalled()
    expect(env.windowRef.curriculumState.activeConsolidationState?.plan instanceof Map).toBe(true)
    completeScenario('LOD-002')
  })

  test('LOD-003 trims chat replay to last 100 entries and uses saved config', async () => {
    startScenario('LOD-003')
    fileReaderController = installFileReaderMock()
    const baseSession = (SaveLoadProgressManager as any).collectSessionData()
    baseSession.chatSession.history = Array.from({ length: 120 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'model',
      content: `message-${index}`
    }))
    baseSession.chatSession.systemInstruction = 'Custom instruction'
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session: baseSession
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    expect(windowAIController.createChat).toHaveBeenCalled()
    const call = windowAIController.createChat.mock.calls[0][0]
    expect(call.history).toHaveLength(100)
    expect(call.config.systemInstruction).toBe('Custom instruction')
    completeScenario('LOD-003')
  })

  test('LOD-004 restores raw text map and processes mermaid blocks', async () => {
    startScenario('LOD-004')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.ui.messages = [
      {
        id: 'sensei-1',
        sender: 'sensei',
        text: 'Rendered',
        timestamp: new Date().toISOString(),
        isReloadable: false,
        phaseSelectionEnabled: false
      }
    ]
    session.ui.rawTextMap = { 'sensei-1': 'Raw content' }
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    expect(env.streamingRawText.get('sensei-1')).toBe('Raw content')
    expect(env.processMermaidBlocks).toHaveBeenCalledWith('sensei-1')
    completeScenario('LOD-004')
  })

  test('LOD-005 updates footer and curriculum via helpers or fallback', async () => {
    startScenario('LOD-005')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.ui.footerState = { confidence: 'High', confusion: 'Low', intent: 'Curious' }
    session.ui.curriculumStatus = 'Module Two • Concept Three'
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    expect(env.updateFooter).toHaveBeenCalled()
    expect(env.updateCurriculumDisplay).toHaveBeenCalled()
    completeScenario('LOD-005')
  })

  test('LOD-006 replays pending module selection message', async () => {
    startScenario('LOD-006')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.applicationState.pendingModuleSelection = 1
    env.windowRef.displayPhaseSelectionMessage = jest.fn()
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    expect(env.windowRef.displayPhaseSelectionMessage).toHaveBeenCalled()
    completeScenario('LOD-006')
  })

  test('LOD-007 restores consolidation plan map', async () => {
    startScenario('LOD-007')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.consolidation = (SaveLoadProgressManager as any).serializeConsolidation({
      stage: 'Diagnosing',
      plan: new Map([[1, [{ text: 'Plan', kcValue: 1 }]]]),
      planOrder: [1],
      currentPlanStep: 0
    })
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await loadPromise
    const plan = env.windowRef.curriculumState.activeConsolidationState?.plan
    expect(plan instanceof Map).toBe(true)
    expect(plan?.get(1)?.[0].text).toBe('Plan')
    completeScenario('LOD-007')
  })

  test('LOD-008 reinitializes SelectionSensei after delay', async () => {
    startScenario('LOD-008')
    fileReaderController = installFileReaderMock()
    jest.useFakeTimers({ now: Date.now() })
    try {
      const session = (SaveLoadProgressManager as any).collectSessionData()
      const saveFile = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        metadata: {},
        session
      }
      const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
      env.windowRef.__selectionSenseiLoader = jest.fn(async () => ({ reinitializeSelectionSensei }))
      const promise = SaveLoadProgressManager.loadProgress(file)
      fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
      await jest.runOnlyPendingTimersAsync()
      await promise
      await jest.advanceTimersByTimeAsync(200)
      await Promise.resolve()
      expect((reinitializeSelectionSensei as jest.Mock)).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
      delete env.windowRef.__selectionSenseiLoader
    }
    completeScenario('LOD-008')
  })

  test('LOD-009 resets isRestoring after UI restoration error', async () => {
    startScenario('LOD-009')
    fileReaderController = installFileReaderMock()
    const restoreUISpy = jest.spyOn(SaveLoadProgressManager as any, 'restoreUIState').mockRejectedValue(new Error('render failure'))
    const session = (SaveLoadProgressManager as any).collectSessionData()
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await expect(loadPromise).rejects.toThrow('render failure')
    expect(restoreUISpy).toHaveBeenCalled()
    restoreUISpy.mockRestore()
    expect((SaveLoadProgressManager as any).isRestoring).toBe(false)
    completeScenario('LOD-009')
  })

  test('LOD-010 reads file via FileReader and uses reviver for types', async () => {
    startScenario('LOD-010')
    fileReaderController = installFileReaderMock()
    const payload = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session: (SaveLoadProgressManager as any).collectSessionData()
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(payload, serialization.serializeForSave))
    await loadPromise
    expect(fileReaderController.pendingCount()).toBe(0)
    completeScenario('LOD-010')
  })

  test('DAT-001 curriculum state serialization round-trips sets and maps', () => {
    startScenario('DAT-001')
    const state = env.windowRef.curriculumState
    state.coveredPointsInCurrentChunk.add('Point A1')
    state.pointsToRevisitInCurrentChunk.add('Point B1')
    const serialized = serialization.serializeCurriculumState(state)
    const restored = serialization.deserializeCurriculumState(serialized)
    expect(restored.coveredPointsInCurrentChunk instanceof Set).toBe(true)
    expect(restored.pointsToRevisitInCurrentChunk instanceof Set).toBe(true)
    completeScenario('DAT-001')
  })

  test('DAT-002 learner model set preserved across serialization', () => {
    startScenario('DAT-002')
    env.windowRef.learnerModel.awardedKcForPhasePoints.add('kc-extra')
    const serialized = serialization.serializeLearnerModel(env.windowRef.learnerModel)
    const restored = serialization.deserializeLearnerModel(serialized)
    expect(restored.awardedKcForPhasePoints instanceof Set).toBe(true)
    expect(restored.awardedKcForPhasePoints.has('kc-extra')).toBe(true)
    completeScenario('DAT-002')
  })

  test('DAT-003 deepCloneState creates structural copy without mutation', () => {
    startScenario('DAT-003')
    const original = {
      date: new Date('2025-10-02T10:00:00.000Z'),
      set: new Set([1, 2]),
      map: new Map([[1, { value: 5 }]])
    }
    const clone = serialization.deepCloneState(original)
    ;(clone.set as Set<number>).add(3)
    ;(clone.map as Map<number, { value: number }>).get(1)!.value = 10
    expect(original.set.has(3)).toBe(false)
    expect((original.map.get(1) as any).value).toBe(5)
    completeScenario('DAT-003')
  })

  test('DAT-004 consolidation helper preserves map entries', () => {
    startScenario('DAT-004')
    const serialized = (SaveLoadProgressManager as any).serializeConsolidation({
      stage: 'Diagnosing',
      plan: new Map([[0, [{ text: 'Plan Item', kcValue: 1 }]]]),
      planOrder: [0],
      currentPlanStep: 0
    })
    const restored = (SaveLoadProgressManager as any).deserializeConsolidation(serialized)
    expect(restored?.plan instanceof Map).toBe(true)
    expect(restored?.plan.get(0)?.[0].text).toBe('Plan Item')
    completeScenario('DAT-004')
  })

  test('DAT-005 curriculum checksum stable for identical module metadata', () => {
    startScenario('DAT-005')
    const checksumA = (SaveLoadProgressManager as any).generateCurriculumChecksum(env.windowRef.curriculum)
    const checksumB = (SaveLoadProgressManager as any).generateCurriculumChecksum(env.windowRef.curriculum)
    env.windowRef.curriculum.modules[0].title = 'Changed'
    const checksumC = (SaveLoadProgressManager as any).generateCurriculumChecksum(env.windowRef.curriculum)
    expect(checksumA).toBe(checksumB)
    expect(checksumC).not.toBe(checksumA)
    completeScenario('DAT-005')
  })

  test('ERR-001 validation fails when applicationState missing', () => {
    startScenario('ERR-001')
    const result = serialization.validateSerializedData({
      learnerModel: {},
      chatSession: { history: [], systemInstruction: '', modelConfig: {} },
      ui: { messages: [], rawTextMap: {}, footerState: { confidence: '', confusion: '', intent: '' }, curriculumStatus: '' },
      notepad: { notes: [] },
      consolidation: null
    })
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(['Missing required field: applicationState']))
    completeScenario('ERR-001')
  })

  test('ERR-002 validation fails for null data', () => {
    startScenario('ERR-002')
    const result = serialization.validateSerializedData(null as any)
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(['Data is null or undefined']))
    completeScenario('ERR-002')
  })

  test('ERR-003 FileReader errors reject loadProgress', async () => {
    startScenario('ERR-003')
    fileReaderController = installFileReaderMock()
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.rejectNext(new Error('read failure'))
    await expect(loadPromise).rejects.toBeDefined()
    completeScenario('ERR-003')
  })

  test('ERR-004 loadProgress falls back when DOM nodes missing', async () => {
    startScenario('ERR-004')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    delete env.windowRef.updateFooter
    delete env.windowRef.updateCurriculumDisplay
    env.footerNodes.confidence.remove()
    env.footerNodes.confusion.remove()
    env.footerNodes.intent.remove()
    env.curriculumStatusNode.remove()
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await expect(loadPromise).resolves.toBeUndefined()
    completeScenario('ERR-004')
  })

  test('ERR-005 SelectionSensei loader rejection does not break load flow', async () => {
    startScenario('ERR-005')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const handler = () => {}
    process.on('unhandledRejection', handler)
    const loaderSpy = jest.fn(async () => ({
      reinitializeSelectionSensei: () => {
        throw new Error('loader-failure')
      }
    }))
    env.windowRef.__selectionSenseiLoader = loaderSpy
    const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await expect(loadPromise).resolves.toBeUndefined()
    await new Promise(resolve => setTimeout(resolve, 150))
    process.off('unhandledRejection', handler)
    delete env.windowRef.__selectionSenseiLoader
    expect(loaderSpy).toHaveBeenCalled()
    expect(loggerErrorSpy).toHaveBeenCalled()
    loggerErrorSpy.mockRestore()
    completeScenario('ERR-005')
  })

  test('ERR-006 loadProgress tolerates partial UI snapshot', async () => {
    startScenario('ERR-006')
    fileReaderController = installFileReaderMock()
    const session = (SaveLoadProgressManager as any).collectSessionData()
    session.ui.messages = []
    session.ui.rawTextMap = {}
    const saveFile = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {},
      session
    }
    const file = new globalThis.File(['{}'], 'progress.json', { type: 'application/json' })
    const loadPromise = SaveLoadProgressManager.loadProgress(file)
    fileReaderController.resolveNext(JSON.stringify(saveFile, serialization.serializeForSave))
    await expect(loadPromise).resolves.toBeUndefined()
    const messageArea = document.getElementById('message-area')
    expect(messageArea).not.toBeNull()
    completeScenario('ERR-006')
  })
})

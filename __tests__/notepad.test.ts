import { Notepad } from '../notepad'
import { logger } from '../logger'
import { Curriculum } from '../curriculum'
import { NotepadImporter, NotepadImportError, ImportedConceptGroup } from '../notepadImporter'

jest.mock('../ui', () => ({
  showImportFailureModal: jest.fn(() => Promise.resolve())
}))

jest.mock('marked')

describe('Notepad custom concepts', () => {
  let originalRAF: typeof requestAnimationFrame
  let originalQuill: any

  beforeAll(() => {
    originalRAF = window.requestAnimationFrame
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    }
    originalQuill = (global as any).Quill
    ;(global as any).Quill = jest.fn(() => ({
      root: { innerHTML: '' },
      getContents: jest.fn(() => ({})),
      setContents: jest.fn(),
      clipboard: { dangerouslyPasteHTML: jest.fn() },
      focus: jest.fn(),
      getText: jest.fn(() => '')
    }))
  })

  afterAll(() => {
    window.requestAnimationFrame = originalRAF
    ;(global as any).Quill = originalQuill
  })

  beforeEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  const buildCurriculum = (): Curriculum => ({
    modules: [
      {
        id: 'module-1',
        title: 'Module 1',
        goal: 'Goal',
        concepts: [
          { id: 'concept-1', title: 'Concept 1', description: '', overview: '', motivation: '', examples: [], checkpoints: [] }
        ]
      }
    ]
  } as unknown as Curriculum)

  const openModal = (instance: Notepad) => {
    ;(instance as any).openModal()
  }

  test('creates a custom concept via header button and commits rename on enter', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    openModal(instance)

    const addButton = document.getElementById('notepad-add-concept-button') as HTMLButtonElement
    addButton.click()

    const input = document.querySelector('.notepad-concept-title-input') as HTMLInputElement
    expect(input).not.toBeNull()
    input.value = 'Custom Concept'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    const snapshot = instance.getAllNotes()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].title).toBe('Custom Concept')
  })

  test('concept add note button logs note-added and opens editor', () => {
    const infoSpy = jest.spyOn(logger, 'info')
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    openModal(instance)

    const addConcept = document.getElementById('notepad-add-concept-button') as HTMLButtonElement
    addConcept.click()
    const input = document.querySelector('.notepad-concept-title-input') as HTMLInputElement
    input.value = 'Concept A'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    const addNoteButton = document.querySelector('.notepad-concept-add-note') as HTMLButtonElement
    addNoteButton.click()

    const logs = infoSpy.mock.calls.filter(call => call[0] === '[NOTEPAD_CUSTOM_CONCEPTS]')
    const noteLog = logs.find(call => call[1]?.event === 'note-added' && call[1]?.source === 'concept-button')
    expect(noteLog).toBeTruthy()

    const quillCalls = (global as any).Quill.mock.calls
    expect(quillCalls.length).toBeGreaterThan(0)
  })

  test('addNote uses curriculum context to create concept automatically', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    instance.setActiveCurriculumContext({ conceptTitle: 'Context Concept', moduleTitle: 'Module 1' })
    instance.addNote('Sample', 'Sample')

    const snapshot = instance.getAllNotes()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].title).toBe('Context Concept')
    expect(snapshot[0].notes).toHaveLength(1)
    expect(snapshot[0].notes[0].text).toBe('Sample')
  })

  test('persistence round trip preserves concept hierarchy', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    instance.setActiveCurriculumContext({ conceptTitle: 'Persisted Concept' })
    instance.addNote('Alpha', 'Alpha')

    const snapshot = instance.getAllNotes()
    const fresh = new Notepad()
    fresh.initialize(buildCurriculum())
    fresh.restoreNotes(snapshot as unknown as any[])
    const restored = fresh.getAllNotes()
    expect(restored).toHaveLength(1)
    expect(restored[0].title).toBe('Persisted Concept')
    expect(restored[0].notes).toHaveLength(1)
    expect(restored[0].notes[0].text).toBe('Alpha')
  })

  test('restoreNotes migrates legacy array and logs migration-complete', () => {
    const infoSpy = jest.spyOn(logger, 'info')
    const legacy = [
      {
        id: 'legacy-1',
        moduleTitle: 'Legacy Module',
        conceptTitle: 'Legacy Concept',
        text: 'Legacy Text',
        timestamp: new Date().toISOString()
      }
    ]
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    instance.restoreNotes(legacy as unknown as any[])
    const snapshot = instance.getAllNotes()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].title).toBe('Legacy Concept')
    const migrationLog = infoSpy.mock.calls.find(call => call[0] === '[NOTEPAD_CUSTOM_CONCEPTS]' && call[1]?.event === 'migration-complete')
    expect(migrationLog).toBeTruthy()
  })

  test('import merges notes into existing concept', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    instance.setActiveCurriculumContext({ conceptTitle: 'Merge Concept' })
    instance.addNote('Existing note', 'Existing note')

    const initialSnapshot = instance.getAllNotes()
    const conceptId = initialSnapshot[0].id

    const importGroups: ImportedConceptGroup[] = [
      {
        id: conceptId,
        title: 'Merge Concept',
        createdAt: new Date().toISOString(),
        notes: [
          {
            id: 'import-note-1',
            htmlContent: '<p>Imported</p>',
            textContent: 'Imported note',
            timestamp: new Date().toISOString()
          }
        ]
      }
    ]

    ;(instance as any).mergeImportedConcepts(importGroups)

    const after = instance.getAllNotes()
    expect(after).toHaveLength(1)
    expect(after[0].notes).toHaveLength(2)
    const noteTexts = after[0].notes.map(note => note.text.trim())
    expect(noteTexts).toEqual(expect.arrayContaining(['Existing note', 'Imported note']))
  })

  test('renaming concept with blank title defaults to Untitled Concept', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    openModal(instance)

    const addConcept = document.getElementById('notepad-add-concept-button') as HTMLButtonElement
    addConcept.click()
    const input = document.querySelector('.notepad-concept-title-input') as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    const snapshot = instance.getAllNotes()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].title).toBe('Untitled Concept')
  })

  test('restoreNotes ignores malformed payloads', () => {
    const instance = new Notepad()
    instance.initialize(buildCurriculum())
    instance.restoreNotes('bad-payload' as unknown as any[])
    const snapshot = instance.getAllNotes()
    expect(snapshot).toHaveLength(0)
  })

  test('importer rejects documents without concept sections', () => {
    const importer = new NotepadImporter()
    expect(() => (importer as any).parseHtml('<html></html>')).toThrow(NotepadImportError)
  })
})

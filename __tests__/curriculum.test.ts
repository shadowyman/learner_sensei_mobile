import type {
  Concept,
  Curriculum,
  CurriculumItem,
  CurriculumState,
  Phase,
  TeachingPoint
} from '../curriculum'
import { initializeLearnerModel, type LearnerModel } from '../adaptiveEngine'
import type { ConsolidationState } from '../consolidationManager'
import {
  CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
  GENERAL_INTERACTION_FOCUS_INSTRUCTION,
  REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE,
  TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE,
  REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE,
  REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE,
  GENERAL_ENGAGEMENT_PROMPT_TEMPLATE
} from '../prompts'
import { logger } from '../logger'
const consolidationManager = require('../consolidationManager') as typeof import('../consolidationManager')

const SAMPLE_CURRICULUM_TEXT = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. What is recursion?: Recursion depends on base cases.
2. Why base cases matter: Base cases stop infinite loops.

Methodology:
1. Explain base cases: Show terminating conditions.
2. Trace recursion: Walk through recursive calls.

Socratic:
Challenge the learner to predict call depth.
Solidify & Prepare:
Summarize recursion strategies.
`

const resetTeachingPlanCache = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('teaching-plan-cache')
  }
}

const setupIntroIllustrateItem = async () => {
  const { parseModulesTxt, initializeCurriculumState, getCurrentCurriculumItem } = await loadCurriculumModule()
  const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
  const seedPlan = createTeachingPlan([
    ['Seed teaching point']
  ])
  const state = await initializeCurriculumState(curriculum, plannerFromPlan(seedPlan), 0)
  if (!state) {
    throw new Error('Failed to initialize curriculum state for tests')
  }
  resetTeachingPlanCache()
  const item = getCurrentCurriculumItem(curriculum, state)
  if (!item) {
    throw new Error('Failed to resolve curriculum item for tests')
  }
  return { curriculum, state, item }
}

type ChunkTexts = string[][]

const createConcept = (title: string, text: string): Concept => ({
  title,
  text
})

const createTeachingPoint = (text: string, kcValue = 0.1, extras: Partial<TeachingPoint> = {}): TeachingPoint => ({
  text,
  kcValue,
  ...extras
})

const createTeachingPlan = (chunks: ChunkTexts, kcValue = 0.1): TeachingPoint[][] =>
  chunks.map(chunk => chunk.map(text => createTeachingPoint(text, kcValue)))

const createModuleDefinition = ({
  id = 'Module1',
  title = 'Recursion Module',
  summary = 'Module summary',
  goal = 'Understand recursion basics',
  concepts = [createConcept('Concept 1', 'Recursion depends on base cases.')],
  methodology = [
    { title: 'Explain base cases', text: 'Show examples of terminating conditions.' },
    { title: 'Trace recursion', text: 'Walk through recursive calls step by step.' }
  ],
  socratic = 'Ask the learner to predict call stacks.',
  solidify = 'Review key takeaways and practice problems.'
}: Partial<Curriculum['modules'][number]> = {}): Curriculum['modules'][number] => ({
  id,
  title,
  summary,
  goal,
  concepts,
  methodology,
  socratic,
  solidify
})

const createCurriculum = (modules: Curriculum['modules'] = [createModuleDefinition({})]): Curriculum => ({
  modules
})

const createCurriculumWithConcepts = (concepts: string[]): Curriculum => {
  const module = createModuleDefinition({
    concepts: concepts.map((title, index) => createConcept(title, `Concept ${index + 1} detail.`))
  })
  return createCurriculum([module])
}

const createCurriculumItem = ({
  moduleTitle,
  moduleGoal,
  concept,
  curriculumPathId,
  phase,
  isModuleWidePhase
}: {
  moduleTitle: string
  moduleGoal: string
  concept: Concept | null
  curriculumPathId: string
  phase: Phase
  isModuleWidePhase?: boolean
}): CurriculumItem => ({
  moduleTitle,
  moduleGoal,
  concept,
  curriculumPathId,
  isLastConceptInModule: false,
  isLastPhaseForConcept: false,
  isModuleWidePhase: Boolean(isModuleWidePhase)
})

type CurriculumStateOverrides = Partial<CurriculumState> & {
  teachingPlan?: TeachingPoint[][]
}

const createCurriculumState = ({
  currentModuleIndex = 0,
  currentConceptIndex = 0,
  currentPhase = 'IntroIllustrate' as Phase,
  teachingPlan = createTeachingPlan([
    ['Introduce recursion', 'Describe base case'],
    ['Explore recursive step']
  ]),
  isCompleted = false,
  activeConsolidationState = null,
  currentTeachingChunkIndex = 0,
  coveredPointsInCurrentChunk = new Set<string>(),
  pointsToRevisitInCurrentChunk = new Set<string>(),
  socraticTurnCount = 0,
  socraticBaseInstruction = null,
  socraticCompletionPending = null
}: CurriculumStateOverrides = {}): CurriculumState => ({
  currentModuleIndex,
  currentConceptIndex,
  currentPhase,
  activeConsolidationState,
  isCompleted,
  teachingPlanForPhase: teachingPlan,
  currentTeachingChunkIndex,
  coveredPointsInCurrentChunk,
  pointsToRevisitInCurrentChunk,
  socraticTurnCount,
  socraticBaseInstruction,
  socraticCompletionPending
})

const makePathId = (moduleId: string, conceptTitle: string | null, phase: Phase) => {
  const normalizedConcept = conceptTitle ? `${conceptTitle.replace(/\s+/g, '_')}-` : ''
  return `${moduleId}-${normalizedConcept}Phase_${phase}`
}

const ensureRevisitSet = (state: CurriculumState): Set<string> => {
  if (!state.pointsToRevisitInCurrentChunk) {
    state.pointsToRevisitInCurrentChunk = new Set<string>()
  }
  return state.pointsToRevisitInCurrentChunk
}

const getFirstChunk = (plan: TeachingPoint[][]): TeachingPoint[] => {
  const chunk = plan[0]
  if (!chunk) {
    throw new Error('Expected teaching plan to contain at least one chunk')
  }
  return chunk
}

const getChunkPoint = (chunk: TeachingPoint[], index: number): TeachingPoint => {
  const point = chunk[index]
  if (!point) {
    throw new Error('Expected teaching chunk to contain required point')
  }
  return point
}

const createLearnerModel = (): LearnerModel => {
  const model = initializeLearnerModel()
  model.awardedKcForPhasePoints = new Set<string>()
  model.contentPointsCoverage = {}
  return model
}

const plannerFromPlan = (plan: TeachingPoint[][]) => async (phase: Phase, text: string): Promise<TeachingPoint[][]> => {
  void phase
  void text
  return plan
}

const loadCurriculumModule = async () => require('../curriculum') as typeof import('../curriculum')

const getFirstModule = (curriculum: Curriculum): Curriculum['modules'][number] => {
  const moduleDef = curriculum.modules[0]
  if (!moduleDef) {
    throw new Error('Curriculum requires at least one module')
  }
  return moduleDef
}

const getFirstConcept = (moduleDef: Curriculum['modules'][number]): Concept => {
  const concept = moduleDef.concepts[0]
  if (!concept) {
    throw new Error('Module requires at least one concept')
  }
  return concept
}

const buildCurriculumContext = () => {
  const curriculum = createCurriculum()
  const moduleDef = getFirstModule(curriculum)
  const concept = getFirstConcept(moduleDef)
  const item = createCurriculumItem({
    moduleTitle: moduleDef.title,
    moduleGoal: moduleDef.goal,
    concept,
    curriculumPathId: makePathId(moduleDef.id, concept.title, 'IntroIllustrate'),
    phase: 'IntroIllustrate'
  })
  return { curriculum, moduleDef, concept, item }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fixtures sanity', () => {
  test('createCurriculum builds module with concepts and sections', () => {
    const curriculum = createCurriculum()
    expect(curriculum.modules).toHaveLength(1)
    const module = getFirstModule(curriculum)
    expect(module.concepts.length).toBeGreaterThan(0)
    expect(module.socratic).toMatch(/predict/)
    expect(module.solidify).toMatch(/Review/)
  })

  test('createCurriculumItem produces expected structure', () => {
    const moduleDef = createModuleDefinition({})
    const item = createCurriculumItem({
      moduleTitle: moduleDef.title,
      moduleGoal: moduleDef.goal,
      concept: moduleDef.concepts[0] ?? null,
      curriculumPathId: 'Module1-Concept1-Phase_IntroIllustrate',
      phase: 'IntroIllustrate',
      isModuleWidePhase: false
    })
    expect(item.moduleTitle).toBe(moduleDef.title)
    expect(item.concept?.title).toBe(moduleDef.concepts[0]?.title)
    expect(item.isModuleWidePhase).toBe(false)
  })

  test('createCurriculumState seeds teaching plan and sets', () => {
    const state = createCurriculumState()
    expect(Array.isArray(state.teachingPlanForPhase)).toBe(true)
    expect(state.teachingPlanForPhase[0]?.length).toBeGreaterThan(0)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
  })

  test('createLearnerModel initializes sets and coverage map', () => {
    const model = createLearnerModel()
    expect(model.awardedKcForPhasePoints instanceof Set).toBe(true)
    expect(model.contentPointsCoverage).toBeTruthy()
  })

  test('plannerFromPlan returns async generator of teaching plan', async () => {
    const plan = createTeachingPlan([
      ['Explain call stack'],
      ['Highlight base case']
    ])
    const planner = plannerFromPlan(plan)
    const result = await planner('IntroIllustrate', 'text')
    expect(result).toEqual(plan)
  })
})

describe('state accessors and content aggregation', () => {
  test('curriculum load state toggles', async () => {
    await new Promise<void>(resolve => {
      jest.isolateModules(() => {
        const isolatedModule = require('../curriculum') as typeof import('../curriculum')
        expect(isolatedModule.isCurriculumLoaded()).toBe(false)
        resolve()
      })
    })
    const { setCurriculum, isCurriculumLoaded, getLoadedCurriculum, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    setCurriculum(curriculum)
    expect(isCurriculumLoaded()).toBe(true)
    expect(getLoadedCurriculum()).toBe(curriculum)
  })

  test('concept phase aggregation passes concept and socratic content to planner', async () => {
    const { generateTeachingPlanForPhase, initializeCurriculumState, getCurrentCurriculumItem, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const seedState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Seed']
    ])), 0)
    if (!seedState) {
      throw new Error('Unable to initialize curriculum state')
    }
    const item = getCurrentCurriculumItem(curriculum, seedState)
    if (!item) {
      throw new Error('Expected curriculum item')
    }
    const plan = createTeachingPlan([
      ['Placeholder']
    ])
    let capturedText = ''
    const planner = jest.fn(async (phase: Phase, text: string) => {
      capturedText = text
      return plan
    })
    await generateTeachingPlanForPhase(curriculum, item, 'Socratic', planner)
    expect(planner).toHaveBeenCalledTimes(1)
    expect(capturedText).toContain(item.concept?.title ?? '')
    expect(capturedText).toContain(item.concept?.text ?? '')
    expect(capturedText).toContain(getFirstModule(curriculum).socratic)
  })

  test('module-wide aggregation includes goal, concepts, and solidify guidance', async () => {
    const { generateTeachingPlanForPhase, jumpToPhase, getCurrentCurriculumItem, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const moduleState = await jumpToPhase(curriculum, 0, 'Solidify', plannerFromPlan(createTeachingPlan([
      ['Module Seed']
    ])))
    if (!moduleState) {
      throw new Error('Unable to jump to module phase')
    }
    const item = getCurrentCurriculumItem(curriculum, moduleState)
    if (!item) {
      throw new Error('Expected module-wide curriculum item')
    }
    const plan = createTeachingPlan([
      ['Placeholder']
    ])
    let capturedText = ''
    const planner = jest.fn(async (phase: Phase, text: string) => {
      capturedText = text
      return plan
    })
    await generateTeachingPlanForPhase(curriculum, item, 'Solidify', planner)
    expect(planner).toHaveBeenCalledTimes(1)
    expect(capturedText).toContain(item.moduleGoal)
    getFirstModule(curriculum).concepts.forEach(entry => {
      expect(capturedText).toContain(entry.title)
      expect(capturedText).toContain(entry.text)
    })
    expect(capturedText).toContain(getFirstModule(curriculum).solidify)
  })

  test('missing module produces empty-source generation error', async () => {
    const { generateTeachingPlanForPhase, initializeCurriculumState, getCurrentCurriculumItem, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Seed']
    ])), 0)
    if (!state) {
      throw new Error('Unable to initialize curriculum state')
    }
    const baseItem = getCurrentCurriculumItem(curriculum, state)
    if (!baseItem) {
      throw new Error('Expected curriculum item')
    }
    const missingModuleItem = {
      ...baseItem,
      moduleTitle: 'Missing Module',
      curriculumPathId: 'Missing-Phase_Socratic'
    }
    const planner = jest.fn(async () => createTeachingPlan([
      ['Placeholder']
    ]))
    await expect(generateTeachingPlanForPhase(curriculum, missingModuleItem, 'Socratic', planner)).rejects.toThrow('No source content available to generate teaching plan.')
    expect(planner).not.toHaveBeenCalled()
  })

  test('concept phase without concept produces empty-source generation error', async () => {
    const { generateTeachingPlanForPhase, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const moduleDef = getFirstModule(curriculum)
    const missingConceptItem = {
      moduleTitle: moduleDef.title,
      moduleGoal: moduleDef.goal,
      concept: null,
      curriculumPathId: `${moduleDef.id}-Phase_Socratic`,
      isLastConceptInModule: false,
      isLastPhaseForConcept: false,
      isModuleWidePhase: false
    }
    const planner = jest.fn(async () => createTeachingPlan([
      ['Placeholder']
    ]))
    await expect(generateTeachingPlanForPhase(curriculum, missingConceptItem, 'Socratic', planner)).rejects.toThrow('No source content available to generate teaching plan.')
    expect(planner).not.toHaveBeenCalled()
  })
})

describe('plan validation and generation', () => {
  test('rejects null teaching plan with validation error', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const planner = jest.fn(async () => null)
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_INVALID]', expect.objectContaining({ reason: 'Teaching plan is empty or missing.' }))
  })

  test('rejects empty teaching plan array', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const planner = jest.fn(async () => [])
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_INVALID]', expect.objectContaining({ reason: 'Teaching plan is empty or missing.' }))
  })

  test('rejects empty chunk entries', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const planner = jest.fn(async () => [[]])
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_INVALID]', expect.objectContaining({ chunkIndex: 1, reason: expect.stringContaining('Chunk 1') }))
  })

  test('rejects missing action item entries', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const valid = createTeachingPoint('Introduce recursion', 0.1)
    const planner = jest.fn(async () => [[valid, undefined as unknown as TeachingPoint]])
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_INVALID]', expect.objectContaining({ itemIndex: 2, chunkIndex: 1 }))
  })

  test('rejects blank text entries', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const planner = jest.fn(async () => [[createTeachingPoint('   ', 0.1)]])
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_INVALID]', expect.objectContaining({ reason: expect.stringContaining('missing text') }))
  })

  test('rejects invalid kc values across scenarios', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanValidationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const invalidPlans: TeachingPoint[][][] = [
      [[createTeachingPoint('Title', 0.1), createTeachingPoint('Detail', -0.2)]],
      [[createTeachingPoint('Title', 0.1), createTeachingPoint('Detail', Number.NaN)]],
      [[createTeachingPoint('Title', 0.1), createTeachingPoint('Detail', 0)]]
    ]
    for (const invalid of invalidPlans) {
      const planner = jest.fn(async () => invalid)
      await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanValidationError)
    }
    expect(errorSpy).toHaveBeenCalled()
    const kcLog = errorSpy.mock.calls.find(call => call[0] === '[TEACHING_PLAN_INVALID]' && call[1]?.kcValue !== undefined)
    expect(kcLog).toBeDefined()
  })

  test('accepts valid plan and sanitizes entries', async () => {
    const { generateTeachingPlanForPhase } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const plan: TeachingPoint[][] = [[
      createTeachingPoint('  Teach recursion  ', 0.2, {
        interactionGuidance: { expectedTurns: 2 },
        socraticMetadata: { detectedCategory: 'metacognitive' }
      }),
      createTeachingPoint('Reinforce understanding', 0.2, { isSocraticIntent: true })
    ]]
    const planner = jest.fn(async () => plan)
    const result = await generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)
    const firstChunk = getFirstChunk(result)
    const firstPoint = getChunkPoint(firstChunk, 0)
    const secondPoint = getChunkPoint(firstChunk, 1)
    expect(firstPoint.text).toBe('Teach recursion')
    expect(firstPoint.interactionGuidance).toEqual({ expectedTurns: 2 })
    expect(firstPoint.socraticMetadata).toEqual({ detectedCategory: 'metacognitive' })
    expect(secondPoint.isSocraticIntent).toBe(true)
    expect(infoSpy).toHaveBeenCalledWith('[TEACHING_PLAN_VALIDATION]', expect.objectContaining({ chunks: 1, totalActionItems: 2 }))
  })

  test('generation fails when module has no content', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanGenerationError } = await loadCurriculumModule()
    const { curriculum, item } = await setupIntroIllustrateItem()
    const concept = item.concept
    if (!concept) {
      throw new Error('Expected concept for IntroIllustrate item')
    }
    const planner = jest.fn(async () => createTeachingPlan([
      ['Placeholder']
    ]))
    const missingModuleItem = {
      ...item,
      moduleTitle: 'Missing Module',
      curriculumPathId: 'Missing-Phase_IntroIllustrate'
    }
    await expect(generateTeachingPlanForPhase(curriculum, missingModuleItem, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanGenerationError)
    expect(planner).not.toHaveBeenCalled()
  })

  test('planner exceptions are wrapped with TeachingPlanGenerationError', async () => {
    const { generateTeachingPlanForPhase, TeachingPlanGenerationError } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const { curriculum, item } = await setupIntroIllustrateItem()
    const planner = jest.fn(async () => {
      throw new Error('planner-failure')
    })
    await expect(generateTeachingPlanForPhase(curriculum, item, 'IntroIllustrate', planner)).rejects.toBeInstanceOf(TeachingPlanGenerationError)
    expect(errorSpy).toHaveBeenCalledWith('[TEACHING_PLAN_GENERATION_FAILED]', expect.objectContaining({ error: 'planner-failure' }))
  })
})

describe('parsing and migration', () => {
  const buildModuleText = () => `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. What is recursion?: A definition and intuition.
2. Why base cases matter: Prevent infinite descent.

Methodology:
1. Demonstrate simple recursion: Use factorial as anchor.
2. Contrast iterative vs recursion: Highlight trade-offs.

Socratic:
Ask learners to predict call depth.
Solidify & Prepare:
Summarize and assign practice problems.

Module 2: Advanced Recursion
Goal:
Explore recursion patterns

Concepts:
1. Tail recursion: Rewriting to eliminate additional frames.
2. Mutual recursion: Coordinated call cycles.

Methodology:
1. Visualize call graphs: Map function interplay.
2. Evaluate performance: Discuss complexity.

Socratic:
Challenge the learner with variations.
Solidify & Prepare:
Consolidate techniques with exercises.
`

  test('parses complete module text with all sections', async () => {
    const { parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(buildModuleText())
    expect(curriculum.modules).toHaveLength(2)
    const first = getFirstModule(curriculum)
    expect(first.goal).toContain('Understand recursion fundamentals')
    expect(first.concepts.map(entry => entry.title)).toEqual([
      'What is recursion?',
      'Why base cases matter'
    ])
    expect(first.methodology).toHaveLength(2)
    expect(first.socratic).toContain('predict call depth')
    expect(first.solidify).toContain('Summarize')
  })

  test('missing goal triggers parse error', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Concepts:
1. What is recursion?: Intro text.

Methodology:
1. Demonstrate: Step.

Socratic:
Prompt learner.
Solidify & Prepare:
Wrap up.
`
    expect(() => parseModulesTxt(text)).toThrow(CurriculumParsingError)
  })

  test('missing concepts section triggers error', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Methodology:
1. Demonstrate: Step.

Socratic:
Prompt learner.
Solidify & Prepare:
Wrap up.
`
    expect(() => parseModulesTxt(text)).toThrow(CurriculumParsingError)
  })

  test('malformed concept entry triggers error', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. Missing colon entry

Methodology:
1. Demonstrate: Step.

Socratic:
Prompt learner.
Solidify & Prepare:
Wrap up.
`
    expect(() => parseModulesTxt(text)).toThrow(CurriculumParsingError)
  })

  test('missing socratic section triggers parse error', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. What is recursion?: Intro text.

Methodology:
1. Demonstrate: Step.

Solidify & Prepare:
Wrap up.
`
    expect(() => parseModulesTxt(text)).toThrow(CurriculumParsingError)
  })

  test('missing solidify section triggers parse error', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. What is recursion?: Intro text.

Methodology:
1. Demonstrate: Step.

Socratic:
Prompt learner.
`
    expect(() => parseModulesTxt(text)).toThrow(CurriculumParsingError)
  })

  test('methodology parsing skips malformed steps', async () => {
    const { parseModulesTxt } = await loadCurriculumModule()
    const text = `
Module 1: Recursion Foundations
Goal:
Understand recursion fundamentals

Concepts:
1. What is recursion?: Intro text.

Methodology:
1. Valid step: First detail.
Invalid methodology line without delimiter
2. Another valid step: Second detail.

Socratic:
Prompt learner.
Solidify & Prepare:
Wrap up.
`
    const curriculum = parseModulesTxt(text)
    expect(getFirstModule(curriculum).methodology).toEqual([
      { title: '1. Valid step', text: 'First detail.\nInvalid methodology line without delimiter' },
      { title: '2. Another valid step', text: 'Second detail.' }
    ])
  })

  test('no module headers yields empty curriculum', async () => {
    const { parseModulesTxt, CurriculumParsingError } = await loadCurriculumModule()
    expect(() => parseModulesTxt('This text lacks module headers entirely.')).toThrow(CurriculumParsingError)
  })
})

describe('state initialization and navigation', () => {
  test('initializeCurriculumState seeds state for first concept', async () => {
    const { initializeCurriculumState } = await loadCurriculumModule()
    const { curriculum, item } = buildCurriculumContext()
    const plan = createTeachingPlan([
      ['Introduce recursion']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    expect(state).not.toBeNull()
    expect(state?.currentModuleIndex).toBe(0)
    expect(state?.currentConceptIndex).toBe(0)
    expect(state?.currentPhase).toBe('IntroIllustrate')
    expect(state?.teachingPlanForPhase).toEqual(plan)
    expect(state?.coveredPointsInCurrentChunk.size).toBe(0)
  })

  test('initializeCurriculumState guards invalid input', async () => {
    const { initializeCurriculumState } = await loadCurriculumModule()
    const { curriculum } = await setupIntroIllustrateItem()
    const errorSpy = jest.spyOn(logger, 'error')
    const plan = createTeachingPlan([
      ['Introduce recursion']
    ])
    const invalidIndexResult = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 5)
    expect(invalidIndexResult).toBeNull()
    const emptyCurriculum: Curriculum = { modules: [] }
    const emptyConceptsCurriculum: Curriculum = {
      modules: curriculum.modules.map(module => ({
        ...module,
        concepts: []
      }))
    }
    const emptyConceptResult = await initializeCurriculumState(emptyConceptsCurriculum, plannerFromPlan(plan), 0)
    expect(emptyConceptResult).toBeNull()
    const throwingPlanner = async () => {
      throw new Error('planner-failure')
    }
    const failureResult = await initializeCurriculumState(curriculum, throwingPlanner, 0)
    expect(failureResult).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  test('initializeCurriculumState rejects empty teaching chunk plans', async () => {
    const { initializeCurriculumState } = await loadCurriculumModule()
    const { curriculum } = await setupIntroIllustrateItem()
    const emptyPlan = createTeachingPlan([[]])
    const errorSpy = jest.spyOn(logger, 'error')
    const result = await initializeCurriculumState(curriculum, plannerFromPlan(emptyPlan), 0)
    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  test('jumpToPhase generates module-wide state', async () => {
    const { jumpToPhase, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Socratic prompt']
    ])
    const state = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(plan))
    expect(state).not.toBeNull()
    expect(state?.currentPhase).toBe('Socratic')
    expect(state?.currentConceptIndex).toBe(1)
    expect(state?.teachingPlanForPhase).toEqual(plan)
    expect(state?.isCompleted).toBe(false)
  })

  test('jumpToPhase enforces prerequisites', async () => {
    const { jumpToPhase, parseModulesTxt } = await loadCurriculumModule()
    const baseCurriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const curriculum: Curriculum = {
      modules: baseCurriculum.modules.map(module => ({
        ...module,
        concepts: []
      }))
    }
    const warnSpy = jest.spyOn(logger, 'warn')
    const result = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(createTeachingPlan([
      ['Placeholder']
    ])))
    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('[PHASE_VALIDATION] Cannot jump to Socratic without concepts')
  })

  test('navigateToConcept blocked outside IntroIllustrate phase', async () => {
    const { navigateToConcept } = await loadCurriculumModule()
    const { curriculum, state } = await setupIntroIllustrateItem()
    state.currentPhase = 'Socratic'
    state.teachingPlanForPhase = createTeachingPlan([
      ['Point']
    ])
    const learnerModel = createLearnerModel()
    const warnSpy = jest.spyOn(logger, 'warn')
    const planner = plannerFromPlan(createTeachingPlan([
      ['Placeholder']
    ]))
    const result = await navigateToConcept(1, curriculum, state, learnerModel, planner)
    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith('[CONCEPT_NAV] Navigation only allowed in IntroIllustrate phase. Current phase:', 'Socratic')
  })

  test('navigateToConcept resets tracking and learner model', async () => {
    const { navigateToConcept } = await loadCurriculumModule()
    const { curriculum, state } = await setupIntroIllustrateItem()
    state.teachingPlanForPhase = createTeachingPlan([
      ['Point A', 'Point B']
    ])
    state.coveredPointsInCurrentChunk.add('Point A')
    ensureRevisitSet(state).add('Point B')
    state.activeConsolidationState = {} as any
    const learnerModel = createLearnerModel()
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 5
    learnerModel.awardedKcForPhasePoints = new Set(['legacy'])
    learnerModel.contentPointsCoverage = {
      'Point A': { coverage: 'ExplicitlyAddressed', understanding_score: 0.5 }
    }
    const newPlan = createTeachingPlan([
      ['New Point']
    ])
    const planner = plannerFromPlan(newPlan)
    const result = await navigateToConcept(1, curriculum, state, learnerModel, planner)
    expect(result).toBe(true)
    expect(state.currentConceptIndex).toBe(1)
    expect(state.teachingPlanForPhase).toEqual(newPlan)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    expect(state.activeConsolidationState).toBeNull()
    expect(learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(0)
    expect(learnerModel.awardedKcForPhasePoints.size).toBe(0)
    expect(learnerModel.contentPointsCoverage?.['New Point']).toBeUndefined()
  })

  test('getInitialCurriculumTopicId returns computed id or fallback', async () => {
    const { getInitialCurriculumTopicId, parseModulesTxt } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const result = getInitialCurriculumTopicId(curriculum)
    expect(result).toBe('Module1-What_is_recursion-Phase_IntroIllustrate')
    expect(getInitialCurriculumTopicId(null)).toBe('General_Introduction_To_Recursion')
  })

  test('getCurrentCurriculumItem reflects state context', async () => {
    const { parseModulesTxt, initializeCurriculumState, jumpToPhase, getCurrentCurriculumItem } = await loadCurriculumModule()
    const warnSpy = jest.spyOn(logger, 'warn')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)

    const introPlan = createTeachingPlan([
      ['Intro Seed']
    ])
    const introState = await initializeCurriculumState(curriculum, plannerFromPlan(introPlan), 0)
    if (!introState) {
      throw new Error('Expected intro state for getCurrentCurriculumItem test')
    }
    const introItem = getCurrentCurriculumItem(curriculum, introState)
    expect(introItem).toBeTruthy()
    expect(introItem?.moduleTitle).toBe('Recursion Foundations')
    expect(introItem?.moduleGoal).toBe('Understand recursion fundamentals')
    expect(introItem?.concept?.title).toBe('What is recursion?')
    expect(introItem?.isModuleWidePhase).toBe(false)
    expect(introItem?.isLastConceptInModule).toBe(false)
    expect(introItem?.isLastPhaseForConcept).toBe(true)
    expect(introItem?.curriculumPathId.endsWith('Phase_IntroIllustrate')).toBe(true)

    const modulePlan = createTeachingPlan([
      ['Module Seed']
    ])
    const moduleState = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(modulePlan))
    if (!moduleState) {
      throw new Error('Expected module-wide state for getCurrentCurriculumItem test')
    }
    const moduleItem = getCurrentCurriculumItem(curriculum, moduleState)
    expect(moduleItem).toBeTruthy()
    expect(moduleItem?.isModuleWidePhase).toBe(true)
    expect(moduleItem?.concept).toBeNull()
    expect(moduleItem?.curriculumPathId.endsWith('Phase_Socratic')).toBe(true)

    const completedState = await initializeCurriculumState(curriculum, plannerFromPlan(introPlan), 0)
    if (!completedState) {
      throw new Error('Expected completed state for getCurrentCurriculumItem test')
    }
    completedState.isCompleted = true
    expect(getCurrentCurriculumItem(curriculum, completedState)).toBeNull()

    warnSpy.mockClear()
    const outOfRangeState = await initializeCurriculumState(curriculum, plannerFromPlan(introPlan), 0)
    if (!outOfRangeState) {
      throw new Error('Expected out-of-range state for getCurrentCurriculumItem test')
    }
    outOfRangeState.currentConceptIndex = curriculum.modules[0]?.concepts.length ?? 0
    const missingItem = getCurrentCurriculumItem(curriculum, outOfRangeState)
    expect(missingItem).toBeNull()
    const warnCalls = warnSpy.mock.calls.filter(([message]) => String(message).includes('Current concept index'))
    expect(warnCalls.length).toBeGreaterThan(0)
  })
})

describe('socratic handling and phase transitions', () => {
  test('advanceCurriculumState processes socratic completion and initializes next phase', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      jumpToPhase,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const socraticPlan = createTeachingPlan([
      ['Socratic prompt']
    ])
    const state = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(socraticPlan))
    if (!state) {
      throw new Error('Expected Socratic state for advanceCurriculumState test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item for Socratic state')
    }
    learnerModel.KCs[currentItem.curriculumPathId] = 0
    state.socraticCompletionPending = { triggered: true, trigger: 'complete', cleanResponse: 'ok' }
    state.socraticTurnCount = 3
    state.socraticBaseInstruction = 'base'

    const nextPlan = createTeachingPlan([
      ['Solidify action']
    ])
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(nextPlan))
    expect(result).toBe(true)
    expect(state.currentPhase).toBe('Solidify')
    expect(state.socraticCompletionPending).toBeNull()
    expect(state.socraticTurnCount).toBe(0)
    expect(state.socraticBaseInstruction).toBeNull()
    expect(state.teachingPlanForPhase).toEqual(nextPlan)
    expect(state.currentTeachingChunkIndex).toBe(0)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    expect(learnerModel.KCs[currentItem.curriculumPathId]).toBeCloseTo(PHASE_MASTERY_THRESHOLD)
    const socraticLogs = infoSpy.mock.calls.filter(([message]) => message === '[SOCRATIC_COMPLETION_VALIDATION]')
    expect(socraticLogs.some(([, payload]) => payload?.event === 'completed')).toBe(true)
    const advanceLogs = infoSpy.mock.calls.filter(([message]) => message === '[ADVANCE_VALIDATION]')
    expect(advanceLogs.some(([, payload]) => payload?.event === 'socratic-phase-transition')).toBe(true)
    const nextItem = getCurrentCurriculumItem(curriculum, state)
    expect(nextItem?.isModuleWidePhase).toBe(true)
    expect(nextItem?.curriculumPathId.endsWith('Phase_Solidify')).toBe(true)
  })

  test('advanceCurriculumState returns false when socratic completion not pending', async () => {
    const { advanceCurriculumState, parseModulesTxt, jumpToPhase } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const state = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(createTeachingPlan([
      ['Prompt']
    ])))
    if (!state) {
      throw new Error('Expected Socratic state for fallback test')
    }
    state.socraticCompletionPending = null
    const learnerModel = createLearnerModel()
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(createTeachingPlan([
      ['Next']
    ])))
    expect(result).toBe(false)
    const socraticLogs = infoSpy.mock.calls.filter(([message]) => message === '[SOCRATIC_COMPLETION_VALIDATION]')
    expect(socraticLogs.length).toBe(0)
    expect(state.currentPhase).toBe('Socratic')
  })

  test('concept mastery advances to next concept', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const firstPlan = createTeachingPlan([
      ['Concept one point']
    ])
    const secondPlan = createTeachingPlan([
      ['Concept two intro']
    ])
    const planQueue = [firstPlan, secondPlan]
    const planner = jest.fn(async () => planQueue.shift() ?? createTeachingPlan([
      ['Fallback']
    ]))
    const state = await initializeCurriculumState(curriculum, planner, 0)
    if (!state) {
      throw new Error('Expected initialized state for concept advancement test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item for concept advancement test')
    }
    const currentChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    currentChunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    const result = await advanceCurriculumState(curriculum, state, learnerModel, planner)
    expect(result).toBe(true)
    expect(state.currentConceptIndex).toBe(1)
    expect(state.currentPhase).toBe('IntroIllustrate')
    expect(state.teachingPlanForPhase).toEqual(secondPlan)
    expect(state.currentTeachingChunkIndex).toBe(0)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    const advanceLogs = infoSpy.mock.calls.filter(([message]) => message === '[ADVANCE_VALIDATION]')
    expect(advanceLogs.some(([, payload]) => payload?.event === 'concept-advanced')).toBe(true)
    const nextItem = getCurrentCurriculumItem(curriculum, state)
    const secondConceptTitle = curriculum.modules[0]?.concepts[1]?.title
    expect(nextItem?.concept?.title).toBe(secondConceptTitle)
  })

  test('last concept mastery promotes to module phase', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      navigateToConcept,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const conceptOnePlan = createTeachingPlan([
      ['Concept one point']
    ])
    const conceptTwoPlan = createTeachingPlan([
      ['Concept two point']
    ])
    const modulePlan = createTeachingPlan([
      ['Socratic action']
    ])
    const planQueue = [conceptOnePlan, conceptTwoPlan, modulePlan]
    const planner = jest.fn(async () => planQueue.shift() ?? createTeachingPlan([
      ['Fallback']
    ]))
    const state = await initializeCurriculumState(curriculum, planner, 0)
    if (!state) {
      throw new Error('Expected initialized state for module phase promotion test')
    }
    const learnerModel = createLearnerModel()
    const navigationSucceeded = await navigateToConcept(1, curriculum, state, learnerModel, planner)
    expect(navigationSucceeded).toBe(true)
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item after navigating to last concept')
    }
    const currentChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    currentChunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    const result = await advanceCurriculumState(curriculum, state, learnerModel, planner)
    expect(result).toBe(true)
    expect(state.currentPhase).toBe('Socratic')
    expect(state.currentConceptIndex).toBe(1)
    expect(state.teachingPlanForPhase).toEqual(modulePlan)
    expect(state.currentTeachingChunkIndex).toBe(0)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    const advanceLogs = infoSpy.mock.calls.filter(([message]) => message === '[ADVANCE_VALIDATION]')
    expect(advanceLogs.some(([, payload]) => payload?.event === 'module-phase-transition')).toBe(true)
    const moduleItem = getCurrentCurriculumItem(curriculum, state)
    expect(moduleItem?.isModuleWidePhase).toBe(true)
    expect(moduleItem?.concept).toBeNull()
    expect(moduleItem?.curriculumPathId.endsWith('Phase_Socratic')).toBe(true)
  })

  test('socratic mastery clears counters and moves to Solidify', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      jumpToPhase,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const socraticPlan = createTeachingPlan([
      ['Socratic prompt']
    ])
    const state = await jumpToPhase(curriculum, 0, 'Socratic', plannerFromPlan(socraticPlan))
    if (!state) {
      throw new Error('Expected Socratic state for mastery transition test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item in Socratic phase')
    }
    const socraticChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    socraticChunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    state.socraticTurnCount = 4
    state.socraticBaseInstruction = 'base'

    const solidifyPlan = createTeachingPlan([
      ['Solidify action']
    ])
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(solidifyPlan))
    expect(result).toBe(true)
    expect(state.currentPhase).toBe('Solidify')
    expect(state.socraticTurnCount).toBe(0)
    expect(state.socraticBaseInstruction).toBeNull()
    expect(state.teachingPlanForPhase).toEqual(solidifyPlan)
    expect(state.currentTeachingChunkIndex).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    expect(learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(0)
    const socraticTransitionLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'socratic-phase-transition')
    expect(socraticTransitionLog).toBeDefined()
    const phaseInitLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'phase-state-initialized' && call[1]?.phase === 'Solidify')
    expect(phaseInitLog).toBeDefined()
  })

  test('final module completion marks curriculum completed', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      jumpToPhase,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const solidifyPlan = createTeachingPlan([
      ['Solidify point']
    ])
    const state = await jumpToPhase(curriculum, 0, 'Solidify', plannerFromPlan(solidifyPlan))
    if (!state) {
      throw new Error('Expected Solidify state for completion test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item in Solidify phase')
    }
    const solidifyChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    solidifyChunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD

    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(createTeachingPlan([
      ['Unused follow-up']
    ])))
    expect(result).toBe(true)
    expect(state.isCompleted).toBe(true)
    const completionLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'curriculum-completed')
    expect(completionLog).toBeDefined()
  })

  test('initializeNewPhaseState stores new teaching plan and resets tracking', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const firstPlan = createTeachingPlan([
      ['Concept one point']
    ])
    const secondPlan = createTeachingPlan([
      ['Concept two point']
    ])
    const plannerQueue = [firstPlan, secondPlan]
    const planner = jest.fn(async () => plannerQueue.shift() ?? createTeachingPlan([
      ['Fallback']
    ]))
    const state = await initializeCurriculumState(curriculum, planner, 0)
    if (!state) {
      throw new Error('Expected initialized state for phase initialization test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item for phase initialization test')
    }
    const introChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    introChunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    const result = await advanceCurriculumState(curriculum, state, learnerModel, planner)
    expect(result).toBe(true)
    expect(state.teachingPlanForPhase).toEqual(secondPlan)
    expect(state.currentTeachingChunkIndex).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    const nextItem = getCurrentCurriculumItem(curriculum, state)
    if (!nextItem) {
      throw new Error('Expected next item after phase initialization')
    }
    expect(nextItem.concept?.title).toBe('Why base cases matter')
    expect(learnerModel.KCs[nextItem.curriculumPathId]).toBe(0)
    const phaseInitLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'phase-state-initialized' && call[1]?.phase === 'IntroIllustrate')
    expect(phaseInitLog).toBeDefined()
  })

  test('initializeNewPhaseState failure propagates false result', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Point']
    ])
    const plannerQueue = [introPlan]
    const initPlanner = jest.fn(async () => plannerQueue.shift() ?? introPlan)
    const state = await initializeCurriculumState(curriculum, initPlanner, 0)
    if (!state) {
      throw new Error('Expected initialized state for failure path test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item before triggering failure')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    const throwingPlanner = jest.fn(async () => {
      throw new Error('planner-failure')
    })
    const result = await advanceCurriculumState(curriculum, state, learnerModel, throwingPlanner)
    expect(result).toBe(false)
    const failureLog = errorSpy.mock.calls.find(call => call[0] === '[PHASE_INIT_FAILURE]')
    expect(failureLog).toBeDefined()
  })

  test('initializeNewPhaseState forces completion when item missing', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Point']
    ])
    const plannerQueue = [introPlan]
    const initPlanner = jest.fn(async () => plannerQueue.shift() ?? introPlan)
    const state = await initializeCurriculumState(curriculum, initPlanner, 0)
    if (!state) {
      throw new Error('Expected initialized state for missing item test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item before corrupting state')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    state.currentModuleIndex = curriculum.modules.length
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(createTeachingPlan([
      ['Next']
    ])))
    expect(result).toBe(false)
    expect(state.isCompleted).toBe(true)
    const nullItemLog = errorSpy.mock.calls.find(call => call[0] === '[CURRICULUM_STATE] Module missing for current index.' || String(call[0]).includes('Cannot advance curriculum'))
    expect(nullItemLog).toBeDefined()
  })

  test('cleanupCompletedPhase clears consolidation and resets counters', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Concept point']
    ])
    const plannerQueue = [introPlan]
    const initPlanner = jest.fn(async () => plannerQueue.shift() ?? introPlan)
    const state = await initializeCurriculumState(curriculum, initPlanner, 0)
    if (!state) {
      throw new Error('Expected initialized state for cleanup test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item before cleanup test')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = PHASE_MASTERY_THRESHOLD
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 3
    state.activeConsolidationState = consolidationManager.initiateConsolidation(learnerModel, state.teachingPlanForPhase)
    const result = await advanceCurriculumState(curriculum, state, learnerModel, initPlanner)
    expect(result).toBe(true)
    expect(state.activeConsolidationState).toBeNull()
    expect(learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(0)
    const consolidationLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'consolidation-terminated' && call[1]?.reason === 'phase-mastery')
    expect(consolidationLog).toBeDefined()
  })

  test('phase completion starts consolidation when mastery unmet', async () => {
    const {
      advanceCurriculumState,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Point']
    ])
    const plannerQueue = [introPlan]
    const planner = jest.fn(async () => plannerQueue.shift() ?? introPlan)
    const state = await initializeCurriculumState(curriculum, planner, 0)
    if (!state) {
      throw new Error('Expected initialized state for consolidation start test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current curriculum item before consolidation start')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.KCs[currentItem.curriculumPathId] = 0.2
    const result = await advanceCurriculumState(curriculum, state, learnerModel, planner)
    expect(result).toBe(false)
    expect(state.activeConsolidationState).not.toBeNull()
    const consolidationLog = infoSpy.mock.calls.find(call => call[0] === '[CONSOLIDATION_VALIDATION]' && call[1]?.event === 'session-started')
    expect(consolidationLog).toBeDefined()
  })

  test('phase completion exits consolidation when mastery achieved during loop', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Point']
    ])
    const modulePlan = createTeachingPlan([
      ['Module action']
    ])
    const plannerQueue = [introPlan, modulePlan]
    const planner = jest.fn(async () => plannerQueue.shift() ?? createTeachingPlan([
      ['Fallback']
    ]))
    const state = await initializeCurriculumState(curriculum, planner, 0)
    if (!state) {
      throw new Error('Expected initialized state for consolidation exit test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current curriculum item before consolidation exit')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const pathId = currentItem.curriculumPathId
    learnerModel.KCs[pathId] = 0.2
    state.activeConsolidationState = consolidationManager.initiateConsolidation(learnerModel, state.teachingPlanForPhase)
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 1
    learnerModel.LastUserInput = 'answer'
    learnerModel.KCs[pathId] = PHASE_MASTERY_THRESHOLD
    const result = await advanceCurriculumState(curriculum, state, learnerModel, planner)
    expect(result).toBe(true)
    expect(state.activeConsolidationState).toBeNull()
    expect(state.currentPhase).toBe('IntroIllustrate')
    expect(state.currentConceptIndex).toBeGreaterThanOrEqual(0)
    // console.log(infoSpy.mock.calls)
    const consolidationEvents = infoSpy.mock.calls
      .filter(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'consolidation-terminated')
      .map(call => call[1])
    expect(consolidationEvents.length).toBeGreaterThan(0)
    const phaseInitLog = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'phase-state-initialized' && call[1]?.phase === 'IntroIllustrate')
    expect(phaseInitLog).toBeDefined()
  })

  test('consolidation exit surfaces phase initialization failure', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const introPlan = createTeachingPlan([
      ['Point']
    ])
    const plannerQueue = [introPlan]
    const initPlanner = jest.fn(async () => plannerQueue.shift() ?? introPlan)
    const state = await initializeCurriculumState(curriculum, initPlanner, 0)
    if (!state) {
      throw new Error('Expected initialized state for consolidation failure test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current curriculum item before consolidation failure test')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const pathId = currentItem.curriculumPathId
    learnerModel.KCs[pathId] = 0.2
    state.activeConsolidationState = consolidationManager.initiateConsolidation(learnerModel, state.teachingPlanForPhase)
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 1
    learnerModel.LastUserInput = 'answer'
    learnerModel.KCs[pathId] = PHASE_MASTERY_THRESHOLD
    const throwingPlanner = jest.fn(async () => {
      throw new Error('planner-failure')
    })
    const result = await advanceCurriculumState(curriculum, state, learnerModel, throwingPlanner)
    expect(result).toBe(false)
    expect(state.activeConsolidationState).not.toBeNull()
    expect(state.currentPhase).toBe('IntroIllustrate')
    expect(state.currentConceptIndex).toBe(0)
    const chunkAfterFailure = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    expect(chunkAfterFailure.map(point => point.text)).toEqual(chunk.map(point => point.text))
    const failureLog = errorSpy.mock.calls.find(call => call[0] === '[PHASE_INIT_FAILURE]')
    expect(failureLog).toBeDefined()
  })

  test('concept mastery rollback when new phase initialization fails', async () => {
    const {
      advanceCurriculumState,
      PHASE_MASTERY_THRESHOLD,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const errorSpy = jest.spyOn(logger, 'error')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const firstPlan = createTeachingPlan([
      ['Point']
    ])
    const plannerQueue = [firstPlan]
    const initPlanner = jest.fn(async () => plannerQueue.shift() ?? firstPlan)
    const state = await initializeCurriculumState(curriculum, initPlanner, 0)
    if (!state) {
      throw new Error('Expected initialized state for mastery rollback test')
    }
    const learnerModel = createLearnerModel()
    const currentItem = getCurrentCurriculumItem(curriculum, state)
    if (!currentItem) {
      throw new Error('Expected current item for mastery rollback test')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const pathId = currentItem.curriculumPathId
    learnerModel.KCs[pathId] = PHASE_MASTERY_THRESHOLD
    const throwingPlanner = jest.fn(async () => {
      throw new Error('planner-failure')
    })
    const result = await advanceCurriculumState(curriculum, state, learnerModel, throwingPlanner)
    expect(result).toBe(false)
    const rolledBackItem = getCurrentCurriculumItem(curriculum, state)
    expect(rolledBackItem?.curriculumPathId).toBe(currentItem.curriculumPathId)
    expect(state.currentPhase).toBe(currentItem.curriculumPathId.split('Phase_')[1])
    const chunkAfterFailure = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    expect(chunkAfterFailure.map(point => point.text)).toEqual(chunk.map(point => point.text))
    expect(state.activeConsolidationState).toBeNull()
    const failureLog = errorSpy.mock.calls.find(call => call[0] === '[PHASE_INIT_FAILURE]')
    expect(failureLog).toBeDefined()
  })
})

describe('chunk progression and focus mechanics', () => {
  test('advanceCurriculumState advances chunk and resets tracking', async () => {
    const {
      advanceCurriculumState,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A', 'Point B'],
      ['Next Chunk']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for chunk advancement test')
    }
    const learnerModel = createLearnerModel()
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic = 2
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(plan))
    expect(result).toBe(true)
    expect(state.currentTeachingChunkIndex).toBe(1)
    expect(state.coveredPointsInCurrentChunk.size).toBe(0)
    expect(ensureRevisitSet(state).size).toBe(0)
    expect(learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(0)
    const logCall = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'chunk-advanced')
    expect(logCall).toBeDefined()
  })

  test('advanceCurriculumState gates chunk and increments counter', async () => {
    const {
      advanceCurriculumState,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A', 'Point B']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for chunk gating test')
    }
    const learnerModel = createLearnerModel()
    state.coveredPointsInCurrentChunk.add('Point A')
    const result = await advanceCurriculumState(curriculum, state, learnerModel, plannerFromPlan(plan))
    expect(result).toBe(false)
    expect(learnerModel.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(1)
    const logCall = infoSpy.mock.calls.find(call => call[0] === '[ADVANCE_VALIDATION]' && call[1]?.event === 'chunk-gated')
    expect(logCall).toBeDefined()
  })

  test('advanceCurriculumState short-circuits when curriculum completed', async () => {
    const {
      advanceCurriculumState,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Seed point']
    ])
    const initializedState = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!initializedState) {
      throw new Error('Expected initialized state for completed curriculum test')
    }
    initializedState.isCompleted = true
    const learnerModel = createLearnerModel()
    const planner = jest.fn()
    const result = await advanceCurriculumState(curriculum, initializedState, learnerModel, planner)
    expect(result).toBe(false)
    expect(planner).not.toHaveBeenCalled()
  })

  test('getCurriculumFocusInstruction returns early-return strings', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()

    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)

    const completedPlan = createTeachingPlan([
      ['Completed seed']
    ])
    const completedState = await initializeCurriculumState(curriculum, plannerFromPlan(completedPlan), 0)
    if (!completedState) {
      throw new Error('Expected completed curriculum state')
    }
    const completedItem = getCurrentCurriculumItem(curriculum, completedState)
    if (!completedItem) {
      throw new Error('Expected curriculum item for completed scenario')
    }
    completedState.isCompleted = true
    const completedInstruction = getCurriculumFocusInstruction(curriculum, completedItem, completedState, false)
    expect(completedInstruction).toBe(CURRICULUM_COMPLETED_FOCUS_INSTRUCTION)

    const generalState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['General seed']
    ])), 0)
    if (!generalState) {
      throw new Error('Expected initialized state for general interaction fallback')
    }
    const generalInstruction = getCurriculumFocusInstruction(curriculum, null as unknown as CurriculumItem, generalState, false)
    expect(generalInstruction).toBe(GENERAL_INTERACTION_FOCUS_INSTRUCTION)

    const consolidationState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Focus weak point']
    ])), 0)
    if (!consolidationState) {
      throw new Error('Expected initialized state for consolidation scenario')
    }
    const consolidationItem = getCurrentCurriculumItem(curriculum, consolidationState)
    if (!consolidationItem) {
      throw new Error('Expected curriculum item for consolidation scenario')
    }
    const learnerModel = createLearnerModel()
    consolidationState.activeConsolidationState = consolidationManager.initiateConsolidation(learnerModel, consolidationState.teachingPlanForPhase)
    const consolidationInstruction = getCurriculumFocusInstruction(curriculum, consolidationItem, consolidationState, false)
    const expectedConsolidation = consolidationManager.getConsolidationFocusInstruction(consolidationItem, consolidationState.activeConsolidationState as ConsolidationState)
    expect(consolidationInstruction).toBe(expectedConsolidation)
  })

  test('pre-calculated focus points take precedence', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Point A']
    ])), 0)
    if (!state) {
      throw new Error('Expected initialized state for pre-calculated focus test')
    }
    const item = getCurrentCurriculumItem(curriculum, state)
    if (!item) {
      throw new Error('Expected curriculum item for pre-calculated focus test')
    }
    const instruction = getCurriculumFocusInstruction(curriculum, item, state, false, {
      focusPoints: ['Custom Point'],
      primaryActionType: 'Teach New Content (from current chunk)'
    })
    expect(instruction).toContain('Custom Point')
  })

  test('focus calculation derives new content branch when no precalc provided', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Point A']
    ])), 0)
    if (!state) {
      throw new Error('Expected initialized state for new content focus test')
    }
    const item = getCurrentCurriculumItem(curriculum, state)
    if (!item) {
      throw new Error('Expected curriculum item for new content focus test')
    }
    const instruction = getCurriculumFocusInstruction(curriculum, item, state, false)
    expect(instruction).toContain(TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(['Point A']))
  })

  test('primary action mapping covers revisit, reinforce, and engagement paths', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)

    const revisitState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Point A']
    ])), 0)
    if (!revisitState) {
      throw new Error('Expected state for chunk revisit mapping test')
    }
    const revisitItem = getCurrentCurriculumItem(curriculum, revisitState)
    if (!revisitItem) {
      throw new Error('Expected curriculum item for chunk revisit mapping test')
    }
    ensureRevisitSet(revisitState).add('Point A')
    const revisitInstruction = getCurriculumFocusInstruction(curriculum, revisitItem, revisitState, false)
    expect(revisitInstruction).toContain(REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(['Point A']))

    const generalRevisitState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Point A']
    ])), 0)
    if (!generalRevisitState) {
      throw new Error('Expected state for general revisit mapping test')
    }
    const generalRevisitItem = getCurrentCurriculumItem(curriculum, generalRevisitState)
    if (!generalRevisitItem) {
      throw new Error('Expected curriculum item for general revisit mapping test')
    }
    ensureRevisitSet(generalRevisitState).add('Point B')
    const generalRevisitInstruction = getCurriculumFocusInstruction(curriculum, generalRevisitItem, generalRevisitState, false)
    expect(generalRevisitInstruction).toContain(REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(['Point B']))

    const reinforceState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Point A']
    ])), 0)
    if (!reinforceState) {
      throw new Error('Expected state for reinforce mapping test')
    }
    const reinforceItem = getCurrentCurriculumItem(curriculum, reinforceState)
    if (!reinforceItem) {
      throw new Error('Expected curriculum item for reinforce mapping test')
    }
    const reinforceChunk = reinforceState.teachingPlanForPhase[reinforceState.currentTeachingChunkIndex] ?? []
    reinforceChunk.forEach(point => reinforceState.coveredPointsInCurrentChunk.add(point.text))
    const reinforceInstruction = getCurriculumFocusInstruction(curriculum, reinforceItem, reinforceState, false)
    expect(reinforceInstruction).toContain(REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(reinforceItem, reinforceChunk.map(point => point.text)))

    const engagementState = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Scaffold point']
    ])), 0)
    if (!engagementState) {
      throw new Error('Expected state for engagement mapping test')
    }
    const engagementItem = getCurrentCurriculumItem(curriculum, engagementState)
    if (!engagementItem) {
      throw new Error('Expected curriculum item for engagement mapping test')
    }
    engagementState.teachingPlanForPhase = [[]]
    engagementState.currentTeachingChunkIndex = 0
    const engagementInstruction = getCurriculumFocusInstruction(curriculum, engagementItem, engagementState, false)
    expect(engagementInstruction).toContain(GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(engagementItem, engagementState))
  })

  test('contextual instruction assembly includes curriculum details and optional check', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Focus point', 'Secondary point']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for contextual instruction test')
    }
    const item = getCurrentCurriculumItem(curriculum, state)
    if (!item || !item.concept) {
      throw new Error('Expected concept-backed curriculum item for contextual instruction test')
    }
    const instruction = getCurriculumFocusInstruction(curriculum, item, state, false, {
      focusPoints: plan[0]?.map(point => point.text) ?? [],
      primaryActionType: 'Teach New Content (from current chunk)'
    })
    expect(instruction).toContain(`Current Module: ${item.moduleTitle}`)
    expect(instruction).toContain('## ⭐ PRIMARY ACTION FOR THIS TURN')
    expect(instruction).toContain('## 🧠 Let\'s Check Your Understanding')
    expect(instruction).toContain(item.concept.title)
  })

  test('isMustObeyTurn suppresses understanding check block', async () => {
    const {
      getCurriculumFocusInstruction,
      parseModulesTxt,
      initializeCurriculumState,
      getCurrentCurriculumItem
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for must-obey test')
    }
    const item = getCurrentCurriculumItem(curriculum, state)
    if (!item) {
      throw new Error('Expected curriculum item for must-obey test')
    }
    const instruction = getCurriculumFocusInstruction(curriculum, item, state, true, {
      focusPoints: plan[0]?.map(point => point.text) ?? [],
      primaryActionType: 'Teach New Content (from current chunk)'
    })
    expect(instruction).not.toContain('## 🧠 Let\'s Check Your Understanding')
  })

  test('calculateFocusPoints handles consolidation branch', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for consolidation focus test')
    }
    state.activeConsolidationState = consolidationManager.initiateConsolidation(createLearnerModel(), state.teachingPlanForPhase)
    const result = calculateFocusPoints(state)
    expect(result.primaryActionType).toBe('Consolidation')
    expect(result.focusPoints).toEqual([])
  })

  test('calculateFocusPoints prioritizes revisit within chunk', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A', 'Point B']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for revisit focus test')
    }
    ensureRevisitSet(state).add('Point B')
    const result = calculateFocusPoints(state)
    expect(result.focusPoints).toEqual(['Point B'])
    expect(result.primaryActionType).toBe('Revisit & Clarify (from current chunk)')
  })

  test('calculateFocusPoints falls back to general revisit when needed', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for general revisit focus test')
    }
    ensureRevisitSet(state).add('External Point')
    const result = calculateFocusPoints(state)
    expect(result.focusPoints).toEqual(['External Point'])
    expect(result.primaryActionType).toBe('Revisit & Clarify (general points for this phase)')
  })

  test('calculateFocusPoints introduces new content when points uncovered', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A', 'Point B']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for new content focus test (calculate)')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.slice(0, 1).forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const result = calculateFocusPoints(state)
    expect(result.focusPoints).toEqual(chunk.slice(1).map(point => point.text))
    expect(result.primaryActionType).toBe('Teach New Content (from current chunk)')
  })

  test('calculateFocusPoints reinforces when chunk fully covered', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for reinforce focus test')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const result = calculateFocusPoints(state)
    expect(result.focusPoints).toEqual(chunk.map(point => point.text))
    expect(result.primaryActionType).toBe('Reinforce & Deepen (current chunk)')
  })

  test('calculateFocusPoints defaults to general engagement for empty chunks', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(createTeachingPlan([
      ['Scaffold point']
    ])), 0)
    if (!state) {
      throw new Error('Expected initialized state for general engagement focus test')
    }
    state.teachingPlanForPhase = [[]]
    state.currentTeachingChunkIndex = 0
    const result = calculateFocusPoints(state)
    expect(result.focusPoints).toEqual([])
    expect(result.primaryActionType).toBe('General Engagement')
  })

  test('calculateFocusPoints chooses reinforcement action when current chunk fully covered and revisit empty', async () => {
    const {
      calculateFocusPoints,
      parseModulesTxt,
      initializeCurriculumState
    } = await loadCurriculumModule()
    const curriculum = parseModulesTxt(SAMPLE_CURRICULUM_TEXT)
    const plan = createTeachingPlan([
      ['Point A', 'Point B']
    ])
    const state = await initializeCurriculumState(curriculum, plannerFromPlan(plan), 0)
    if (!state) {
      throw new Error('Expected initialized state for reinforcement focus test')
    }
    const chunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex] ?? []
    chunk.forEach(point => state.coveredPointsInCurrentChunk.add(point.text))
    const result = calculateFocusPoints(state)
    expect(result.primaryActionType).toBe('Reinforce & Deepen (current chunk)')
    expect(result.focusPoints).toEqual(chunk.map(point => point.text))
  })
})

describe('socratic completion parsing', () => {
  test('detects completion trigger and trims response', async () => {
    const { checkForSocraticCompletion } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const response = '[SOCRATIC_COMPLETION_TRIGGERED: mastery] Great job!'
    const result = checkForSocraticCompletion(response)
    expect(result.triggered).toBe(true)
    expect(result.trigger).toBe('mastery')
    expect(result.cleanResponse).toBe('Great job!')
    const logCall = infoSpy.mock.calls.find(call => call[0] === '[SOCRATIC_COMPLETION_VALIDATION]' && call[1]?.trigger === 'mastery')
    expect(logCall).toBeDefined()
    expect(logCall?.[1]?.event).toBe('completion-flag-check')
  })

  test('returns false when trigger absent', async () => {
    const { checkForSocraticCompletion } = await loadCurriculumModule()
    const infoSpy = jest.spyOn(logger, 'info')
    const result = checkForSocraticCompletion('Keep exploring recursion!')
    expect(result.triggered).toBe(false)
    expect(result.cleanResponse).toBe('Keep exploring recursion!')
    const logCall = infoSpy.mock.calls.find(call => call[0] === '[SOCRATIC_COMPLETION_VALIDATION]' && call[1]?.trigger === null)
    expect(logCall).toBeDefined()
    expect(logCall?.[1]?.event).toBe('completion-flag-check')
  })
})

import { generateTeachingPlanForPhase, TeachingPlanGenerationError, type Curriculum, type CurriculumItem, type Phase, type TeachingPoint } from '../curriculum'

const buildCurriculum = (): { curriculum: Curriculum; item: CurriculumItem } => {
  const concept = {
    title: 'Concept 1',
    text: 'Recursion relies on base cases and inductive steps.'
  }

  const moduleDef = {
    id: 'Module1',
    title: 'Adaptive Module',
    goal: 'Guide learners through recursion basics',
    concepts: [concept],
    methodology: [] as { title: string; text: string }[],
    socratic: 'Prompt learners to reason about recursive depth.',
    solidify: 'Summarize recursion and provide practice.'
  }

  const curriculum: Curriculum = {
    modules: [moduleDef]
  }

  const item: CurriculumItem = {
    moduleTitle: moduleDef.title,
    moduleGoal: moduleDef.goal,
    concept,
    curriculumPathId: moduleDef.id,
    isLastConceptInModule: false,
    isLastPhaseForConcept: false,
    isModuleWidePhase: false
  }

  return { curriculum, item }
}

describe('curriculum generateTeachingPlanForPhase', () => {
  const phase: Phase = 'IntroIllustrate'

  test('produces teaching plan structure from planner output', async () => {
    const { curriculum, item } = buildCurriculum()
    const planner = async () => [[{ text: 'Introduce recursion', kcValue: 1 } satisfies TeachingPoint]]
    const plan = await generateTeachingPlanForPhase(curriculum, item, phase, planner)
    expect(Array.isArray(plan)).toBe(true)
    expect(plan[0]?.[0]?.text).toContain('recursion')
  })

  test('surfaces planner failures as TeachingPlanGenerationError', async () => {
    const { curriculum, item } = buildCurriculum()
    const planner = async () => {
      throw new Error('planner-failed')
    }
    await expect(generateTeachingPlanForPhase(curriculum, item, phase, planner)).rejects.toThrow(TeachingPlanGenerationError)
  })

  test.todo('validate TeachingPlanValidationError once full fixtures are available')
})

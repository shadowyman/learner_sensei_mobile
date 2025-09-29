import {
  MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION,
  GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT,
  buildSenseiEnhancementPrompt
} from '../prompts'

describe('prompts scaffolds', () => {
  test('main sensei response template', () => {
    const output = MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      'Keep the learner focused on base cases.',
      'Encourage concrete analogies for recursion.',
      true
    )
    expect(output).toContain('[RecursiveSensei CRITICAL OVERRIDE')
    expect(output).toContain('High-Priority Directive: Encourage concrete analogies for recursion.')
    expect(output).toContain('Keep the learner focused on base cases.')
  })

  test('socratic teaching plan prompt', () => {
    const output = GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
      'Socratic content about recursion',
      'Recursion Essentials',
      'Demystify recursion',
      'Concept 1, Concept 2'
    )
    expect(output).toContain('You are a world-class Socratic Teaching Plan Architect')
    expect(output).toContain('Title: Recursion Essentials')
    expect(output).toContain('detected_category')
  })

  test('sensei enhancement prompt', () => {
    const output = buildSenseiEnhancementPrompt('# Topic\nContent.')
    expect(output).toContain('MINIMUM 15 KEY,VALUE ENHANCEMENTS REQUIRED')
    expect(output).toContain('Output strict JSON shaped exactly as')
    expect(output).toContain('# Topic')
  })

  test.todo('add prompt fixtures for additional template variants')
})

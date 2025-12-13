import { generateWrapUpAssessment, type WrapUpAssessmentPromptContext } from '@sensei/core/wrapUpAssessment'

describe('Core wrap-up assessment tool', () => {
  it('normalizes and orders a valid 15-question payload with five snippets', async () => {
    const snippetQuestions = Array.from({ length: 5 }, (_, index) => ({
      id: `snippet-${index + 1}`,
      type: 'snippet' as const,
      prompt: `Snippet prompt ${index + 1}`,
      code: 'int main() { return 0; }',
      choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correct_choice: 'Choice A',
      explanation: 'Explanation text.',
      interviewer_insight: 'Insight text.'
    }))
    const conceptQuestions = Array.from({ length: 10 }, (_, index) => ({
      id: `concept-${index + 1}`,
      type: 'concept' as const,
      prompt: `Concept prompt ${index + 1}`,
      choices: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_choice: 'Option B',
      explanation: 'Explanation text.',
      interviewer_insight: 'Insight text.'
    }))

    const llm = {
      callText: jest.fn(),
      callJson: jest.fn(),
      callWithTools: jest.fn().mockResolvedValue({
        toolCalls: [{
          name: 'submit_wrap_up_assessment',
          args: { questions: [...snippetQuestions, ...conceptQuestions] }
        }],
        text: ''
      })
    } as any

    const context: WrapUpAssessmentPromptContext = {
      moduleTitle: 'Sample Module',
      moduleGoal: 'Goal',
      solidifyContent: '',
      conceptSummaries: ['Concept 1', 'Concept 2']
    }

    const result = await generateWrapUpAssessment(llm, 'module-1', context)
    expect(result).not.toBeNull()
    const questions = result!.questions
    expect(questions).toHaveLength(15)
    expect(questions.filter(q => q.type === 'snippet')).toHaveLength(5)
    const conceptCount = questions.filter(q => q.type === 'concept').length
    expect(questions.slice(0, conceptCount).every(q => q.type === 'concept')).toBe(true)
    expect(questions.slice(conceptCount).every(q => q.type === 'snippet')).toBe(true)
  })

  it('returns null when payload is malformed', async () => {
    const llm = {
      callText: jest.fn(),
      callJson: jest.fn(),
      callWithTools: jest.fn().mockResolvedValue({ text: 'plain-text-response' })
    } as any
    const context: WrapUpAssessmentPromptContext = {
      moduleTitle: 'Sample Module',
      moduleGoal: 'Goal',
      solidifyContent: '',
      conceptSummaries: ['Concept 1']
    }
    const result = await generateWrapUpAssessment(llm, 'module-1', context)
    expect(result).toBeNull()
  })
})

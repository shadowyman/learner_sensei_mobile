import { parseGeminiJsonResponse, llmExtractAndPlanTeachingOrder } from '../geminiService'

describe('geminiService parseGeminiJsonResponse', () => {
  test('parses fenced JSON payload', () => {
    const json = '```json\n{"value":"ok"}\n```'
    const parsed = parseGeminiJsonResponse(json)
    expect(parsed).toEqual({ value: 'ok' })
  })

  test('returns null on invalid payload', () => {
    const parsed = parseGeminiJsonResponse('not-json')
    expect(parsed).toBeNull()
  })
})

describe('geminiService llmExtractAndPlanTeachingOrder', () => {
  test('returns teaching plan for Socratic phase', async () => {
    const generateContent = jest.fn(async () => ({
      text: '{"detected_category":"reasoning","teaching_plan":[[{"text":"Challenge learners","kcValue":1}]]}'
    }))
    const ai = { models: { generateContent } } as any
    const text = 'Module Title: Mission Sensei\nModule Goal:\nHelp learners build intuition\n\nAll Module Concepts:\nConcept 1: Recursive thinking\nSocratic Instructions'
    const result = await llmExtractAndPlanTeachingOrder(ai, text, 'Socratic')
    expect(result?.[0]?.[0]?.text).toContain('Challenge')
  })

  test('returns teaching plan for non Socratic phase', async () => {
    const generateContent = jest.fn(async () => ({
      text: '{"teaching_plan":[[{"text":"Explain recursion","kcValue":1}]]}'
    }))
    const ai = { models: { generateContent } } as any
    const text = 'Learner submitted summary about recursion.'
    const result = await llmExtractAndPlanTeachingOrder(ai, text, 'IntroIllustrate')
    expect(result?.[0]?.[0]?.text).toContain('recursion')
  })
})

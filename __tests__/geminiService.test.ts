import { parseGeminiJsonResponse, llmExtractAndPlanTeachingOrder } from '../geminiService'

jest.mock('@google/genai')

type GenAIMockControls = {
  GoogleGenAI: new (config: unknown) => any
  __setMockGenerativeContent: (override: unknown) => void
  __resetMockGenerativeContent: () => void
}

const {
  GoogleGenAI,
  __setMockGenerativeContent,
  __resetMockGenerativeContent
} = jest.requireMock('@google/genai') as GenAIMockControls

afterEach(() => {
  __resetMockGenerativeContent()
})

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
    __setMockGenerativeContent({
      result: '{"detected_category":"reasoning","teaching_plan":[[{"text":"Challenge learners","kcValue":1}]]}'
    })
    const ai = new GoogleGenAI({})
    const text = 'Module Title: Mission Sensei\nModule Goal:\nHelp learners build intuition\n\nAll Module Concepts:\nConcept 1: Recursive thinking\nSocratic Instructions'
    const result = await llmExtractAndPlanTeachingOrder(ai, text, 'Socratic')
    expect(result?.[0]?.[0]?.text).toContain('Challenge')
  })

  test('returns teaching plan for non Socratic phase', async () => {
    __setMockGenerativeContent({
      result: '{"teaching_plan":[[{"text":"Explain recursion","kcValue":1}]]}'
    })
    const ai = new GoogleGenAI({})
    const text = 'Learner submitted summary about recursion.'
    const result = await llmExtractAndPlanTeachingOrder(ai, text, 'IntroIllustrate')
    expect(result?.[0]?.[0]?.text).toContain('recursion')
  })
})

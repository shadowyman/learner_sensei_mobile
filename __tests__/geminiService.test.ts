import { parseGeminiJsonResponse, llmExtractAndPlanTeachingOrder, requestSenseiEnhancement } from '../geminiService'

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

describe('geminiService requestSenseiEnhancement desktop compatibility', () => {
  test('returns null without a provider client', async () => {
    await expect(requestSenseiEnhancement(null, {
      originalMarkdown: 'Teach recursion through base cases.',
      wordCount: 6
    })).resolves.toBeNull()
  })

  test('uses the Core browser enhancement config and parses fenced JSON', async () => {
    const generateContent = jest.fn(async () => ({
      text: () => '```json\n{"enhancements":[{"key":"Base cases stop recursion.","value":"They define when the function can return without calling itself again.","insertType":"append","ordering":1}],"metadata":{"source":"desktop"}}\n```'
    }))
    const ai = { models: { generateContent } } as any

    const result = await requestSenseiEnhancement(ai, {
      originalMarkdown: 'Base cases stop recursion.',
      wordCount: 4
    })

    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-flash-latest',
      config: expect.objectContaining({
        responseMimeType: 'application/json',
        temperature: 0.4
      })
    }))
    const request = generateContent.mock.calls[0][0]
    expect(request.contents[0].parts[0].text).toContain('Base cases stop recursion.')
    expect(result).toEqual({
      enhancements: [{
        key: 'Base cases stop recursion.',
        value: 'They define when the function can return without calling itself again.',
        insertType: 'append',
        ordering: 1
      }],
      metadata: { source: 'desktop' }
    })
  })

  test('returns null for malformed provider text', async () => {
    const generateContent = jest.fn(async () => ({
      text: () => 'not-json'
    }))
    const ai = { models: { generateContent } } as any

    await expect(requestSenseiEnhancement(ai, {
      originalMarkdown: 'Recursion needs a smaller subproblem.',
      wordCount: 5
    })).resolves.toBeNull()
  })

  test('returns null when provider generation fails', async () => {
    const generateContent = jest.fn(async () => {
      throw new Error('provider failed')
    })
    const ai = { models: { generateContent } } as any

    await expect(requestSenseiEnhancement(ai, {
      originalMarkdown: 'Recursive calls move toward the base case.',
      wordCount: 7
    })).resolves.toBeNull()
  })
})

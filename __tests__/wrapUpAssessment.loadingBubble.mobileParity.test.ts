jest.mock('../src/ui', () => ({
  sanitizeMarkdownFences: (text: string) => text,
  parseSanitizedMarkdown: (text: string) => text,
  addLanguageDisplayToCodeBlocks: () => {},
  addCopyButtonsToCodeBlocks: () => {}
}))

import { presentWrapUpAssessmentOverlay } from '../src/wrapUpAssessment'

const buildPhaseLoadingBubble = () => {
  const bubble = document.createElement('div')
  bubble.classList.add('message-bubble')
  const container = document.createElement('div')
  container.classList.add('phase-loading-container')
  bubble.appendChild(container)
  ;(bubble as any).dotAnimation = 1
  ;(bubble as any).messageAnimation = 2
  document.body.appendChild(bubble)
  return bubble
}

const buildValidQuestions = () => {
  const conceptQuestions = Array.from({ length: 10 }, (_, idx) => ({
    id: `concept-${idx + 1}`,
    type: 'concept' as const,
    prompt: `Concept prompt ${idx + 1}`,
    choices: ['A', 'B', 'C', 'D'],
    correct_choice: 'A',
    explanation: 'Explanation.',
    interviewer_insight: 'Insight.'
  }))

  const snippetQuestions = Array.from({ length: 5 }, (_, idx) => ({
    id: `snippet-${idx + 1}`,
    type: 'snippet' as const,
    prompt: `Snippet prompt ${idx + 1}`,
    code: 'int main() { return 0; }',
    choices: ['A', 'B', 'C', 'D'],
    correct_choice: 'A',
    explanation: 'Explanation.',
    interviewer_insight: 'Insight.'
  }))

  return [...conceptQuestions, ...snippetQuestions]
}

describe('Wrap Up assessment phase-loading bubble parity', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the phase-loading bubble while wrap-up is pending on mobile', async () => {
    buildPhaseLoadingBubble()
    const showApology = jest.fn().mockResolvedValue(undefined)

    await presentWrapUpAssessmentOverlay({
      overlay: null,
      failed: false,
      moduleTitle: 'Module',
      showApology
    })

    expect(document.querySelector('.phase-loading-container')).toBeTruthy()
    expect(showApology).not.toHaveBeenCalled()
  })

  it('clears the phase-loading bubble when wrap-up is shown or fails', async () => {
    buildPhaseLoadingBubble()
    const showApology = jest.fn().mockResolvedValue(undefined)

    await presentWrapUpAssessmentOverlay({
      overlay: {
        moduleTitle: 'Module',
        questions: buildValidQuestions()
      } as any,
      failed: false,
      moduleTitle: 'Module',
      showApology
    })

    expect(document.querySelector('.phase-loading-container')).toBeFalsy()

    buildPhaseLoadingBubble()
    await presentWrapUpAssessmentOverlay({
      overlay: null,
      failed: true,
      moduleTitle: 'Module',
      showApology
    })

    expect(document.querySelector('.phase-loading-container')).toBeFalsy()
    expect(showApology).toHaveBeenCalled()
  })
})


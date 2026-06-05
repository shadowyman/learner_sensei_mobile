import { hasReloadKeyTakeawayEnhancer, isMainResponseReloadContext } from '../ui'

describe('reload context guards', () => {
  test('accepts main-response reload contexts with empty user input', () => {
    expect(isMainResponseReloadContext({
      type: 'mainResponse',
      dynamicSystemInstruction: 'Socratic initialization instruction',
      userInput: '',
      llmStreamRequest: {
        mode: 'socratic',
        teachingPlan: [[{
          text: 'Ask why base cases stop recursion.',
          interactionGuidance: {
            expectedTurns: 2,
            completionTriggers: ['base case explained'],
            turnManagement: 'Ask one question at a time.'
          }
        }]],
        pedagogicalGuidance: { directive: undefined },
        isSystemInitialization: true,
        currentUserInput: ''
      }
    })).toBe(true)
  })

  test('rejects main-response reload contexts without user input presence', () => {
    expect(isMainResponseReloadContext({
      type: 'mainResponse',
      dynamicSystemInstruction: 'Instruction'
    })).toBe(false)
  })

  test('accepts key-takeaway enhancer metadata on module-intro reload contexts', () => {
    expect(hasReloadKeyTakeawayEnhancer({
      type: 'moduleIntro',
      introSystemInstruction: 'Introduce the module.',
      moduleTitleForPrompt: 'Recursive Structure',
      keyTakeawayEnhancer: {
        promptHash: 'module-intro-hash',
        promptText: 'Enhance the key takeaway.'
      }
    })).toBe(true)
  })
})

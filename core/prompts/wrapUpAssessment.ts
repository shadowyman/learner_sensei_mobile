export interface WrapUpAssessmentPromptContext {
  moduleTitle: string;
  moduleGoal: string;
  solidifyContent: string;
  conceptSummaries: string[];
}

export const WRAP_UP_ASSESSMENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'submit_wrap_up_assessment',
        description: 'Delivers the full wrap-up assessment question set for the current module solidify phase. Always include exactly 15 questions with five snippet items.',
        parametersJsonSchema: {
          type: 'object',
          description: 'Payload containing the generated wrap-up assessment questions.',
          properties: {
            questions: {
              type: 'array',
              description: 'Ordered wrap-up assessment questions to present to the learner.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Stable identifier for the question.' },
                  type: { type: 'string', enum: ['snippet', 'concept'], description: 'Question category.' },
                  prompt: { type: 'string', description: 'Question stem shown to the learner.' },
                  code: { type: 'string', description: 'Optional C++ snippet for snippet questions.' },
                  choices: {
                    type: 'array',
                    description: 'Exactly four answer choices formatted as Markdown-capable strings.',
                    items: { type: 'string' }
                  },
                  correct_choice: { type: 'string', description: 'The choice string that is correct.' },
                  explanation: { type: 'string', description: 'Detailed reasoning explaining the answer.' },
                  interviewer_insight: { type: 'string', description: 'FAANG interviewer perspective highlighting the trap or signal.' }
                },
                required: ['id', 'type', 'prompt', 'choices', 'correct_choice', 'explanation', 'interviewer_insight']
              }
            }
          },
          required: ['questions']
        }
      }
    ]
  }
] as const;

export function buildWrapUpAssessmentPrompt(context: WrapUpAssessmentPromptContext): string {
  const { moduleTitle, moduleGoal, conceptSummaries } = context;
  const conceptSection = conceptSummaries.length
    ? conceptSummaries.map((concept, index) => `Concept ${index + 1}: ${concept}`).join('\n')
    : 'No individual concept summaries were supplied; infer coverage from the solidify material.';

  return [
    'You are an assessment author. Prepare a 15-question multiple-choice assessment that spans every concept in the provided material. Each question should feel tricky and creative—draw on implied knowledge within scope, not just verbatim details—so the set mirrors the rigor of FAANG-style interviews.',
    'Deliver the finished assessment by invoking the submit_wrap_up_assessment tool with the questions array. Do not emit JSON, tool_code, or natural language outside of the tool invocation.',
    'Requirements:',
    '1. Exactly five questions must be C++ code-snippet items (`"type": "snippet"`) with a valid C++ `code` field; the remaining ten are conceptual (`"type": "concept"`).',
    '2. For code snippets, assume surrounding infrastructure already exists—show only the lines necessary to illustrate the bug or question.',
    '3. Every question must present four answer choices, and the `"correct_choice"` string must match one of those choices exactly.',
    '4. Provide both `"explanation"` (why the correct answer is right) and `"interviewer_insight"` (how a FAANG interviewer disguises the concept, the trap they set, and the weakness they are screening for).',
    '5. Ensure the questions are tricky and thought-provoking, requiring deep understanding rather than surface recall.',
    'Each question object supplied to the tool must include these fields: id (string), type ("snippet" | "concept"), prompt (string), optional code (string for snippet questions), choices (array of four strings), correct_choice (string matching one choice), explanation (string), interviewer_insight (string).',
    `Module Title: ${moduleTitle}`,
    `Module Goal:\n${moduleGoal}`,
    'Concept Summaries:\n' + conceptSection,
    'Ensure the full set covers algorithms, complexity, pitfalls, and systems-thinking cues implicit in the Solidify content. Every question should feel like a FAANG interview moment that rewards precise reasoning.'
  ].join('\n');
}

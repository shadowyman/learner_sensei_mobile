import type { CoreLlmClient } from './llmTypes';

const WRAP_UP_ASSESSMENT_DEBUG_DEFAULT = false;
const WRAP_UP_ASSESSMENT_DEBUG_FLAG = false;

export type WrapUpAssessmentQuestionType = 'snippet' | 'concept';

export interface WrapUpAssessmentQuestion {
  id: string;
  type: WrapUpAssessmentQuestionType;
  prompt: string;
  code?: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  interviewer_insight: string;
}

export interface WrapUpAssessmentGenerationResult {
  questions: WrapUpAssessmentQuestion[];
}

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

function isWrapUpDebugEnabled(): boolean {
  const anyGlobal = globalThis as any;
  if (anyGlobal && anyGlobal.__WRAP_UP_DEBUG === true) {
    return true;
  }
  if (anyGlobal && anyGlobal.__WRAP_UP_DEBUG === false) {
    return false;
  }
  return WRAP_UP_ASSESSMENT_DEBUG_FLAG ?? WRAP_UP_ASSESSMENT_DEBUG_DEFAULT;
}

function buildDebugAssessment(moduleTitle: string): WrapUpAssessmentGenerationResult {
  const snippetQuestions = Array.from({ length: 5 }, (_, idx) => {
    const correctMarkdown = '**Correct:** It recomputes overlapping subproblems without memoization so runtime is exponential.';
    const basePrompt = `**Debug Snippet ${idx + 1}** for _${moduleTitle}_`;
    const demoAppendix = '\n\n> Blockquote demo\n\n1. Ordered item\n2. _Italic item_\n\n- Bullet with `inline` code\n- ![Alt text](https://dummyimage.com/120x60/0f172a/ffffff&text=Img)';
    const prompt = idx === 0 ? `${basePrompt}${demoAppendix}` : basePrompt;
    return {
      id: `debug-snippet-${idx + 1}`,
      type: 'snippet' as const,
      prompt,
      code: 'int fib(int n) {\n    if (n <= 1) return n;\n    return fib(n - 1) + fib(n - 2);\n}',
      choices: [
        correctMarkdown,
        '_Incorrect_: It returns incorrect values for `n < 2` because the base case should return -1.',
        'It uses tail recursion so stack depth remains constant.',
        'It leaks memory because the recursion never hits a base case.'
      ],
      correct_choice: correctMarkdown,
      explanation: 'The classic recursive Fibonacci implementation re-explores states; memoization or iteration eliminates exponential blowup.',
      interviewer_insight: 'Interviewers expect you to contrast naive recursion with memoized or iterative variants.'
    };
  });

  const conceptQuestions = Array.from({ length: 10 }, (_, idx) => {
    const correctMarkdown = '**Answer:** It lets each branch restore shared state before siblings explore.';
    return {
      id: `debug-concept-${idx + 1}`,
      type: 'concept' as const,
      prompt: `Debug Concept ${idx + 1}: Why does **post-order** processing matter?`,
      choices: [
        correctMarkdown,
        'It guarantees logarithmic complexity in balanced trees.',
        'It converts recursion into iteration automatically.',
        'It memoizes subproblems without extra storage.'
      ],
      correct_choice: correctMarkdown,
      explanation: 'Post-order ensures temporary state is cleaned up, so other branches see a pristine context.',
      interviewer_insight: 'This checks whether you can articulate branch-local state management under recursion.'
    };
  });

  return { questions: [...snippetQuestions, ...conceptQuestions] };
}

function coerceString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeWrapUpAssessmentQuestions(raw: unknown): WrapUpAssessmentQuestion[] {
  const sourceArray = Array.isArray((raw as any)?.questions)
    ? (raw as any).questions
    : Array.isArray(raw) ? raw : [];

  return sourceArray.map((entry: any, index: number) => {
    const prompt = coerceString(entry?.prompt);
    const choicesArray = Array.isArray(entry?.choices) ? entry.choices : [];
    const choices = choicesArray.map((choice: any) => coerceString(choice));
    const typeRaw = coerceString(entry?.type).toLowerCase();
    const question: WrapUpAssessmentQuestion = {
      id: coerceString(entry?.id) || `q${index + 1}`,
      type: typeRaw === 'snippet' ? 'snippet' : 'concept',
      prompt,
      choices,
      correct_choice: coerceString(entry?.correct_choice),
      explanation: coerceString(entry?.explanation),
      interviewer_insight: coerceString(entry?.interviewer_insight)
    };
    const code = coerceString(entry?.code);
    if (code) {
      question.code = code;
    }
    return question;
  });
}

export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function extractQuestionsFromToolCode(raw: string): WrapUpAssessmentQuestion[] | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as { tool_code?: string | null };
    const toolCode = typeof parsed?.tool_code === 'string' ? parsed.tool_code : null;
    if (!toolCode) {
      return null;
    }

    const questionsIndex = toolCode.indexOf('questions=');
    if (questionsIndex === -1) {
      return null;
    }
    const arrayStart = toolCode.indexOf('[', questionsIndex);
    if (arrayStart === -1) {
      return null;
    }
    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < toolCode.length; i += 1) {
      const char = toolCode[i];
      if (char === '[') {
        depth += 1;
      } else if (char === ']') {
        depth -= 1;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
    if (arrayEnd === -1) {
      return null;
    }

    const arrayJson = toolCode.slice(arrayStart, arrayEnd + 1);
    const parsedQuestions = JSON.parse(arrayJson);
    return normalizeWrapUpAssessmentQuestions(parsedQuestions);
  } catch (_error) {
    return null;
  }
}

export function reorderWrapUpAssessmentQuestions(
  questions: WrapUpAssessmentQuestion[]
): WrapUpAssessmentQuestion[] {
  const concepts = questions.filter(question => question.type === 'concept');
  const snippets = questions.filter(question => question.type === 'snippet');
  return [...concepts, ...snippets];
}

export function enforceWrapUpAssessmentQuestionCounts(
  questions: WrapUpAssessmentQuestion[]
): WrapUpAssessmentQuestion[] | null {
  const concepts = questions.filter(question => question.type === 'concept');
  const snippets = questions.filter(question => question.type === 'snippet');
  if (concepts.length < 10 || snippets.length < 5) {
    return null;
  }
  return [...concepts.slice(0, 10), ...snippets.slice(0, 5)];
}

function parseQuestionsFromText(text: string): WrapUpAssessmentQuestion[] | null {
  const cleaned = stripJsonFence(text);
  if (!cleaned) {
    return null;
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return normalizeWrapUpAssessmentQuestions(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray((parsed as any).questions)) {
        return normalizeWrapUpAssessmentQuestions(parsed);
      }
      if (typeof (parsed as any).tool_code === 'string') {
        return extractQuestionsFromToolCode(cleaned);
      }
    }
    return null;
  } catch (_error) {
    return extractQuestionsFromToolCode(cleaned);
  }
}

export async function generateWrapUpAssessment(
  llm: CoreLlmClient | null,
  _moduleId: string,
  promptContext: WrapUpAssessmentPromptContext
): Promise<WrapUpAssessmentGenerationResult | null> {
  if (!llm) {
    return null;
  }

  if (isWrapUpDebugEnabled()) {
    return buildDebugAssessment(promptContext.moduleTitle);
  }

  const prompt = buildWrapUpAssessmentPrompt(promptContext);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const toolResult = await llm.callWithTools(prompt, { task: 'wrap_up_assessment', tools: WRAP_UP_ASSESSMENT_TOOLS });
      const toolCalls = toolResult.toolCalls;
      let normalized: WrapUpAssessmentQuestion[] | null = null;
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        const firstArgs = (toolCalls[0] as any)?.args;
        if (firstArgs) {
          normalized = normalizeWrapUpAssessmentQuestions(firstArgs);
        }
      }
      if (!normalized || normalized.length === 0) {
        const text = toolResult.text ?? '';
        normalized = extractQuestionsFromToolCode(text) ?? parseQuestionsFromText(text);
      }
      if (!normalized || normalized.length === 0) {
        throw new Error('Model returned no wrap-up payload');
      }
      const orderedQuestions = reorderWrapUpAssessmentQuestions(normalized);
      const enforcedQuestions = enforceWrapUpAssessmentQuestionCounts(orderedQuestions);
      if (!enforcedQuestions) {
        throw new Error('Model returned malformed wrap-up question set');
      }
      return { questions: enforcedQuestions };
    } catch (error) {
      lastError = error;
    }
  }

  return null;
}

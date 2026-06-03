import type { CoreLlmClient } from './llmTypes';
import type { WrapUpAssessmentPromptContext } from './prompts/wrapUpAssessment';
import { buildWrapUpAssessmentPrompt, WRAP_UP_ASSESSMENT_TOOLS } from './prompts/wrapUpAssessment';

export type { WrapUpAssessmentPromptContext } from './prompts/wrapUpAssessment';
export { buildWrapUpAssessmentPrompt, WRAP_UP_ASSESSMENT_TOOLS } from './prompts/wrapUpAssessment';

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

function assertNonEmptyString(value: unknown, message: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  throw new Error(message);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function validateWrapUpAssessmentQuestions(
  questions: WrapUpAssessmentQuestion[]
): WrapUpAssessmentQuestion[] {
  if (!Array.isArray(questions)) {
    throw new Error('Wrap Up assessment payload is not an array.');
  }

  if (questions.length !== 15) {
    throw new Error(`Wrap Up assessment must contain exactly 15 questions; received ${questions.length}.`);
  }

  const snippetCount = questions.filter(question => question.type === 'snippet').length;
  if (snippetCount !== 5) {
    throw new Error(`Wrap Up assessment must include exactly 5 snippet questions; received ${snippetCount}.`);
  }

  return questions.map((question, index) => {
    const displayIndex = index + 1;
    const id = assertNonEmptyString(question.id, `Question ${displayIndex} is missing an id.`);
    const prompt = assertNonEmptyString(question.prompt, `Question ${displayIndex} prompt is missing.`);
    const explanation = assertNonEmptyString(question.explanation, `Question ${displayIndex} explanation is missing.`);
    const interviewerInsight = assertNonEmptyString(
      question.interviewer_insight,
      `Question ${displayIndex} interviewer insight is missing.`
    );
    const choicesArray = Array.isArray(question.choices) ? question.choices : [];
    if (choicesArray.length !== 4) {
      throw new Error(`Question ${displayIndex} must contain exactly four answer choices.`);
    }
    const normalizedChoices = choicesArray.map((choice, choiceIndex) =>
      assertNonEmptyString(choice, `Question ${displayIndex} choice ${choiceIndex + 1} is empty.`)
    );
    const correctChoice = assertNonEmptyString(
      question.correct_choice,
      `Question ${displayIndex} correct choice is missing.`
    );
    if (!normalizedChoices.includes(correctChoice)) {
      throw new Error(`Question ${displayIndex} correct choice must match one of the provided choices.`);
    }
    const code = optionalString(question.code);
    const type = question.type === 'snippet' ? 'snippet' : 'concept';
    if (type === 'snippet' && !code) {
      throw new Error(`Snippet question ${displayIndex} is missing required C++ code.`);
    }

    return {
      id,
      type,
      prompt,
      code,
      choices: normalizedChoices,
      correct_choice: correctChoice,
      explanation,
      interviewer_insight: interviewerInsight
    } as WrapUpAssessmentQuestion;
  });
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
  promptContext: WrapUpAssessmentPromptContext,
  options?: {
    onAttemptError?: (params: { attempt: number; maxAttempts: number; error: unknown }) => void;
  }
): Promise<WrapUpAssessmentGenerationResult | null> {
  if (!llm) {
    return null;
  }

  if (isWrapUpDebugEnabled()) {
    return buildDebugAssessment(promptContext.moduleTitle);
  }

  const prompt = buildWrapUpAssessmentPrompt(promptContext);
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
      const validatedQuestions = validateWrapUpAssessmentQuestions(enforcedQuestions);
      return { questions: validatedQuestions };
    } catch (error) {
      options?.onAttemptError?.({ attempt, maxAttempts, error });
      if (isTimeoutError(error)) {
        break;
      }
    }
  }

  return null;
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const anyError = error;
  const name = typeof (anyError as any)?.name === 'string' ? (anyError as any).name : '';
  const code = typeof (anyError as any)?.code === 'string' ? (anyError as any).code : '';
  const message = typeof (anyError as any)?.message === 'string' ? (anyError as any).message : '';
  const lowered = message.toLowerCase();
  return (
    name === 'AbortError' ||
    code === 'ETIMEDOUT' ||
    lowered.includes('timed out') ||
    lowered.includes('timeout') ||
    lowered.includes('deadline exceeded')
  );
}

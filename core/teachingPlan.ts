import type { CoreLlmClient } from './llmTypes';
import {
  GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT
} from './prompts/teachingPlan';

export {
  GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_ITEM_BASED_TEACHING_PLAN_PROMPT_FUNCTION,
  GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT,
  GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION
} from './prompts/teachingPlan';

export type Phase = 'IntroIllustrate' | 'Socratic' | 'Solidify';

export interface TeachingPoint {
  text: string;
  kcValue: number;
  isSocraticIntent?: boolean;
  interactionGuidance?: {
    expectedTurns: number;
    turnManagement?: any;
    completionTriggers?: any;
  };
  socraticMetadata?: {
    detectedCategory?: string;
  };
}

const PHASE_KC_TOTAL = 0.65;

function stripJsonFence(text: string): string {
  let cleaned = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleaned.match(fenceRegex);
  if (match && match[2]) {
    cleaned = match[2].trim();
  }
  return cleaned;
}

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function extractSocraticMetadataFromCombinedText(textToProcess: string): {
  moduleTitle: string;
  moduleGoal: string;
  conceptsSummary: string;
} {
  const titleMatch = textToProcess.match(/Module Title: (.+?)(?:\n|$)/);
  const goalMatch = textToProcess.match(/Module Goal:\n(.+?)(?:\n\n|$)/s);
  const conceptsMatch = textToProcess.match(/All Module Concepts:\n([\s\S]+?)(?:\nSocratic Instructions|$)/);
  const parsedTitle = titleMatch?.[1]?.trim() ?? '';
  const parsedGoal = goalMatch?.[1]?.trim() ?? '';
  let parsedConcepts = '';

  const conceptsSection = conceptsMatch?.[1];
  if (conceptsSection) {
    const conceptTitles = Array.from(conceptsSection.matchAll(/Concept \d+: (.+?)(?:\n|$)/g))
      .map((match) => match[1]?.trim())
      .filter((title): title is string => Boolean(title && title.length > 0));
    if (conceptTitles.length > 0) {
      parsedConcepts = conceptTitles.join(', ');
    }
  }

  return {
    moduleTitle: parsedTitle,
    moduleGoal: parsedGoal,
    conceptsSummary: parsedConcepts
  };
}

function normalizeSocraticPlan(parsed: any): TeachingPoint[][] | null {
  const socraticPlan = parsed?.teaching_plan;
  if (!Array.isArray(socraticPlan) || socraticPlan.length === 0) {
    return null;
  }
  if (!Array.isArray(socraticPlan[0]) || socraticPlan[0].length === 0) {
    return null;
  }

  const detectedCategory = typeof parsed?.detected_category === 'string' ? parsed.detected_category : undefined;
  const transformedPlan: TeachingPoint[][] = socraticPlan.map((chunk: any[]) =>
    chunk.map((item: any) => {
      const point: TeachingPoint = {
        text: item.text,
        kcValue: item.kcValue || PHASE_KC_TOTAL,
        isSocraticIntent: item.isSocraticIntent,
        interactionGuidance: item.interactionGuidance
      };
      if (detectedCategory) {
        point.socraticMetadata = { detectedCategory };
      }
      return point;
    })
  );

  return transformedPlan;
}

function normalizeStandardPlan(parsed: any): TeachingPoint[][] | null {
  if (!parsed || !Array.isArray(parsed.teaching_plan)) {
    return null;
  }

  const plan = parsed.teaching_plan;
  const isValidPlan = plan.every(
    (chunk: any) =>
      Array.isArray(chunk) &&
      chunk.length >= 1 &&
      chunk.every((item: any) => typeof item === 'object' && item !== null && typeof item.text === 'string')
  );

  if (!isValidPlan) {
    return null;
  }

  const totalNumChunks = plan.length;
  const totalNumPoints = plan.reduce((sum: number, chunk: any[]) => sum + chunk.length, 0);
  if (totalNumPoints <= 0) {
    return null;
  }
  if (totalNumChunks > 10) {
    return null;
  }

  const uniformKcValue = PHASE_KC_TOTAL / totalNumPoints;
  const transformedPlan: TeachingPoint[][] = plan.map((chunk: any[]) =>
    chunk.map((item: any) => ({
      text: item.text,
      kcValue: uniformKcValue
    }))
  );
  return transformedPlan;
}

export async function extractAndPlanTeachingOrder(
  llm: CoreLlmClient | null,
  args: {
    textToProcess: string;
    phase: Phase;
    moduleTitle?: string;
    moduleGoal?: string;
    conceptsSummary?: string;
    itemBasedPromptEnabled?: boolean;
  }
): Promise<TeachingPoint[][] | null> {
  if (!llm) {
    return null;
  }

  const phase = args.phase;
  const textToProcess = args.textToProcess;

  let prompt: string;
  if (phase === 'Socratic') {
    let extractedTitle = args.moduleTitle ?? '';
    let extractedGoal = args.moduleGoal ?? '';
    let extractedConcepts = args.conceptsSummary ?? '';
    if (!extractedTitle || !extractedGoal || !extractedConcepts) {
      const extracted = extractSocraticMetadataFromCombinedText(textToProcess);
      if (!extractedTitle) extractedTitle = extracted.moduleTitle;
      if (!extractedGoal) extractedGoal = extracted.moduleGoal;
      if (!extractedConcepts) extractedConcepts = extracted.conceptsSummary;
    }
    prompt = GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(textToProcess, extractedTitle, extractedGoal, extractedConcepts);
  } else {
    prompt = args.itemBasedPromptEnabled
      ? GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess)
      : GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);
  }

  try {
    const text = await llm.callText(prompt, { task: 'teaching_plan' });
    const cleaned = stripJsonFence(text);
    const parsed = safeJsonParse(cleaned);
    if (!parsed) {
      return null;
    }
    if (phase === 'Socratic' && parsed && parsed.detected_category && parsed.teaching_plan) {
      return normalizeSocraticPlan(parsed);
    }
    return normalizeStandardPlan(parsed);
  } catch (_error) {
    return null;
  }
}

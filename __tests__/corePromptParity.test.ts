import crypto from 'crypto';
import {
  WRAP_UP_ASSESSMENT_TOOLS,
  buildWrapUpAssessmentPrompt
} from '@sensei/core/prompts/wrapUpAssessment';
import {
  GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
  GET_ITEM_BASED_TEACHING_PLAN_PROMPT_FUNCTION,
  GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT,
  GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION
} from '@sensei/core/prompts/teachingPlan';
import {
  buildComprehensiveAnalysisPrompt
} from '@sensei/core/prompts/learnerAnalysis';
import { MERMAID_FIX_PROMPT_TEMPLATE } from '@sensei/core/prompts/mermaidRepair';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('Core prompt parity fixtures', () => {
  test('wrap-up assessment prompt and tool schema match pre-normalization output', () => {
    const prompt = buildWrapUpAssessmentPrompt({
      moduleTitle: 'Module Alpha',
      moduleGoal: 'Master recursive decomposition',
      solidifyContent: 'Solidify content is not interpolated by the current wrap-up prompt.',
      conceptSummaries: ['Base cases prevent runaway recursion', 'Recursive steps shrink problem size']
    });

    expect(sha256(prompt)).toBe('296a4e1d786392358e59a6434634d2b242cf0b911d2f10eeda0c2f7ae1d30069');
    expect(sha256(JSON.stringify(WRAP_UP_ASSESSMENT_TOOLS))).toBe('8cb62a2ea073afb647ee565b56a2ff50214bdb2730bc5eb24331a1e849c65976');
  });

  test('teaching plan prompt variants match pre-normalization output', () => {
    const textToProcess = 'Concepts:\n1. Base Case\n2. Recursive Step\n';
    const socraticPrompt = GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
      'Socratic Instructions\nAsk why the base case matters.',
      'Module Alpha',
      'Master recursive decomposition',
      'Base Case, Recursive Step'
    );

    expect(sha256(GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess))).toBe('4cbad4b3e19be3ba5addef3c318f82a56472eba5e3b006626135d333ba6a448c');
    expect(sha256(GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess))).toBe('aad79689c12413216d52f57faca70820bf969e59a619502a1932b43c9610d9e4');
    expect(sha256(GET_ITEM_BASED_TEACHING_PLAN_PROMPT_FUNCTION(textToProcess))).toBe('aad79689c12413216d52f57faca70820bf969e59a619502a1932b43c9610d9e4');
    expect(sha256(GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess))).toBe('4cbad4b3e19be3ba5addef3c318f82a56472eba5e3b006626135d333ba6a448c');
    expect(sha256(socraticPrompt)).toBe('146681a7755b1cc088825cede3f5cbdc173661f7090596d89c01e5fc3dcc7421');
  });

  test('learner analysis phase prompts match pre-normalization output', () => {
    const baseRequest = {
      userInputText: 'I think recursion repeats until the base case.',
      lastSenseiMsg: 'Explain how the base case stops recursion.',
      currentTaskIdForAnalysis: 'task-alpha',
      expectedContentPointsForCurrentChunk: ['Identify the base case', 'Explain the shrinking recursive step']
    };

    expect(sha256(buildComprehensiveAnalysisPrompt({ ...baseRequest, phase: 'Socratic' }))).toBe('be10e38d3eac32b1ea05685cc29456cc7a011b172d663edec2ab74342647e0ad');
    expect(sha256(buildComprehensiveAnalysisPrompt({ ...baseRequest, phase: 'IntroIllustrate' }))).toBe('84b4a74ad6729d190d1e1e38c3ddf3d1740bf7e8f05f8b1873a2416bb2ff5ee0');
    expect(sha256(buildComprehensiveAnalysisPrompt({ ...baseRequest, phase: 'Solidify' }))).toBe('84b4a74ad6729d190d1e1e38c3ddf3d1740bf7e8f05f8b1873a2416bb2ff5ee0');
    expect(sha256(buildComprehensiveAnalysisPrompt({ ...baseRequest, phase: 'Unknown' }))).toBe('84b4a74ad6729d190d1e1e38c3ddf3d1740bf7e8f05f8b1873a2416bb2ff5ee0');
  });

  test('Mermaid repair fallback prompt matches pre-normalization output', () => {
    const prompt = MERMAID_FIX_PROMPT_TEMPLATE('graph TD\nA-->B', 'Parse error on line 2');

    expect(sha256(prompt)).toBe('233a04a6d6d81f3f1897abae509e9f0c70c55b62084ab40f3171292b46700d0e');
  });
});

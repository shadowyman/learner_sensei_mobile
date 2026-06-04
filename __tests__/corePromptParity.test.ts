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
import { MODULE_INTRODUCTION_TASK_TEMPLATE } from '@sensei/core/prompts/moduleIntroduction';
import { buildModuleIntroductionPrompt } from '@sensei/core/moduleIntroduction';
import {
  MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION,
  buildSocraticExecutionInstruction,
  buildSocraticInitialInstruction
} from '@sensei/core/prompts/mainSenseiResponse';
import {
  buildMainSenseiDynamicSystemInstruction,
  buildMainSenseiResponsePrompt
} from '@sensei/core/mainSenseiResponse';

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

  test('module introduction prompt builders match pre-normalization output', () => {
    const request = {
      selectedModuleTitle: 'Module Alpha',
      firstConceptTitle: 'Base Case',
      phaseDisplayName: 'Intro & Illustrate',
      userInputText: 'Phase: Intro & Illustrate',
      curriculumFocusInstruction: '## Curriculum Focus\nCurrent Module: Module Alpha\n__PEDAGOGICAL_GUIDANCE__',
      moduleTitleForPrompt: 'Module Alpha'
    };

    expect(sha256(MODULE_INTRODUCTION_TASK_TEMPLATE(
      request.selectedModuleTitle,
      request.firstConceptTitle,
      request.phaseDisplayName,
      request.userInputText
    ))).toBe('f01a504ec3537c4b0b4122cfccd95b9f72c6fe1800c73a37bda11c8a4238def2');
    expect(sha256(buildModuleIntroductionPrompt(request))).toBe('a8580064a20598c1b90a8a2bb3b5e7055a6b9950084588b36c186f30daeec08d');
  });

  test('main Sensei response prompt builders match pre-normalization output', () => {
    const curriculumFocusInstruction = '## Primary Action\nTeach recursion base cases.\n__PEDAGOGICAL_GUIDANCE__';
    const request = {
      curriculumFocusInstruction,
      pedagogicalGuidanceDirective: 'GUIDE: Encourage concrete analogies for recursion.',
      currentUserInput: 'How do I know when to stop recursion?',
      navigationContext: 'The learner opened the recursion module.'
    };

    expect(sha256(MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      curriculumFocusInstruction,
      'Encourage concrete analogies for recursion.',
      false
    ))).toBe('bc1627e8e2a214f438ea1545c1ab091e15f145e644ce721360a7989bd7bc365e');
    expect(sha256(buildMainSenseiDynamicSystemInstruction(request))).toBe('07241cbd3579b4cb8410ece38c1003036eaa856241fd13742e08fea0c32dd0cc');
    expect(sha256(buildMainSenseiResponsePrompt(request))).toBe('702b8e3886cef8901f377dbd67952ae35a6855dec5f79de860cc0db72046c67e');
    expect(sha256(MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      curriculumFocusInstruction,
      'Focus only on reassurance.',
      true
    ))).toBe('2fffa08fac2993736f91876284dc34366780431b6a5e9f0192646c171ef2f7da');
  });

  test('Socratic main Sensei prompt builders match migrated output', () => {
    const teachingPlan = [[{
      text: 'Ask why the base case stops recursive calls.',
      interactionGuidance: {
        expectedTurns: 2,
        completionTriggers: ['learner explains base case'],
        turnManagement: 'Ask one question at a time.'
      },
      socraticMetadata: {
        detectedCategory: 'GENERAL_CONCEPT'
      }
    }]];

    expect(sha256(buildSocraticInitialInstruction(
      teachingPlan,
      'Concept: Base Case'
    ))).toBe('6e5e8cf6963b0ad22b41404395838a50be65d5b986caf691ee488f09dcfd7caa');
    expect(sha256(buildSocraticExecutionInstruction({
      teachingPlan,
      pedagogicalGuidance: {
        directive: 'Use short probing questions.'
      },
      isSystemInitialization: false,
      navigationContext: 'Navigation anchor'
    }))).toBe('fd49f0a13b8fde0afe5d376c9aba575e0456ab847d4def52aa576967200a5061');
    expect(sha256(buildMainSenseiResponsePrompt({
      mode: 'socratic',
      teachingPlan,
      pedagogicalGuidance: {
        directive: 'Use short probing questions.'
      },
      isSystemInitialization: false,
      navigationContext: 'Navigation anchor',
      currentUserInput: 'I do not understand the base case.'
    }))).toBe('4ebed4af8da024c0d95558217a3cea31ba549c2cadde7990131b68eb9fad99f4');
    expect(sha256(buildMainSenseiResponsePrompt({
      mode: 'socratic',
      teachingPlan,
      pedagogicalGuidance: {
        metaPrompt: 'MUST_OBEY ACTION: calm the learner and ask one diagnostic question.'
      },
      isSystemInitialization: false,
      currentUserInput: 'I am frustrated.'
    }))).toBe('4fc9bf19e852aded01baccc9659449fbe16261056d26fd21cc9759eb18990614');
  });
});

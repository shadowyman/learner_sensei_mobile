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
  buildCurriculumFocusInstruction,
  buildSocraticExecutionInstruction,
  buildSocraticInitialInstruction
} from '@sensei/core/prompts/mainSenseiResponse';
import {
  buildMainSenseiDynamicSystemInstruction,
  buildMainSenseiResponsePrompt
} from '@sensei/core/mainSenseiResponse';
import {
  SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS as CORE_BASE_SENSEI_PROMPT
} from '@sensei/core/prompts/baseSensei';
import { MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS } from '@sensei/core/modelUsage';
import {
  MAX_CONVERSATION_HISTORY_ENTRIES,
  MAX_CONVERSATION_HISTORY_ENTRY_CHARS,
  MAX_CONVERSATION_HISTORY_TOTAL_CHARS,
  sanitizeConversationHistory
} from '@sensei/core/promptEnvelope';
import {
  SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS as WEBVIEW_BASE_SENSEI_PROMPT,
  buildSenseiEnhancementPrompt as buildWebViewSenseiEnhancementPrompt
} from '../prompts';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const activeCurriculumFocus = {
  status: 'active' as const,
  item: {
    moduleTitle: 'Module Alpha',
    moduleGoal: 'Master recursive decomposition',
    concept: {
      title: 'Base Case',
      text: 'A base case stops recursion before the calls continue forever.'
    },
    isModuleWidePhase: false
  },
  state: {
    currentPhase: 'IntroIllustrate',
    currentTeachingChunkIndex: 0,
    teachingPlanChunkCount: 2
  },
  focusPoints: ['Identify the condition that should stop recursion'],
  primaryActionType: 'Teach New Content (from current chunk)',
  includeCheckUnderstanding: true
};

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

  test('Core owns the verbatim Recursive Sensei base prompt', () => {
    expect(CORE_BASE_SENSEI_PROMPT).toBe(WEBVIEW_BASE_SENSEI_PROMPT);
    expect(CORE_BASE_SENSEI_PROMPT.length).toBe(15097);
    expect(sha256(CORE_BASE_SENSEI_PROMPT)).toBe('799b4a4ba61f4a0c22824ef668cc54b0566edb39c65531c75dbfed788b832aca');
    expect(CORE_BASE_SENSEI_PROMPT).toContain('STRICT MERMAID TECHNICAL REQUIREMENTS');
    expect(CORE_BASE_SENSEI_PROMPT).toContain('MANDATORY TEACHING EXECUTION FRAMEWORK');
  });

  test('module introduction prompt builders assemble Core-owned curriculum focus output', () => {
    const request = {
      selectedModuleTitle: 'Module Alpha',
      firstConceptTitle: 'Base Case',
      phaseDisplayName: 'Intro & Illustrate',
      userInputText: 'Phase: Intro & Illustrate',
      curriculumFocus: activeCurriculumFocus,
      moduleTitleForPrompt: 'Module Alpha'
    };

    expect(sha256(MODULE_INTRODUCTION_TASK_TEMPLATE(
      request.selectedModuleTitle,
      request.firstConceptTitle,
      request.phaseDisplayName,
      request.userInputText
    ))).toBe('f01a504ec3537c4b0b4122cfccd95b9f72c6fe1800c73a37bda11c8a4238def2');
    expect(sha256(buildModuleIntroductionPrompt(request))).toBe('c59166b2f56d1c4aac30c072ac5a4e5779f7824b9995783cff91acc4ee30684c');
  });

  test('enhancement prompt moves to Core without changing runtime output', () => {
    const originalMarkdown = [
      '# Recursion',
      '',
      'A base case stops the recursive chain.',
      '',
      'It gives the recursive calls somewhere concrete to stop.'
    ].join('\n');
    const oldPrompt = buildWebViewSenseiEnhancementPrompt(originalMarkdown);

    expect(oldPrompt.length).toBe(2316);
    expect(sha256(oldPrompt)).toBe('4cc63e3b241f0397f8d5e078bd973671150f6facd672d4f8882ac19b77c008e9');

    const coreEnhancementPrompts = require('@sensei/core/prompts/enhancement');
    expect(coreEnhancementPrompts.buildSenseiEnhancementPrompt(originalMarkdown)).toBe(oldPrompt);
  });

  test('main Sensei response prompt builders assemble Core-owned curriculum focus output', () => {
    const curriculumFocusInstruction = '## Primary Action\nTeach recursion base cases.\n__PEDAGOGICAL_GUIDANCE__';
    const request = {
      curriculumFocus: activeCurriculumFocus,
      pedagogicalGuidanceDirective: 'GUIDE: Encourage concrete analogies for recursion.',
      currentUserInput: 'How do I know when to stop recursion?',
      navigationContext: 'The learner opened the recursion module.'
    };

    expect(sha256(MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      curriculumFocusInstruction,
      'Encourage concrete analogies for recursion.',
      false
    ))).toBe('5a08eef5316d2345ac1d985b25bf07502ec0212b5ac70efb00cd637d141bb1f5');
    expect(sha256(buildMainSenseiDynamicSystemInstruction(request))).toBe('de711742875522581a38c0d854a7cf2aceb3f5598043de175684f232530e1153');
    expect(sha256(buildMainSenseiResponsePrompt(request))).toBe('260172f60354822559ec480abf5d92d01246a39a612cd24a20e0540631923404');
    expect(sha256(MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      curriculumFocusInstruction,
      'Focus only on reassurance.',
      true
    ))).toBe('2fffa08fac2993736f91876284dc34366780431b6a5e9f0192646c171ef2f7da');
  });

  test('main Sensei prompt options preserve execution and guidance controls', () => {
    expect(MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS).toEqual({
      executionDirectiveEnabled: true,
      pedagogicalGuidanceEnabled: true
    });

    const prompt = MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
      '## Primary Action\nTeach recursion.\n__PEDAGOGICAL_GUIDANCE__',
      'Use the learner-specific intervention.',
      false,
      {
        executionDirectiveEnabled: false,
        pedagogicalGuidanceEnabled: false
      }
    );

    expect(prompt).not.toContain('## 🎯 EXECUTION DIRECTIVE');
    expect(prompt).not.toContain('Use the learner-specific intervention.');
    expect(prompt).toContain('No specific guidance');
  });

  test('main Sensei migrated prompt envelope preserves base persona and recent history when requested', () => {
    const prompt = buildMainSenseiResponsePrompt({
      curriculumFocus: activeCurriculumFocus,
      currentUserInput: 'Can you explain that example again?',
      includeBaseSystemInstruction: true,
      conversationHistory: [
        { role: 'user', content: 'I am confused about base cases.' },
        { role: 'sensei', content: 'A base case stops the recursive chain.' }
      ]
    });

    expect(prompt).toContain('[RecursiveSensei Base System Instruction]');
    expect(prompt).toContain('You ARE the Recursive Sensei');
    expect(prompt).toContain('[Recent Conversation History]');
    expect(prompt).toContain('User: I am confused about base cases.');
    expect(prompt).toContain('Sensei: A base case stops the recursive chain.');
    expect(prompt).toContain('User: Can you explain that example again?');
  });

  test('migrated prompt envelope bounds conversation history before prompt construction', () => {
    const oversizedHistory = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'sensei' as const,
      content: ` entry-${index} ${'x'.repeat(MAX_CONVERSATION_HISTORY_ENTRY_CHARS + 500)} `
    }));
    const bounded = sanitizeConversationHistory(oversizedHistory);

    expect(bounded.length).toBeLessThanOrEqual(MAX_CONVERSATION_HISTORY_ENTRIES);
    expect(bounded.every((entry) => entry.content.length <= MAX_CONVERSATION_HISTORY_ENTRY_CHARS)).toBe(true);
    expect(bounded.reduce((total, entry) => total + entry.content.length, 0)).toBeLessThanOrEqual(MAX_CONVERSATION_HISTORY_TOTAL_CHARS);

    const prompt = buildMainSenseiResponsePrompt({
      curriculumFocus: activeCurriculumFocus,
      currentUserInput: 'Continue.',
      includeBaseSystemInstruction: true,
      conversationHistory: oversizedHistory
    });
    expect(prompt).toContain('[Recent Conversation History]');
    expect(prompt).not.toContain('entry-0');
    expect(prompt).not.toContain('x'.repeat(MAX_CONVERSATION_HISTORY_ENTRY_CHARS + 1));
  });

  test('module introduction migrated prompt envelope preserves base persona when requested', () => {
    const prompt = buildModuleIntroductionPrompt({
      selectedModuleTitle: 'Module Alpha',
      firstConceptTitle: 'Base Case',
      phaseDisplayName: 'IntroIllustrate',
      userInputText: 'Phase: IntroIllustrate',
      curriculumFocus: activeCurriculumFocus,
      includeBaseSystemInstruction: true
    });

    expect(prompt).toContain('[RecursiveSensei Base System Instruction]');
    expect(prompt).toContain('You ARE the Recursive Sensei');
    expect(prompt).toContain("Let's begin Module Alpha.");
  });

  test('Core owns migrated curriculum focus prompt construction from structured snapshots', () => {
    const prompt = buildCurriculumFocusInstruction(activeCurriculumFocus);

    expect(prompt).toContain('## ⭐ PRIMARY ACTION FOR THIS TURN: Teach New Content (from current chunk) ⭐');
    expect(prompt).toContain('Teaching Points:');
    expect(prompt).toContain('"Identify the condition that should stop recursion"');
    expect(prompt).toContain('## Curriculum Focus');
    expect(prompt).toContain('Current Module: Module Alpha');
    expect(prompt).toContain('## 🧠 Let\'s Check Your Understanding');
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
    ))).toBe('3cff9a97088f2cfada7e83b8ac993fc98407199ccdb3453f4494725f6227db67');
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

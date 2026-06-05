import { MODULE_INTRODUCTION_TASK_TEMPLATE } from './prompts/moduleIntroduction';
import { buildMainSenseiDynamicSystemInstruction, type MainSenseiGuidanceContext } from './mainSenseiResponse';
import type { CurriculumFocusPromptSnapshot, MainSenseiResponsePromptOptions } from './prompts/mainSenseiResponse';
import { buildCapabilityPromptEnvelope, type ConversationHistoryEntry } from './promptEnvelope';

export const MODULE_INTRODUCTION_CAPABILITY = 'moduleIntroduction' as const;

export interface ModuleIntroductionPromptRequest {
  selectedModuleTitle: string;
  firstConceptTitle: string;
  phaseDisplayName: string;
  userInputText: string;
  curriculumFocus: CurriculumFocusPromptSnapshot;
  pedagogicalGuidanceDirective?: MainSenseiGuidanceContext['pedagogicalGuidanceDirective'];
  cleanPedagogicalGuidance?: MainSenseiGuidanceContext['cleanPedagogicalGuidance'];
  isMustObey?: MainSenseiGuidanceContext['isMustObey'];
  promptOptions?: MainSenseiResponsePromptOptions;
  moduleTitleForPrompt?: string;
  includeBaseSystemInstruction?: boolean;
  conversationHistory?: ConversationHistoryEntry[];
}

export function buildModuleIntroductionTaskPrompt(request: ModuleIntroductionPromptRequest): string {
  return MODULE_INTRODUCTION_TASK_TEMPLATE(
    request.selectedModuleTitle,
    request.firstConceptTitle,
    request.phaseDisplayName,
    request.userInputText
  );
}

export function buildModuleIntroductionPrompt(request: ModuleIntroductionPromptRequest): string {
  const moduleTitleForPrompt = request.moduleTitleForPrompt ?? request.selectedModuleTitle;
  const coreInstruction = buildMainSenseiDynamicSystemInstruction({
    curriculumFocus: request.curriculumFocus,
    pedagogicalGuidanceDirective: request.pedagogicalGuidanceDirective,
    cleanPedagogicalGuidance: request.cleanPedagogicalGuidance,
    isMustObey: request.isMustObey,
    promptOptions: request.promptOptions
  });
  const taskPrompt = `${buildModuleIntroductionTaskPrompt(request)}
${coreInstruction}


Let's begin ${moduleTitleForPrompt}.`;
  return buildCapabilityPromptEnvelope({
    taskPrompt,
    includeBaseSystemInstruction: request.includeBaseSystemInstruction,
    conversationHistory: request.conversationHistory
  });
}

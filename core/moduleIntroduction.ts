import { MODULE_INTRODUCTION_TASK_TEMPLATE } from './prompts/moduleIntroduction';
import { buildCapabilityPromptEnvelope, type ConversationHistoryEntry } from './promptEnvelope';

export const MODULE_INTRODUCTION_CAPABILITY = 'moduleIntroduction' as const;

export interface ModuleIntroductionPromptRequest {
  selectedModuleTitle: string;
  firstConceptTitle: string;
  phaseDisplayName: string;
  userInputText: string;
  curriculumFocusInstruction: string;
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
  const taskPrompt = `${buildModuleIntroductionTaskPrompt(request)}
${request.curriculumFocusInstruction}


Let's begin ${moduleTitleForPrompt}.`;
  return buildCapabilityPromptEnvelope({
    taskPrompt,
    includeBaseSystemInstruction: request.includeBaseSystemInstruction,
    conversationHistory: request.conversationHistory
  });
}

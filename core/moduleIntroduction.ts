import { MODULE_INTRODUCTION_TASK_TEMPLATE } from './prompts/moduleIntroduction';

export const MODULE_INTRODUCTION_CAPABILITY = 'moduleIntroduction' as const;

export interface ModuleIntroductionPromptRequest {
  selectedModuleTitle: string;
  firstConceptTitle: string;
  phaseDisplayName: string;
  userInputText: string;
  curriculumFocusInstruction: string;
  moduleTitleForPrompt?: string;
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
  return `${buildModuleIntroductionTaskPrompt(request)}
${request.curriculumFocusInstruction}


Let's begin ${moduleTitleForPrompt}.`;
}

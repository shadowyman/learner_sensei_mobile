import {
  MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION,
  USER_LAST_INPUT_PLACEHOLDER,
  buildCurriculumFocusInstruction,
  buildSocraticExecutionInstruction,
  type CurriculumFocusPromptSnapshot,
  type MainSenseiResponsePromptOptions,
  type SocraticExecutionInstructionRequest
} from './prompts/mainSenseiResponse';
import { buildCapabilityPromptEnvelope, type ConversationHistoryEntry } from './promptEnvelope';
import type { RoleAwareHistoryLimits } from './llmBoundaryPolicy';

export const MAIN_SENSEI_RESPONSE_CAPABILITY = 'mainSenseiResponse' as const;

export interface MainSenseiGuidanceContext {
  pedagogicalGuidanceDirective?: string;
  cleanPedagogicalGuidance?: string;
  isMustObey?: boolean;
}

export interface StandardMainSenseiResponsePromptRequest extends MainSenseiGuidanceContext {
  mode?: 'standard';
  curriculumFocus: CurriculumFocusPromptSnapshot;
  currentUserInput: string;
  navigationContext?: string;
  promptOptions?: MainSenseiResponsePromptOptions;
  includeBaseSystemInstruction?: boolean;
  conversationHistory?: ConversationHistoryEntry[];
  historyLimits?: RoleAwareHistoryLimits;
}

export interface SocraticMainSenseiResponsePromptRequest extends SocraticExecutionInstructionRequest {
  mode: 'socratic';
  currentUserInput: string;
  includeBaseSystemInstruction?: boolean;
  conversationHistory?: ConversationHistoryEntry[];
  historyLimits?: RoleAwareHistoryLimits;
}

export type MainSenseiResponsePromptRequest =
  | StandardMainSenseiResponsePromptRequest
  | SocraticMainSenseiResponsePromptRequest;

export interface ParsedPedagogicalGuidance {
  cleanPedagogicalGuidance: string | undefined;
  isMustObey: boolean;
}

export function parsePedagogicalGuidanceDirective(
  guidance: MainSenseiGuidanceContext
): ParsedPedagogicalGuidance {
  if (typeof guidance.isMustObey === 'boolean') {
    return {
      cleanPedagogicalGuidance: guidance.cleanPedagogicalGuidance,
      isMustObey: guidance.isMustObey
    };
  }

  let isMustObey = false;
  let tempDirective = guidance.pedagogicalGuidanceDirective || '';
  let proseDirective = guidance.pedagogicalGuidanceDirective;

  if (tempDirective.startsWith('MUST_OBEY ')) {
    isMustObey = true;
    tempDirective = tempDirective.substring('MUST_OBEY '.length);
  }

  const colonIndex = tempDirective.indexOf(':');
  if (colonIndex !== -1) {
    proseDirective = tempDirective.substring(colonIndex + 1).trim();
  } else {
    proseDirective = tempDirective.trim();
  }

  if (!proseDirective) {
    proseDirective = undefined;
  }

  return {
    cleanPedagogicalGuidance: proseDirective,
    isMustObey
  };
}

export function buildMainSenseiDynamicSystemInstruction(
  request: Omit<StandardMainSenseiResponsePromptRequest, 'currentUserInput'>
): string {
  const parsed = parsePedagogicalGuidanceDirective(request);
  const curriculumFocusInstruction = buildCurriculumFocusInstruction(request.curriculumFocus);
  const coreInstruction = MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
    curriculumFocusInstruction,
    parsed.cleanPedagogicalGuidance,
    parsed.isMustObey,
    request.promptOptions
  );

  if (!request.navigationContext) {
    return coreInstruction;
  }

  return `[NavigationContext]
${request.navigationContext}

${coreInstruction}`;
}

export function buildMainSenseiResponsePrompt(request: MainSenseiResponsePromptRequest): string {
  const dynamicContext = request.mode === 'socratic'
    ? buildSocraticExecutionInstruction(request)
    : buildMainSenseiDynamicSystemInstruction(request);
  const userLine = `User: ${request.currentUserInput}`;
  const taskPrompt = dynamicContext.includes(USER_LAST_INPUT_PLACEHOLDER)
    ? dynamicContext.replace(USER_LAST_INPUT_PLACEHOLDER, userLine)
    : `${dynamicContext}

${userLine}`;
  return buildCapabilityPromptEnvelope({
    taskPrompt,
    includeBaseSystemInstruction: request.includeBaseSystemInstruction,
    conversationHistory: request.conversationHistory,
    historyLimits: request.historyLimits
  });
}

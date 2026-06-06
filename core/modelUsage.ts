const GEMINI_FLASH = 'gemini-flash-latest';
const GEMINI_FLASH_PREVIEW = 'gemini-3-flash-preview';

export const MAIN_RESPONSE_TIMEOUT_MS = 180_000;

export const MERMAID_ERROR_RECOVERY_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.2
  }
};

export const MERMAID_RECOVERY_TIMEOUT_MS = 40000;

export const WRAP_UP_ASSESSMENT_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH_PREVIEW,
  config: {
    temperature: 0.6
  }
};

export const WRAP_UP_ASSESSMENT_TIMEOUT_MS = 240_000;

export const TEACHING_PLAN_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.7
  }
};

export const TEACHING_PLAN_TIMEOUT_MS = 180_000;

export const COMPREHENSIVE_ANALYSIS_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.5
  }
};

export const COMPREHENSIVE_ANALYSIS_TIMEOUT_MS = 180_000;

export const SELECTION_SENSEI_MODAL_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.5
  }
};

export const MAIN_TEXT_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    temperature: 0.7
  }
};

export const MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS = {
  executionDirectiveEnabled: true,
  pedagogicalGuidanceEnabled: true
};

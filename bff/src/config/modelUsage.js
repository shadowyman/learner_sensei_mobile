const GEMINI_FLASH = 'gemini-flash-latest';
const GEMINI_FLASH_PREVIEW = 'gemini-3-flash-preview';
const {
  MAIN_RESPONSE_TIMEOUT_MS,
  MERMAID_RECOVERY_TIMEOUT_MS,
  WRAP_UP_ASSESSMENT_TIMEOUT_MS,
  TEACHING_PLAN_TIMEOUT_MS,
  COMPREHENSIVE_ANALYSIS_TIMEOUT_MS,
  SELECTION_SENSEI_MODAL_CONFIG: CORE_SELECTION_SENSEI_MODAL_CONFIG,
  MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS
} = require('@sensei/core/modelUsage');

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

const MAIN_RESPONSE_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: MAIN_RESPONSE_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    temperature: 0.7
  }
};

const MERMAID_ERROR_RECOVERY_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: MERMAID_RECOVERY_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.2
  }
};

const WRAP_UP_ASSESSMENT_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH_PREVIEW,
  timeoutMs: WRAP_UP_ASSESSMENT_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    temperature: 0.6
  }
};

const TEACHING_PLAN_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: TEACHING_PLAN_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.7
  }
};

const COMPREHENSIVE_ANALYSIS_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: COMPREHENSIVE_ANALYSIS_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.5
  }
};

const SELECTION_SENSEI_MODAL_CONFIG = {
  modelName: CORE_SELECTION_SENSEI_MODAL_CONFIG.modelName || GEMINI_FLASH,
  timeoutMs: MAIN_RESPONSE_TIMEOUT_MS,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    responseMimeType: CORE_SELECTION_SENSEI_MODAL_CONFIG.config?.responseMimeType || 'application/json',
    temperature: CORE_SELECTION_SENSEI_MODAL_CONFIG.config?.temperature ?? 0.5
  }
};

module.exports = {
  DEFAULT_SAFETY_SETTINGS,
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG,
  TEACHING_PLAN_GENERATION_CONFIG,
  COMPREHENSIVE_ANALYSIS_CONFIG,
  SELECTION_SENSEI_MODAL_CONFIG,
  MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS
};

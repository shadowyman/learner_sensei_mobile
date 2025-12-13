const GEMINI_FLASH = 'gemini-flash-latest';

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

const MAIN_RESPONSE_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: 180_000,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    temperature: 0.7
  }
};

const MERMAID_ERROR_RECOVERY_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: 40_000,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.2
  }
};

const WRAP_UP_ASSESSMENT_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH,
  timeoutMs: 240_000,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  config: {
    temperature: 0.6
  }
};

module.exports = {
  DEFAULT_SAFETY_SETTINGS,
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG
};

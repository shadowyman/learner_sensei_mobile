const GEMINI_FLASH = 'gemini-flash-latest';

export const MERMAID_ERROR_RECOVERY_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: 'application/json',
    temperature: 0.2
  }
};

export const MERMAID_RECOVERY_TIMEOUT_MS = 40000;

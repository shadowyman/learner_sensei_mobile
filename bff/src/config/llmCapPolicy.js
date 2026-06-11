const {
  MAIN_SENSEI_USER_MESSAGE_MAX_CHARS,
  SELECTION_SENSEI_USER_MESSAGE_MAX_CHARS,
  MAIN_SENSEI_HISTORY_ENTRY_MAX_CHARS,
  SELECTION_SENSEI_RESPONSE_ENTRY_MAX_CHARS,
  MAIN_SENSEI_HISTORY_MAX_ENTRIES,
  SELECTION_SENSEI_TRANSCRIPT_MAX_ENTRIES,
  MAIN_SENSEI_STRUCTURED_PROMPT_MAX_CHARS,
  SELECTION_SENSEI_STRUCTURED_MODAL_MAX_CHARS,
  SENSEI_ENHANCEMENT_ORIGINAL_MARKDOWN_MAX_CHARS,
  SENSEI_ENHANCEMENT_STRUCTURED_INPUT_MAX_CHARS
} = require('@sensei/core/llmCapPolicy');

const numberEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createLlmCapPolicy = () => {
  const mainSensei = {
    userMessageMaxChars: numberEnv('BFF_MAIN_SENSEI_USER_MESSAGE_MAX_CHARS', MAIN_SENSEI_USER_MESSAGE_MAX_CHARS),
    senseiEntryMaxChars: numberEnv('BFF_MAIN_SENSEI_SENSEI_ENTRY_MAX_CHARS', MAIN_SENSEI_HISTORY_ENTRY_MAX_CHARS),
    historyMaxEntries: numberEnv('BFF_MAIN_SENSEI_HISTORY_MAX_ENTRIES', MAIN_SENSEI_HISTORY_MAX_ENTRIES),
    aggregateMaxChars: numberEnv('BFF_MAIN_SENSEI_STRUCTURED_PROMPT_MAX_CHARS', MAIN_SENSEI_STRUCTURED_PROMPT_MAX_CHARS)
  };
  const selectionSensei = {
    selectedTextMaxChars: numberEnv('BFF_SELECTION_SENSEI_SELECTED_TEXT_MAX_CHARS', 12000),
    originalSenseiMessageMaxChars: numberEnv('BFF_SELECTION_SENSEI_ORIGINAL_MESSAGE_MAX_CHARS', SELECTION_SENSEI_RESPONSE_ENTRY_MAX_CHARS),
    actionLabelMaxChars: numberEnv('BFF_SELECTION_SENSEI_ACTION_LABEL_MAX_CHARS', 80),
    userMessageMaxChars: numberEnv('BFF_SELECTION_SENSEI_USER_MESSAGE_MAX_CHARS', SELECTION_SENSEI_USER_MESSAGE_MAX_CHARS),
    modalConversationIdMaxChars: numberEnv('BFF_SELECTION_SENSEI_MODAL_CONVERSATION_ID_MAX_CHARS', 200),
    initialResponseTitleMaxChars: numberEnv('BFF_SELECTION_SENSEI_INITIAL_RESPONSE_TITLE_MAX_CHARS', 500),
    senseiEntryMaxChars: numberEnv('BFF_SELECTION_SENSEI_SENSEI_ENTRY_MAX_CHARS', SELECTION_SENSEI_RESPONSE_ENTRY_MAX_CHARS),
    transcriptMaxEntries: numberEnv('BFF_SELECTION_SENSEI_TRANSCRIPT_MAX_ENTRIES', SELECTION_SENSEI_TRANSCRIPT_MAX_ENTRIES),
    aggregateMaxChars: numberEnv('BFF_SELECTION_SENSEI_STRUCTURED_MODAL_MAX_CHARS', SELECTION_SENSEI_STRUCTURED_MODAL_MAX_CHARS)
  };
  const senseiEnhancement = {
    originalMarkdownMaxChars: numberEnv('BFF_SENSEI_ENHANCEMENT_ORIGINAL_MARKDOWN_MAX_CHARS', SENSEI_ENHANCEMENT_ORIGINAL_MARKDOWN_MAX_CHARS),
    aggregateMaxChars: numberEnv('BFF_SENSEI_ENHANCEMENT_STRUCTURED_INPUT_MAX_CHARS', SENSEI_ENHANCEMENT_STRUCTURED_INPUT_MAX_CHARS)
  };

  return {
    rateLimits: {
      conversational: {
        windowMs: numberEnv('BFF_LLM_CONVERSATIONAL_RATE_WINDOW_MS', 60_000),
        limit: numberEnv('BFF_LLM_CONVERSATIONAL_RATE_LIMIT', 3)
      }
    },
    capabilities: {
      mainSensei,
      selectionSensei,
      senseiEnhancement
    },
    mainSensei,
    selectionSensei,
    senseiEnhancement
  };
};

module.exports = {
  createLlmCapPolicy
};

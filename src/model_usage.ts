/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Define model names as constants
const GEMINI_PRO = 'gemini-flash-latest'; // Main teaching, higher quality
const GEMINI_FLASH = 'gemini-flash-latest'; // Faster, for analysis/structured output

/**
 * Configuration for the "Teaching Plan Generation" task.
 * Used in geminiService.ts for llmExtractAndPlanTeachingOrder.
 * Switched to Flash model as it's a structured JSON generation task that might benefit from speed.
 */
export const TEACHING_PLAN_GENERATION_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    responseMimeType: "application/json",
    temperature: 0.7,
  },
};

export { WRAP_UP_ASSESSMENT_GENERATION_CONFIG } from '@sensei/core/modelUsage';
export { WRAP_UP_ASSESSMENT_TOOLS } from '@sensei/core/wrapUpAssessment';

export const TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED = false;

/**
 * Configuration for the "Comprehensive Analysis" task.
 * Used in geminiService.ts for getAnalysisFromGemini.
 * Switched to Flash model for structured JSON output, potentially faster analysis.
 */
export const COMPREHENSIVE_ANALYSIS_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: "application/json",
    temperature: 0.5,
  },
};

/**
 * Configuration for the "Module Introduction Chat" task.
 * Used in interactionHelpers.ts for streamModuleIntroduction.
 * Continues to use Pro model for higher quality conversational intro.
 * Note: This is for ai.chats.create, so systemInstruction is dynamic.
 */
export const MODULE_INTRODUCTION_CHAT_MODEL_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    temperature: 0.5,
  },
};

/**
 * Configuration for the "Main Sensei Response Chat" task.
 * Used in interactionHelpers.ts for streamMainSenseiResponse.
 * Continues to use Pro model for core teaching dialogue.
 * Note: This is for ai.chats.create, so systemInstruction is dynamic.
 */
export const MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    temperature: 0.5,
  },
};

export const KEY_TAKEAWAY_ENHANCER_MODEL_CONFIG = {
  modelName: MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.modelName,
  config: {
    ...MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.config,
  },
};

export const MAIN_SENSEI_EXECUTION_DIRECTIVE_ENABLED = true;
export const MAIN_SENSEI_PEDAGOGICAL_GUIDANCE_ENABLED = true;

export const ENABLE_KEY_TAKEAWAY_ENHANCER = true;
export const KEY_TAKEAWAY_PLACEHOLDER = 'key_takeaway_placeholder';
export const KEY_TAKEAWAY_POST_STREAM_GRACE_MS = 60000;

/**
 * Configuration for the "Debug Mode Codebase Query" task.
 * Used in debugMode.ts for handleSendToGemini.
 * Uses Pro model for better understanding of codebase questions.
 */
export const DEBUG_MODE_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    temperature: 0.6, // A neutral temperature for debugging queries
  },
};

/**
 * Configuration for the "Pedagogical Directive Generation" (Meta-Prompt) task.
 * Used in pedagogicalProfiler.ts to generate the final prose directive for the main Sensei.
 * Uses a fast Flash model for low-latency directive creation.
 */
export const PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG = {
  modelName: GEMINI_FLASH, // Updated to recommended flash model
  config: { temperature: 0.5 },
};

/**
 * Configuration for the "Selection Sensei" task.
 * Used in selectionSensei.ts for selected text explanations and interactions.
 * Uses Flash model for quick, structured responses to text selection actions.
 */
export const SELECTION_SENSEI_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    temperature: 0.5,
    responseMimeType: "application/json",
  },
};

/**
 * Configuration for the "Mermaid Error Recovery" task.
 * Used in mermaidErrorRecovery.ts for fixing Mermaid diagram syntax errors.
 * Uses Flash model for consistent, rule-based diagram fixes.
 */
export const MERMAID_ERROR_RECOVERY_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: "application/json",
    temperature: 0.2,
  },
};

export const ENHANCEMENT_REQUEST_CONFIG = {
  modelName: GEMINI_FLASH,
  config: {
    responseMimeType: "application/json",
    temperature: 0.3,
  },
};

/**
 * Configuration for the "Archetype Comparison Test" task.
 * Used in test.ts for testing consistency of archetype classification.
 * Uses Pro model for higher quality archetype analysis.
 */
export const ARCHETYPE_COMPARISON_TEST_CONFIG = {
  modelName: GEMINI_PRO,
  config: {
    temperature: 0.7,
  },
};

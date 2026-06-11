const dotenv = require('dotenv');
const {
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG,
  TEACHING_PLAN_GENERATION_CONFIG,
  COMPREHENSIVE_ANALYSIS_CONFIG,
  MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS
} = require('./modelUsage');
const { createLlmCapPolicy } = require('./llmCapPolicy');

dotenv.config();

const parseBooleanEnv = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const corsOrigin = process.env.CORS_ORIGIN || '*';
const jsonBodyLimit = '3mb';

const topicRegistry = new Set([
  'c++_recursive_mastery'
]);

const llmCapPolicy = createLlmCapPolicy();

const rateLimit = {
  windowMs: Number(process.env.TURN_RATE_WINDOW_MS || llmCapPolicy.rateLimits.conversational.windowMs),
  limit: Number(process.env.TURN_RATE_LIMIT || llmCapPolicy.rateLimits.conversational.limit)
};

const wrapUpRateLimit = {
  minIntervalMs: 20_000,
  burstWindowMs: 2 * 60_000,
  burstLimit: 3,
  blockMs: 5 * 60_000
};

const teachingPlanRateLimit = {
  minIntervalMs: 20_000,
  burstWindowMs: 2 * 60_000,
  burstLimit: 3,
  blockMs: 5 * 60_000
};

const selectionSenseiRateLimit = {
  windowMs: llmCapPolicy.rateLimits.conversational.windowMs,
  limit: llmCapPolicy.rateLimits.conversational.limit
};

const enhancementRateLimit = {
  windowMs: llmCapPolicy.rateLimits.conversational.windowMs,
  limit: llmCapPolicy.rateLimits.conversational.limit
};

const analysisRateLimit = {
  minIntervalMs: 2_000,
  burstWindowMs: 2 * 60_000,
  burstLimit: 30,
  blockMs: 5 * 60_000
};

const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 2 * 60 * 60 * 1000);
const idempotencyTtlMs = Number(process.env.IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const hardStreamTimeoutMs = Number(process.env.STREAM_TIMEOUT_MS || 60_000);
const keepaliveIntervalMs = Number(process.env.STREAM_KEEPALIVE_MS || 15_000);
const stallToBufferedMs = Number(process.env.STALL_TO_BUFFERED_MS || 25_000);
const sessionCleanupIntervalMs = Number(process.env.SESSION_CLEANUP_INTERVAL_MS || 60_000);
const teachingPlanItemBasedPromptEnabled = parseBooleanEnv(
  process.env.BFF_TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED ?? process.env.TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED,
  false
);
const mainSenseiPromptOptions = {
  executionDirectiveEnabled: parseBooleanEnv(
    process.env.BFF_MAIN_SENSEI_EXECUTION_DIRECTIVE_ENABLED ?? process.env.MAIN_SENSEI_EXECUTION_DIRECTIVE_ENABLED,
    MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS.executionDirectiveEnabled
  ),
  pedagogicalGuidanceEnabled: parseBooleanEnv(
    process.env.BFF_MAIN_SENSEI_PEDAGOGICAL_GUIDANCE_ENABLED ?? process.env.MAIN_SENSEI_PEDAGOGICAL_GUIDANCE_ENABLED,
    MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS.pedagogicalGuidanceEnabled
  )
};

const gemini = {
  apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || 'AIzaSyD_Z16_FKAwMArnKLpXu1i2KQfRYsRa3iM',
  mainModel: process.env.GEMINI_MAIN_MODEL || MAIN_RESPONSE_CONFIG.modelName,
  mermaidModel: process.env.GEMINI_MERMAID_MODEL || MERMAID_ERROR_RECOVERY_CONFIG.modelName,
  wrapUpModel: process.env.GEMINI_WRAPUP_MODEL || WRAP_UP_ASSESSMENT_GENERATION_CONFIG.modelName,
  teachingPlanModel: process.env.GEMINI_TEACHING_PLAN_MODEL || TEACHING_PLAN_GENERATION_CONFIG.modelName,
  analysisModel: process.env.GEMINI_ANALYSIS_MODEL || COMPREHENSIVE_ANALYSIS_CONFIG.modelName,
  requestTimeoutMs: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || MAIN_RESPONSE_CONFIG.timeoutMs),
  maxRetries: Number(process.env.GEMINI_MAX_RETRIES || 1),
  temperature: Number(process.env.GEMINI_TEMPERATURE || MAIN_RESPONSE_CONFIG.config.temperature || 0.7)
};

module.exports = {
  port,
  host,
  corsOrigin,
  jsonBodyLimit,
  topicRegistry,
  rateLimit,
  wrapUpRateLimit,
  teachingPlanRateLimit,
  selectionSenseiRateLimit,
  enhancementRateLimit,
  llmCapPolicy,
  analysisRateLimit,
  sessionTtlMs,
  idempotencyTtlMs,
  sessionCleanupIntervalMs,
  hardStreamTimeoutMs,
  keepaliveIntervalMs,
  stallToBufferedMs,
  teachingPlanItemBasedPromptEnabled,
  mainSenseiPromptOptions,
  gemini,
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG,
  TEACHING_PLAN_GENERATION_CONFIG
};

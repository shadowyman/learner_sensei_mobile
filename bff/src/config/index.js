const dotenv = require('dotenv');
const { MAIN_RESPONSE_CONFIG, MERMAID_ERROR_RECOVERY_CONFIG, WRAP_UP_ASSESSMENT_GENERATION_CONFIG } = require('./modelUsage');

dotenv.config();

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const corsOrigin = process.env.CORS_ORIGIN || '*';
const jsonBodyLimit = '3mb';

const topicRegistry = new Set([
  'c++_recursive_mastery'
]);

const rateLimit = {
  windowMs: Number(process.env.TURN_RATE_WINDOW_MS || 60_000),
  limit: Number(process.env.TURN_RATE_LIMIT || 3)
};

const wrapUpRateLimit = {
  minIntervalMs: 20_000,
  burstWindowMs: 2 * 60_000,
  burstLimit: 3,
  blockMs: 5 * 60_000
};

const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 2 * 60 * 60 * 1000);
const idempotencyTtlMs = Number(process.env.IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const hardStreamTimeoutMs = Number(process.env.STREAM_TIMEOUT_MS || 60_000);
const keepaliveIntervalMs = Number(process.env.STREAM_KEEPALIVE_MS || 15_000);
const stallToBufferedMs = Number(process.env.STALL_TO_BUFFERED_MS || 25_000);
const sessionCleanupIntervalMs = Number(process.env.SESSION_CLEANUP_INTERVAL_MS || 60_000);

const gemini = {
  apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || 'AIzaSyD_Z16_FKAwMArnKLpXu1i2KQfRYsRa3iM',
  mainModel: process.env.GEMINI_MAIN_MODEL || MAIN_RESPONSE_CONFIG.modelName,
  mermaidModel: process.env.GEMINI_MERMAID_MODEL || MERMAID_ERROR_RECOVERY_CONFIG.modelName,
  wrapUpModel: process.env.GEMINI_WRAPUP_MODEL || WRAP_UP_ASSESSMENT_GENERATION_CONFIG.modelName,
  requestTimeoutMs: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 180_000),
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
  sessionTtlMs,
  idempotencyTtlMs,
  sessionCleanupIntervalMs,
  hardStreamTimeoutMs,
  keepaliveIntervalMs,
  stallToBufferedMs,
  gemini,
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG
};

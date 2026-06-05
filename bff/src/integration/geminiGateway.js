const {
  MAIN_RESPONSE_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG,
  TEACHING_PLAN_GENERATION_CONFIG,
  COMPREHENSIVE_ANALYSIS_CONFIG,
  DEFAULT_SAFETY_SETTINGS
} = require('../config/modelUsage');
const { MERMAID_RECOVERY_TIMEOUT_MS } = require('@sensei/core/modelUsage');
const TAG = 'GEMINI_GATEWAY';

let genaiImportPromise;
const loadGenai = () => {
  if (!genaiImportPromise) {
    genaiImportPromise = import('@google/genai');
  }
  return genaiImportPromise;
};

const split = (text, size = 160) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

const createTimeoutError = (timeoutMs) => {
  const err = new Error(`Gemini request timed out after ${timeoutMs}ms`);
  err.name = 'AbortError';
  err.code = 'ETIMEDOUT';
  return err;
};

const withDeadline = async (promise, timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return await promise;
  }
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
  });
  const outcome = await Promise.race([
    Promise.resolve(promise).then(
      (value) => ({ kind: 'result', value }),
      (error) => ({ kind: 'error', error })
    ),
    timeoutPromise
  ]);
  clearTimeout(timeoutHandle);
  if (outcome.kind === 'timeout') {
    throw createTimeoutError(timeoutMs);
  }
  if (outcome.kind === 'error') {
    throw outcome.error;
  }
  return outcome.value;
};

class GeminiGateway {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    this.apiKey = config.gemini.apiKey;
    this.modelName = config.gemini.mainModel;
    this.temperature = config.gemini.temperature;
    this.timeoutMs = config.gemini.requestTimeoutMs;
    this.clientPromise = this.#createClient();
  }

  async #createClient() {
    const { GoogleGenAI } = await loadGenai();
    return new GoogleGenAI({ apiKey: this.apiKey });
  }

  getTaskConfig(task) {
    switch (task) {
      case 'comprehensive_analysis':
        return COMPREHENSIVE_ANALYSIS_CONFIG;
      case 'mermaid_repair':
        return MERMAID_ERROR_RECOVERY_CONFIG;
      case 'wrap_up_assessment':
        return WRAP_UP_ASSESSMENT_GENERATION_CONFIG;
      case 'teaching_plan':
        return TEACHING_PLAN_GENERATION_CONFIG;
      default:
        return MAIN_RESPONSE_CONFIG;
    }
  }

  getTaskModelName(task, cfg) {
    switch (task) {
      case 'comprehensive_analysis':
        return this.config.gemini.analysisModel || cfg.modelName;
      case 'mermaid_repair':
        return this.config.gemini.mermaidModel || cfg.modelName;
      case 'wrap_up_assessment':
        return this.config.gemini.wrapUpModel || cfg.modelName;
      case 'teaching_plan':
        return this.config.gemini.teachingPlanModel || cfg.modelName;
      default:
        return this.modelName || cfg.modelName;
    }
  }

  async callText(prompt, { task }) {
    const isMermaid = task === 'mermaid_repair';
    const cfg = this.getTaskConfig(task);
    const modelName = this.getTaskModelName(task, cfg);
    const temperature = cfg.config.temperature ?? this.temperature;
    const baseTimeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : this.timeoutMs;
    const timeoutMs = isMermaid ? Math.min(baseTimeoutMs, MERMAID_RECOVERY_TIMEOUT_MS) : baseTimeoutMs;
    const safetySettings = Array.isArray(cfg.safetySettings) ? cfg.safetySettings : DEFAULT_SAFETY_SETTINGS;
    const responseMimeType = typeof cfg.config?.responseMimeType === 'string' ? cfg.config.responseMimeType : undefined;
    const client = await this.clientPromise;
    this.logger.info(TAG, 'callText start', { task, model: modelName, temperature, promptLength: prompt.length });
    const start = Date.now();
    const res = await withDeadline(client.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature,
        responseMimeType,
        safetySettings,
        httpOptions: { timeout: timeoutMs }
      }
    }), timeoutMs + 1000);
    const text = typeof res?.text === 'function' ? res.text() : (res?.text ?? '');
    this.logger.info(TAG, 'callText end', { task, elapsedMs: Date.now() - start, bytes: text.length });
    return text;
  }

  async callJson(prompt, { task }) {
    const text = await this.callText(prompt, { task });
    return JSON.parse(text);
  }

  async callWithTools(prompt, { task, tools }) {
    const isMermaid = task === 'mermaid_repair';
    const cfg = this.getTaskConfig(task);
    const modelName = this.getTaskModelName(task, cfg);
    const temperature = cfg.config.temperature ?? this.temperature;
    const baseTimeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : this.timeoutMs;
    const timeoutMs = isMermaid ? Math.min(baseTimeoutMs, MERMAID_RECOVERY_TIMEOUT_MS) : baseTimeoutMs;
    const safetySettings = Array.isArray(cfg.safetySettings) ? cfg.safetySettings : DEFAULT_SAFETY_SETTINGS;
    const client = await this.clientPromise;
    this.logger.info(TAG, 'callWithTools start', { task, model: modelName, temperature, promptLength: prompt.length });
    const start = Date.now();
    let stage = 'init';
    try {
      stage = 'generateContent';
      const res = await withDeadline(client.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          temperature,
          safetySettings,
          tools,
          httpOptions: { timeout: timeoutMs }
        }
      }), timeoutMs + 1000);

      stage = 'parseResponse';
      const toolCalls = Array.isArray(res?.functionCalls) ? res.functionCalls : undefined;
      const text = toolCalls?.length ? '' : (typeof res?.text === 'function' ? res.text() : (res?.text ?? ''));
      const candidate = Array.isArray(res?.candidates) ? res.candidates[0] : undefined;
      const finishReason = candidate?.finishReason;
      const finishMessage = candidate?.finishMessage;
      const candidateTokenCount = candidate?.tokenCount;
      const promptBlockReason = res?.promptFeedback?.blockReason;
      const promptBlockMessage = res?.promptFeedback?.blockReasonMessage;
      const promptTokenCount = res?.usageMetadata?.promptTokenCount;
      const candidatesTokenCount = res?.usageMetadata?.candidatesTokenCount;
      const totalTokenCount = res?.usageMetadata?.totalTokenCount;

      let safetyRatings;
      if (Array.isArray(candidate?.safetyRatings)) {
        safetyRatings = candidate.safetyRatings.map((rating) => ({
          category: rating?.category,
          probability: rating?.probability,
          blocked: rating?.blocked
        }));
      }

      this.logger.info(TAG, 'callWithTools end', {
        task,
        elapsedMs: Date.now() - start,
        toolCalls: toolCalls?.length ?? 0,
        finishReason,
        finishMessage,
        promptBlockReason,
        promptBlockMessage,
        candidateTokenCount,
        promptTokenCount,
        candidatesTokenCount,
        totalTokenCount,
        safetyRatings
      });
      return { toolCalls, text };
    } catch (error) {
      this.logger.error(TAG, 'callWithTools error', {
        task,
        stage,
        elapsedMs: Date.now() - start,
        model: modelName,
        timeoutMs,
        name: error?.name,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }

  async *streamMainResponse(prompt, { context, allowFallback = true, signal }) {
    const turnId = context.turn?.id;
    const cfg = MAIN_RESPONSE_CONFIG;
    const baseTimeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : this.timeoutMs;
    const safetySettings = Array.isArray(cfg.safetySettings) ? cfg.safetySettings : DEFAULT_SAFETY_SETTINGS;
    const client = await this.clientPromise;

    if (signal?.aborted) {
      this.logger.info(TAG, 'stream aborted before start', { turnId });
      return;
    }

    this.logger.info(TAG, 'stream start', {
      turnId,
      model: this.modelName,
      temperature: this.temperature,
      promptLength: prompt.length
    });

    const startTime = Date.now();

    try {
      const stream = await client.models.generateContentStream({
        model: this.modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          temperature: cfg.config.temperature ?? this.temperature,
          safetySettings,
          httpOptions: { timeout: baseTimeoutMs }
        }
      });

      for await (const chunk of stream) {
        if (signal?.aborted) {
          this.logger.info(TAG, 'stream aborted', { turnId, elapsedMs: Date.now() - startTime });
          return;
        }
        const text = typeof chunk?.text === 'function' ? chunk.text() : (chunk?.text ?? '');
        if (!text) {
          continue;
        }
        yield { text };
      }

      const elapsed = Date.now() - startTime;
      this.logger.info(TAG, 'stream end', { turnId, elapsedMs: elapsed });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') {
        this.logger.info(TAG, 'stream aborted', { turnId, elapsedMs: Date.now() - startTime });
        return;
      }
      this.logger.error(TAG, 'stream error', {
        turnId,
        message: error?.message,
        code: error?.code
      });
      if (!allowFallback) {
        throw error;
      }
      this.logger.warn('LLM_STREAM_MIGRATION', 'provider-fallback-used', {
        requestId: turnId,
        capability: context.capability,
        messageId: context.messageId
      });
      const response = "Sensei services are currently degraded. We're working on this issue, and if this issue persists, please report it to us using the Feedback button in the header menu.";
      for (const part of split(response)) {
        yield { text: part };
      }
    }
  }

  async recoverMermaidDiagram(payload) {
    this.logger.info(TAG, 'recover mermaid request', { hasCode: Boolean(payload.code) });
    return { fixed: false };
  }
}

module.exports = GeminiGateway;

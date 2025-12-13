const { MAIN_RESPONSE_CONFIG, MERMAID_ERROR_RECOVERY_CONFIG, WRAP_UP_ASSESSMENT_GENERATION_CONFIG, DEFAULT_SAFETY_SETTINGS } = require('../config/modelUsage');
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
      case 'mermaid_repair':
        return MERMAID_ERROR_RECOVERY_CONFIG;
      case 'wrap_up_assessment':
        return WRAP_UP_ASSESSMENT_GENERATION_CONFIG;
      default:
        return MAIN_RESPONSE_CONFIG;
    }
  }

  getTaskModelName(task, cfg) {
    switch (task) {
      case 'mermaid_repair':
        return this.config.gemini.mermaidModel || cfg.modelName;
      case 'wrap_up_assessment':
        return this.config.gemini.wrapUpModel || cfg.modelName;
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
    const client = await this.clientPromise;
    this.logger.info(TAG, 'callText start', { task, model: modelName, temperature, promptLength: prompt.length });
    const start = Date.now();
    const res = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature,
        responseMimeType: isMermaid ? cfg.config.responseMimeType : undefined,
        safetySettings,
        httpOptions: { timeout: timeoutMs }
      }
    });
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
    let toolConfig;
    if (task === 'wrap_up_assessment') {
      const allowedFunctionNames = [];
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          const decls = tool?.functionDeclarations;
          if (Array.isArray(decls)) {
            for (const decl of decls) {
              if (typeof decl?.name === 'string') {
                allowedFunctionNames.push(decl.name);
              }
            }
          }
        }
      }
      const uniqueAllowed = Array.from(new Set(allowedFunctionNames)).filter((name) => typeof name === 'string' && name.length > 0);
      toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: uniqueAllowed.length > 0 ? uniqueAllowed : undefined } };
    }
    const res = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature,
        safetySettings,
        tools,
        toolConfig,
        httpOptions: { timeout: timeoutMs }
      }
    });
    const toolCalls = Array.isArray(res?.functionCalls) ? res.functionCalls : undefined;
    const text = toolCalls?.length ? '' : (typeof res?.text === 'function' ? res.text() : (res?.text ?? ''));
    this.logger.info(TAG, 'callWithTools end', { task, elapsedMs: Date.now() - start, toolCalls: toolCalls?.length ?? 0 });
    return { toolCalls, text };
  }

  async *streamMainResponse(prompt, { context }) {
    const turnId = context.turn?.id;
    const cfg = MAIN_RESPONSE_CONFIG;
    const baseTimeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : this.timeoutMs;
    const safetySettings = Array.isArray(cfg.safetySettings) ? cfg.safetySettings : DEFAULT_SAFETY_SETTINGS;
    const client = await this.clientPromise;

    this.logger.info(TAG, 'stream start', {
      turnId,
      model: this.modelName,
      temperature: this.temperature,
      promptLength: prompt.length
    });

    const startTime = Date.now();
    let lastChunkTime = startTime;

    try {
      const stream = await client.models.generateContentStream({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: cfg.config.temperature ?? this.temperature,
          safetySettings,
          httpOptions: { timeout: baseTimeoutMs }
        }
      });

      for await (const chunk of stream) {
        const text = typeof chunk?.text === 'function' ? chunk.text() : (chunk?.text ?? '');
        if (!text) {
          continue;
        }
        const now = Date.now();
        this.logger.info(TAG, 'chunk', { turnId, bytes: text.length, sincePrevMs: now - lastChunkTime });
        lastChunkTime = now;
        yield { text };
      }

      const elapsed = Date.now() - startTime;
      this.logger.info(TAG, 'stream end', { turnId, elapsedMs: elapsed });
    } catch (error) {
      this.logger.error(TAG, 'stream error', {
        turnId,
        message: error?.message,
        code: error?.code
      });
      // Fallback to deterministic stub
      const base = context.turn?.input?.text ?? '';
      const response = `Sensei (fallback) response to: ${base}`;
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

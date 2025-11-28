const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
const { MERMAID_ERROR_RECOVERY_CONFIG, MERMAID_RECOVERY_TIMEOUT_MS } = require('@sensei/core/modelUsage');
const TAG = 'GEMINI_GATEWAY';

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
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  async callText(prompt, { task }) {
    const isMermaid = task === 'mermaid_repair';
    const modelName = isMermaid ? this.config.gemini.mermaidModel : this.modelName;
    const temperature = isMermaid ? MERMAID_ERROR_RECOVERY_CONFIG.config.temperature ?? this.temperature : this.temperature;
    const timeoutMs = isMermaid ? Math.min(this.timeoutMs, MERMAID_RECOVERY_TIMEOUT_MS) : this.timeoutMs;
    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature,
        responseMimeType: isMermaid ? MERMAID_ERROR_RECOVERY_CONFIG.config.responseMimeType : undefined
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ]
    });
    this.logger.info(TAG, 'callText start', { task, model: modelName, temperature, promptLength: prompt.length });
    const start = Date.now();
    const res = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      { timeout: timeoutMs }
    );
    const response = res?.response;
    const text = typeof response?.text === 'function' ? response.text() : '';
    this.logger.info(TAG, 'callText end', { task, elapsedMs: Date.now() - start, bytes: text.length });
    return text;
  }

  async callJson(prompt, { task }) {
    const text = await this.callText(prompt, { task });
    return JSON.parse(text);
  }

  async *streamMainResponse(prompt, { context }) {
    const turnId = context.turn?.id;
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: this.temperature
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ]
    });

    this.logger.info(TAG, 'stream start', {
      turnId,
      model: this.modelName,
      temperature: this.temperature,
      promptLength: prompt.length
    });

    const startTime = Date.now();
    let lastChunkTime = startTime;

    try {
      const result = await model.generateContentStream(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { timeout: this.timeoutMs }
      );

      for await (const chunk of result.stream) {
        const text = typeof chunk?.text === 'function'
          ? chunk.text()
          : chunk?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
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

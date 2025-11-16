const TAG = 'GEMINI_GATEWAY';

const split = (text, size = 160) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

class GeminiGateway {
  constructor({ logger }) {
    this.logger = logger;
  }

  async *streamMainResponse(prompt, { context }) {
    const base = context.turn.input?.text ?? '';
    const response = `Sensei (stub) response to: ${base}`;
    this.logger.info(TAG, 'stream stub', { turnId: context.turn.id, promptLength: prompt.length });
    for (const chunk of split(response)) {
      yield { text: chunk };
    }
  }

  async recoverMermaidDiagram(payload) {
    this.logger.info(TAG, 'recover mermaid request', { hasCode: Boolean(payload.code) });
    return { fixed: false };
  }
}

module.exports = GeminiGateway;

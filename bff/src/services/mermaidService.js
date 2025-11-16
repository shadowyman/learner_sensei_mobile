const TAG = 'MERMAID_SERVICE';

const stripCodeFence = (code) => code.replace(/```(mermaid)?/gi, '').trim();

const applyDeterministicFixes = (code) => {
  let next = stripCodeFence(code);
  let changed = next !== code;
  if (/\bdirection\s+td\b/i.test(next)) {
    next = next.replace(/\bdirection\s+td\b/gi, 'direction TB');
    changed = true;
  }
  if (!/^graph\s+/i.test(next)) {
    next = `graph TD\n${next}`.trim();
    changed = true;
  }
  return { changed, code: next };
};

class MermaidService {
  constructor({ logger, geminiGateway }) {
    this.logger = logger;
    this.geminiGateway = geminiGateway;
  }

  async recover(payload) {
    const baseCode = payload.code || '';
    const deterministic = applyDeterministicFixes(baseCode);
    if (deterministic.changed) {
      this.logger.info(TAG, 'deterministic fix applied', { messageId: payload.messageId });
      return { fixed: true, fixedCode: deterministic.code };
    }
    const llmResult = await this.geminiGateway.recoverMermaidDiagram(payload);
    this.logger.info(TAG, 'llm fix attempt', { messageId: payload.messageId, fixed: llmResult.fixed });
    return llmResult.fixed ? { fixed: true, fixedCode: llmResult.fixedCode } : { fixed: false };
  }
}

module.exports = MermaidService;

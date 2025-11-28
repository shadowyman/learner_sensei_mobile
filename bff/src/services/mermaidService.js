const {
  applyBacktickFix,
  applyUniversalQuoteFix,
  fixSubgraphDirections,
  attemptMermaidFix,
  ensureGraphDirective
} = require('@sensei/core/mermaidErrorRecovery');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

const TAG = 'MERMAID_SERVICE';

const stripCodeFence = (code) => code.replace(/```(mermaid)?/gi, '').trim();

class MermaidService {
  constructor({ logger, geminiGateway }) {
    this.logger = logger;
    this.geminiGateway = geminiGateway;
  }

  async recover(payload) {
    const inputDiagram = stripCodeFence(payload.code || '');
    const mode = payload.mode === 'llm' ? 'llm' : 'auto';

    let candidate = ensureGraphDirective(inputDiagram);
    if (mode === 'auto') {
      let changed = candidate !== inputDiagram;
      const backtickFixed = applyBacktickFix(candidate);
      if (backtickFixed !== candidate) {
        candidate = backtickFixed;
        changed = true;
      }
      const quoteFixed = applyUniversalQuoteFix(candidate);
      if (quoteFixed !== candidate) {
        candidate = quoteFixed;
        changed = true;
      }
      const directionFixed = fixSubgraphDirections(candidate);
      if (directionFixed !== candidate) {
        candidate = directionFixed;
        changed = true;
      }
      this.logger.info(TAG, 'deterministic pass', { messageId: payload.messageId, fixed: changed });
      if (changed) {
        return { fixed: true, fixedCode: candidate };
      }
    }

    const llm = new CoreLlmAdapter({ geminiGateway: this.geminiGateway });
    const llmResult = await attemptMermaidFix(llm, candidate, payload.errorMessage || '', { forceLlm: true });
    this.logger.info(TAG, 'llm fix attempt', { messageId: payload.messageId, fixed: llmResult.fixed });
    return llmResult.fixed && llmResult.diagram ? { fixed: true, fixedCode: llmResult.diagram } : { fixed: false };
  }
}

module.exports = MermaidService;

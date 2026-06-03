const { getComprehensiveAnalysis } = require('@sensei/core/learnerAnalysis');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

const TAG = 'ANALYSIS_SERVICE';

class AnalysisService {
  constructor({ logger, geminiGateway }) {
    this.logger = logger;
    this.coreLlmClient = new CoreLlmAdapter({ geminiGateway });
  }

  async generateAnalysis({ session, payload }) {
    const userInputText = payload?.userInputText ?? '';
    const lastSenseiMsg = payload?.lastSenseiMsg ?? null;
    const phase = payload?.phase ?? 'Unknown';
    this.logger.info(TAG, 'request-start', {
      sessionId: session.id,
      phase,
      inputLength: typeof userInputText === 'string' ? userInputText.length : 0,
      lastSenseiLength: typeof lastSenseiMsg === 'string' ? lastSenseiMsg.length : 0
    });

    const result = await getComprehensiveAnalysis(this.coreLlmClient, payload);
    if (!result) {
      this.logger.error(TAG, 'request-fail', { sessionId: session.id, phase });
      return null;
    }

    this.logger.info(TAG, 'request-success', { sessionId: session.id, phase });
    return result;
  }
}

module.exports = AnalysisService;


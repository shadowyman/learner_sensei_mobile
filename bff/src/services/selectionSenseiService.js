const { runSelectionSenseiModalMessage } = require('@sensei/core/selectionSensei');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

const TAG = 'SELECTION_SENSEI_SERVICE';

class SelectionSenseiService {
  constructor({ logger, geminiGateway, coreLlmClient }) {
    this.logger = logger;
    this.coreLlmClient = coreLlmClient || new CoreLlmAdapter({ geminiGateway });
  }

  async runModalMessage({ session, request }) {
    this.logger.info(TAG, 'request-start', {
      sessionId: session.id,
      mode: request.mode,
      selectedTextLength: typeof request.selectedText === 'string' ? request.selectedText.length : 0
    });

    const result = await runSelectionSenseiModalMessage(this.coreLlmClient, request);
    if (!result?.ok) {
      this.logger.warn(TAG, 'request-fail', {
        sessionId: session.id,
        mode: request.mode,
        errorCode: result?.errorCode || 'unknown'
      });
      return result || {
        ok: false,
        errorCode: 'provider_error',
        errorMessage: 'Selection Sensei modal provider execution failed.'
      };
    }

    this.logger.info(TAG, 'request-success', {
      sessionId: session.id,
      mode: request.mode,
      explanationLength: typeof result.explanation === 'string' ? result.explanation.length : 0,
      rawTextLength: typeof result.rawText === 'string' ? result.rawText.length : 0
    });
    return result;
  }
}

module.exports = SelectionSenseiService;

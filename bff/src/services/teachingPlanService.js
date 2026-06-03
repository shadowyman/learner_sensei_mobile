const TAG = 'TEACHING_PLAN_SERVICE';

const { extractAndPlanTeachingOrder } = require('@sensei/core/teachingPlan');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

class TeachingPlanService {
  constructor({ logger, geminiGateway, config = {} }) {
    this.logger = logger;
    this.coreLlmClient = new CoreLlmAdapter({ geminiGateway });
    this.itemBasedPromptEnabled = Boolean(config.teachingPlanItemBasedPromptEnabled);
  }

  async generateTeachingPlan({ session, payload }) {
    const phase = payload?.phase;
    const textToProcess = payload?.textToProcess ?? '';
    this.logger.info(TAG, 'request-start', {
      sessionId: session.id,
      phase,
      textLength: typeof textToProcess === 'string' ? textToProcess.length : 0,
      itemBasedPromptEnabled: this.itemBasedPromptEnabled
    });

    const result = await extractAndPlanTeachingOrder(this.coreLlmClient, {
      textToProcess,
      phase,
      moduleTitle: payload.moduleTitle,
      moduleGoal: payload.moduleGoal,
      conceptsSummary: payload.conceptsSummary,
      itemBasedPromptEnabled: this.itemBasedPromptEnabled
    });

    if (!Array.isArray(result) || result.length === 0) {
      this.logger.error(TAG, 'request-fail', { sessionId: session.id, phase });
      return null;
    }

    this.logger.info(TAG, 'request-success', { sessionId: session.id, phase, chunks: result.length });
    return result;
  }
}

module.exports = TeachingPlanService;

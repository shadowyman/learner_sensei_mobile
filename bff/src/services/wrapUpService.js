const TAG = 'WRAPUP_SERVICE';

const { generateWrapUpAssessment } = require('@sensei/core');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

class WrapUpService {
  constructor({ logger, geminiGateway }) {
    this.logger = logger;
    this.coreLlmClient = new CoreLlmAdapter({ geminiGateway });
  }

  async generateWrapUp({ session, moduleId, promptContext }) {
    this.logger.info(TAG, 'request-start', {
      sessionId: session.id,
      moduleId,
      moduleTitle: promptContext.moduleTitle
    });
    const result = await generateWrapUpAssessment(this.coreLlmClient, moduleId, promptContext);
    if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
      this.logger.error(TAG, 'request-fail', {
        sessionId: session.id,
        moduleId
      });
      return null;
    }
    const overlay = {
      moduleTitle: promptContext.moduleTitle,
      moduleGoal: promptContext.moduleGoal || undefined,
      conceptSummaries: promptContext.conceptSummaries,
      questions: result.questions
    };
    this.logger.info(TAG, 'request-success', {
      sessionId: session.id,
      moduleId,
      questionCount: overlay.questions.length
    });
    return overlay;
  }

  async maybeGenerateWrapUp(context) {
    const metadata = context.turn?.metadata || {};
    const promptContext = metadata.wrapUpPromptContext;
    const moduleId = metadata.moduleId;
    if (!promptContext || !moduleId) {
      this.logger.info(TAG, 'wrap-up skipped', { turnId: context.turn?.id });
      return null;
    }
    return this.generateWrapUp({ session: context.session, moduleId, promptContext });
  }
}

module.exports = WrapUpService;

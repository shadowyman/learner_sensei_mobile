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
    let lastAttemptError = null;
    const result = await generateWrapUpAssessment(this.coreLlmClient, moduleId, promptContext, {
      onAttemptError: ({ attempt, maxAttempts, error }) => {
        const anyError = error || {};
        lastAttemptError = {
          attempt,
          maxAttempts,
          name: typeof anyError.name === 'string' ? anyError.name : undefined,
          code: typeof anyError.code === 'string' ? anyError.code : undefined,
          message: typeof anyError.message === 'string' ? anyError.message : String(error)
        };
      }
    });
    if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
      this.logger.error(TAG, 'request-fail', {
        sessionId: session.id,
        moduleId,
        lastAttemptError
      });
      return null;
    }
    const overlay = {
      moduleId,
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

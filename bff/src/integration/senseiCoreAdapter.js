const TAG = 'CORE_ADAPTER';
const { buildModuleIntroductionPrompt } = require('@sensei/core/moduleIntroduction');
const { buildMainSenseiResponsePrompt } = require('@sensei/core/mainSenseiResponse');

class SenseiCoreAdapter {
  constructor({ logger }) {
    this.logger = logger;
  }

  async buildPrompt(context) {
    const input = context.turn.input?.text ?? '';
    const prompt = `You are Recursive Sensei. Respond helpfully to: ${input}`;
    this.logger.info(TAG, 'prompt built', { turnId: context.turn.id, length: prompt.length });
    return prompt;
  }

  async buildCapabilityPrompt(request) {
    if (request.capability === 'moduleIntroduction') {
      const prompt = buildModuleIntroductionPrompt(request.payload);
      this.logger.info(TAG, 'capability prompt built', {
        capability: request.capability,
        requestId: request.requestId,
        length: prompt.length
      });
      return prompt;
    }
    if (request.capability === 'mainSenseiResponse') {
      const prompt = buildMainSenseiResponsePrompt(request.payload);
      this.logger.info(TAG, 'capability prompt built', {
        capability: request.capability,
        requestId: request.requestId,
        length: prompt.length
      });
      return prompt;
    }
    const error = new Error('Unsupported capability');
    error.code = 'BAD_REQUEST';
    throw error;
  }

  deriveFooter(context) {
    return {
      confidence: 'Medium',
      confusion: 'Low',
      intent: 'Other'
    };
  }
}

module.exports = SenseiCoreAdapter;

const TAG = 'CORE_ADAPTER';
const { buildModuleIntroductionPrompt } = require('@sensei/core/moduleIntroduction');
const { buildMainSenseiResponsePrompt } = require('@sensei/core/mainSenseiResponse');
const { SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS } = require('@sensei/core/prompts/baseSensei');

class SenseiCoreAdapter {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
  }

  async buildPrompt(context) {
    const input = context.turn.input?.text ?? '';
    const prompt = `You are Recursive Sensei. Respond helpfully to: ${input}`;
    this.logger.info(TAG, 'prompt built', { turnId: context.turn.id, length: prompt.length });
    return prompt;
  }

  async buildCapabilityPrompt(request) {
    const payload = {
      ...request.payload,
      includeBaseSystemInstruction: false,
      historyLimits: this.#mainHistoryLimits(),
      promptOptions: this.config.mainSenseiPromptOptions
    };
    if (request.capability === 'moduleIntroduction') {
      const prompt = buildModuleIntroductionPrompt(payload);
      this.logger.info(TAG, 'capability prompt built', {
        capability: request.capability,
        requestId: request.requestId,
        length: prompt.length
      });
      return {
        prompt,
        systemInstruction: SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS
      };
    }
    if (request.capability === 'mainSenseiResponse') {
      const prompt = buildMainSenseiResponsePrompt(payload);
      this.logger.info(TAG, 'capability prompt built', {
        capability: request.capability,
        requestId: request.requestId,
        length: prompt.length
      });
      return {
        prompt,
        systemInstruction: SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS
      };
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

  #mainHistoryLimits() {
    const policy = this.config?.llmBoundaryPolicy?.mainSensei;
    if (!policy) {
      return undefined;
    }
    return {
      maxEntries: policy.historyMaxEntries,
      userEntryChars: policy.userMessageMaxChars,
      senseiEntryChars: policy.senseiEntryMaxChars,
      totalChars: policy.aggregateMaxChars
    };
  }
}

module.exports = SenseiCoreAdapter;

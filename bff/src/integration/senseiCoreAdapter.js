const TAG = 'CORE_ADAPTER';

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

  deriveFooter(context) {
    return {
      confidence: 'Medium',
      confusion: 'Low',
      intent: 'Other'
    };
  }
}

module.exports = SenseiCoreAdapter;

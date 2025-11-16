const TAG = 'WRAPUP_SERVICE';

class WrapUpService {
  constructor({ logger }) {
    this.logger = logger;
  }

  async maybeGenerateWrapUp(context) {
    this.logger.info(TAG, 'wrap-up skipped (stub)', { turnId: context.turn.id });
    return null;
  }
}

module.exports = WrapUpService;

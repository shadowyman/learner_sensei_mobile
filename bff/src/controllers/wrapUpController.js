const { z } = require('zod');
const { sendError } = require('../utils/apiError');

const TAG = 'WRAPUP_CONTROLLER';

const PromptContextSchema = z.object({
  moduleTitle: z.string().min(1),
  moduleGoal: z.string(),
  solidifyContent: z.string(),
  conceptSummaries: z.array(z.string())
});

const WrapUpRequestSchema = z.object({
  moduleId: z.string().min(1),
  promptContext: PromptContextSchema
});

class WrapUpController {
  constructor({ wrapUpService, sessionService, logger }) {
    this.wrapUpService = wrapUpService;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  async postWrapUp(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }
    const parseResult = WrapUpRequestSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'wrap-up payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid wrap-up payload');
    }
    try {
      const overlay = await this.wrapUpService.generateWrapUp({
        session,
        moduleId: parseResult.data.moduleId,
        promptContext: parseResult.data.promptContext
      });
      if (!overlay) {
        return sendError(res, 500, 'WRAP_UP_FAILED', 'Unable to generate wrap-up assessment');
      }
      return res.status(200).json(overlay);
    } catch (error) {
      this.logger.error(TAG, 'wrap-up generation failure', { sessionId, message: error?.message });
      return sendError(res, 500, 'WRAP_UP_FAILED', 'Unable to generate wrap-up assessment');
    }
  }
}

module.exports = WrapUpController;


const { z } = require('zod');
const { sendError } = require('../utils/apiError');

const TAG = 'TEACHING_PLAN_CONTROLLER';

const TeachingPlanRequestSchema = z.object({
  phase: z.enum(['IntroIllustrate', 'Socratic', 'Solidify']),
  textToProcess: z.string().min(1),
  moduleTitle: z.string().optional(),
  moduleGoal: z.string().optional(),
  conceptsSummary: z.string().optional(),
  itemBasedPromptEnabled: z.boolean().optional()
});

class TeachingPlanController {
  constructor({ teachingPlanService, sessionService, logger }) {
    this.teachingPlanService = teachingPlanService;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  async postTeachingPlan(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }

    const parseResult = TeachingPlanRequestSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid teaching plan payload');
    }

    try {
      const teachingPlan = await this.teachingPlanService.generateTeachingPlan({
        session,
        payload: parseResult.data
      });
      if (!teachingPlan) {
        return sendError(res, 500, 'TEACHING_PLAN_FAILED', 'Unable to generate teaching plan');
      }
      return res.status(200).json({ teachingPlan });
    } catch (error) {
      this.logger.error(TAG, 'generation failure', { sessionId, message: error?.message });
      return sendError(res, 500, 'TEACHING_PLAN_FAILED', 'Unable to generate teaching plan');
    }
  }
}

module.exports = TeachingPlanController;


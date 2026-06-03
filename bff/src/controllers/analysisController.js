const { z } = require('zod');
const { sendError } = require('../utils/apiError');

const TAG = 'ANALYSIS_CONTROLLER';

const AnalysisRequestSchema = z.object({
  userInputText: z.string(),
  lastSenseiMsg: z.string().nullable(),
  currentTaskIdForAnalysis: z.string().min(1),
  expectedContentPointsForCurrentChunk: z.array(z.string()),
  phase: z.enum(['IntroIllustrate', 'Socratic', 'Solidify', 'Unknown'])
});

class AnalysisController {
  constructor({ analysisService, sessionService, logger }) {
    this.analysisService = analysisService;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  async postAnalysis(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }

    const parseResult = AnalysisRequestSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid analysis payload');
    }

    try {
      const analysis = await this.analysisService.generateAnalysis({
        session,
        payload: parseResult.data
      });
      if (!analysis) {
        return sendError(res, 500, 'ANALYSIS_FAILED', 'Unable to generate learner analysis');
      }
      return res.status(200).json(analysis);
    } catch (error) {
      this.logger.error(TAG, 'generation failure', { sessionId, message: error?.message });
      return sendError(res, 500, 'ANALYSIS_FAILED', 'Unable to generate learner analysis');
    }
  }
}

module.exports = AnalysisController;


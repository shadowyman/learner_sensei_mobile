const { z } = require('zod');
const { sendError } = require('../utils/apiError');
const { llmCapPolicy } = require('../config');
const {
  buildSessionLimiterKey,
  validateEnhancementCaps
} = require('../validation/llmCapValidation');

const TAG = 'ENHANCEMENT_CONTROLLER';

const ENHANCEMENT_POLICY = llmCapPolicy.capabilities?.senseiEnhancement || llmCapPolicy.senseiEnhancement;

const EnhancementPayloadSchema = z.object({
  originalMarkdown: z.string().trim().min(1),
  wordCount: z.number().finite().nonnegative().optional()
}).strict();

class EnhancementController {
  constructor({ enhancementService, sessionService, logger, enhancementRateLimiter }) {
    this.enhancementService = enhancementService;
    this.sessionService = sessionService;
    this.logger = logger;
    this.enhancementRateLimiter = enhancementRateLimiter;
  }

  async postEnhancement(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }

    const parseResult = EnhancementPayloadSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'payload invalid', {
        requestId: req.requestId,
        issues: parseResult.error.errors.map((issue) => ({
          code: issue.code,
          path: issue.path
        }))
      });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid Sensei enhancement payload');
    }

    const capResult = validateEnhancementCaps(parseResult.data, ENHANCEMENT_POLICY);
    if (!capResult.success) {
      this.logger.warn(TAG, 'payload cap exceeded', {
        requestId: req.requestId,
        issues: capResult.issues.map((issue) => ({
          path: issue.path,
          maximum: issue.maximum,
          actual: issue.actual
        }))
      });
      return sendError(res, capResult.status, capResult.code, 'Invalid Sensei enhancement payload');
    }

    if (this.enhancementRateLimiter) {
      const limiterKey = buildSessionLimiterKey(sessionId, req.ip, req.get?.('User-Agent'));
      const rate = typeof this.enhancementRateLimiter.checkKey === 'function'
        ? this.enhancementRateLimiter.checkKey(limiterKey)
        : this.enhancementRateLimiter.check(limiterKey, undefined);
      if (!rate.allowed) {
        this.logger.warn(TAG, 'rate limited', { sessionId, ip: req.ip, requestId: req.requestId });
        res.set('Retry-After', String(rate.retryAfterSeconds || 60));
        return sendError(res, 429, 'RATE_LIMITED', 'Too many Sensei enhancement requests; wait a bit before trying again.');
      }
    }

    try {
      const result = await this.enhancementService.runEnhancement({
        session,
        request: capResult.payload
      });
      if (!result?.ok) {
        return sendError(res, 502, 'ENHANCEMENT_UNAVAILABLE', 'Unable to generate Sensei enhancement');
      }
      return res.status(200).json({
        success: true,
        result: {
          enhancements: result.enhancements,
          metadata: result.metadata
        }
      });
    } catch (error) {
      this.logger.error(TAG, 'generation failure', {
        sessionId,
        errorName: error instanceof Error ? error.name : typeof error
      });
      return sendError(res, 500, 'ENHANCEMENT_UNAVAILABLE', 'Unable to generate Sensei enhancement');
    }
  }
}

module.exports = {
  EnhancementController,
  EnhancementPayloadSchema
};

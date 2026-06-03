const express = require('express');
const TeachingPlanController = require('../controllers/teachingPlanController');
const { sendError } = require('../utils/apiError');

const TAG = 'TEACHING_PLAN_RATE_LIMIT';

module.exports = (deps) => {
  const router = express.Router();
  const controller = new TeachingPlanController(deps);
  router.post('/sessions/:sessionId/teaching-plan', (req, res, next) => {
    const rateLimiter = deps.teachingPlanRateLimiter;
    if (rateLimiter) {
      const sessionKey = req.params.sessionId || 'unknown';
      const key = `${sessionKey}::${req.ip || 'unknown'}::${req.get('User-Agent') || 'unknown'}`;
      const rate = rateLimiter.check(key);
      if (!rate.allowed) {
        deps.logger.warn(TAG, 'rate limited', { sessionId: req.params.sessionId, ip: req.ip, requestId: req.requestId });
        res.set('Retry-After', String(rate.retryAfterSeconds || 60));
        return sendError(res, 429, 'RATE_LIMITED', 'Too many teaching plan requests—wait a bit before trying again.');
      }
    }
    return controller.postTeachingPlan(req, res, next);
  });
  return router;
};

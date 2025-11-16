const { z } = require('zod');
const { sendError } = require('../utils/apiError');

const TAG = 'SESSION_CONTROLLER';

const SessionCreateSchema = z.object({
  topicId: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

const TurnSubmitSchema = z.object({
  clientTurnId: z.string().min(1),
  input: z.object({
    text: z.string().min(1)
  }),
  metadata: z.object({
    source: z.string().optional(),
    appVersion: z.string().optional(),
    selectionSensei: z
      .object({
        actionId: z.string(),
        selectedText: z.string().optional()
      })
      .optional()
  }).optional()
});

const MAX_INPUT_CHARS = 4000;

class SessionController {
  constructor({ sessionService, turnService, rateLimiter, logger }) {
    this.sessionService = sessionService;
    this.turnService = turnService;
    this.rateLimiter = rateLimiter;
    this.logger = logger;
  }

  createSession(req, res) {
    const parseResult = SessionCreateSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'session payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid session payload');
    }
    try {
      const session = this.sessionService.createSession(parseResult.data.topicId, parseResult.data.metadata || {});
      this.logger.info(TAG, 'session created', { sessionId: session.id, requestId: req.requestId });
      return res.status(200).json({ sessionId: session.id });
    } catch (error) {
      if (error.code === 'BAD_REQUEST') {
        return sendError(res, 400, 'BAD_REQUEST', 'Unknown topicId');
      }
      this.logger.error(TAG, 'session creation failure', { error: error.message });
      return sendError(res, 500, 'INTERNAL', 'Unable to create session');
    }
  }

  submitTurn(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }
    const parseResult = TurnSubmitSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'turn payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid turn payload');
    }
    const text = parseResult.data.input.text || '';
    if (text.length > MAX_INPUT_CHARS) {
      return sendError(res, 413, 'BAD_REQUEST', 'Your message is too long—shorten it and resend.');
    }
    const rate = this.rateLimiter.check(req.ip, req.get('User-Agent'));
    if (!rate.allowed) {
      this.logger.warn(TAG, 'rate limited', { sessionId, ip: req.ip, requestId: req.requestId });
      res.set('Retry-After', String(rate.retryAfterSeconds || 60));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many messages—wait a moment before trying again.');
    }
    const baseMetadata = parseResult.data.metadata ?? {};
    const metadata = {
      ...baseMetadata,
      source: baseMetadata.source || 'mobile',
      appVersion: baseMetadata.appVersion
    };
    const result = this.turnService.createOrGetTurn(sessionId, parseResult.data.clientTurnId, {
      input: parseResult.data.input,
      metadata
    });
    if (!result.turn) {
      return sendError(res, 400, 'BAD_REQUEST', 'Unable to create turn');
    }
    const baseUrl = this.#deriveBaseUrl(req);
    const streamUrl = `${baseUrl.replace('http', 'ws')}/sessions/${encodeURIComponent(sessionId)}/stream?turnId=${encodeURIComponent(result.turn.id)}`;
    this.logger.info(TAG, 'turn accepted', {
      sessionId,
      turnId: result.turn.id,
      replay: result.isReplay,
      requestId: req.requestId
    });
    return res.status(200).json({ turnId: result.turn.id, streamUrl });
  }

  #deriveBaseUrl(req) {
    const proto = req.get('X-Forwarded-Proto') || req.protocol || 'http';
    const host = req.get('X-Forwarded-Host') || req.get('host') || 'localhost';
    return `${proto}://${host}`;
  }
}

module.exports = SessionController;

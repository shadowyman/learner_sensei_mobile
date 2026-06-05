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

const LlmStreamSubmitSchema = z.object({
  capability: z.enum(['moduleIntroduction', 'mainSenseiResponse']),
  messageId: z.string().min(1),
  payload: z.record(z.any()),
  metadata: z.object({
    source: z.string().optional(),
    appVersion: z.string().optional()
  }).optional(),
  options: z.object({
    allowFallback: z.boolean().optional(),
    requireRealProvider: z.boolean().optional()
  }).optional()
});

const CurriculumFocusItemSchema = z.object({
  moduleTitle: z.string().min(1),
  moduleGoal: z.string(),
  concept: z.object({
    title: z.string().min(1),
    text: z.string()
  }).nullable(),
  isModuleWidePhase: z.boolean()
});

const CurriculumFocusStateSchema = z.object({
  currentPhase: z.string().min(1),
  currentTeachingChunkIndex: z.number().int().nonnegative(),
  teachingPlanChunkCount: z.number().int().nonnegative()
});

const CurriculumFocusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed')
  }),
  z.object({
    status: z.literal('general')
  }),
  z.object({
    status: z.literal('active'),
    item: CurriculumFocusItemSchema,
    state: CurriculumFocusStateSchema,
    focusPoints: z.array(z.string()),
    primaryActionType: z.string().min(1),
    includeCheckUnderstanding: z.boolean()
  }),
  z.object({
    status: z.literal('consolidation'),
    item: CurriculumFocusItemSchema,
    consolidation: z.object({
      stage: z.enum(['Diagnosing', 'Planning', 'Executing']),
      allWeakPoints: z.array(z.string()).optional(),
      userDiagnosisResponse: z.string().optional(),
      currentPlanStep: z.number().int().nonnegative().optional(),
      currentChunkIndex: z.number().int().nonnegative().optional(),
      pointsToRemediate: z.array(z.string()).optional()
    })
  })
]);

const ModuleIntroductionPayloadSchema = z.object({
  selectedModuleTitle: z.string().min(1),
  firstConceptTitle: z.string().min(1),
  phaseDisplayName: z.string().min(1),
  userInputText: z.string(),
  curriculumFocus: CurriculumFocusSchema,
  pedagogicalGuidanceDirective: z.string().optional(),
  cleanPedagogicalGuidance: z.string().optional(),
  isMustObey: z.boolean().optional(),
  moduleTitleForPrompt: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'sensei']),
    content: z.string().min(1)
  })).max(8).optional()
});

const StandardMainSenseiResponsePayloadSchema = z.object({
  mode: z.enum(['standard']).optional(),
  curriculumFocus: CurriculumFocusSchema,
  pedagogicalGuidanceDirective: z.string().optional(),
  cleanPedagogicalGuidance: z.string().optional(),
  isMustObey: z.boolean().optional(),
  currentUserInput: z.string(),
  navigationContext: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'sensei']),
    content: z.string().min(1)
  })).max(8).optional(),
  promptOptions: z.object({
    executionDirectiveEnabled: z.boolean().optional(),
    pedagogicalGuidanceEnabled: z.boolean().optional()
  }).optional()
});

const SocraticTeachingPointSchema = z.object({
  text: z.string().min(1),
  interactionGuidance: z.object({
    expectedTurns: z.number(),
    completionTriggers: z.array(z.string()).min(1),
    turnManagement: z.string().min(1)
  }),
  socraticMetadata: z.object({
    detectedCategory: z.string().optional()
  }).optional()
});

const SocraticMainSenseiResponsePayloadSchema = z.object({
  mode: z.literal('socratic'),
  teachingPlan: z.array(z.array(SocraticTeachingPointSchema).min(1)).min(1),
  pedagogicalGuidance: z.object({
    metaPrompt: z.string().optional(),
    directive: z.string().optional()
  }).optional(),
  isSystemInitialization: z.boolean().optional(),
  navigationContext: z.string().optional(),
  conceptContext: z.string().optional(),
  currentUserInput: z.string(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'sensei']),
    content: z.string().min(1)
  })).max(8).optional()
});

const validateLlmStreamCapabilityPayload = (capability, payload) => {
  if (capability === 'moduleIntroduction') {
    return ModuleIntroductionPayloadSchema.safeParse(payload);
  }
  if (capability === 'mainSenseiResponse' && payload?.mode === 'socratic') {
    return SocraticMainSenseiResponsePayloadSchema.safeParse(payload);
  }
  if (capability === 'mainSenseiResponse') {
    return StandardMainSenseiResponsePayloadSchema.safeParse(payload);
  }
  return { success: false, error: { errors: [{ message: 'Unsupported capability' }] } };
};

const MAX_INPUT_CHARS = 4000;

const getLlmStreamLearnerInputText = (capability, payload) => {
  if (capability === 'moduleIntroduction') {
    return payload.userInputText || '';
  }
  if (capability === 'mainSenseiResponse') {
    return payload.currentUserInput || '';
  }
  return '';
};

class SessionController {
  constructor({ sessionService, turnService, rateLimiter, logger, streamingService }) {
    this.sessionService = sessionService;
    this.turnService = turnService;
    this.rateLimiter = rateLimiter;
    this.logger = logger;
    this.streamingService = streamingService;
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

  submitLlmStream(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found for llm stream', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }
    const parseResult = LlmStreamSubmitSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'llm stream payload invalid', { errors: parseResult.error.errors, requestId: req.requestId });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid LLM stream payload');
    }
    const capabilityPayloadResult = validateLlmStreamCapabilityPayload(parseResult.data.capability, parseResult.data.payload);
    if (!capabilityPayloadResult.success) {
      this.logger.warn(TAG, 'llm stream capability payload invalid', {
        capability: parseResult.data.capability,
        errors: capabilityPayloadResult.error.errors,
        requestId: req.requestId
      });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid LLM stream capability payload');
    }
    const learnerInputText = getLlmStreamLearnerInputText(parseResult.data.capability, capabilityPayloadResult.data);
    if (learnerInputText.length > MAX_INPUT_CHARS) {
      return sendError(res, 413, 'BAD_REQUEST', 'Your message is too long—shorten it and resend.');
    }
    const rate = this.rateLimiter.check(req.ip, req.get('User-Agent'));
    if (!rate.allowed) {
      this.logger.warn(TAG, 'llm stream rate limited', { sessionId, ip: req.ip, requestId: req.requestId });
      res.set('Retry-After', String(rate.retryAfterSeconds || 60));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many messages—wait a moment before trying again.');
    }
    const accepted = this.streamingService.createLlmStreamRequest({
      sessionId,
      capability: parseResult.data.capability,
      messageId: parseResult.data.messageId,
      payload: capabilityPayloadResult.data,
      metadata: {
        ...(parseResult.data.metadata || {}),
        source: parseResult.data.metadata?.source || 'mobile',
        appVersion: parseResult.data.metadata?.appVersion
      },
      options: parseResult.data.options
    });
    const baseUrl = this.#deriveBaseUrl(req);
    const streamUrl = `${baseUrl.replace('http', 'ws')}/sessions/${encodeURIComponent(sessionId)}/llm-stream?requestId=${encodeURIComponent(accepted.requestId)}`;
    this.logger.info(TAG, 'llm stream accepted', {
      sessionId,
      requestId: accepted.requestId,
      capability: accepted.capability,
      messageId: accepted.messageId,
      requestIdHeader: req.requestId
    });
    return res.status(200).json({ requestId: accepted.requestId, streamUrl });
  }

  #deriveBaseUrl(req) {
    const proto = req.get('X-Forwarded-Proto') || req.protocol || 'http';
    const host = req.get('X-Forwarded-Host') || req.get('host') || 'localhost';
    return `${proto}://${host}`;
  }
}

module.exports = SessionController;

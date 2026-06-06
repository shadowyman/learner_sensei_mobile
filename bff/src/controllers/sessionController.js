const { z } = require('zod');
const { sanitizeConversationHistory } = require('@sensei/core/promptEnvelope');
const {
  MAIN_SENSEI_HISTORY_LIMITS
} = require('@sensei/core/llmBoundaryPolicy');
const { ACTIVE_PRIMARY_ACTION_TYPES } = require('@sensei/core/prompts/mainSenseiResponse');
const { sendError } = require('../utils/apiError');

const TAG = 'SESSION_CONTROLLER';
const MAX_TITLE_CHARS = 240;
const MAX_PHASE_CHARS = 120;
const MAX_MODULE_GOAL_CHARS = 2000;
const MAX_CONCEPT_TEXT_CHARS = 4000;
const MAX_FOCUS_POINTS = 12;
const MAX_FOCUS_POINT_CHARS = 1000;
const MAX_GUIDANCE_CHARS = 4000;
const MAX_NAVIGATION_CONTEXT_CHARS = 2000;
const MAX_CONSOLIDATION_POINTS = 12;
const MAX_CONSOLIDATION_POINT_CHARS = 1000;
const MAX_SOCRATIC_PLAN_ROWS = 8;
const MAX_SOCRATIC_PLAN_POINTS_PER_ROW = 8;
const MAX_SOCRATIC_TEXT_CHARS = 4000;
const MAX_SOCRATIC_TRIGGERS = 12;
const MAX_SOCRATIC_TRIGGER_CHARS = 500;
const MAX_SOCRATIC_TURN_MANAGEMENT_CHARS = 2000;
const MAX_METADATA_TEXT_CHARS = 240;
const DEFAULT_MAIN_POLICY = {
  userMessageMaxChars: MAIN_SENSEI_HISTORY_LIMITS.userEntryChars,
  senseiEntryMaxChars: MAIN_SENSEI_HISTORY_LIMITS.senseiEntryChars,
  historyMaxEntries: MAIN_SENSEI_HISTORY_LIMITS.maxEntries,
  aggregateMaxChars: MAIN_SENSEI_HISTORY_LIMITS.totalChars
};

const BoundedString = (max) => z.string().max(max);
const RequiredBoundedString = (max) => z.string().min(1).max(max);
const ConversationHistorySchema = z.array(z.object({
  role: z.enum(['user', 'sensei']),
  content: z.string().min(1)
}));

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

const CurriculumFocusConceptSchema = z.object({
  title: RequiredBoundedString(MAX_TITLE_CHARS),
  text: BoundedString(MAX_CONCEPT_TEXT_CHARS)
});

const CurriculumFocusItemSchema = z.discriminatedUnion('isModuleWidePhase', [
  z.object({
    moduleTitle: RequiredBoundedString(MAX_TITLE_CHARS),
    moduleGoal: BoundedString(MAX_MODULE_GOAL_CHARS),
    concept: CurriculumFocusConceptSchema,
    isModuleWidePhase: z.literal(false)
  }),
  z.object({
    moduleTitle: RequiredBoundedString(MAX_TITLE_CHARS),
    moduleGoal: BoundedString(MAX_MODULE_GOAL_CHARS),
    concept: z.null(),
    isModuleWidePhase: z.literal(true)
  })
]);

const CurriculumFocusStateSchema = z.object({
  currentPhase: RequiredBoundedString(MAX_PHASE_CHARS),
  currentTeachingChunkIndex: z.number().int().nonnegative(),
  teachingPlanChunkCount: z.number().int().nonnegative()
});

const PrimaryActionTypeSchema = z.enum(ACTIVE_PRIMARY_ACTION_TYPES);

const ConsolidationSnapshotSchema = z.discriminatedUnion('stage', [
  z.object({
    stage: z.literal('Diagnosing'),
    allWeakPoints: z.array(RequiredBoundedString(MAX_CONSOLIDATION_POINT_CHARS)).min(1).max(MAX_CONSOLIDATION_POINTS)
  }),
  z.object({
    stage: z.literal('Planning'),
    allWeakPoints: z.array(RequiredBoundedString(MAX_CONSOLIDATION_POINT_CHARS)).max(MAX_CONSOLIDATION_POINTS).optional(),
    userDiagnosisResponse: RequiredBoundedString(MAX_GUIDANCE_CHARS)
  }),
  z.object({
    stage: z.literal('Executing'),
    allWeakPoints: z.array(RequiredBoundedString(MAX_CONSOLIDATION_POINT_CHARS)).max(MAX_CONSOLIDATION_POINTS).optional(),
    userDiagnosisResponse: BoundedString(MAX_GUIDANCE_CHARS).optional(),
    currentPlanStep: z.number().int().nonnegative(),
    currentChunkIndex: z.number().int().nonnegative(),
    pointsToRemediate: z.array(RequiredBoundedString(MAX_CONSOLIDATION_POINT_CHARS)).min(1).max(MAX_CONSOLIDATION_POINTS)
  })
]);

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
    focusPoints: z.array(BoundedString(MAX_FOCUS_POINT_CHARS)).max(MAX_FOCUS_POINTS),
    primaryActionType: PrimaryActionTypeSchema,
    includeCheckUnderstanding: z.boolean()
  }),
  z.object({
    status: z.literal('consolidation'),
    item: CurriculumFocusItemSchema,
    consolidation: ConsolidationSnapshotSchema
  })
]);

const ModuleIntroductionPayloadSchema = z.object({
  selectedModuleTitle: RequiredBoundedString(MAX_TITLE_CHARS),
  firstConceptTitle: RequiredBoundedString(MAX_TITLE_CHARS),
  phaseDisplayName: RequiredBoundedString(MAX_PHASE_CHARS),
  userInputText: z.string(),
  curriculumFocus: CurriculumFocusSchema,
  pedagogicalGuidanceDirective: BoundedString(MAX_GUIDANCE_CHARS).optional(),
  cleanPedagogicalGuidance: BoundedString(MAX_GUIDANCE_CHARS).optional(),
  isMustObey: z.boolean().optional(),
  moduleTitleForPrompt: BoundedString(MAX_TITLE_CHARS).optional(),
  conversationHistory: ConversationHistorySchema.optional()
});

const StandardMainSenseiResponsePayloadSchema = z.object({
  mode: z.enum(['standard']).optional(),
  curriculumFocus: CurriculumFocusSchema,
  pedagogicalGuidanceDirective: BoundedString(MAX_GUIDANCE_CHARS).optional(),
  cleanPedagogicalGuidance: BoundedString(MAX_GUIDANCE_CHARS).optional(),
  isMustObey: z.boolean().optional(),
  currentUserInput: z.string(),
  navigationContext: BoundedString(MAX_NAVIGATION_CONTEXT_CHARS).optional(),
  conversationHistory: ConversationHistorySchema.optional(),
  promptOptions: z.object({
    executionDirectiveEnabled: z.boolean().optional(),
    pedagogicalGuidanceEnabled: z.boolean().optional()
  }).optional()
});

const SocraticTeachingPointSchema = z.object({
  text: RequiredBoundedString(MAX_SOCRATIC_TEXT_CHARS),
  interactionGuidance: z.object({
    expectedTurns: z.number(),
    completionTriggers: z.array(RequiredBoundedString(MAX_SOCRATIC_TRIGGER_CHARS)).min(1).max(MAX_SOCRATIC_TRIGGERS),
    turnManagement: RequiredBoundedString(MAX_SOCRATIC_TURN_MANAGEMENT_CHARS)
  }),
  socraticMetadata: z.object({
    detectedCategory: BoundedString(MAX_METADATA_TEXT_CHARS).optional()
  }).optional()
});

const SocraticMainSenseiResponsePayloadSchema = z.object({
  mode: z.literal('socratic'),
  teachingPlan: z.array(z.array(SocraticTeachingPointSchema).min(1).max(MAX_SOCRATIC_PLAN_POINTS_PER_ROW)).min(1).max(MAX_SOCRATIC_PLAN_ROWS),
  pedagogicalGuidance: z.object({
    metaPrompt: BoundedString(MAX_GUIDANCE_CHARS).optional(),
    directive: BoundedString(MAX_GUIDANCE_CHARS).optional()
  }).optional(),
  isSystemInitialization: z.boolean().optional(),
  navigationContext: BoundedString(MAX_NAVIGATION_CONTEXT_CHARS).optional(),
  conceptContext: BoundedString(MAX_CONCEPT_TEXT_CHARS).optional(),
  currentUserInput: z.string(),
  conversationHistory: ConversationHistorySchema.optional()
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

const buildMainHistoryLimits = (mainPolicy) => ({
  maxEntries: mainPolicy.historyMaxEntries,
  userEntryChars: mainPolicy.userMessageMaxChars,
  senseiEntryChars: mainPolicy.senseiEntryMaxChars,
  totalChars: mainPolicy.aggregateMaxChars
});

const boundLlmStreamPayload = (payload, mainPolicy = DEFAULT_MAIN_POLICY) => {
  if (!Array.isArray(payload.conversationHistory)) {
    return payload;
  }
  return {
    ...payload,
    conversationHistory: sanitizeConversationHistory(payload.conversationHistory, buildMainHistoryLimits(mainPolicy))
  };
};

const countPromptInputChars = (value) => {
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countPromptInputChars(item), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total, item) => total + countPromptInputChars(item), 0);
  }
  return 0;
};

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
  constructor({ sessionService, turnService, rateLimiter, logger, streamingService, config }) {
    this.sessionService = sessionService;
    this.turnService = turnService;
    this.rateLimiter = rateLimiter;
    this.logger = logger;
    this.streamingService = streamingService;
    this.mainSenseiPolicy = config?.llmBoundaryPolicy?.mainSensei || DEFAULT_MAIN_POLICY;
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
    if (text.length > this.mainSenseiPolicy.userMessageMaxChars) {
      return sendError(res, 413, 'BAD_REQUEST', 'Your message is too long—shorten it and resend.');
    }
    const rate = this.#checkSessionRateLimit(sessionId, req);
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
    const boundedCapabilityPayload = boundLlmStreamPayload(capabilityPayloadResult.data, this.mainSenseiPolicy);
    const learnerInputText = getLlmStreamLearnerInputText(parseResult.data.capability, boundedCapabilityPayload);
    if (learnerInputText.length > this.mainSenseiPolicy.userMessageMaxChars) {
      return sendError(res, 413, 'BAD_REQUEST', 'Your message is too long—shorten it and resend.');
    }
    if (countPromptInputChars(boundedCapabilityPayload) > this.mainSenseiPolicy.aggregateMaxChars) {
      return sendError(res, 413, 'BAD_REQUEST', 'Your request includes too much context—shorten it and resend.');
    }
    const rate = this.#checkSessionRateLimit(sessionId, req);
    if (!rate.allowed) {
      this.logger.warn(TAG, 'llm stream rate limited', { sessionId, ip: req.ip, requestId: req.requestId });
      res.set('Retry-After', String(rate.retryAfterSeconds || 60));
      return sendError(res, 429, 'RATE_LIMITED', 'Too many messages—wait a moment before trying again.');
    }
    const accepted = this.streamingService.createLlmStreamRequest({
      sessionId,
      capability: parseResult.data.capability,
      messageId: parseResult.data.messageId,
      payload: boundedCapabilityPayload,
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

  #checkSessionRateLimit(sessionId, req) {
    const key = `${sessionId || 'unknown'}::${req.ip || 'unknown'}::${req.get('User-Agent') || 'unknown'}`;
    if (typeof this.rateLimiter.checkKey === 'function') {
      return this.rateLimiter.checkKey(key);
    }
    return this.rateLimiter.check(key, undefined);
  }
}

module.exports = SessionController;

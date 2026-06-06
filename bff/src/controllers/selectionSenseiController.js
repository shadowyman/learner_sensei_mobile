const { z } = require('zod');
const { sendError } = require('../utils/apiError');
const { llmCapPolicy } = require('../config');
const {
  buildSessionLimiterKey,
  validateSelectionSenseiCaps
} = require('../validation/llmCapValidation');

const TAG = 'SELECTION_SENSEI_CONTROLLER';

const SELECTION_POLICY = llmCapPolicy.capabilities?.selectionSensei || llmCapPolicy.selectionSensei;

const LIMITS = {
  selectedText: SELECTION_POLICY.selectedTextMaxChars,
  originalSenseiMessageText: SELECTION_POLICY.originalSenseiMessageMaxChars,
  actionLabel: SELECTION_POLICY.actionLabelMaxChars,
  userQuestion: SELECTION_POLICY.userMessageMaxChars,
  question: SELECTION_POLICY.userMessageMaxChars,
  modalConversationId: SELECTION_POLICY.modalConversationIdMaxChars,
  initialResponseTitle: SELECTION_POLICY.initialResponseTitleMaxChars,
  initialResponseField: SELECTION_POLICY.senseiEntryMaxChars,
  transcriptEntries: SELECTION_POLICY.transcriptMaxEntries,
  transcriptUserEntryText: SELECTION_POLICY.userMessageMaxChars,
  transcriptSenseiEntryText: SELECTION_POLICY.senseiEntryMaxChars,
  transcriptAggregate: SELECTION_POLICY.aggregateMaxChars,
  totalStructuredInput: SELECTION_POLICY.aggregateMaxChars
};

const LLM_ACTIONS = [
  'explainSimpler',
  'explainWithAnalogy',
  'explainInMoreDepth',
  'showAnExample',
  'showExampleCodeSnippet',
  'askQuestion'
];

const nonEmptyString = () => z.string().trim().min(1);

const InitialResponseSchema = z.object({
  suggestedTitle: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  rawText: z.string().trim().optional()
}).strict().superRefine((value, ctx) => {
  if (!value.suggestedTitle && !value.explanation && !value.rawText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Initial response must include suggestedTitle, explanation, or rawText.'
    });
  }
});

const TranscriptEntrySchema = z.object({
  role: z.enum(['user', 'sensei']),
  text: z.string().trim().min(1)
}).strict();

const ToolbarActionSchema = z.object({
  mode: z.literal('toolbarAction'),
  actionType: z.enum(LLM_ACTIONS),
  selectedText: nonEmptyString(),
  originalSenseiMessageText: nonEmptyString(),
  actionLabel: nonEmptyString(),
  userQuestion: z.string().trim().min(1).optional()
}).strict().superRefine((value, ctx) => {
  if (value.actionType === 'askQuestion' && !value.userQuestion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['userQuestion'],
      message: 'askQuestion requires userQuestion.'
    });
  }
  if (value.actionType !== 'askQuestion' && value.userQuestion !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['userQuestion'],
      message: 'userQuestion is only accepted for askQuestion.'
    });
  }
});

const FollowUpSchema = z.object({
  mode: z.literal('followUp'),
  modalConversationId: z.string().trim().min(1).optional(),
  selectedText: nonEmptyString(),
  originalSenseiMessageText: nonEmptyString(),
  initialActionType: z.enum(LLM_ACTIONS),
  initialActionLabel: nonEmptyString(),
  initialActionUserQuestion: z.string().trim().min(1).optional(),
  initialResponse: InitialResponseSchema,
  modalTranscript: z.array(TranscriptEntrySchema).optional(),
  question: nonEmptyString()
}).strict().superRefine((value, ctx) => {
  if (value.initialActionType !== 'askQuestion' && value.initialActionUserQuestion !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['initialActionUserQuestion'],
      message: 'initialActionUserQuestion is only accepted when the initial action was askQuestion.'
    });
  }
});

const SelectionSenseiModalPayloadSchema = z.union([
  ToolbarActionSchema,
  FollowUpSchema
]);

const toCoreRequest = (payload) => {
  if (payload.mode === 'toolbarAction') {
    return {
      mode: 'toolbarAction',
      actionType: payload.actionType,
      selectedText: payload.selectedText,
      originalSenseiMessageText: payload.originalSenseiMessageText,
      actionLabel: payload.actionLabel,
      userQuestion: payload.userQuestion
    };
  }
  return {
    mode: 'followUp',
    selectedText: payload.selectedText,
    originalSenseiMessageText: payload.originalSenseiMessageText,
    initialAction: {
      actionType: payload.initialActionType,
      actionLabel: payload.initialActionLabel,
      userQuestion: payload.initialActionUserQuestion
    },
    initialResponse: payload.initialResponse,
    transcript: (payload.modalTranscript || []).map((entry) => ({
      role: entry.role === 'sensei' ? 'assistant' : 'user',
      content: entry.text
    })),
    question: payload.question
  };
};

class SelectionSenseiController {
  constructor({ selectionSenseiService, sessionService, logger, selectionSenseiRateLimiter }) {
    this.selectionSenseiService = selectionSenseiService;
    this.sessionService = sessionService;
    this.logger = logger;
    this.selectionSenseiRateLimiter = selectionSenseiRateLimiter;
  }

  async postModalMessage(req, res) {
    const { sessionId } = req.params;
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session not found', { sessionId });
      return sendError(res, 400, 'BAD_REQUEST', 'Unknown session');
    }

    const parseResult = SelectionSenseiModalPayloadSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'payload invalid', {
        requestId: req.requestId,
        issues: parseResult.error.errors.map((issue) => ({
          code: issue.code,
          path: issue.path
        }))
      });
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid Selection Sensei modal payload');
    }

    const capResult = validateSelectionSenseiCaps(parseResult.data, SELECTION_POLICY);
    if (!capResult.success) {
      this.logger.warn(TAG, 'payload cap exceeded', {
        requestId: req.requestId,
        issues: capResult.issues.map((issue) => ({
          path: issue.path,
          maximum: issue.maximum,
          actual: issue.actual
        }))
      });
      return sendError(res, capResult.status, capResult.code, 'Invalid Selection Sensei modal payload');
    }

    if (this.selectionSenseiRateLimiter) {
      const limiterKey = buildSessionLimiterKey(sessionId, req.ip, req.get?.('User-Agent'));
      const rate = typeof this.selectionSenseiRateLimiter.checkKey === 'function'
        ? this.selectionSenseiRateLimiter.checkKey(limiterKey)
        : this.selectionSenseiRateLimiter.check(limiterKey, undefined);
      if (!rate.allowed) {
        this.logger.warn(TAG, 'rate limited', { sessionId, ip: req.ip, requestId: req.requestId });
        res.set('Retry-After', String(rate.retryAfterSeconds || 60));
        return sendError(res, 429, 'RATE_LIMITED', 'Too many Selection Sensei requests—wait a bit before trying again.');
      }
    }

    try {
      const result = await this.selectionSenseiService.runModalMessage({
        session,
        request: toCoreRequest(capResult.payload)
      });
      if (!result?.ok) {
        const status = result?.errorCode === 'missing_llm' ? 503 : 502;
        return sendError(res, status, 'SELECTION_SENSEI_MODAL_FAILED', 'Unable to generate Selection Sensei response');
      }
      return res.status(200).json({
        success: true,
        result: {
          suggestedTitle: result.suggestedTitle,
          explanation: result.explanation,
          rawText: result.rawText
        }
      });
    } catch (error) {
      this.logger.error(TAG, 'generation failure', { sessionId, message: error?.message });
      return sendError(res, 500, 'SELECTION_SENSEI_MODAL_FAILED', 'Unable to generate Selection Sensei response');
    }
  }
}

module.exports = {
  SelectionSenseiController,
  LIMITS,
  toCoreRequest
};

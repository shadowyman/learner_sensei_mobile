const SelectionSenseiService = require('../src/services/selectionSenseiService');
const GeminiGateway = require('../src/integration/geminiGateway');
const { SelectionSenseiController, toCoreRequest } = require('../src/controllers/selectionSenseiController');

;(async () => {
  const calls = [];
  const service = new SelectionSenseiService({
    logger: {
      info() {},
      warn() {},
      error() {}
    },
    coreLlmClient: {
      async callText(prompt, options) {
        calls.push({ prompt, options });
        return JSON.stringify({
          suggestedTitle: 'Base Case',
          explanation: 'A base case stops recursion.'
        });
      }
    }
  });

  const result = await service.runModalMessage({
    session: { id: 'session-selection-sensei' },
    request: {
      mode: 'toolbarAction',
      actionType: 'explainSimpler',
      selectedText: 'base case stops recursion',
      originalSenseiMessageText: 'Original Sensei context about recursion.',
      actionLabel: 'Simpler'
    }
  });

  if (!result?.ok) {
    throw new Error(`Expected service success, got ${JSON.stringify(result)}`);
  }
  if (result.suggestedTitle !== 'Base Case' || result.explanation !== 'A base case stops recursion.') {
    throw new Error(`Unexpected normalized service result: ${JSON.stringify(result)}`);
  }
  if (calls.length !== 1 || calls[0].options?.task !== 'selection_sensei_modal') {
    throw new Error(`Expected one Core LLM call for selection_sensei_modal, got ${JSON.stringify(calls)}`);
  }
  if (calls[0].prompt.includes('client final prompt')) {
    throw new Error('Service must not require or forward client final prompt strings');
  }

  const translated = toCoreRequest({
    mode: 'followUp',
    modalConversationId: 'modal-correlation-only',
    selectedText: 'base case',
    originalSenseiMessageText: 'Original context',
    initialActionType: 'askQuestion',
    initialActionLabel: 'Ask',
    initialActionUserQuestion: 'Why does this stop recursion?',
    initialResponse: {
      suggestedTitle: 'Base Case',
      explanation: 'A base case stops the recursive calls.'
    },
    modalTranscript: [
      { role: 'user', text: 'Can you explain this simply?' },
      { role: 'sensei', text: 'A base case is the stop condition.' }
    ],
    question: 'How does that prevent an infinite loop?'
  });
  if (translated.mode !== 'followUp' || translated.initialAction.actionType !== 'askQuestion') {
    throw new Error(`Unexpected follow-up translation: ${JSON.stringify(translated)}`);
  }
  if (translated.modalConversationId !== undefined) {
    throw new Error('modalConversationId must remain BFF correlation metadata and not enter Core prompt input');
  }
  if (translated.transcript[1].role !== 'assistant') {
    throw new Error(`Expected sensei transcript role to map to assistant, got ${translated.transcript[1].role}`);
  }
  if (translated.initialAction.userQuestion !== 'Why does this stop recursion?') {
    throw new Error(`Expected original ask question to reach Core initial action, got ${JSON.stringify(translated.initialAction)}`);
  }
  if (translated.transcript[0].content !== 'Can you explain this simply?' || translated.transcript[1].content !== 'A base case is the stop condition.') {
    throw new Error(`Expected transcript text to map to Core content, got ${JSON.stringify(translated.transcript)}`);
  }
  if (Object.prototype.hasOwnProperty.call(translated.transcript[0], 'text')) {
    throw new Error(`Core transcript entries must not retain BFF text field: ${JSON.stringify(translated.transcript)}`);
  }

  const followUpResult = await service.runModalMessage({
    session: { id: 'session-selection-sensei' },
    request: translated
  });
  if (!followUpResult?.ok) {
    throw new Error(`Expected follow-up service success, got ${JSON.stringify(followUpResult)}`);
  }
  const followUpPrompt = calls[1]?.prompt || '';
  if (!followUpPrompt.includes('Original Ask Question: Why does this stop recursion?')) {
    throw new Error(`Follow-up prompt did not preserve original ask question: ${followUpPrompt}`);
  }
  if (!followUpPrompt.includes('User: Can you explain this simply?') || !followUpPrompt.includes('Assistant: A base case is the stop condition.')) {
    throw new Error(`Follow-up prompt did not preserve transcript content: ${followUpPrompt}`);
  }
  if (followUpPrompt.includes('undefined')) {
    throw new Error(`Follow-up prompt rendered undefined transcript or ask context: ${followUpPrompt}`);
  }

  const controllerCalls = [];
  const controller = new SelectionSenseiController({
    selectionSenseiService: {
      async runModalMessage(input) {
        controllerCalls.push(input);
        return {
          ok: true,
          suggestedTitle: 'Controller Success',
          explanation: 'Structured request reached the Selection Sensei service.',
          rawText: '{"suggestedTitle":"Controller Success","explanation":"Structured request reached the Selection Sensei service."}'
        };
      }
    },
    sessionService: {
      getSession(sessionId) {
        return sessionId === 'session-route' ? { id: sessionId } : null;
      }
    },
    logger: {
      info() {},
      warn() {},
      error() {}
    }
  });
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {
      return this;
    }
  };
  await controller.postModalMessage({
    params: { sessionId: 'session-route' },
    requestId: 'request-controller',
    body: {
      mode: 'toolbarAction',
      actionType: 'askQuestion',
      selectedText: 'base case',
      originalSenseiMessageText: 'Original context',
      actionLabel: 'Ask',
      userQuestion: 'Why does this stop recursion?'
    }
  }, response);
  if (response.statusCode !== 200 || response.body?.success !== true) {
    throw new Error(`Expected controller success response, got ${response.statusCode} ${JSON.stringify(response.body)}`);
  }
  if (controllerCalls.length !== 1 || controllerCalls[0].request.actionType !== 'askQuestion') {
    throw new Error(`Expected controller to call service with structured ask request, got ${JSON.stringify(controllerCalls)}`);
  }
  if (Object.prototype.hasOwnProperty.call(controllerCalls[0].request, 'prompt')) {
    throw new Error('Controller must not synthesize or accept final prompt fields in the BFF request object');
  }

  const limitedServiceCalls = [];
  let limiterCalls = 0;
  const limitedController = new SelectionSenseiController({
    selectionSenseiService: {
      async runModalMessage(input) {
        limitedServiceCalls.push(input);
        return {
          ok: true,
          suggestedTitle: 'Allowed',
          explanation: 'First valid request passed the limiter.'
        };
      }
    },
    sessionService: {
      getSession(sessionId) {
        return { id: sessionId };
      }
    },
    selectionSenseiRateLimiter: {
      check() {
        limiterCalls += 1;
        return limiterCalls === 1
          ? { allowed: true, retryAfterSeconds: 0 }
          : { allowed: false, retryAfterSeconds: 20 };
      }
    },
    logger: {
      info() {},
      warn() {},
      error() {}
    }
  });
  const createResponse = () => ({
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    }
  });
  const limitedReq = {
    params: { sessionId: 'session-rate' },
    requestId: 'request-rate',
    ip: '127.0.0.1',
    get(name) {
      return name === 'User-Agent' ? 'selection-sensei-rate-test' : undefined;
    },
    body: {
      mode: 'toolbarAction',
      actionType: 'explainSimpler',
      selectedText: 'base case',
      originalSenseiMessageText: 'Original context',
      actionLabel: 'Simpler'
    }
  };
  const firstLimitedResponse = createResponse();
  await limitedController.postModalMessage(limitedReq, firstLimitedResponse);
  const secondLimitedResponse = createResponse();
  await limitedController.postModalMessage(limitedReq, secondLimitedResponse);
  if (firstLimitedResponse.statusCode !== 200 || secondLimitedResponse.statusCode !== 429) {
    throw new Error(`Expected first limiter request 200 and second 429, got ${firstLimitedResponse.statusCode}/${secondLimitedResponse.statusCode}`);
  }
  if (limitedServiceCalls.length !== 1) {
    throw new Error(`Rate-limited request must not call provider service, got ${limitedServiceCalls.length} service calls`);
  }
  if (secondLimitedResponse.headers['Retry-After'] !== '20') {
    throw new Error(`Expected Retry-After 20, got ${JSON.stringify(secondLimitedResponse.headers)}`);
  }

  let observedGenerateContent = null;
  const gateway = Object.create(GeminiGateway.prototype);
  gateway.logger = {
    info() {},
    warn() {},
    error() {}
  };
  gateway.config = {
    gemini: {
      mainModel: 'main-model-should-not-be-used'
    }
  };
  gateway.modelName = 'main-model-should-not-be-used';
  gateway.temperature = 0.7;
  gateway.timeoutMs = 180000;
  gateway.clientPromise = Promise.resolve({
    models: {
      async generateContent(params) {
        observedGenerateContent = params;
        return { text: () => '{"suggestedTitle":"Configured","explanation":"JSON task config used."}' };
      }
    }
  });

  const gatewayText = await gateway.callText('Selection Sensei prompt', { task: 'selection_sensei_modal' });
  if (!gatewayText.includes('Configured')) {
    throw new Error(`Unexpected gateway text: ${gatewayText}`);
  }
  if (observedGenerateContent?.model !== 'gemini-flash-latest') {
    throw new Error(`Expected Selection Sensei model, got ${observedGenerateContent?.model}`);
  }
  if (observedGenerateContent?.config?.temperature !== 0.5) {
    throw new Error(`Expected temperature 0.5, got ${observedGenerateContent?.config?.temperature}`);
  }
  if (observedGenerateContent?.config?.responseMimeType !== 'application/json') {
    throw new Error(`Expected JSON response MIME type, got ${observedGenerateContent?.config?.responseMimeType}`);
  }

  console.log('selection sensei modal service/model routing test passed');
})();

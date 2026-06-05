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

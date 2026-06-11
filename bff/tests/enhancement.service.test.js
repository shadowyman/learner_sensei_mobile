const EnhancementService = require('../src/services/enhancementService');
const { EnhancementController } = require('../src/controllers/enhancementController');
const GeminiGateway = require('../src/integration/geminiGateway');

;(async () => {
  const calls = [];
  const service = new EnhancementService({
    logger: {
      info() {},
      warn() {},
      error() {}
    },
    coreLlmClient: {
      async callText(prompt, options) {
        calls.push({ prompt, options });
        return JSON.stringify({
          enhancements: [
            {
              key: 'A base case stops the recursive chain.',
              value: 'This gives recursion a concrete stopping condition.',
              insertType: 'append'
            }
          ],
          metadata: { source: 'fixture' }
        });
      }
    }
  });

  const result = await service.runEnhancement({
    session: { id: 'session-enhancement' },
    request: {
      originalMarkdown: 'A base case stops the recursive chain.',
      wordCount: 8
    }
  });

  if (!result?.ok) {
    throw new Error(`Expected service success, got ${JSON.stringify(result)}`);
  }
  if (!Array.isArray(result.enhancements) || result.enhancements.length !== 1) {
    throw new Error(`Expected normalized enhancements, got ${JSON.stringify(result)}`);
  }
  if (result.renderedMarkdown || result.markdown || result.finalMarkdown) {
    throw new Error(`Enhancement service must not return rendered markdown: ${JSON.stringify(result)}`);
  }
  if (calls.length !== 1 || calls[0].options?.task !== 'sensei_enhancement') {
    throw new Error(`Expected one Core LLM call for sensei_enhancement, got ${JSON.stringify(calls)}`);
  }
  if (calls[0].prompt.includes('client final prompt') || calls[0].prompt.includes('providerOptions')) {
    throw new Error('Service must not require or forward client final prompt/provider-control strings');
  }

  const {
    SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES,
    SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS,
    SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS
  } = require('@sensei/core/llmCapPolicy');
  const cappedService = new EnhancementService({
    logger: {
      info() {},
      warn() {},
      error() {}
    },
    coreLlmClient: {
      async callText() {
        return JSON.stringify({
          enhancements: [
            {
              key: 'x'.repeat(SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS + 1),
              value: 'oversized key',
              insertType: 'append'
            },
            {
              key: 'oversized value',
              value: 'x'.repeat(SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS + 1),
              insertType: 'append'
            },
            ...Array.from({ length: SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES + 5 }, (_, index) => ({
              key: `Valid key ${index}.`,
              value: `Valid value ${index}.`,
              insertType: 'append'
            }))
          ],
          metadata: { source: 'fixture' }
        });
      }
    }
  });
  const cappedResult = await cappedService.runEnhancement({
    session: { id: 'session-enhancement' },
    request: {
      originalMarkdown: 'A base case stops the recursive chain.',
      wordCount: 8
    }
  });
  if (!cappedResult?.ok || cappedResult.enhancements.length !== SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES) {
    throw new Error(`Expected capped provider output, got ${JSON.stringify(cappedResult)}`);
  }
  if (JSON.stringify(cappedResult).includes('oversized key') || JSON.stringify(cappedResult).includes('oversized value')) {
    throw new Error(`Provider output caps leaked oversized entries: ${JSON.stringify(cappedResult)}`);
  }

  const malformedService = new EnhancementService({
    logger: {
      info() {},
      warn() {},
      error() {}
    },
    coreLlmClient: {
      async callText() {
        return '{"enhancements": [';
      }
    }
  });
  const malformedResult = await malformedService.runEnhancement({
    session: { id: 'session-enhancement' },
    request: {
      originalMarkdown: 'A base case stops the recursive chain.'
    }
  });
  if (malformedResult?.ok !== false || malformedResult.errorCode !== 'provider_error') {
    throw new Error(`Expected malformed provider output to return generic failure, got ${JSON.stringify(malformedResult)}`);
  }
  if (JSON.stringify(malformedResult).includes('{"enhancements": [') || JSON.stringify(malformedResult).includes('A base case stops')) {
    throw new Error(`Failure result leaked provider text or learner markdown: ${JSON.stringify(malformedResult)}`);
  }

  const providerFailingService = new EnhancementService({
    logger: {
      info() {},
      warn() {},
      error() {}
    },
    coreLlmClient: {
      async callText() {
        throw new Error('provider secret raw failure');
      }
    }
  });
  const providerFailure = await providerFailingService.runEnhancement({
    session: { id: 'session-enhancement' },
    request: {
      originalMarkdown: 'A base case stops the recursive chain.'
    }
  });
  if (providerFailure?.ok !== false || providerFailure.errorCode !== 'provider_error') {
    throw new Error(`Expected provider failure to return generic failure, got ${JSON.stringify(providerFailure)}`);
  }
  if (JSON.stringify(providerFailure).includes('provider secret raw failure') || JSON.stringify(providerFailure).includes('A base case stops')) {
    throw new Error(`Provider failure leaked raw error or learner markdown: ${JSON.stringify(providerFailure)}`);
  }

  const controllerCalls = [];
  let limiterCalls = 0;
  const controller = new EnhancementController({
    enhancementService: {
      async runEnhancement(input) {
        controllerCalls.push(input);
        return {
          ok: true,
          enhancements: [],
          metadata: { source: 'controller' }
        };
      }
    },
    sessionService: {
      getSession(sessionId) {
        return sessionId === 'session-route' ? { id: sessionId } : null;
      }
    },
    enhancementRateLimiter: {
      checkKey(key) {
        limiterCalls += 1;
        return { allowed: true, retryAfterSeconds: 0, key };
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
  };
  await controller.postEnhancement({
    params: { sessionId: 'session-route' },
    requestId: 'request-enhancement',
    ip: '127.0.0.1',
    get(name) {
      return name === 'User-Agent' ? 'enhancement-service-test' : undefined;
    },
    body: {
      originalMarkdown: 'A base case stops the recursive chain.',
      wordCount: 8
    }
  }, response);
  if (response.statusCode !== 200 || response.body?.success !== true) {
    throw new Error(`Expected controller success response, got ${response.statusCode} ${JSON.stringify(response.body)}`);
  }
  if (controllerCalls.length !== 1 || controllerCalls[0].request.originalMarkdown !== 'A base case stops the recursive chain.') {
    throw new Error(`Expected controller to call service with structured request, got ${JSON.stringify(controllerCalls)}`);
  }
  if (Object.prototype.hasOwnProperty.call(controllerCalls[0].request, 'prompt')) {
    throw new Error('Controller must not synthesize or accept final prompt fields in the BFF request object');
  }
  if (limiterCalls !== 1) {
    throw new Error(`Expected enhancement rate limiter to be checked before provider execution, got ${limiterCalls}`);
  }
  if (JSON.stringify(response.body).includes('provider secret') || JSON.stringify(response.body).includes('client final prompt')) {
    throw new Error(`Controller response leaked provider or prompt internals: ${JSON.stringify(response.body)}`);
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
        return { text: () => '{"enhancements":[],"metadata":{}}' };
      }
    }
  });

  await gateway.callText('Sensei enhancement prompt', {
    task: 'sensei_enhancement'
  });
  if (observedGenerateContent?.model === 'main-model-should-not-be-used') {
    throw new Error('Expected sensei_enhancement to use an enhancement-specific Gemini task config, not the default main model');
  }
  if (observedGenerateContent?.config?.responseMimeType !== 'application/json') {
    throw new Error(`Expected JSON response MIME type, got ${JSON.stringify(observedGenerateContent?.config)}`);
  }

  console.log('enhancement service/model routing test passed');
})();

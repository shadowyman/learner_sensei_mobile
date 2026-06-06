const SessionController = require('../src/controllers/sessionController');
const RateLimiter = require('../src/infra/rateLimiter');
const config = require('../src/config');
const SenseiCoreAdapter = require('../src/integration/senseiCoreAdapter');
const GeminiGateway = require('../src/integration/geminiGateway');
const { SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS } = require('@sensei/core/prompts/baseSensei');

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

const createReq = ({ sessionId, body, ip = '127.0.0.1', userAgent = 'main-sensei-policy-test' }) => ({
  params: { sessionId },
  body,
  ip,
  protocol: 'http',
  requestId: `req-${sessionId}`,
  get(name) {
    if (name === 'User-Agent') return userAgent;
    if (name === 'host') return '127.0.0.1:8787';
    return undefined;
  }
});

const createController = ({ rateLimiter, acceptedStreams }) => new SessionController({
  sessionService: {
    getSession(sessionId) {
      return { id: sessionId };
    }
  },
  turnService: {
    createOrGetTurn(sessionId, clientTurnId, input) {
      return {
        turn: {
          id: `turn-${clientTurnId}`,
          sessionId,
          input: input.input,
          metadata: input.metadata
        },
        isReplay: false
      };
    }
  },
  rateLimiter,
  logger: {
    info() {},
    warn() {},
    error() {}
  },
  streamingService: {
    createLlmStreamRequest(input) {
      acceptedStreams.push(input);
      return {
        requestId: `llm-${acceptedStreams.length}`,
        capability: input.capability
      };
    }
  },
  config
});

const validTurnBody = (id) => ({
  clientTurnId: id,
  input: { text: 'Please explain base cases.' },
  metadata: { source: 'mobile' }
});

const validLlmStreamBody = (messageId, overrides = {}) => ({
  capability: 'mainSenseiResponse',
  messageId,
  payload: {
    curriculumFocus: { status: 'general' },
    currentUserInput: 'Can you continue?',
    ...overrides
  },
  metadata: { source: 'mobile' }
});

const collectText = async (iterable) => {
  let output = '';
  for await (const chunk of iterable) {
    output += chunk.text;
  }
  return output;
};

;(async () => {
  const acceptedStreams = [];
  const turnController = createController({
    rateLimiter: new RateLimiter(config.rateLimit),
    acceptedStreams
  });

  const turnResponses = [];
  for (let index = 0; index < 3; index += 1) {
    const res = createResponse();
    turnController.submitTurn(createReq({
      sessionId: 'session-main-a',
      body: validTurnBody(`a-${index}`)
    }), res);
    turnResponses.push(res.statusCode);
  }
  const separateTurnRes = createResponse();
  turnController.submitTurn(createReq({
    sessionId: 'session-main-b',
    body: validTurnBody('b-0')
  }), separateTurnRes);
  const limitedTurnRes = createResponse();
  turnController.submitTurn(createReq({
    sessionId: 'session-main-a',
    body: validTurnBody('a-3')
  }), limitedTurnRes);

  if (turnResponses.join('/') !== '200/200/200' || separateTurnRes.statusCode !== 200 || limitedTurnRes.statusCode !== 429) {
    throw new Error(`Expected turn statuses 200/200/200/200/429, got ${turnResponses.join('/')}/${separateTurnRes.statusCode}/${limitedTurnRes.statusCode}`);
  }

  const oversizedTurnRes = createResponse();
  turnController.submitTurn(createReq({
    sessionId: 'session-main-c',
    body: {
      ...validTurnBody('oversized-turn'),
      input: { text: 'x'.repeat(config.llmBoundaryPolicy.mainSensei.userMessageMaxChars + 1) }
    }
  }), oversizedTurnRes);
  if (oversizedTurnRes.statusCode !== 413) {
    throw new Error(`Expected oversized turn input to be rejected with 413, got ${oversizedTurnRes.statusCode}`);
  }

  const streamController = createController({
    rateLimiter: new RateLimiter(config.rateLimit),
    acceptedStreams
  });
  const longSenseiHistory = 's'.repeat(120000);
  const streamRes = createResponse();
  streamController.submitLlmStream(createReq({
    sessionId: 'session-stream-a',
    body: validLlmStreamBody('stream-long-history', {
      conversationHistory: [
        { role: 'user', content: 'Can you explain this?' },
        { role: 'sensei', content: longSenseiHistory }
      ]
    })
  }), streamRes);
  if (streamRes.statusCode !== 200) {
    throw new Error(`Expected long Sensei history stream request to be accepted, got ${streamRes.statusCode}`);
  }
  const acceptedPayload = acceptedStreams[0]?.payload;
  if (acceptedPayload?.conversationHistory?.[1]?.content.length !== longSenseiHistory.length) {
    throw new Error(`Expected long Sensei history to survive policy bounds, got ${acceptedPayload?.conversationHistory?.[1]?.content.length}`);
  }

  const oversizedStreamRes = createResponse();
  streamController.submitLlmStream(createReq({
    sessionId: 'session-stream-b',
    body: validLlmStreamBody('stream-oversized-user', {
      currentUserInput: 'u'.repeat(config.llmBoundaryPolicy.mainSensei.userMessageMaxChars + 1)
    })
  }), oversizedStreamRes);
  if (oversizedStreamRes.statusCode !== 413) {
    throw new Error(`Expected oversized stream user input to be rejected with 413, got ${oversizedStreamRes.statusCode}`);
  }

  const streamRateResponses = [];
  const rateController = createController({
    rateLimiter: new RateLimiter(config.rateLimit),
    acceptedStreams: []
  });
  for (let index = 0; index < 3; index += 1) {
    const res = createResponse();
    rateController.submitLlmStream(createReq({
      sessionId: 'session-stream-rate-a',
      body: validLlmStreamBody(`stream-rate-${index}`)
    }), res);
    streamRateResponses.push(res.statusCode);
  }
  const separateStreamRes = createResponse();
  rateController.submitLlmStream(createReq({
    sessionId: 'session-stream-rate-b',
    body: validLlmStreamBody('stream-rate-other')
  }), separateStreamRes);
  const limitedStreamRes = createResponse();
  rateController.submitLlmStream(createReq({
    sessionId: 'session-stream-rate-a',
    body: validLlmStreamBody('stream-rate-limited')
  }), limitedStreamRes);
  if (streamRateResponses.join('/') !== '200/200/200' || separateStreamRes.statusCode !== 200 || limitedStreamRes.statusCode !== 429) {
    throw new Error(`Expected stream statuses 200/200/200/200/429, got ${streamRateResponses.join('/')}/${separateStreamRes.statusCode}/${limitedStreamRes.statusCode}`);
  }

  const adapter = new SenseiCoreAdapter({
    logger: { info() {}, warn() {}, error() {} },
    config
  });
  const providerInput = await adapter.buildCapabilityPrompt({
    requestId: 'main-provider-envelope',
    capability: 'mainSenseiResponse',
    payload: validLlmStreamBody('provider-envelope').payload
  });
  if (typeof providerInput !== 'object' || !providerInput.prompt || providerInput.systemInstruction !== SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS) {
    throw new Error(`Expected adapter to return prompt plus base systemInstruction, got ${JSON.stringify(providerInput)}`);
  }
  if (providerInput.prompt.includes(SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS) || providerInput.prompt.includes('[RecursiveSensei Base System Instruction]')) {
    throw new Error('Main Sensei BFF provider prompt must not flatten the base persona into prompt text');
  }

  let observedStreamRequest = null;
  const gateway = Object.create(GeminiGateway.prototype);
  gateway.logger = { info() {}, warn() {}, error() {} };
  gateway.config = config;
  gateway.modelName = 'main-model';
  gateway.temperature = 0.7;
  gateway.timeoutMs = 180000;
  gateway.clientPromise = Promise.resolve({
    models: {
      async generateContentStream(params) {
        observedStreamRequest = params;
        return (async function* () {
          yield { text: () => 'streamed main response' };
        })();
      }
    }
  });
  const streamed = await collectText(gateway.streamMainResponse(providerInput.prompt, {
    context: { turn: { id: 'turn-provider-envelope' } },
    systemInstruction: providerInput.systemInstruction
  }));
  if (streamed !== 'streamed main response') {
    throw new Error(`Expected gateway stream text, got ${streamed}`);
  }
  if (observedStreamRequest?.config?.systemInstruction !== SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS) {
    throw new Error(`Expected main base persona in Gemini systemInstruction, got ${JSON.stringify(observedStreamRequest?.config)}`);
  }
  if (observedStreamRequest?.contents?.[0]?.parts?.[0]?.text?.includes(SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS)) {
    throw new Error('Main Sensei Gemini contents must not include the base persona text');
  }

  console.log('main sensei boundary policy test passed');
})();

const GeminiGateway = require('../src/integration/geminiGateway');

const collectText = async (stream) => {
  let text = '';
  for await (const chunk of stream) {
    text += chunk.text;
  }
  return text;
};

const makeGateway = (generateContentStream) => {
  const gateway = Object.create(GeminiGateway.prototype);
  gateway.logger = {
    info() {},
    warn() {},
    error() {}
  };
  gateway.modelName = 'gemini-test-model';
  gateway.temperature = 0.7;
  gateway.timeoutMs = 1000;
  gateway.clientPromise = Promise.resolve({
    models: {
      generateContentStream: generateContentStream || (async () => {
        const error = new Error('provider exhausted');
        error.code = 429;
        throw error;
      })
    }
  });
  return gateway;
};

;(async () => {
  const prompt = 'test prompt';
  const context = {
    capability: 'mainSenseiResponse',
    messageId: 'msg-fallback',
    turn: {
      id: 'turn-fallback',
      input: {
        text: "I don't understand problem decomposition"
      }
    }
  };

  const fallbackText = await collectText(makeGateway().streamMainResponse(prompt, {
    context,
    allowFallback: true
  }));

  const expected = "Sensei services are currently degraded. We're working on this issue, and if this issue persists, please report it to us using the Feedback button in the header menu.";
  if (fallbackText !== expected) {
    throw new Error(`Unexpected fallback text: ${fallbackText}`);
  }
  if (fallbackText.includes(context.turn.input.text)) {
    throw new Error('Fallback text must not echo the learner prompt');
  }

  let threw = false;
  try {
    await collectText(makeGateway().streamMainResponse(prompt, {
      context,
      allowFallback: false
    }));
  } catch (error) {
    threw = error.code === 429;
  }
  if (!threw) {
    throw new Error('Expected strict provider mode to throw the provider error');
  }

  const abortController = new AbortController();
  abortController.abort();
  const abortedText = await collectText(makeGateway().streamMainResponse(prompt, {
    context,
    allowFallback: true,
    signal: abortController.signal
  }));
  if (abortedText !== '') {
    throw new Error(`Expected aborted stream to produce no fallback text, got: ${abortedText}`);
  }

  const activeAbortController = new AbortController();
  let observedAbortSignal = null;
  const signalGateway = makeGateway(async (params) => {
    observedAbortSignal = params?.config?.abortSignal;
    return (async function* () {
      yield { text: () => 'ok' };
    })();
  });
  const signalText = await collectText(signalGateway.streamMainResponse(prompt, {
    context,
    allowFallback: false,
    signal: activeAbortController.signal
  }));
  if (signalText !== 'ok') {
    throw new Error(`Expected provider stream text, got: ${signalText}`);
  }
  if (observedAbortSignal !== activeAbortController.signal) {
    throw new Error('Expected Gemini stream config to receive the request abort signal');
  }

  console.log('gemini gateway fallback behavior test passed');
})();

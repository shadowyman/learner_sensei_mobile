const WebSocket = require('ws');
const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readStreamEvents = (streamUrl) => new Promise((resolve, reject) => {
  const ws = new WebSocket(streamUrl);
  const events = [];
  const timeout = setTimeout(() => {
    try {
      ws.close();
    } catch (_) {}
    reject(new Error('Timed out waiting for deterministic LLM stream completion'));
  }, 10_000);

  ws.on('message', (raw) => {
    let event;
    try {
      event = JSON.parse(String(raw));
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
      return;
    }
    events.push(event);
    if (event.type === 'error') {
      clearTimeout(timeout);
      try {
        ws.close();
      } catch (_) {}
      reject(new Error(`LLM stream error ${event.code}: ${event.message}`));
    }
    if (event.type === 'status' && event.phase === 'completed') {
      clearTimeout(timeout);
      try {
        ws.close();
      } catch (_) {}
      resolve(events);
    }
  });

  ws.on('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    const completed = events.some((event) => event.type === 'status' && event.phase === 'completed');
    if (!completed) {
      reject(new Error(`LLM stream closed before completion: ${JSON.stringify(events)}`));
    }
  });
});

const postJson = (base, path, body) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'llm-stream-deterministic-int-test' },
  body: JSON.stringify(body)
});

const createSession = async (base) => {
  const res = await postJson(base, '/sessions', { topicId: 'c++_recursive_mastery' });
  if (!res.ok) {
    throw new Error(`Session creation failed with HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.sessionId) {
    throw new Error(`Session creation missing sessionId: ${JSON.stringify(body)}`);
  }
  return body.sessionId;
};

const assertRejected = async (base, sessionId, body, expectedMessage) => {
  const res = await postJson(base, `/sessions/${encodeURIComponent(sessionId)}/llm-stream`, body);
  if (res.status !== 400) {
    throw new Error(`Expected 400 for ${expectedMessage}, got HTTP ${res.status}`);
  }
  const errorBody = await res.json();
  if (errorBody.code !== 'BAD_REQUEST') {
    throw new Error(`Expected BAD_REQUEST for ${expectedMessage}, got ${JSON.stringify(errorBody)}`);
  }
};

const assertAcceptedStream = async (base, sessionId, body, expectedText) => {
  const res = await postJson(base, `/sessions/${encodeURIComponent(sessionId)}/llm-stream`, body);
  if (!res.ok) {
    throw new Error(`Expected 200 for ${body.capability}/${body.messageId}, got HTTP ${res.status}`);
  }
  const accepted = await res.json();
  if (!accepted.requestId || !accepted.streamUrl) {
    throw new Error(`LLM stream acceptance missing fields: ${JSON.stringify(accepted)}`);
  }
  const events = await readStreamEvents(accepted.streamUrl);
  const started = events.find((event) => event.type === 'status' && event.phase === 'started');
  const completed = events.find((event) => event.type === 'status' && event.phase === 'completed');
  const chunks = events.filter((event) => event.type === 'chunk');
  if (!started || !completed || chunks.length < 2) {
    throw new Error(`Expected started, chunks, completed for ${body.messageId}: ${JSON.stringify(events)}`);
  }
  for (const event of [started, completed, ...chunks]) {
    if (event.requestId !== accepted.requestId) {
      throw new Error(`Expected requestId ${accepted.requestId}, got ${event.requestId}`);
    }
    if (event.messageId !== body.messageId) {
      throw new Error(`Expected messageId ${body.messageId}, got ${event.messageId}`);
    }
    if (event.capability !== body.capability) {
      throw new Error(`Expected capability ${body.capability}, got ${event.capability}`);
    }
  }
  const text = chunks.map((event) => event.text).join('');
  if (!text.includes(expectedText)) {
    throw new Error(`Expected deterministic text marker ${expectedText}, got ${text}`);
  }
  return { accepted, text };
};

;(async () => {
  const { server, container } = startServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.on('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8787;
  const BASE = `http://127.0.0.1:${port}`;
  const prompts = [];
  const shutdown = async () => new Promise((resolve) => server.close(() => resolve()));

  container.geminiGateway.streamMainResponse = async function* streamMainResponse(prompt, { context, allowFallback }) {
    prompts.push({
      capability: context.capability,
      messageId: context.messageId,
      prompt,
      allowFallback
    });
    yield { text: `deterministic:${context.capability}:${context.messageId}:` };
    yield { text: prompt.slice(0, 80) };
  };

  try {
    const sessionId = await createSession(BASE);
    const originalHardStreamTimeoutMs = container.streamingService.config.hardStreamTimeoutMs;
    container.streamingService.config.hardStreamTimeoutMs = 20;
    const unclaimed = container.streamingService.createLlmStreamRequest({
      sessionId,
      capability: 'moduleIntroduction',
      messageId: 'msg-unclaimed-expiry',
      payload: {
        selectedModuleTitle: 'Module Alpha',
        firstConceptTitle: 'Base Case',
        phaseDisplayName: 'IntroIllustrate',
        userInputText: 'Phase: IntroIllustrate',
        curriculumFocusInstruction: 'Focus on base cases.'
      },
      metadata: { source: 'bff-deterministic-int-test' },
      options: {}
    });
    await sleep(60);
    container.streamingService.config.hardStreamTimeoutMs = originalHardStreamTimeoutMs;
    if (container.streamingService.llmStreamRequests.has(unclaimed.requestId)) {
      throw new Error(`Expected unclaimed LLM stream request to expire: ${unclaimed.requestId}`);
    }

    await assertRejected(BASE, sessionId, {
      capability: 'moduleIntroduction',
      payload: {
        selectedModuleTitle: 'Module',
        firstConceptTitle: 'Concept',
        phaseDisplayName: 'IntroIllustrate',
        userInputText: 'Phase',
        curriculumFocusInstruction: 'Focus'
      }
    }, 'missing messageId');

    await assertRejected(BASE, sessionId, {
      capability: 'moduleIntroduction',
      messageId: 'msg-bad-intro',
      payload: {
        selectedModuleTitle: 'Module'
      }
    }, 'malformed module introduction payload');

    await assertRejected(BASE, sessionId, {
      capability: 'mainSenseiResponse',
      messageId: 'msg-bad-standard',
      payload: {
        currentUserInput: 'What is recursion?'
      }
    }, 'malformed standard main response payload');

    await assertRejected(BASE, sessionId, {
      capability: 'mainSenseiResponse',
      messageId: 'msg-bad-socratic',
      payload: {
        mode: 'socratic',
        currentUserInput: 'I am stuck'
      }
    }, 'malformed Socratic main response payload');

    await assertAcceptedStream(BASE, sessionId, {
      capability: 'moduleIntroduction',
      messageId: 'msg-intro-deterministic',
      payload: {
        selectedModuleTitle: 'Module Alpha',
        firstConceptTitle: 'Base Case',
        phaseDisplayName: 'IntroIllustrate',
        userInputText: 'Phase: IntroIllustrate',
        curriculumFocusInstruction: 'Focus on base cases.',
        moduleTitleForPrompt: 'Module Alpha'
      }
    }, 'deterministic:moduleIntroduction:msg-intro-deterministic');

    await assertAcceptedStream(BASE, sessionId, {
      capability: 'mainSenseiResponse',
      messageId: 'msg-standard-deterministic',
      payload: {
        mode: 'standard',
        curriculumFocusInstruction: '## Primary Action\nExplain base cases.\n__PEDAGOGICAL_GUIDANCE__',
        pedagogicalGuidanceDirective: 'GUIDE: Stay concise.',
        currentUserInput: 'How do base cases stop recursion?',
        navigationContext: 'The learner is in Module Alpha.'
      }
    }, 'deterministic:mainSenseiResponse:msg-standard-deterministic');

    await assertAcceptedStream(BASE, sessionId, {
      capability: 'mainSenseiResponse',
      messageId: 'msg-socratic-deterministic',
      payload: {
        mode: 'socratic',
        teachingPlan: [[{
          text: 'Ask why the base case stops recursive calls.',
          interactionGuidance: {
            expectedTurns: 2,
            completionTriggers: ['learner explains base case'],
            turnManagement: 'Ask one question at a time.'
          },
          socraticMetadata: {
            detectedCategory: 'GENERAL_CONCEPT'
          }
        }]],
        pedagogicalGuidance: {
          directive: 'Use short probing questions.'
        },
        isSystemInitialization: false,
        currentUserInput: 'I do not understand the base case.'
      }
    }, 'deterministic:mainSenseiResponse:msg-socratic-deterministic');

    const introPrompt = prompts.find((entry) => entry.messageId === 'msg-intro-deterministic')?.prompt || '';
    const standardPrompt = prompts.find((entry) => entry.messageId === 'msg-standard-deterministic')?.prompt || '';
    const socraticPrompt = prompts.find((entry) => entry.messageId === 'msg-socratic-deterministic')?.prompt || '';
    if (!introPrompt.includes("Let's begin Module Alpha.")) {
      throw new Error(`Module introduction prompt did not reach Core builder: ${introPrompt}`);
    }
    if (!standardPrompt.includes('User: How do base cases stop recursion?')) {
      throw new Error(`Standard main prompt did not include user input: ${standardPrompt}`);
    }
    if (!socraticPrompt.includes('SocraticContext') || !socraticPrompt.includes('User: I do not understand the base case.')) {
      throw new Error(`Socratic main prompt did not reach Socratic Core builder: ${socraticPrompt}`);
    }

    console.log('llm stream deterministic integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

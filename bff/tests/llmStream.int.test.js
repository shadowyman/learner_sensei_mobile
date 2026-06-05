const WebSocket = require('ws');
const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readStreamEvents = (streamUrl) => new Promise((resolve, reject) => {
  const ws = new WebSocket(streamUrl);
  const events = [];
  const timeout = setTimeout(() => {
    try {
      ws.close();
    } catch (_) {}
    reject(new Error('Timed out waiting for LLM stream completion'));
  }, 90_000);

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

;(async () => {
  const { server } = startServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.on('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8787;
  const BASE = `http://127.0.0.1:${port}`;
  const shutdown = async () => new Promise((resolve) => server.close(() => resolve()));

  try {
    const sessionRes = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: 'c++_recursive_mastery' })
    });
    if (!sessionRes.ok) {
      throw new Error(`HTTP ${sessionRes.status}`);
    }
    const { sessionId } = await sessionRes.json();

    const badSessionRes = await fetch(`${BASE}/sessions/bad-session-id/llm-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'llm-stream-bad-session-int-test' },
      body: JSON.stringify({ capability: 'moduleIntroduction', messageId: 'msg-bad', payload: {} })
    });
    if (badSessionRes.status !== 400) {
      throw new Error(`Expected 400 for bad session, got ${badSessionRes.status}`);
    }

    const invalidPayloadRes = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/llm-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'llm-stream-invalid-payload-int-test' },
      body: JSON.stringify({ capability: 'unknown', messageId: 'msg-invalid', payload: {} })
    });
    if (invalidPayloadRes.status !== 400) {
      throw new Error(`Expected 400 for invalid payload, got ${invalidPayloadRes.status}`);
    }

    const payload = {
      capability: 'moduleIntroduction',
      messageId: 'msg-real-gemini-smoke',
      payload: {
        selectedModuleTitle: 'Recursive Smoke Module',
        firstConceptTitle: 'Base Case',
        phaseDisplayName: 'IntroIllustrate',
        userInputText: 'Phase: IntroIllustrate',
        curriculumFocus: {
          status: 'active',
          item: {
            moduleTitle: 'Recursive Smoke Module',
            moduleGoal: 'Confirm the migrated LLM stream reaches Gemini.',
            concept: {
              title: 'Base Case',
              text: 'This smoke concept asks the model to mention Recursive Sensei stream smoke.'
            },
            isModuleWidePhase: false
          },
          state: {
            currentPhase: 'IntroIllustrate',
            currentTeachingChunkIndex: 0,
            teachingPlanChunkCount: 1
          },
          focusPoints: ['Mention the words Recursive Sensei stream smoke.'],
          primaryActionType: 'Teach New Content (from current chunk)',
          includeCheckUnderstanding: false
        },
        moduleTitleForPrompt: 'Recursive Smoke Module'
      },
      metadata: {
        source: 'bff-real-gemini-int-test'
      },
      options: {
        requireRealProvider: true
      }
    };

    const acceptedRes = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/llm-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'llm-stream-real-gemini-int-test' },
      body: JSON.stringify(payload)
    });
    if (!acceptedRes.ok) {
      throw new Error(`Expected 200 for llm stream submit, got HTTP ${acceptedRes.status}`);
    }
    const accepted = await acceptedRes.json();
    if (!accepted || typeof accepted.requestId !== 'string' || !accepted.requestId.startsWith('llmreq_')) {
      throw new Error(`Invalid LLM stream acceptance payload: ${JSON.stringify(accepted)}`);
    }
    if (typeof accepted.streamUrl !== 'string' || !accepted.streamUrl.includes('/llm-stream?requestId=')) {
      throw new Error(`Invalid LLM stream URL: ${JSON.stringify(accepted)}`);
    }

    const events = await readStreamEvents(accepted.streamUrl);
    const chunks = events.filter((event) => event.type === 'chunk');
    const started = events.find((event) => event.type === 'status' && event.phase === 'started');
    const completed = events.find((event) => event.type === 'status' && event.phase === 'completed');
    if (!started || !completed) {
      throw new Error(`Expected started and completed statuses: ${JSON.stringify(events)}`);
    }
    if (chunks.length === 0) {
      throw new Error(`Expected at least one Gemini chunk: ${JSON.stringify(events)}`);
    }
    for (const event of [...chunks, started, completed]) {
      if (event.requestId !== accepted.requestId) {
        throw new Error(`Expected requestId ${accepted.requestId}, got ${event.requestId}`);
      }
      if (event.messageId !== payload.messageId) {
        throw new Error(`Expected messageId ${payload.messageId}, got ${event.messageId}`);
      }
      if (event.capability !== payload.capability) {
        throw new Error(`Expected capability ${payload.capability}, got ${event.capability}`);
      }
    }
    const text = chunks.map((event) => event.text).join('');
    if (!text.trim()) {
      throw new Error('Expected non-empty streamed Gemini text');
    }
    if (/fallback/i.test(text)) {
      throw new Error(`Expected real Gemini text without fallback marker, got: ${text}`);
    }

    console.log('llm stream real Gemini integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

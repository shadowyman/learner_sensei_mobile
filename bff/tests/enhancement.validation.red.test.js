const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createBasePayload = () => ({
  originalMarkdown: [
    '# Recursion',
    '',
    'A base case stops the recursive chain.',
    '',
    'The recursive step makes progress.'
  ].join('\n'),
  wordCount: 10,
  messageId: 'sensei-message-1'
});

const postJson = (url, payload) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'enhancement-validation-red-test' },
  body: JSON.stringify(payload)
});

const expectRejected = async (res, allowedStatuses, label) => {
  if (!allowedStatuses.includes(res.status)) {
    const body = await res.text();
    throw new Error(`${label}: expected ${allowedStatuses.join(' or ')}, got ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object' || typeof json.message !== 'string') {
    throw new Error(`${label}: expected structured error body, got ${JSON.stringify(json)}`);
  }
};

;(async () => {
  const { server } = startServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.on('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8787;
  const base = `http://127.0.0.1:${port}`;
  const shutdown = async () => new Promise((resolve) => server.close(() => resolve()));

  try {
    const sessionRes = await postJson(`${base}/sessions`, { topicId: 'c++_recursive_mastery' });
    if (!sessionRes.ok) {
      throw new Error(`Session creation failed with HTTP ${sessionRes.status}`);
    }
    const { sessionId } = await sessionRes.json();
    const route = `${base}/sessions/${encodeURIComponent(sessionId)}/enhancement`;

    await expectRejected(await postJson(route, {
      ...createBasePayload(),
      prompt: 'Add enhancements to this message.',
      finalPrompt: 'Client controlled final prompt.',
      promptText: 'Client prompt text.',
      instruction: 'Use this client instruction.',
      systemInstruction: 'You are Enhancement.',
      model: 'gemini-test',
      temperature: 1,
      providerOptions: { temperature: 1 },
      safetySettings: [],
      config: { responseMimeType: 'application/json' },
      tools: [],
      chat: { history: [] },
      history: [{ role: 'user', parts: [{ text: 'raw provider history' }] }]
    }), [400], 'old prompt-string and provider-control payload');

    await expectRejected(await postJson(route, {
      wordCount: 10
    }), [400], 'missing originalMarkdown');

    await expectRejected(await postJson(route, {
      ...createBasePayload(),
      originalMarkdown: ''
    }), [400], 'empty originalMarkdown');

    await expectRejected(await postJson(route, {
      ...createBasePayload(),
      originalMarkdown: 'x'.repeat(250001)
    }), [400, 413], 'oversized originalMarkdown');

    await expectRejected(await postJson(route, {
      ...createBasePayload(),
      arbitraryClientKey: 'not allowed'
    }), [400], 'arbitrary unknown client key');

    await expectRejected(await postJson(route, {
      ...createBasePayload(),
      wordCount: 'ten'
    }), [400], 'invalid wordCount');

    console.log('enhancement validation red test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

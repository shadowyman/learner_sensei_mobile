const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createBaseToolbarPayload = () => ({
  mode: 'toolbarAction',
  actionType: 'explainSimpler',
  selectedText: 'base case stops recursion',
  originalSenseiMessageText: 'Original explanation about recursion and base cases.',
  actionLabel: 'Simpler'
});

const createBaseFollowUpPayload = () => ({
  mode: 'followUp',
  modalConversationId: 'modal-1',
  selectedText: 'base case stops recursion',
  originalSenseiMessageText: 'Original explanation about recursion and base cases.',
  initialActionType: 'explainSimpler',
  initialActionLabel: 'Simpler',
  initialResponse: {
    suggestedTitle: 'Base Case',
    explanation: 'A base case stops recursion.'
  },
  modalTranscript: [
    { role: 'user', text: 'Can you explain this simply?' },
    { role: 'sensei', text: 'A base case gives recursion a stopping point.' }
  ],
  question: 'How does that prevent an infinite loop?'
});

const omitKeys = (payload, keys) => {
  const next = { ...payload };
  for (const key of keys) {
    delete next[key];
  }
  return next;
};

const postJson = (url, payload) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'selection-sensei-modal-validation-red-test' },
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
    const route = `${base}/sessions/${encodeURIComponent(sessionId)}/selection-sensei/modal-message`;

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      prompt: 'Explain the selected text.',
      systemInstruction: 'You are Selection Sensei.',
      model: 'gemini-test'
    }), [400], 'old prompt-string payload');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      instruction: 'Use this client-controlled prompt instruction.'
    }), [400], 'instruction prompt fragment');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      temperature: 1
    }), [400], 'client-controlled temperature');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionType: 'addToNotepad'
    }), [400], 'non-LLM toolbar action');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionType: 'inventedAction',
      promptControl: 'be dramatic'
    }), [400], 'arbitrary toolbar action and prompt control');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      providerOptions: { temperature: 1 }
    }), [400], 'unknown provider options key');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      arbitraryClientKey: 'not allowed'
    }), [400], 'arbitrary unknown client key');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      history: [{ role: 'user', parts: [{ text: 'raw provider history' }] }]
    }), [400], 'raw provider history');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      modalTranscript: [{ role: 'model', text: 'provider-shaped role' }]
    }), [400], 'invalid modal transcript role');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionType: 'askQuestion'
    }), [400], 'askQuestion missing userQuestion');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionType: 'askQuestion',
      userQuestion: ''
    }), [400], 'askQuestion empty userQuestion');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      userQuestion: 'This stray question must not control a non-ask action.'
    }), [400], 'non-ask toolbar action with stray userQuestion');

    await expectRejected(await postJson(route, omitKeys(createBaseFollowUpPayload(), ['question'])), [400], 'follow-up missing question');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      question: ''
    }), [400], 'follow-up empty question');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      initialActionUserQuestion: 'This question belongs only to initial ask actions.'
    }), [400], 'non-ask follow-up with stray initialActionUserQuestion');

    await expectRejected(await postJson(route, omitKeys(createBaseFollowUpPayload(), [
      'selectedText',
      'originalSenseiMessageText',
      'initialActionType',
      'initialActionLabel',
      'initialResponse'
    ])), [400], 'follow-up missing required modal context');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionType: 'askQuestion',
      userQuestion: 'x'.repeat(8001)
    }), [400, 413], 'oversized userQuestion');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      initialActionType: 'askQuestion',
      initialActionLabel: 'Ask',
      initialActionUserQuestion: 'x'.repeat(8001)
    }), [400, 413], 'oversized initialActionUserQuestion');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      actionLabel: 'x'.repeat(81)
    }), [400, 413], 'oversized actionLabel');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      initialResponse: {
        suggestedTitle: 'Large response',
        explanation: 'x'.repeat(24001)
      }
    }), [400, 413], 'oversized initial response explanation');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      initialResponse: {
        rawText: 'x'.repeat(24001)
      }
    }), [400, 413], 'oversized initial response rawText');

    await expectRejected(await postJson(route, {
      ...createBaseToolbarPayload(),
      selectedText: 'x'.repeat(12001)
    }), [400, 413], 'oversized selected text');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      modalTranscript: [{ role: 'sensei', text: 'x'.repeat(12001) }]
    }), [400, 413], 'oversized transcript entry');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      modalTranscript: Array.from({ length: 25 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'sensei',
        text: `entry ${index}`
      }))
    }), [400, 413], 'oversized transcript array');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      modalTranscript: Array.from({ length: 6 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'sensei',
        text: `${index}`.repeat(12000)
      }))
    }), [400, 413], 'oversized transcript aggregate');

    await expectRejected(await postJson(route, {
      ...createBaseFollowUpPayload(),
      originalSenseiMessageText: 'x'.repeat(97000)
    }), [400, 413], 'oversized prompt-rendered structured input');

    console.log('selection sensei modal validation red test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

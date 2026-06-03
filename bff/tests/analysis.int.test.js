const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    const payload = {
      userInputText: 'ok',
      lastSenseiMsg: 'Explain base case and the recursive step.',
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: ['Explain base case', 'Explain recursive step'],
      phase: 'IntroIllustrate'
    };

    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'analysis-success-int-test' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json || typeof json !== 'object') {
      throw new Error(`Invalid analysis payload: ${JSON.stringify(json)}`);
    }
    if (!json.affective_state || typeof json.affective_state !== 'object') {
      throw new Error('Missing affective_state');
    }
    if (!json.cognitive_load_indicators || typeof json.cognitive_load_indicators !== 'object') {
      throw new Error('Missing cognitive_load_indicators');
    }
    if (!json.srl_indicators || typeof json.srl_indicators !== 'object') {
      throw new Error('Missing srl_indicators');
    }
    if (typeof json.primary_intent !== 'string') {
      throw new Error('Missing primary_intent');
    }
    if (!json.topic_interaction || typeof json.topic_interaction !== 'object') {
      throw new Error('Missing topic_interaction');
    }

    const rateLimitHeaders = { 'Content-Type': 'application/json', 'User-Agent': 'analysis-rate-limit-int-test' };
    const rateLimitUrl = `${BASE}/sessions/rate-limit-session/analysis`;
    const rate1 = await fetch(rateLimitUrl, {
      method: 'POST',
      headers: rateLimitHeaders,
      body: JSON.stringify(payload)
    });
    if (rate1.status !== 400) {
      throw new Error(`Expected 400 for rate-limit-session request 1, got ${rate1.status}`);
    }

    const rate2 = await fetch(rateLimitUrl, {
      method: 'POST',
      headers: rateLimitHeaders,
      body: JSON.stringify(payload)
    });
    if (rate2.status !== 429) {
      throw new Error(`Expected 429 for rate-limit-session request 2, got ${rate2.status}`);
    }
    const retryAfter2 = Number(rate2.headers.get('Retry-After') || '0');
    if (!Number.isFinite(retryAfter2) || retryAfter2 <= 0 || retryAfter2 > 2) {
      throw new Error(`Expected Retry-After <= 2 on request 2, got ${retryAfter2}`);
    }

    let last = rate2;
    for (let i = 3; i <= 31; i += 1) {
      last = await fetch(rateLimitUrl, {
        method: 'POST',
        headers: rateLimitHeaders,
        body: JSON.stringify(payload)
      });
    }
    if (last.status !== 429) {
      throw new Error(`Expected 429 for rate-limit-session request 31, got ${last.status}`);
    }
    const retryAfter31 = Number(last.headers.get('Retry-After') || '0');
    if (!Number.isFinite(retryAfter31) || retryAfter31 < 300) {
      throw new Error(`Expected Retry-After >= 300 on request 31, got ${retryAfter31}`);
    }

    console.log('analysis integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();


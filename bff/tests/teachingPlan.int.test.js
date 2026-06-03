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
      phase: 'IntroIllustrate',
      textToProcess: 'Module Title: Sample Module\nCore Concept Content:\nExplain recursion with a base case and recursive step.',
      moduleTitle: 'Sample Module',
      moduleGoal: 'Build recursive intuition',
      conceptsSummary: 'base case, recursive step'
    };

    const res = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/teaching-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'teaching-plan-success-int-test' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const teachingPlan = json?.teachingPlan;
    if (!Array.isArray(teachingPlan) || teachingPlan.length === 0) {
      throw new Error(`Invalid teaching plan payload: ${JSON.stringify(json)}`);
    }
    const points = teachingPlan.flat();
    if (points.length === 0) {
      throw new Error('Teaching plan contained no points');
    }
    for (const point of points) {
      if (!point || typeof point.text !== 'string' || typeof point.kcValue !== 'number') {
        throw new Error(`Invalid teaching point: ${JSON.stringify(point)}`);
      }
    }
    const kcTotal = points.reduce((sum, point) => sum + point.kcValue, 0);
    if (!Number.isFinite(kcTotal) || Math.abs(kcTotal - 0.65) > 0.1) {
      throw new Error(`Unexpected KC total: ${kcTotal}`);
    }

    const badRes = await fetch(`${BASE}/sessions/bad-session-id/teaching-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'teaching-plan-bad-session-int-test' },
      body: JSON.stringify(payload)
    });
    if (badRes.status !== 400) {
      throw new Error(`Expected 400 for bad session, got ${badRes.status}`);
    }

    const rateLimitHeaders = { 'Content-Type': 'application/json', 'User-Agent': 'teaching-plan-rate-limit-int-test' };
    const rateLimitUrl = `${BASE}/sessions/rate-limit-session/teaching-plan`;
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
    if (!Number.isFinite(retryAfter2) || retryAfter2 <= 0 || retryAfter2 > 20) {
      throw new Error(`Expected Retry-After <= 20 on request 2, got ${retryAfter2}`);
    }

    const rate3 = await fetch(rateLimitUrl, {
      method: 'POST',
      headers: rateLimitHeaders,
      body: JSON.stringify(payload)
    });
    if (rate3.status !== 429) {
      throw new Error(`Expected 429 for rate-limit-session request 3, got ${rate3.status}`);
    }

    const rate4 = await fetch(rateLimitUrl, {
      method: 'POST',
      headers: rateLimitHeaders,
      body: JSON.stringify(payload)
    });
    if (rate4.status !== 429) {
      throw new Error(`Expected 429 for rate-limit-session request 4, got ${rate4.status}`);
    }
    const retryAfter4 = Number(rate4.headers.get('Retry-After') || '0');
    if (!Number.isFinite(retryAfter4) || retryAfter4 < 300) {
      throw new Error(`Expected Retry-After >= 300 on request 4, got ${retryAfter4}`);
    }

    console.log('teaching plan integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

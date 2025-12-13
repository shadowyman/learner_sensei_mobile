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

    const promptContext = {
      moduleTitle: 'Sample Module',
      moduleGoal: 'Goal',
      solidifyContent: '',
      conceptSummaries: ['Concept 1', 'Concept 2']
    }

    const wrapRes = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/wrapup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: 'module-1', promptContext })
    });
    if (!wrapRes.ok) {
      throw new Error(`HTTP ${wrapRes.status}`);
    }
    const overlay = await wrapRes.json();
    if (!overlay || !Array.isArray(overlay.questions)) {
      throw new Error(`Invalid overlay payload: ${JSON.stringify(overlay)}`);
    }
    if (overlay.questions.length !== 15) {
      throw new Error(`Expected 15 questions, got ${overlay.questions.length}`);
    }
    const snippetCount = overlay.questions.filter(q => q.type === 'snippet').length;
    if (snippetCount !== 5) {
      throw new Error(`Expected 5 snippet questions, got ${snippetCount}`);
    }

    const badRes = await fetch(`${BASE}/sessions/bad-session-id/wrapup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: 'module-1', promptContext })
    });
    if (badRes.status !== 400) {
      throw new Error(`Expected 400 for bad session, got ${badRes.status}`);
    }

    console.log('wrap-up integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

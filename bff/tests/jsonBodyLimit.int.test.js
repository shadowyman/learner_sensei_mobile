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
    const oversized = 'x'.repeat(2 * 1024 * 1024 + 16 * 1024);
    const sessionRes = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: 'c++_recursive_mastery', metadata: { oversized } })
    });
    if (!sessionRes.ok) {
      throw new Error(`Expected 200, got HTTP ${sessionRes.status}`);
    }
    const json = await sessionRes.json();
    if (!json || typeof json.sessionId !== 'string' || json.sessionId.length === 0) {
      throw new Error(`Expected sessionId, got ${JSON.stringify(json)}`);
    }

    console.log('json body limit integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  await sleep(50);
})();

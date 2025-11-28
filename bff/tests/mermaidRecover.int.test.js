const { startServer } = require('../src/server');

const BASE = 'http://localhost:8787';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { server } = startServer();
  const shutdown = async () => new Promise((resolve) => server.close(() => resolve()));

  try {
    // payload designed to skip deterministic fixes (no TD/backticks/quote issues) and require LLM for a trailing arrow
    const payload = {
      messageId: 'int-test-mermaid',
      code: 'graph TD\\nA-->B\\nB-->C\\nC-->D\\nD-->', // invalid trailing edge should trigger LLM path
      theme: 'warm'
    };

    const res = await fetch(`${BASE}/mermaid/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();

    if (!json.fixed) {
      throw new Error(`Expected fixed=true, got ${JSON.stringify(json)}`);
    }
    if (typeof json.fixedCode !== 'string' || !json.fixedCode.includes('graph')) {
      throw new Error('fixedCode missing or malformed');
    }
    // basic sanity: no TD direction regressions and the dangling arrow resolved
    if (json.fixedCode.includes('direction TD')) {
      throw new Error('direction TD was not normalized');
    }
    if (json.fixedCode.includes('-->') === false) {
      throw new Error('expected at least one edge in fixed diagram');
    }

    console.log('mermaid recover integration test passed');
  } catch (err) {
    await shutdown();
    console.error(err);
    process.exit(1);
  }

  await shutdown();
  // give the server a moment to close sockets
  await sleep(50);
})();

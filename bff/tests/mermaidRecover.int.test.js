const { startServer } = require('../src/server');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { server } = startServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.on('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8787;
  const BASE = `http://127.0.0.1:${port}`;
  const shutdown = async () => new Promise((resolve) => server.close(() => resolve()));

  try {
    const payload = {
      messageId: 'int-test-mermaid',
      code: 'graph TD\\nA-->B\\nB-->C\\nC-->D\\nD-->',
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
  await sleep(50);
})();

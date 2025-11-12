'use strict';

// Simple BFF for local development that matches the RN app contracts.
// Endpoints:
//  - POST /sessions -> { sessionId }
//  - POST /sessions/:sessionId/turns -> { turnId, streamUrl }
//  - WS /stream?turnId=... -> emits {status/chunk/wrapUp}
//  - POST /mermaid/recover -> { fixed:boolean, fixedCode? }
//  - POST /telemetry -> 204

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { WebSocketServer } = require('ws');
const { z } = require('zod');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const PORT = Number(process.env.PORT || 8787);

// In-memory stores (dev only)
const sessions = new Set();
const turns = new Map(); // turnId -> { text, createdAt }

const SessionCreateRequest = z.object({ topicId: z.string().optional() });
const TurnSubmitRequest = z.object({
  clientTurnId: z.string(),
  input: z.object({ text: z.string().min(1) }),
  selectionContext: z.record(z.any()).optional()
});
const MermaidRecoverRequest = z.object({
  messageId: z.string(),
  code: z.string(),
  theme: z.string().optional(),
  errorHash: z.string().optional(),
  context: z.record(z.any()).optional()
});
const TelemetryRequest = z.object({ events: z.array(z.record(z.any())) });

// Utilities
const makeId = (pfx) => `${pfx}_${Math.random().toString(36).slice(2)}_${Date.now()}`;

app.post('/sessions', (req, res) => {
  try {
    SessionCreateRequest.parse(req.body ?? {});
  } catch (_) {
    // Non-fatal for dev
  }
  const sessionId = makeId('sess');
  sessions.add(sessionId);
  res.json({ sessionId });
});

app.post('/sessions/:sessionId/turns', (req, res) => {
  const { sessionId } = req.params;
  if (!sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Unknown session' });
  }
  try {
    TurnSubmitRequest.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload', details: e.errors ?? String(e) });
  }
  const turnId = makeId('turn');
  const text = req.body.input.text;
  turns.set(turnId, { text, createdAt: Date.now() });
  const streamUrl = `ws://localhost:${PORT}/stream?turnId=${encodeURIComponent(turnId)}`;
  res.json({ turnId, streamUrl });
});

app.post('/mermaid/recover', (req, res) => {
  try {
    MermaidRecoverRequest.parse(req.body);
  } catch (_) {
    // ok for dev
  }
  // Dev: pretend we fixed the diagram if it contains "graph"; else not.
  const code = (req.body && req.body.code) || '';
  if (/graph\s/i.test(code)) {
    return res.json({ fixed: true, fixedCode: code });
  }
  return res.json({ fixed: false });
});

app.post('/telemetry', (req, res) => {
  try {
    const parsed = TelemetryRequest.safeParse(req.body);
    if (!parsed.success) {
      // Still accept in dev
      console.log('[BFF] telemetry (invalid)', req.body);
    } else {
      console.log('[BFF] telemetry', parsed.data.events?.length ?? 0, 'events');
    }
  } catch (e) {
    console.log('[BFF] telemetry parse error', e);
  }
  res.status(204).end();
});

const server = app.listen(PORT, () => {
  console.log(`[BFF] listening on http://localhost:${PORT}`);
});

// WebSocket streaming implementation
const wss = new WebSocketServer({ server, path: '/stream' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const turnId = url.searchParams.get('turnId');
  const turn = turnId ? turns.get(turnId) : null;
  const baseText = turn?.text || 'Hello from the local Sensei BFF stream.';
  const chunks = createStreamChunks(baseText);

  // status: started
  ws.send(JSON.stringify({
    type: 'status',
    phase: 'started',
    footer: { confidence: 'medium', confusion: 'low', intent: 'learn' }
  }));

  let i = 0;
  const interval = setInterval(() => {
    if (i < chunks.length) {
      ws.send(JSON.stringify({ type: 'chunk', text: chunks[i++] }));
      // occasional keepalive
      if (i % 5 === 0) {
        ws.send(JSON.stringify({ type: 'status', phase: 'keepalive' }));
      }
    } else {
      clearInterval(interval);
      // Optional wrap-up example payload
      ws.send(JSON.stringify({ type: 'wrapUp', payload: { moduleTitle: 'Local Test', questions: [] } }));
      // status: completed
      ws.send(JSON.stringify({
        type: 'status',
        phase: 'completed',
        footer: { confidence: 'high', confusion: 'low', intent: 'understood' }
      }));
      try { ws.close(); } catch (_) {}
    }
  }, 180);

  ws.on('close', () => {
    try { clearInterval(interval); } catch (_) {}
  });
});

function createStreamChunks(text) {
  const prefix = 'Sensei: ';
  const msg = `${prefix}${text}`.trim();
  const words = msg.split(/(\s+)/).filter(Boolean);
  const chunks = [];
  let acc = '';
  for (const w of words) {
    acc += w;
    if (acc.length > 24) {
      chunks.push(acc);
      acc = '';
    }
  }
  if (acc) chunks.push(acc);
  if (chunks.length === 0) chunks.push(msg);
  return chunks;
}

function shutdown(signal) {
  try {
    if (wss && wss.clients) {
      for (const c of wss.clients) {
        try { c.close(1001, 'Server shutting down'); } catch (_) {}
      }
    }
    try { wss.close(); } catch (_) {}
  } catch (_) {}
  try {
    server.close(() => { process.exit(0); });
    setTimeout(() => process.exit(0), 2000);
  } catch (_) {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

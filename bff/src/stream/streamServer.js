const { WebSocketServer } = require('ws');
const { URL } = require('url');

const TAG = 'STREAM_SERVER';

const parseSessionPath = (pathname) => {
  if (!pathname) {
    return null;
  }
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'sessions' && parts[2] === 'stream') {
    return parts[1];
  }
  return null;
};

const parseLlmStreamPath = (pathname) => {
  if (!pathname) {
    return null;
  }
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'sessions' && parts[2] === 'llm-stream') {
    return parts[1];
  }
  return null;
};

const initStreamServer = ({ server, streamingService, logger }) => {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    const full = new URL(req.url, `http://localhost`);
    const llmSessionId = parseLlmStreamPath(full.pathname);
    if (llmSessionId) {
      const requestId = full.searchParams.get('requestId');
      if (!requestId) {
        logger.warn(TAG, 'invalid llm stream path', { pathname: full.pathname });
        ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Invalid stream path' }));
        ws.close();
        return;
      }
      logger.info(TAG, 'llm stream connection', { sessionId: llmSessionId, requestId, origin });
      streamingService.handleLlmStreamConnection({ ws, sessionId: llmSessionId, requestId });
      return;
    }
    const sessionId = parseSessionPath(full.pathname);
    const turnId = full.searchParams.get('turnId');
    if (!sessionId || !turnId) {
      logger.warn(TAG, 'invalid stream path', { pathname: full.pathname });
      ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Invalid stream path' }));
      ws.close();
      return;
    }
    logger.info(TAG, 'stream connection', { sessionId, turnId, origin });
    streamingService.handleConnection({ ws, sessionId, turnId });
  });
  return wss;
};

module.exports = initStreamServer;

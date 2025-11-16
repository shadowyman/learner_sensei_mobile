const WebSocket = require('ws');
const { toWsError } = require('../utils/errorMapper');

const TAG = 'STREAMING_SERVICE';

const splitChunks = (text, size = 120) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

class StreamingService {
  constructor({ turnService, logger, senseiCoreAdapter, geminiGateway, wrapUpService, config }) {
    this.turnService = turnService;
    this.logger = logger;
    this.senseiCoreAdapter = senseiCoreAdapter;
    this.geminiGateway = geminiGateway;
    this.wrapUpService = wrapUpService;
    this.config = config;
  }

  async handleConnection({ ws, sessionId, turnId }) {
    const turn = this.turnService.getTurn(turnId);
    if (!turn || turn.sessionId !== sessionId) {
      this.logger.warn(TAG, 'turn missing for stream', { sessionId, turnId });
      this.#sendWsError(ws, { code: 'BAD_REQUEST' });
      ws.close();
      return;
    }
    const context = { sessionId, turn };
    this.#sendStatus(ws, 'started');

    let bufferedMode = false;
    let bufferedText = '';
    let open = true;

    const keepaliveInterval = setInterval(() => {
      if (!open || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.#sendStatus(ws, 'keepalive');
    }, this.config.keepaliveIntervalMs);

    const hardTimeout = setTimeout(() => {
      this.logger.warn(TAG, 'stream timeout', { sessionId, turnId });
      this.#sendWsError(ws, { code: 'TURN_TIMEOUT' });
      try {
        ws.close();
      } catch (_) {}
    }, this.config.hardStreamTimeoutMs);

    let stallTimer = null;
    const scheduleStall = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
      }
      stallTimer = setTimeout(() => {
        bufferedMode = true;
        this.logger.info(TAG, 'switching to buffered mode', { turnId });
      }, this.config.stallToBufferedMs);
    };
    scheduleStall();

    const cleanup = () => {
      open = false;
      clearInterval(keepaliveInterval);
      clearTimeout(hardTimeout);
      if (stallTimer) {
        clearTimeout(stallTimer);
      }
    };

    try {
      const prompt = await this.senseiCoreAdapter.buildPrompt(context);
      let stream;
      try {
        stream = await this.geminiGateway.streamMainResponse(prompt, { context });
      } catch (error) {
        this.logger.warn(TAG, 'gateway stream fallback', { error: error.message });
        const fallback = splitChunks(`Sensei response: ${context.turn.input?.text ?? ''}`);
        stream = (async function* () {
          for (const part of fallback) {
            yield { text: part };
          }
        })();
      }
      for await (const chunk of stream) {
        if (!chunk || typeof chunk.text !== 'string') {
          continue;
        }
        scheduleStall();
        if (bufferedMode) {
          bufferedText += chunk.text;
        } else {
          this.#sendChunk(ws, chunk.text);
        }
      }
      if (bufferedMode && bufferedText.length > 0) {
        this.#sendChunk(ws, bufferedText);
      }
      const wrapUpPayload = await this.wrapUpService.maybeGenerateWrapUp(context);
      if (wrapUpPayload) {
        this.#sendWrapUp(ws, wrapUpPayload);
      }
      const footer = this.senseiCoreAdapter.deriveFooter(context);
      this.#sendStatus(ws, 'completed', footer);
    } catch (error) {
      this.logger.error(TAG, 'stream failure', { error: error.message, turnId });
      this.#sendWsError(ws, { code: error.code || 'BAD_REQUEST' });
    } finally {
      cleanup();
      try {
        ws.close();
      } catch (_) {}
    }
  }

  #sendStatus(ws, phase, footer) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'status', phase, footer }));
    }
  }

  #sendChunk(ws, text) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chunk', text }));
    }
  }

  #sendWrapUp(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'wrapUp', payload }));
    }
  }

  #sendWsError(ws, error) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', ...toWsError(error) }));
    }
  }
}

module.exports = StreamingService;

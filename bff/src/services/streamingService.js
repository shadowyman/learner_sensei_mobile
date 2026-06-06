const WebSocket = require('ws');
const { toWsError } = require('../utils/errorMapper');
const { makeId } = require('../utils/idGenerator');

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
    this.llmStreamRequests = new Map();
  }

  createLlmStreamRequest({ sessionId, capability, messageId, payload, metadata, options }) {
    const requestId = makeId('llmreq');
    const requireRealProvider = options?.requireRealProvider === true;
    const allowFallback = requireRealProvider ? false : options?.allowFallback !== false;
    const request = {
      requestId,
      sessionId,
      capability,
      messageId,
      payload,
      metadata: metadata || {},
      allowFallback,
      createdAt: Date.now(),
      unclaimedTimer: null
    };
    request.unclaimedTimer = setTimeout(() => {
      if (this.llmStreamRequests.get(requestId) === request) {
        this.llmStreamRequests.delete(requestId);
        this.logger.warn(TAG, 'llm stream request expired before websocket connection', {
          requestId,
          capability,
          messageId
        });
      }
    }, this.config.hardStreamTimeoutMs);
    this.llmStreamRequests.set(requestId, request);
    this.logger.info('LLM_STREAM_MIGRATION', 'request-created', {
      requestId,
      capability,
      messageId
    });
    this.logger.info(TAG, 'llm stream request created', {
      sessionId,
      requestId,
      messageId,
      capability,
      allowFallback
    });
    return request;
  }

  getLlmStreamTimeoutMs() {
    const streamTimeout = Number(this.config.hardStreamTimeoutMs || 0);
    const mainResponseTimeout = Number(this.config.MAIN_RESPONSE_CONFIG?.timeoutMs || 0);
    return Math.max(streamTimeout, mainResponseTimeout, 1);
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

  async handleLlmStreamConnection({ ws, sessionId, requestId }) {
    const request = this.llmStreamRequests.get(requestId);
    if (!request || request.sessionId !== sessionId) {
      this.logger.warn(TAG, 'llm stream request missing', { sessionId, requestId });
      this.#sendLlmError(ws, { code: 'BAD_REQUEST' }, { requestId });
      ws.close();
      return;
    }
    this.llmStreamRequests.delete(requestId);
    if (request.unclaimedTimer) {
      clearTimeout(request.unclaimedTimer);
      request.unclaimedTimer = null;
    }

    let open = true;
    let clientClosed = false;
    const abortController = new AbortController();
    const markClientClosed = (event) => {
      if (clientClosed) {
        return;
      }
      clientClosed = true;
      open = false;
      abortController.abort();
      this.logger.info('LLM_STREAM_MIGRATION', 'stream-client-disconnected', {
        requestId,
        capability: request.capability,
        messageId: request.messageId,
        event
      });
    };
    const onClientClose = () => markClientClosed('close');
    const onClientError = () => markClientClosed('error');
    ws.once('close', onClientClose);
    ws.once('error', onClientError);
    const context = {
      sessionId,
      requestId,
      capability: request.capability,
      messageId: request.messageId,
      turn: {
        id: requestId,
        sessionId,
        input: {
          text: request.payload?.currentUserInput ?? request.payload?.userInputText ?? ''
        },
        metadata: request.metadata
      }
    };

    this.#sendLlmStatus(ws, request, 'started');
    this.logger.info('LLM_STREAM_MIGRATION', 'stream-started', {
      requestId,
      capability: request.capability,
      messageId: request.messageId
    });

    const keepaliveInterval = setInterval(() => {
      if (!open || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.#sendLlmStatus(ws, request, 'keepalive');
    }, this.config.keepaliveIntervalMs);

    const hardTimeout = setTimeout(() => {
      this.logger.warn(TAG, 'llm stream timeout', { sessionId, requestId });
      this.#sendLlmError(ws, { code: 'TURN_TIMEOUT' }, request);
      try {
        ws.close();
      } catch (_) {}
    }, this.getLlmStreamTimeoutMs());

    const cleanup = () => {
      open = false;
      clearInterval(keepaliveInterval);
      clearTimeout(hardTimeout);
      if (request.unclaimedTimer) {
        clearTimeout(request.unclaimedTimer);
        request.unclaimedTimer = null;
      }
    };

    try {
      const providerInput = await this.senseiCoreAdapter.buildCapabilityPrompt(request);
      const prompt = typeof providerInput === 'string' ? providerInput : providerInput.prompt;
      const stream = await this.geminiGateway.streamMainResponse(prompt, {
        context,
        allowFallback: request.allowFallback,
        signal: abortController.signal,
        systemInstruction: typeof providerInput === 'string' ? undefined : providerInput.systemInstruction
      });
      this.logger.info('LLM_STREAM_MIGRATION', 'provider-stream', {
        requestId,
        capability: request.capability,
        provider: 'gemini',
        allowFallback: request.allowFallback
      });
      let chunkCount = 0;
      for await (const chunk of stream) {
        if (clientClosed || abortController.signal.aborted || ws.readyState !== WebSocket.OPEN) {
          clientClosed = true;
          break;
        }
        if (!chunk || typeof chunk.text !== 'string') {
          continue;
        }
        chunkCount++;
        this.#sendLlmChunk(ws, request, chunk.text);
      }
      if (clientClosed || abortController.signal.aborted || ws.readyState !== WebSocket.OPEN) {
        this.logger.info('LLM_STREAM_MIGRATION', 'stream-abandoned', {
          requestId,
          capability: request.capability,
          messageId: request.messageId,
          chunks: chunkCount
        });
        return;
      }
      this.#sendLlmStatus(ws, request, 'completed');
      this.logger.info('LLM_STREAM_MIGRATION', 'stream-completed', {
        requestId,
        capability: request.capability,
        messageId: request.messageId,
        chunks: chunkCount
      });
    } catch (error) {
      if (clientClosed || abortController.signal.aborted || error?.name === 'AbortError') {
        this.logger.info('LLM_STREAM_MIGRATION', 'stream-aborted', {
          requestId,
          capability: request.capability,
          messageId: request.messageId
        });
        return;
      }
      this.logger.error(TAG, 'llm stream failure', { error: error.message, requestId });
      this.#sendLlmError(ws, { code: error.code || 'BAD_REQUEST', message: error.message }, request);
    } finally {
      cleanup();
      ws.removeListener('close', onClientClose);
      ws.removeListener('error', onClientError);
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

  #sendLlmStatus(ws, request, phase) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        phase,
        requestId: request.requestId,
        messageId: request.messageId,
        capability: request.capability
      }));
    }
  }

  #sendLlmChunk(ws, request, text) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chunk',
        requestId: request.requestId,
        messageId: request.messageId,
        capability: request.capability,
        text
      }));
    }
  }

  #sendLlmError(ws, error, request) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        requestId: request?.requestId,
        messageId: request?.messageId,
        capability: request?.capability,
        ...toWsError(error)
      }));
    }
  }
}

module.exports = StreamingService;

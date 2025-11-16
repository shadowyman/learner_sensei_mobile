const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const createContainer = require('./container');
const sessionsRouterFactory = require('./routes/sessions');
const mermaidRouterFactory = require('./routes/mermaid');
const telemetryRouterFactory = require('./routes/telemetry');
const initStreamServer = require('./stream/streamServer');
const requestContext = require('./middleware/requestContext');

const TAG = 'SERVER';

const startServer = () => {
  const container = createContainer();
  const app = express();
  app.use(cors({ origin: container.config.corsOrigin }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use(requestContext);
  app.use(sessionsRouterFactory({
    sessionService: container.sessionService,
    turnService: container.turnService,
    rateLimiter: container.rateLimiter,
    logger: container.logger,
    config: container.config
  }));
  app.use(mermaidRouterFactory({ mermaidService: container.mermaidService, logger: container.logger }));
  app.use(telemetryRouterFactory({ telemetryService: container.telemetryService, logger: container.logger }));
  const server = app.listen(container.config.port, container.config.host, () => {
    container.logger.info(TAG, 'listening', { port: container.config.port, host: container.config.host });
  });
  initStreamServer({
    server,
    streamingService: container.streamingService,
    turnService: container.turnService,
    logger: container.logger
  });
  return { app, server, container };
};

module.exports = {
  startServer
};

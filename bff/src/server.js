const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const createContainer = require('./container');
const sessionsRouterFactory = require('./routes/sessions');
const mermaidRouterFactory = require('./routes/mermaid');
const telemetryRouterFactory = require('./routes/telemetry');
const wrapUpRouterFactory = require('./routes/wrapUp');
const teachingPlanRouterFactory = require('./routes/teachingPlan');
const analysisRouterFactory = require('./routes/analysis');
const selectionSenseiRouterFactory = require('./routes/selectionSensei');
const initStreamServer = require('./stream/streamServer');
const requestContext = require('./middleware/requestContext');

const TAG = 'SERVER';

const startServer = (overrides = {}) => {
  const container = createContainer();
  const app = express();
  app.use(cors({ origin: container.config.corsOrigin }));
  app.use(express.json({ limit: container.config.jsonBodyLimit || '3mb' }));
  app.use(morgan('dev'));
  app.use(requestContext);
  app.use(sessionsRouterFactory({
    sessionService: container.sessionService,
    turnService: container.turnService,
    streamingService: container.streamingService,
    rateLimiter: container.rateLimiter,
    logger: container.logger,
    config: container.config
  }));
  app.use(mermaidRouterFactory({ mermaidService: container.mermaidService, logger: container.logger }));
  app.use(wrapUpRouterFactory({
    wrapUpService: container.wrapUpService,
    sessionService: container.sessionService,
    logger: container.logger,
    wrapUpRateLimiter: container.wrapUpRateLimiter
  }));
  app.use(teachingPlanRouterFactory({
    teachingPlanService: container.teachingPlanService,
    sessionService: container.sessionService,
    logger: container.logger,
    teachingPlanRateLimiter: container.teachingPlanRateLimiter
  }));
  app.use(analysisRouterFactory({
    analysisService: container.analysisService,
    sessionService: container.sessionService,
    logger: container.logger,
    analysisRateLimiter: container.analysisRateLimiter
  }));
  app.use(selectionSenseiRouterFactory({
    selectionSenseiService: container.selectionSenseiService,
    sessionService: container.sessionService,
    logger: container.logger
  }));
  app.use(telemetryRouterFactory({ telemetryService: container.telemetryService, logger: container.logger }));
  const host = overrides.host ?? container.config.host;
  const port = typeof overrides.port === 'number' ? overrides.port : container.config.port;
  const server = app.listen(port, host, () => {
    container.logger.info(TAG, 'listening', { port, host });
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

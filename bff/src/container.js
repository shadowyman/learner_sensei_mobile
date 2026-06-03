const config = require('./config');
const logger = require('./utils/logger');
const SessionStore = require('./infra/sessionStore');
const RateLimiter = require('./infra/rateLimiter');
const WrapUpRateLimiter = require('./infra/wrapUpRateLimiter');
const SessionService = require('./services/sessionService');
const TurnService = require('./services/turnService');
const MermaidService = require('./services/mermaidService');
const TelemetryService = require('./services/telemetryService');
const StreamingService = require('./services/streamingService');
const WrapUpService = require('./services/wrapUpService');
const TeachingPlanService = require('./services/teachingPlanService');
const AnalysisService = require('./services/analysisService');
const SenseiCoreAdapter = require('./integration/senseiCoreAdapter');
const GeminiGateway = require('./integration/geminiGateway');

const createContainer = () => {
  const sessionStore = new SessionStore({
    sessionTtlMs: config.sessionTtlMs,
    idempotencyTtlMs: config.idempotencyTtlMs
  });
  const rateLimiter = new RateLimiter(config.rateLimit);
  const wrapUpRateLimiter = new WrapUpRateLimiter(config.wrapUpRateLimit);
  const teachingPlanRateLimiter = new WrapUpRateLimiter(config.teachingPlanRateLimit);
  const analysisRateLimiter = new WrapUpRateLimiter(config.analysisRateLimit);
  const sessionService = new SessionService({ sessionStore, logger, topicRegistry: config.topicRegistry });
  const turnService = new TurnService({ sessionStore, logger });
  const geminiGateway = new GeminiGateway({ logger, config });
  const mermaidService = new MermaidService({ logger, geminiGateway });
  const telemetryService = new TelemetryService({ logger });
  const wrapUpService = new WrapUpService({ logger, geminiGateway });
  const teachingPlanService = new TeachingPlanService({ logger, geminiGateway, config });
  const analysisService = new AnalysisService({ logger, geminiGateway });
  const senseiCoreAdapter = new SenseiCoreAdapter({ logger });
  const streamingService = new StreamingService({
    turnService,
    logger,
    senseiCoreAdapter,
    geminiGateway,
    wrapUpService,
    config
  });

  return {
    config,
    logger,
    sessionStore,
    rateLimiter,
    wrapUpRateLimiter,
    teachingPlanRateLimiter,
    analysisRateLimiter,
    sessionService,
    turnService,
    geminiGateway,
    mermaidService,
    telemetryService,
    wrapUpService,
    teachingPlanService,
    analysisService,
    senseiCoreAdapter,
    streamingService
  };
};

module.exports = createContainer;

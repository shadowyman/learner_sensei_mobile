const TAG = 'TELEMETRY_SERVICE';

class TelemetryService {
  constructor({ logger }) {
    this.logger = logger;
  }

  async ingest(events, context) {
    const count = Array.isArray(events) ? events.length : 0;
    this.logger.info(TAG, 'telemetry ingest', { count, context });
  }
}

module.exports = TelemetryService;

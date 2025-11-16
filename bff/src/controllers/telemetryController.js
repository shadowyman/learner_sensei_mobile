const { z } = require('zod');

const TAG = 'TELEMETRY_CONTROLLER';

const TelemetrySchema = z.object({
  events: z.array(z.record(z.any())).default([])
});

class TelemetryController {
  constructor({ telemetryService, logger }) {
    this.telemetryService = telemetryService;
    this.logger = logger;
  }

  async ingest(req, res) {
    const parseResult = TelemetrySchema.safeParse(req.body || {});
    if (!parseResult.success) {
      this.logger.warn(TAG, 'telemetry schema mismatch');
      return res.status(204).end();
    }
    try {
      await this.telemetryService.ingest(parseResult.data.events, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (error) {
      this.logger.warn(TAG, 'telemetry ingest failure', { error: error.message });
    }
    return res.status(204).end();
  }
}

module.exports = TelemetryController;

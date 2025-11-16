const express = require('express');
const TelemetryController = require('../controllers/telemetryController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new TelemetryController(deps);
  router.post('/telemetry', (req, res, next) => controller.ingest(req, res, next));
  return router;
};

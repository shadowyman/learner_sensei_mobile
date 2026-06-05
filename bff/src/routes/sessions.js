const express = require('express');
const SessionController = require('../controllers/sessionController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new SessionController(deps);
  router.post('/sessions', (req, res, next) => controller.createSession(req, res, next));
  router.post('/sessions/:sessionId/turns', (req, res, next) => controller.submitTurn(req, res, next));
  router.post('/sessions/:sessionId/llm-stream', (req, res, next) => controller.submitLlmStream(req, res, next));
  return router;
};

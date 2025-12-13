const express = require('express');
const WrapUpController = require('../controllers/wrapUpController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new WrapUpController(deps);
  router.post('/sessions/:sessionId/wrapup', (req, res, next) => controller.postWrapUp(req, res, next));
  return router;
};


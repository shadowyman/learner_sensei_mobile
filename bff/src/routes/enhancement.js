const express = require('express');
const { EnhancementController } = require('../controllers/enhancementController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new EnhancementController(deps);
  router.post('/sessions/:sessionId/enhancement', (req, res, next) => {
    return controller.postEnhancement(req, res, next);
  });
  return router;
};

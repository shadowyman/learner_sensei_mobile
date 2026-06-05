const express = require('express');
const { SelectionSenseiController } = require('../controllers/selectionSenseiController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new SelectionSenseiController(deps);
  router.post('/sessions/:sessionId/selection-sensei/modal-message', (req, res, next) => {
    return controller.postModalMessage(req, res, next);
  });
  return router;
};

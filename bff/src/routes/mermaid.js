const express = require('express');
const MermaidController = require('../controllers/mermaidController');

module.exports = (deps) => {
  const router = express.Router();
  const controller = new MermaidController(deps);
  router.post('/mermaid/recover', (req, res, next) => controller.recover(req, res, next));
  return router;
};

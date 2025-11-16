const { z } = require('zod');

const TAG = 'MERMAID_CONTROLLER';

const MermaidRecoverSchema = z.object({
  messageId: z.string(),
  code: z.string(),
  theme: z.string().optional(),
  errorHash: z.string().optional(),
  context: z.record(z.any()).optional()
});

class MermaidController {
  constructor({ mermaidService, logger }) {
    this.mermaidService = mermaidService;
    this.logger = logger;
  }

  async recover(req, res) {
    const parseResult = MermaidRecoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      this.logger.warn(TAG, 'recover payload invalid', { errors: parseResult.error.errors });
      return res.status(400).json({ error: 'Invalid mermaid payload' });
    }
    const result = await this.mermaidService.recover(parseResult.data);
    return res.json(result);
  }
}

module.exports = MermaidController;

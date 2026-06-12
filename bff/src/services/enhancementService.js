const { parseSenseiEnhancementResponse } = require('@sensei/core/enhancement');
const { buildSenseiEnhancementPrompt } = require('@sensei/core/prompts/enhancement');
const CoreLlmAdapter = require('../integration/coreLlmAdapter');

const TAG = 'ENHANCEMENT_SERVICE';

class EnhancementService {
  constructor({ logger, geminiGateway, coreLlmClient }) {
    this.logger = logger;
    this.coreLlmClient = coreLlmClient || new CoreLlmAdapter({ geminiGateway });
  }

  async runEnhancement({ session, request }) {
    this.logger.info(TAG, 'request-start', {
      sessionId: session.id,
      originalMarkdownLength: request.originalMarkdown.length,
      wordCount: request.wordCount
    });
    try {
      const prompt = buildSenseiEnhancementPrompt(request.originalMarkdown);
      const text = await this.coreLlmClient.callText(prompt, { task: 'sensei_enhancement' });
      const parsed = parseSenseiEnhancementResponse(text);
      if (!parsed) {
        this.logger.warn(TAG, 'provider-output-invalid', { sessionId: session.id });
        return {
          ok: false,
          errorCode: 'provider_error'
        };
      }
      this.logger.info(TAG, 'request-success', {
        sessionId: session.id,
        enhancementCount: parsed.enhancements.length
      });
      return {
        ok: true,
        enhancements: parsed.enhancements,
        metadata: parsed.metadata
      };
    } catch (error) {
      this.logger.warn(TAG, 'request-fail', {
        sessionId: session.id,
        errorName: error instanceof Error ? error.name : typeof error
      });
      return {
        ok: false,
        errorCode: 'provider_error'
      };
    }
  }
}

module.exports = EnhancementService;

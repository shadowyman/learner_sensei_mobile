class CoreLlmAdapter {
  constructor({ geminiGateway }) {
    this.geminiGateway = geminiGateway;
  }

  async callText(prompt, { task }) {
    return this.geminiGateway.callText(prompt, { task });
  }

  async callJson(prompt, { task }) {
    const text = await this.callText(prompt, { task });
    return JSON.parse(text);
  }

  async callWithTools(prompt, { task, tools }) {
    return this.geminiGateway.callWithTools(prompt, { task, tools });
  }
}

module.exports = CoreLlmAdapter;

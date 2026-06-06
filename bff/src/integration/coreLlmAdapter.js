class CoreLlmAdapter {
  constructor({ geminiGateway }) {
    this.geminiGateway = geminiGateway;
  }

  async callText(prompt, { task, systemInstruction } = {}) {
    return this.geminiGateway.callText(prompt, { task, systemInstruction });
  }

  async callJson(prompt, { task, systemInstruction } = {}) {
    const text = await this.callText(prompt, { task, systemInstruction });
    return JSON.parse(text);
  }

  async callWithTools(prompt, { task, tools }) {
    return this.geminiGateway.callWithTools(prompt, { task, tools });
  }
}

module.exports = CoreLlmAdapter;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const defaultState = () => ({
  chunks: [{ text: 'mock-chunk' }],
  result: 'mock-result',
  functionCall: null
});

const cloneChunks = (chunks) => chunks.map(chunk => ({ ...chunk }));

const createResponsePayload = (text) => {
  const parts = [];
  if (state.functionCall) {
    parts.push({ functionCall: state.functionCall });
  }
  parts.push({ text });
  return {
    response: { text },
    candidates: [
      {
        content: { parts }
      }
    ],
    functionCalls: state.functionCall ? [state.functionCall] : []
  };
};

class GenerateContentResponse {
  constructor(value) {
    this.text = value;
    const payload = createResponsePayload(value);
    this.candidates = payload.candidates;
    this.functionCalls = payload.functionCalls;
  }
  toJSON() {
    return createResponsePayload(this.text);
  }
}

const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean'
};

class MockChatSession {
  async sendMessage() {
    return new GenerateContentResponse(state.result);
  }
  async *sendMessageStream() {
    for (const chunk of state.chunks) {
      if (chunk.delay) {
        await sleep(chunk.delay);
      }
      yield new GenerateContentResponse(chunk.text);
    }
  }
  async close() {}
}

class Chat extends MockChatSession {}

class MockGenerativeModel {
  async generateContent() {
    return new GenerateContentResponse(state.result);
  }
  generateContentStream() {
    const iterator = async function* () {
      for (const chunk of state.chunks) {
        if (chunk.delay) {
          await sleep(chunk.delay);
        }
        yield new GenerateContentResponse(chunk.text);
      }
    };
    return {
      [Symbol.asyncIterator]: iterator
    };
  }
  startChat() {
    return new Chat();
  }
}

class MockModels {
  async generateContent() {
    return new GenerateContentResponse(state.result);
  }
  generateContentStream() {
    return new MockGenerativeModel().generateContentStream();
  }
  startChat() {
    return new MockGenerativeModel().startChat();
  }
}

class MockChats {
  create() {
    return new Chat();
  }
}

class GoogleGenAI {
  constructor() {
    this.models = new MockModels();
    this.chats = new MockChats();
  }
  getGenerativeModel() {
    return new MockGenerativeModel();
  }
}

const __setMockGenerativeContent = (override) => {
  if (override.result !== undefined) {
    state.result = override.result;
  }
  if (override.chunks !== undefined) {
    state.chunks = cloneChunks(override.chunks);
  }
  if (override.functionCall !== undefined) {
    state.functionCall = override.functionCall;
  }
};

const __resetMockGenerativeContent = () => {
  state = defaultState();
};

class GenerativeModel extends MockGenerativeModel {}

let state = defaultState();

module.exports = {
  GoogleGenAI,
  GenerateContentResponse,
  GenerativeModel,
  Type,
  __setMockGenerativeContent,
  __resetMockGenerativeContent
};

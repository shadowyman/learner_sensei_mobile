type StreamChunk = {
  text: string
  delay?: number
}

type StreamState = {
  chunks: StreamChunk[]
  result: string
}

const defaultState = (): StreamState => ({
  chunks: [{ text: 'mock-chunk' }],
  result: 'mock-result'
})

let state = defaultState()

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const cloneChunks = (chunks: StreamChunk[]) => chunks.map(chunk => ({ ...chunk }))

const createResponsePayload = (text: string) => ({
  response: {
    text
  },
  candidates: [
    {
      content: {
        parts: [
          {
            text
          }
        ]
      }
    }
  ]
})

export class GenerateContentResponse {
  text: string
  constructor(value: string) {
    this.text = value
  }
  toJSON() {
    return createResponsePayload(this.text)
  }
}

class MockChatSession {
  async sendMessage(_input: unknown) {
    return new GenerateContentResponse(state.result)
  }
  async *sendMessageStream(_input: unknown) {
    for (const chunk of state.chunks) {
      if (chunk.delay) {
        await sleep(chunk.delay)
      }
      yield new GenerateContentResponse(chunk.text)
    }
  }
  async close() {}
}

export class Chat extends MockChatSession {}

class MockGenerativeModel {
  async generateContent(_input: unknown) {
    return new GenerateContentResponse(state.result)
  }
  generateContentStream() {
    const iterator = async function* () {
      for (const chunk of state.chunks) {
        if (chunk.delay) {
          await sleep(chunk.delay)
        }
        yield new GenerateContentResponse(chunk.text)
      }
    }
    return {
      [Symbol.asyncIterator]: iterator
    }
  }
  startChat() {
    return new Chat()
  }
}

class MockModels {
  async generateContent(_input: unknown) {
    return new GenerateContentResponse(state.result)
  }
  generateContentStream() {
    return new MockGenerativeModel().generateContentStream()
  }
  startChat() {
    return new MockGenerativeModel().startChat()
  }
}

class MockChats {
  create(_options: unknown) {
    return new Chat()
  }
}

export class GoogleGenAI {
  models: MockModels
  chats: MockChats
  constructor(_config: unknown) {
    this.models = new MockModels()
    this.chats = new MockChats()
  }
  getGenerativeModel(_config: unknown) {
    return new MockGenerativeModel()
  }
}

export const __setMockGenerativeContent = (override: Partial<StreamState>) => {
  if (override.result !== undefined) {
    state.result = override.result
  }
  if (override.chunks !== undefined) {
    state.chunks = cloneChunks(override.chunks)
  }
}

export const __resetMockGenerativeContent = () => {
  state = defaultState()
}

export class GenerativeModel extends MockGenerativeModel {}

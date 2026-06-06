export interface CoreLlmCallOptions {
  task?: string;
  systemInstruction?: string;
}

export interface CoreLlmClient {
  callText(prompt: string, options?: CoreLlmCallOptions): Promise<string>;
  callJson<T>(prompt: string, options?: CoreLlmCallOptions): Promise<T>;
  callWithTools(prompt: string, options: CoreLlmCallOptions & { task: string; tools: unknown }): Promise<{ toolCalls?: CoreToolCall[]; text?: string }>;
}

export type CoreToolCall = { name: string; args: unknown };

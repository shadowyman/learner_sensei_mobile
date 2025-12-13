export interface CoreLlmClient {
  callText(prompt: string, options?: { task?: string }): Promise<string>;
  callJson<T>(prompt: string, options?: { task?: string }): Promise<T>;
  callWithTools(prompt: string, options: { task: string; tools: unknown }): Promise<{ toolCalls?: CoreToolCall[]; text?: string }>;
}

export type CoreToolCall = { name: string; args: unknown };

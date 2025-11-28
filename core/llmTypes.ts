export interface CoreLlmClient {
  callText(prompt: string, options?: { task?: string }): Promise<string>;
  callJson<T>(prompt: string, options?: { task?: string }): Promise<T>;
}

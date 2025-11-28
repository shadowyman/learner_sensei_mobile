import { MERMAID_ERROR_RECOVERY_CONFIG } from './modelUsage';
import type { CoreLlmClient } from './llmTypes';

export function createBrowserCoreLlmClient(ai: any): CoreLlmClient | null {
  if (!ai || !ai.models || !ai.models.generateContent) {
    return null;
  }
  return {
    async callText(prompt: string) {
      const res = await ai.models.generateContent({
        model: MERMAID_ERROR_RECOVERY_CONFIG.modelName,
        contents: prompt,
        config: MERMAID_ERROR_RECOVERY_CONFIG.config
      });
      if (typeof res?.text === 'function') {
        return res.text();
      }
      return (res as any)?.text ?? '';
    },
    async callJson<T>(prompt: string) {
      const text = await this.callText(prompt);
      return JSON.parse(text) as T;
    }
  };
}


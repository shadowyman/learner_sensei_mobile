import { MERMAID_ERROR_RECOVERY_CONFIG, WRAP_UP_ASSESSMENT_GENERATION_CONFIG } from './modelUsage';
import type { CoreLlmClient } from './llmTypes';

export function createBrowserCoreLlmClient(ai: any): CoreLlmClient | null {
  if (!ai || !ai.models || !ai.models.generateContent) {
    return null;
  }
  return {
    async callText(prompt: string, options?: { task?: string }) {
      const task = options?.task;
      const cfg = task === 'wrap_up_assessment' ? WRAP_UP_ASSESSMENT_GENERATION_CONFIG : MERMAID_ERROR_RECOVERY_CONFIG;
      const res = await ai.models.generateContent({
        model: cfg.modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: cfg.config
      });
      if (typeof res?.text === 'function') {
        return res.text();
      }
      return (res as any)?.text ?? '';
    },
    async callJson<T>(prompt: string, options?: { task?: string }) {
      const text = await this.callText(prompt, options);
      return JSON.parse(text) as T;
    },
    async callWithTools(prompt: string, options: { task: string; tools: unknown }) {
      const cfg = options.task === 'wrap_up_assessment' ? WRAP_UP_ASSESSMENT_GENERATION_CONFIG : MERMAID_ERROR_RECOVERY_CONFIG;
      const config = options.task === 'wrap_up_assessment'
        ? { ...cfg.config, tools: options.tools }
        : cfg.config;
      const res = await ai.models.generateContent({
        model: cfg.modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config
      });
      const toolCalls = Array.isArray((res as any)?.functionCalls) ? (res as any).functionCalls : undefined;
      const text = toolCalls?.length
        ? ''
        : (typeof (res as any)?.text === 'function' ? (res as any).text() : (res as any)?.text ?? '');
      return { toolCalls, text };
    }
  };
}

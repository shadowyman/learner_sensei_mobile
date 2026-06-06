import {
  COMPREHENSIVE_ANALYSIS_CONFIG,
  MAIN_TEXT_CONFIG,
  MERMAID_ERROR_RECOVERY_CONFIG,
  SELECTION_SENSEI_MODAL_CONFIG,
  TEACHING_PLAN_GENERATION_CONFIG,
  WRAP_UP_ASSESSMENT_GENERATION_CONFIG
} from './modelUsage';
import type { CoreLlmClient } from './llmTypes';
import type { CoreLlmCallOptions } from './llmTypes';

function getTaskConfig(task?: string) {
  switch (task) {
    case 'comprehensive_analysis':
      return COMPREHENSIVE_ANALYSIS_CONFIG;
    case 'mermaid_repair':
      return MERMAID_ERROR_RECOVERY_CONFIG;
    case 'wrap_up_assessment':
      return WRAP_UP_ASSESSMENT_GENERATION_CONFIG;
    case 'teaching_plan':
      return TEACHING_PLAN_GENERATION_CONFIG;
    case 'selection_sensei_modal':
      return SELECTION_SENSEI_MODAL_CONFIG;
    default:
      return MAIN_TEXT_CONFIG;
  }
}

export function createBrowserCoreLlmClient(ai: any): CoreLlmClient | null {
  if (!ai || !ai.models || !ai.models.generateContent) {
    return null;
  }
  return {
    async callText(prompt: string, options?: CoreLlmCallOptions) {
      const task = options?.task;
      const cfg = getTaskConfig(task);
      const config = options?.systemInstruction
        ? { ...cfg.config, systemInstruction: options.systemInstruction }
        : cfg.config;
      const res = await ai.models.generateContent({
        model: cfg.modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config
      });
      if (typeof res?.text === 'function') {
        return res.text();
      }
      return (res as any)?.text ?? '';
    },
    async callJson<T>(prompt: string, options?: CoreLlmCallOptions) {
      const text = await this.callText(prompt, options);
      return JSON.parse(text) as T;
    },
    async callWithTools(prompt: string, options: { task: string; tools: unknown }) {
      const cfg = getTaskConfig(options.task);
      const config = options.task === 'wrap_up_assessment' ? { ...cfg.config, tools: options.tools } : cfg.config;
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

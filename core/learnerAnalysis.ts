import type { CoreLlmClient } from './llmTypes';
import type { LearnerAnalysisPhase, LearnerAnalysisPromptRequest } from './prompts/learnerAnalysis';
import { buildComprehensiveAnalysisPrompt } from './prompts/learnerAnalysis';

export type { LearnerAnalysisPhase } from './prompts/learnerAnalysis';
export { buildComprehensiveAnalysisPrompt, MISCONCEPTION_IDS } from './prompts/learnerAnalysis';

export interface AffectiveStateAnalysis {
  confidence: 'Low' | 'Medium' | 'High' | 'Uncertain';
  engagement: 'Waning' | 'Low' | 'Medium' | 'High' | 'Uncertain';
  frustration: 'Low' | 'Medium' | 'High' | 'Uncertain';
  confusion: 'Low' | 'Medium' | 'High' | 'Uncertain';
  boredom: 'Low' | 'Medium' | 'High' | 'Uncertain';
  self_efficacy: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export interface CognitiveLoadIndicatorsAnalysis {
  perceived_intrinsic_difficulty: 'Low' | 'Medium' | 'High' | 'Uncertain';
  extraneous_load_signals: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export type RawHelpSeekingStyle =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'None'
  | 'Uncertain'
  | 'Appropriate'
  | 'Vague'
  | 'Demanding';

export interface SRLIndicatorsAnalysis {
  planning_observed: 'Low' | 'Medium' | 'High' | 'Uncertain';
  monitoring_observed: 'Low' | 'Medium' | 'High' | 'Uncertain';
  help_seeking_style: RawHelpSeekingStyle;
  strategy_hint: string[];
}

export interface MisconceptionHint {
  id: string;
  likelihood: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export interface KnowledgeComponentReference {
  kc_id: string;
  understanding_signal: 'Positive' | 'Negative' | 'Neutral' | 'Uncertain';
}

export interface TopicInteractionAnalysis {
  continues_current_topic: boolean | 'Uncertain';
  signals_topic_resolution: boolean | 'Uncertain';
}

export interface KeyContentPointAssessment {
  point_id: string;
  coverage: 'NotAddressed' | 'ImplicitlyAddressed' | 'ExplicitlyAddressed';
  understanding_score: number;
}

export interface ComprehensiveAnalysisResultType {
  affective_state: AffectiveStateAnalysis;
  cognitive_load_indicators: CognitiveLoadIndicatorsAnalysis;
  srl_indicators: SRLIndicatorsAnalysis;
  misconception_hints: MisconceptionHint[];
  knowledge_component_references: KnowledgeComponentReference[];
  primary_intent:
    | 'AskingQuestion'
    | 'AnsweringQuestion'
    | 'ExpressingConfusion'
    | 'ExpressingUnderstanding'
    | 'ProvidingFeedback'
    | 'SeekingReassurance'
    | 'RequestingCurriculumStart'
    | 'Other'
    | 'Uncertain';
  topic_interaction: TopicInteractionAnalysis;
  key_content_point_assessment?: KeyContentPointAssessment[];
}

export type LearnerAnalysisRequest = LearnerAnalysisPromptRequest;

export function parseComprehensiveAnalysisJson(text: string): ComprehensiveAnalysisResultType | null {
  let cleaned = String(text ?? '').trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleaned.match(fenceRegex);
  if (match && match[2]) {
    cleaned = match[2].trim();
  }
  try {
    return JSON.parse(cleaned) as ComprehensiveAnalysisResultType;
  } catch {
    return null;
  }
}

export async function getComprehensiveAnalysis(
  llm: CoreLlmClient | null,
  request: LearnerAnalysisRequest
): Promise<ComprehensiveAnalysisResultType | null> {
  if (!llm) {
    return null;
  }
  const prompt = buildComprehensiveAnalysisPrompt(request);
  const text = await llm.callText(prompt, { task: 'comprehensive_analysis' });
  return parseComprehensiveAnalysisJson(text);
}

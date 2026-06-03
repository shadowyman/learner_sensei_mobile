export const MISCONCEPTION_IDS = [
  'Misconception_LoopingModel',
  'Misconception_MagicModel',
  'Misconception_BaseCaseOffByOne',
  'Misconception_StackOrderError',
  'Misconception_ParametersDontChange',
  'Misconception_ReturnValuesLost'
] as const;

export type LearnerAnalysisPhase = 'Socratic' | 'IntroIllustrate' | 'Solidify' | 'Unknown';

export type LearnerAnalysisPromptRequest = {
  userInputText: string;
  lastSenseiMsg: string | null;
  currentTaskIdForAnalysis: string;
  expectedContentPointsForCurrentChunk: string[];
  phase: LearnerAnalysisPhase;
};

const KEY_CONTENT_POINT_ASSESSMENT_SCHEMA_VALUE = `[] | [{ \\"point_id\\": \\"string\\", \\"coverage\\": \\"'NotAddressed' | 'ImplicitlyAddressed' | 'ExplicitlyAddressed'\\", \\"understanding_score\\": \\"number (a float between 0.0 for no understanding and 1.0 for full, insightful understanding)\\" }]`;

export function buildComprehensiveAnalysisPrompt(request: LearnerAnalysisPromptRequest): string {
  switch (request.phase) {
    case 'Socratic':
      return `
You are a hyper-efficient, expert-level Learner State Diagnostician. Your SOLE FUNCTION is to analyze the provided context and return a single, valid JSON object.

CRITICAL RULE: You MUST return ONLY the JSON object. Your entire response must be the raw JSON, with no surrounding text, comments, markdown formatting, or apologies.

INPUT DOSSIER
USER_INPUT: ${request.userInputText}
SENSEI_LAST_MESSAGE: ${request.lastSenseiMsg || 'N/A'}
CURRENT_TASK_ID: ${request.currentTaskIdForAnalysis}

For the 'planning_observed' and 'monitoring_observed' fields:
- You MUST distinguish between a lack of evidence ('Uncertain') and evidence of poor skill ('Low'). Use 'Uncertain' for simple inputs (greetings, confirmations). Use 'Low' ONLY for inputs showing chaotic guessing or trial-and-error without a stated goal. Use 'Medium' or 'High' for positive evidence of planning.

For the 'affective_state' fields:
- Infer emotion from subtext. Hedge words like "I think" or "maybe" indicate 'Medium' or 'Low' confidence. Direct, terse language ("just give me the answer") can signal 'High' frustration.

For the 'srl_indicators.strategy_hint' field:
- This must be an array of strings. If no specific learning strategies are observed, return an empty array [].

FINAL INSTRUCTION: Based on your analysis, generate the single, valid JSON object that adheres to the following schema.
{
  "affective_state": { "confidence": "'Low' | 'Medium' | 'High' | 'Uncertain'", "engagement": "'Waning' | 'Low' | 'Medium' | 'High' | 'Uncertain'", "frustration": "'Low' | 'Medium' | 'High' | 'Uncertain'", "confusion": "'Low' | 'Medium' | 'High' | 'Uncertain'", "boredom": "'Low' | 'Medium' | 'High' | 'Uncertain'", "self_efficacy": "'Low' | 'Medium' | 'High' | 'Uncertain'" },
  "cognitive_load_indicators": { "perceived_intrinsic_difficulty": "'Low' | 'Medium' | 'High' | 'Uncertain'", "extraneous_load_signals": "'Low' | 'Medium' | 'High' | 'Uncertain'" },
  "srl_indicators": { "planning_observed": "'Low' | 'Medium' | 'High' | 'Uncertain'", "monitoring_observed": "'Low' | 'Medium' | 'High' | 'Uncertain'", "help_seeking_style": "'Appropriate' | 'Vague' | 'Demanding' | 'None' | 'Uncertain'", "strategy_hint": "string[]" },
  "misconception_hints": "[]",
  "knowledge_component_references": "[]",
  "primary_intent": "'AskingQuestion' | 'AnsweringQuestion' | 'ExpressingConfusion' | 'ExpressingUnderstanding' | 'ProvidingFeedback' | 'SeekingReassurance' | 'RequestingCurriculumStart' | 'Other' | 'Uncertain'",
  "topic_interaction": { "continues_current_topic": "true | false | 'Uncertain'", "signals_topic_resolution": "false" }
}
        `;
    case 'IntroIllustrate':
    case 'Solidify':
    default:
      return `
You are a hyper-efficient, expert-level Learner State Diagnostician. Your SOLE FUNCTION is to analyze the provided context and return a single, valid JSON object.

CRITICAL RULE: You MUST return ONLY the JSON object. Your entire response must be the raw JSON, with no surrounding text, comments, markdown formatting, or apologies.

INPUT DOSSIER
USER_INPUT: ${request.userInputText}
SENSEI_LAST_MESSAGE: ${request.lastSenseiMsg || 'N/A'}
CURRENT_TASK_ID: ${request.currentTaskIdForAnalysis}
EXPECTED_POINTS (for current chunk): ${JSON.stringify(request.expectedContentPointsForCurrentChunk)}
KNOWN_MISCONCEPTIONS: ${JSON.stringify(MISCONCEPTION_IDS)}
MANDATORY ASSESSMENT FRAMEWORK (CHAIN OF THOUGHT)
You will now generate the JSON object. You MUST follow this two-step process internally and adhere to all sub-rules before generating the final JSON.

Step 1: Context Identification.
FIRST, you MUST analyze the SENSEI_LAST_MESSAGE. Compare it against the list of EXPECTED_POINTS. For each expected point, determine whether Sensei addressed it or not.

Step 2: Full Dossier Analysis.
THEN, you will determine the value for every field in the final JSON object by adhering to the following detailed rules:

For the 'key_content_point_assessment' field:
- You will generate one object in the array for EACH 'point_id' in the EXPECTED_POINTS list, regardless of whether Sensei addressed it or not.
- CRITICAL: For each object, the 'point_id' field MUST be copied EXACTLY, character-for-character, from the EXPECTED_POINTS JSON array above. Do NOT rephrase, paraphrase, or make any changes whatsoever to the text. Common errors to avoid: "right_right" instead of "right_depth", missing punctuation, extra spaces, or case changes. When in doubt, double-check each character.
- For each object, you will populate its fields using this two-part analysis:
  - Part A: Determine 'coverage'.
    - Analyze ONLY the SENSEI_LAST_MESSAGE. If it substantively explains or discusses the point, set 'coverage' to 'ExplicitlyAddressed'. Otherwise, set it to 'NotAddressed'.
  - Part B: Determine 'understanding_score'.
    - If 'coverage' is 'NotAddressed', set 'understanding_score' to 0.0 (the user cannot demonstrate understanding of something not taught).
    - If 'coverage' is 'ExplicitlyAddressed', analyze ONLY the USER_INPUT in the context of what the Sensei taught:
      - A score of 1.0 is for perfect, insightful answers to a direct question.
      - A partial answer that grasps the main idea but misses a nuance should receive a partial score (e.g., 0.6).
      - An answer that reveals a misconception should receive a low score (e.g., 0.1). No answer, or an irrelevant one, is 0.0.
      - **Vague Confirmation Rule:** If the USER_INPUT is a passive confirmation (e.g., "yes", "I get it", "ok"), you MUST assign an 'understanding_score' between 0.2 and 0.3.

For the 'planning_observed' and 'monitoring_observed' fields:
- You MUST distinguish between a lack of evidence ('Uncertain') and evidence of poor skill ('Low'). Use 'Uncertain' for simple inputs (greetings, confirmations). Use 'Low' ONLY for inputs showing chaotic guessing or trial-and-error without a stated goal. Use 'Medium' or 'High' for positive evidence of planning.

For the 'affective_state' fields:
- Infer emotion from subtext. Hedge words like "I think" or "maybe" indicate 'Medium' or 'Low' confidence. Direct, terse language ("just give me the answer") can signal 'High' frustration.

For the 'misconception_hints' field:
- For each ID in KNOWN_MISCONCEPTIONS, check if the user's language semantically matches its pattern. Language describing recursion as a simple "repeat" or "loop" should trigger a High likelihood for 'Misconception_LoopingModel'. If no patterns match, return an empty array [].

For the 'topic_interaction.signals_topic_resolution' field:
- This MUST be false if any 'understanding_score' for an assessed point is less than 0.8. It can only be true if the user has demonstrated clear mastery of ALL points addressed in the current chunk.

For the 'srl_indicators.strategy_hint' field:
- This must be an array of strings. If no specific learning strategies are observed, return an empty array [].

FINAL INSTRUCTION: Based on your two-step analysis, generate the single, valid JSON object that adheres to the following schema.
{
  "affective_state": { "confidence": "'Low' | 'Medium' | 'High' | 'Uncertain'", "engagement": "'Waning' | 'Low' | 'Medium' | 'High' | 'Uncertain'", "frustration": "'Low' | 'Medium' | 'High' | 'Uncertain'", "confusion": "'Low' | 'Medium' | 'High' | 'Uncertain'", "boredom": "'Low' | 'Medium' | 'High' | 'Uncertain'", "self_efficacy": "'Low' | 'Medium' | 'High' | 'Uncertain'" },
  "cognitive_load_indicators": { "perceived_intrinsic_difficulty": "'Low' | 'Medium' | 'High' | 'Uncertain'", "extraneous_load_signals": "'Low' | 'Medium' | 'High' | 'Uncertain'" },
  "srl_indicators": { "planning_observed": "'Low' | 'Medium' | 'High' | 'Uncertain'", "monitoring_observed": "'Low' | 'Medium' | 'High' | 'Uncertain'", "help_seeking_style": "'Appropriate' | 'Vague' | 'Demanding' | 'None' | 'Uncertain'", "strategy_hint": "string[]" },
  "misconception_hints": "[] | [{ \\"id\\": \\"string\\", \\"likelihood\\": \\"'Low' | 'Medium' | 'High' | 'Uncertain'\\" }]",
  "knowledge_component_references": "[] | [{ \\"kc_id\\": \\"string\\", \\"understanding_signal\\": \\"'Positive' | 'Negative' | 'Neutral' | 'Uncertain'\\" }]",
  "primary_intent": "'AskingQuestion' | 'AnsweringQuestion' | 'ExpressingConfusion' | 'ExpressingUnderstanding' | 'ProvidingFeedback' | 'SeekingReassurance' | 'RequestingCurriculumStart' | 'Other' | 'Uncertain'",
  "topic_interaction": { "continues_current_topic": "true | false | 'Uncertain'", "signals_topic_resolution": "true | false | 'Uncertain'" },
  "key_content_point_assessment": "${KEY_CONTENT_POINT_ASSESSMENT_SCHEMA_VALUE}"
}
    `;
  }
}

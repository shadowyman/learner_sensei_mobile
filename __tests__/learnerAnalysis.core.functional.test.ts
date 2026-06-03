import { getComprehensiveAnalysis } from '@sensei/core/learnerAnalysis';

describe('Core learner analysis tool', () => {
  test('parses fenced JSON payload', async () => {
    const llm = {
      callText: jest.fn().mockResolvedValue(
        '```json\n' +
          JSON.stringify({
            affective_state: {
              confidence: 'Medium',
              engagement: 'High',
              frustration: 'Low',
              confusion: 'Low',
              boredom: 'Low',
              self_efficacy: 'Medium'
            },
            cognitive_load_indicators: {
              perceived_intrinsic_difficulty: 'Medium',
              extraneous_load_signals: 'Low'
            },
            srl_indicators: {
              planning_observed: 'Uncertain',
              monitoring_observed: 'Uncertain',
              help_seeking_style: 'Uncertain',
              strategy_hint: []
            },
            misconception_hints: [],
            knowledge_component_references: [],
            primary_intent: 'ExpressingUnderstanding',
            topic_interaction: { continues_current_topic: true, signals_topic_resolution: false }
          }) +
          '\n```'
      )
    } as any;

    const result = await getComprehensiveAnalysis(llm, {
      userInputText: 'ok',
      lastSenseiMsg: 'Explain base case.',
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: ['Point A'],
      phase: 'IntroIllustrate'
    });

    expect(llm.callText).toHaveBeenCalledWith(expect.any(String), { task: 'comprehensive_analysis' });
    expect(result).not.toBeNull();
    expect(result!.primary_intent).toBe('ExpressingUnderstanding');
  });

  test('returns null when response is not parseable JSON', async () => {
    const llm = {
      callText: jest.fn().mockResolvedValue('not-json')
    } as any;

    const result = await getComprehensiveAnalysis(llm, {
      userInputText: 'ok',
      lastSenseiMsg: null,
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: [],
      phase: 'IntroIllustrate'
    });

    expect(result).toBeNull();
  });
});

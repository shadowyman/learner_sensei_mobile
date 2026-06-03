import { MISCONCEPTION_IDS, buildComprehensiveAnalysisPrompt } from '@sensei/core/learnerAnalysis';

describe('Learner analysis prompt invariants', () => {
  test('Socratic prompt contains critical headers', () => {
    const prompt = buildComprehensiveAnalysisPrompt({
      userInputText: 'yes',
      lastSenseiMsg: 'Try to reason about the base case.',
      currentTaskIdForAnalysis: 'task-1',
      expectedContentPointsForCurrentChunk: ['Point A'],
      phase: 'Socratic'
    });

    expect(prompt).toContain('CRITICAL RULE: You MUST return ONLY the JSON object.');
    expect(prompt).toContain('INPUT DOSSIER');
    expect(prompt).toContain('CURRENT_TASK_ID: task-1');
  });

  test('Non-Socratic prompt embeds misconception IDs and expected points', () => {
    const expectedPoints = ['Point A', 'Point B'];
    const prompt = buildComprehensiveAnalysisPrompt({
      userInputText: 'I think recursion repeats until base case.',
      lastSenseiMsg: 'Explain recursion and a base case.',
      currentTaskIdForAnalysis: 'task-2',
      expectedContentPointsForCurrentChunk: expectedPoints,
      phase: 'IntroIllustrate'
    });

    expect(prompt).toContain('CRITICAL RULE: You MUST return ONLY the JSON object.');
    expect(prompt).toContain('INPUT DOSSIER');
    expect(prompt).toContain(`EXPECTED_POINTS (for current chunk): ${JSON.stringify(expectedPoints)}`);
    expect(prompt).toContain(`KNOWN_MISCONCEPTIONS: ${JSON.stringify(MISCONCEPTION_IDS)}`);
  });
});

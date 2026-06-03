import { extractAndPlanTeachingOrder } from '@sensei/core/teachingPlan';

describe('Core teaching plan tool', () => {
  test('parses Socratic payload and attaches detected category', async () => {
    const llm = {
      callText: jest.fn().mockResolvedValue(
        JSON.stringify({
          detected_category: 'reasoning',
          teaching_plan: [[{ text: 'Ask focused questions', kcValue: 0.1, isSocraticIntent: true }]]
        })
      )
    } as any;

    const result = await extractAndPlanTeachingOrder(llm, {
      textToProcess: 'Module Title: X',
      phase: 'Socratic',
      moduleTitle: 'X',
      moduleGoal: 'Y',
      conceptsSummary: 'A, B'
    });

    expect(result).not.toBeNull();
    expect(result![0][0]).toMatchObject({
      text: 'Ask focused questions',
      isSocraticIntent: true,
      socraticMetadata: { detectedCategory: 'reasoning' }
    });
  });

  test('normalizes non-Socratic plan and distributes kcValue uniformly', async () => {
    const llm = {
      callText: jest.fn().mockResolvedValue(
        '```json\n' +
          JSON.stringify({
            teaching_plan: [[{ text: 'Explain base case' }, { text: 'Explain recursive step' }]]
          }) +
          '\n```'
      )
    } as any;

    const result = await extractAndPlanTeachingOrder(llm, {
      textToProcess: 'Educational text',
      phase: 'IntroIllustrate'
    });

    expect(result).not.toBeNull();
    expect(result![0]).toHaveLength(2);
    expect(result![0][0].kcValue).toBeCloseTo(0.325, 3);
    expect(result![0][1].kcValue).toBeCloseTo(0.325, 3);
  });

  test('returns null when response is not parseable JSON', async () => {
    const llm = {
      callText: jest.fn().mockResolvedValue('not-json')
    } as any;

    const result = await extractAndPlanTeachingOrder(llm, {
      textToProcess: 'Educational text',
      phase: 'IntroIllustrate'
    });

    expect(result).toBeNull();
  });
});

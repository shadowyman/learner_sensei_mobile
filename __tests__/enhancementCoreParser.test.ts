const loadCoreEnhancement = (): any => require('@sensei/core/enhancement');

const validEnhancementResponse = {
  enhancements: [
    {
      key: 'A base case stops the recursive chain.',
      value: 'This gives recursion a concrete stopping condition.',
      insertType: 'append',
      ordering: 2
    },
    {
      key: 'The recursive step makes progress.',
      value: 'That progress is what makes the later base case reachable.',
      insertType: 'paragraph'
    }
  ],
  metadata: {
    source: 'fixture'
  }
};

describe('Core enhancement parser red gate', () => {
  test('normalizes fenced provider JSON into enhancement payload entries', () => {
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();
    const text = `\`\`\`json\n${JSON.stringify(validEnhancementResponse)}\n\`\`\``;

    expect(parseSenseiEnhancementResponse(text)).toEqual(validEnhancementResponse);
  });

  test('normalizes unfenced provider JSON into enhancement payload entries', () => {
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();

    expect(parseSenseiEnhancementResponse(JSON.stringify(validEnhancementResponse))).toEqual(validEnhancementResponse);
  });

  test('returns null for malformed provider JSON without throwing raw parse errors', () => {
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();

    expect(parseSenseiEnhancementResponse('{"enhancements": [')).toBeNull();
  });

  test('preserves empty enhancement arrays without partial entries', () => {
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();

    expect(parseSenseiEnhancementResponse('{"enhancements":[],"metadata":{}}')).toEqual({
      enhancements: [],
      metadata: {}
    });
  });

  test('drops invalid enhancement entries and preserves metadata', () => {
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();
    const text = JSON.stringify({
      enhancements: [
        { key: '', value: 'missing key', insertType: 'append' },
        { key: 'Valid key.', value: 'Valid value.', insertType: 'append' },
        { key: 'Missing value.', value: '', insertType: 'paragraph' },
        { key: 'Bad insert type.', value: 'Nope.', insertType: 'prepend' }
      ],
      metadata: { source: 'fixture' }
    });

    expect(parseSenseiEnhancementResponse(text)).toEqual({
      enhancements: [
        { key: 'Valid key.', value: 'Valid value.', insertType: 'append' }
      ],
      metadata: { source: 'fixture' }
    });
  });
});

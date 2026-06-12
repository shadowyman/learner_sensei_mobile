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

  test('caps provider enhancement output before returning normalized entries', () => {
    const {
      SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS,
      SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES,
      SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS
    } = require('@sensei/core/llmCapPolicy');
    const { parseSenseiEnhancementResponse } = loadCoreEnhancement();
    const entries = [
      {
        key: 'x'.repeat(SENSEI_ENHANCEMENT_OUTPUT_KEY_MAX_CHARS + 1),
        value: 'oversized key',
        insertType: 'append'
      },
      {
        key: 'oversized value',
        value: 'x'.repeat(SENSEI_ENHANCEMENT_OUTPUT_VALUE_MAX_CHARS + 1),
        insertType: 'append'
      },
      ...Array.from({ length: SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES + 5 }, (_, index) => ({
        key: `Valid key ${index}.`,
        value: `Valid value ${index}.`,
        insertType: 'append'
      }))
    ];

    const parsed = parseSenseiEnhancementResponse(JSON.stringify({
      enhancements: entries,
      metadata: { source: 'fixture' }
    }));

    expect(parsed?.enhancements).toHaveLength(SENSEI_ENHANCEMENT_OUTPUT_MAX_ENTRIES);
    expect(parsed?.enhancements[0]?.key).toBe('Valid key 0.');
    expect(parsed?.enhancements).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'oversized key' }),
      expect.objectContaining({ key: 'oversized value' })
    ]));
    expect(parsed?.metadata).toEqual({ source: 'fixture' });
  });
});

import { parseSelectionSenseiResponsePayload } from '../src/selectionSenseiResponseParser';

describe('parseSelectionSenseiResponsePayload', () => {
  test('parses JSON5 payload with embedded quotes in Mermaid diagram', () => {
    const payload = `{
      suggestedTitle: 'Understanding Backtracking Flow',
      explanation: 'graph TD\\n    A["Start"] --> B(("End"))\\n'
    }`;

    const result = parseSelectionSenseiResponsePayload(payload);

    expect(result.suggestedTitle).toBe('Understanding Backtracking Flow');
    expect(result.explanation).toBe(`graph TD
    A["Start"] --> B(("End"))
`);
  });

  test('repairs single quoted payloads with trailing commas', () => {
    const payload = `{
      'suggestedTitle': 'Base Case',
      'explanation': 'A base case stops the recursive chain.',
    }`;

    const result = parseSelectionSenseiResponsePayload(payload);

    expect(result).toEqual({
      suggestedTitle: 'Base Case',
      explanation: 'A base case stops the recursive chain.'
    });
  });

  test('extracts loose title and explanation fields from freeform provider output', () => {
    const payload = `Here is the response: "suggestedTitle": "Recursive Stop", "explanation": "Line one\\nLine two"`;

    const result = parseSelectionSenseiResponsePayload(payload);

    expect(result).toEqual({
      suggestedTitle: 'Recursive Stop',
      explanation: `Line one
Line two`
    });
  });

  test('returns an empty object for malformed provider output without parseable fields', () => {
    expect(parseSelectionSenseiResponsePayload('not json and no known fields')).toEqual({});
  });

  test('exposes Selection Sensei parser from the future Core owner with fenced payload support', () => {
    const coreSelectionSensei = require('@sensei/core/selectionSensei');
    const result = coreSelectionSensei.parseSelectionSenseiResponsePayload(`\`\`\`json
{"suggestedTitle":"Fenced","explanation":"Works"}
\`\`\``);

    expect(result).toEqual({
      suggestedTitle: 'Fenced',
      explanation: 'Works'
    });
  });
});

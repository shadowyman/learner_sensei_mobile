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
});

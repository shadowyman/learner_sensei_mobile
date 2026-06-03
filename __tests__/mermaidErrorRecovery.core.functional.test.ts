import {
  attemptMermaidFix,
  runMermaidRecovery
} from '@sensei/core/mermaidErrorRecovery';
import type { CoreLlmClient } from '@sensei/core/llmTypes';

function createLlm(response: unknown): CoreLlmClient {
  return {
    callText: jest.fn(async () => ''),
    callJson: jest.fn(async () => response),
    callWithTools: jest.fn(async () => ({ text: '' }))
  };
}

describe('Mermaid error recovery Core behavior', () => {
  test('applies deterministic subgraph direction fixes before calling LLM', async () => {
    const llm = createLlm({
      fixed: true,
      diagram: 'graph TD\nA-->B',
      explanation: 'unused'
    });

    const result = await attemptMermaidFix(
      llm,
      'graph TD\nsubgraph X\n direction TD\n A-->B\nend',
      'Parse error: invalid direction TD'
    );

    expect(result.fixed).toBe(true);
    expect(result.diagram).toContain('direction TB');
    expect(llm.callJson).not.toHaveBeenCalled();
  });

  test('parses JSON string LLM fallback responses', async () => {
    const llm = createLlm(JSON.stringify({
      fixed: true,
      diagram: 'graph TD\nA-->B',
      explanation: 'fixed edge'
    }));

    const result = await attemptMermaidFix(
      llm,
      'A-->',
      'Parse error: unexpected end of input',
      { forceLlm: true }
    );

    expect(result).toEqual({
      fixed: true,
      diagram: 'graph TD\nA-->B',
      explanation: 'fixed edge'
    });
    expect(llm.callJson).toHaveBeenCalledWith(expect.stringContaining('FAILED DIAGRAM:'), {
      task: 'mermaid_repair'
    });
  });

  test('parses fenced JSON LLM fallback responses during recovery', async () => {
    const llm = createLlm('```json\n{"fixed":true,"diagram":"graph TD\\nA-->B","explanation":"fixed"}\n```');
    const renderAttempt = jest
      .fn()
      .mockRejectedValueOnce(new Error('Parse error: unexpected token'))
      .mockResolvedValueOnce({ svg: '<svg />' });

    const result = await runMermaidRecovery({
      llm,
      initialDiagram: 'A-->',
      initialError: 'Parse error',
      renderAttempt,
      maxAttempts: 2
    });

    expect(result).toEqual({
      svg: '<svg />',
      diagram: 'graph TD\nA-->B'
    });
    expect(renderAttempt).toHaveBeenCalledTimes(2);
    expect(llm.callJson).toHaveBeenCalledTimes(1);
  });
});

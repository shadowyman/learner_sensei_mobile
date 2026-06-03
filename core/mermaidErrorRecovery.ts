/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { MERMAID_ERROR_RECOVERY_CONFIG } from './modelUsage';
import type { CoreLlmClient } from './llmTypes';
import { MERMAID_FIX_PROMPT_TEMPLATE } from './prompts/mermaidRepair';

export { MERMAID_FIX_PROMPT_TEMPLATE } from './prompts/mermaidRepair';

const logger = {
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args)
};

const DEBUG_FLAGS = { mermaid_debug: false };

interface MermaidFixRequest {
  failedDiagram: string;
  errorMessage: string;
}

interface MermaidFixResponse {
  fixed: boolean;
  diagram?: string;
  explanation?: string;
}

export function applyBacktickFix(diagram: string): string {
  const backtickCount = (diagram.match(/`/g) || []).length;
  if (backtickCount === 0) {
    return diagram;
  }
  const fixedDiagram = diagram.replace(/`/g, "'");
  return fixedDiagram;
}

export function applyUniversalQuoteFix(diagram: string): string {
  let fixedDiagram = diagram;
  function findMatchingDelimiter(text: string, startPos: number, openChar: string, closeChar: string): number {
    let depth = 1;
    for (let i = startPos; i < text.length; i++) {
      if (text[i] === openChar) depth++;
      else if (text[i] === closeChar) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }
  const lines = fixedDiagram.split('\n');
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const originalLine = lines[lineIdx];
    if (originalLine === undefined) {
      continue;
    }
    let line = originalLine;
    const nodePattern = /([A-Z])(\[|\(\(|\{\{|\(|\{)/g;
    let match;
    let newLine = '';
    let lastIndex = 0;
    while ((match = nodePattern.exec(line)) !== null) {
      const nodeId = match[1];
      const openDelim = match[2];
      if (!nodeId || !openDelim) {
        logger.warn('[MERMAID_FIX] Skipping malformed node token.', {
          lineIndex: lineIdx,
          raw: match[0]
        });
        continue;
      }
      const startPos = match.index + match[0].length;
      let closeDelim = '';
      let searchOpenChar = '';
      let searchCloseChar = '';
      switch (openDelim) {
        case '[':
          closeDelim = ']';
          searchOpenChar = '[';
          searchCloseChar = ']';
          break;
        case '(':
          closeDelim = ')';
          searchOpenChar = '(';
          searchCloseChar = ')';
          break;
        case '((':
          closeDelim = '))';
          searchOpenChar = '(';
          searchCloseChar = ')';
          break;
        case '{':
          closeDelim = '}';
          searchOpenChar = '{';
          searchCloseChar = '}';
          break;
        case '{{':
          closeDelim = '}}';
          searchOpenChar = '{';
          searchCloseChar = '}';
          break;
      }
      if (!closeDelim && openDelim !== '((' && openDelim !== '{{') {
        logger.warn('[MERMAID_FIX] Unsupported delimiter encountered.', {
          openDelim,
          lineIndex: lineIdx
        });
        continue;
      }
      let endPos = -1;
      if (openDelim === '((') {
        let depth = 2;
        for (let i = startPos; i < line.length; i++) {
          if (line[i] === '(') {
            depth++;
          } else if (line[i] === ')') {
            depth--;
            if (depth === 0) {
              endPos = i - 1;
              break;
            }
          }
        }
      } else if (openDelim === '{{') {
        let depth = 2;
        for (let i = startPos; i < line.length; i++) {
          if (line[i] === '{') {
            depth++;
          } else if (line[i] === '}') {
            depth--;
            if (depth === 0) {
              endPos = i - 1;
              break;
            }
          }
        }
      } else {
        endPos = findMatchingDelimiter(line, startPos, searchOpenChar, searchCloseChar);
      }
      if (endPos !== -1 && endPos >= startPos) {
        const content = line.substring(startPos, endPos);
        const trimmedContent = content.trim();
        newLine += line.substring(lastIndex, match.index);
        const isDirectlyQuoted =
          trimmedContent.length > 1 &&
          ((trimmedContent.startsWith('"') && trimmedContent.endsWith('"')) ||
            (trimmedContent.startsWith("'") && trimmedContent.endsWith("'")));
        let innerWrapperQuoted = false;
        if (!isDirectlyQuoted && trimmedContent.length > 2) {
          const firstChar = trimmedContent[0];
          const lastChar = trimmedContent[trimmedContent.length - 1];
          const wrapperPairs = {
            '(': ')',
            '[': ']',
            '{': '}',
            '<': '>'
          } as const;
          if (Object.prototype.hasOwnProperty.call(wrapperPairs, firstChar as PropertyKey)) {
            const opener = firstChar as keyof typeof wrapperPairs;
            if (wrapperPairs[opener] === lastChar) {
              const inner = trimmedContent.slice(1, -1).trim();
              if (
                inner.length > 1 &&
                ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'")))
              ) {
                innerWrapperQuoted = true;
              }
            }
          }
        }
        const shouldWrap = trimmedContent.length > 0 && !isDirectlyQuoted && !innerWrapperQuoted;
        if (shouldWrap) {
          const escapedContent = content.replace(/"/g, '\\"');
          newLine += nodeId + openDelim + '"' + escapedContent + '"' + closeDelim;
        } else {
          newLine += nodeId + openDelim + content + closeDelim;
        }
        lastIndex = endPos + closeDelim.length;
        nodePattern.lastIndex = lastIndex;
      }
    }
    newLine += line.substring(lastIndex);
    lines[lineIdx] = newLine || line;
  }
  return lines.join('\n');
}

export function ensureGraphDirective(diagram: string): string {
  if (/^\s*graph\s+/i.test(diagram)) {
    return diagram;
  }
  return `graph TD\n${diagram}`.trim();
}

export function fixSubgraphDirections(diagram: string): string {
  const subgraphFixed = diagram.replace(/(\bsubgraph\b[\s\S]*?\bdirection\s+)td\b/gi, (_, prefix) => `${prefix}TB`);
  const anyDirectionFixed = subgraphFixed.replace(/(\bdirection\s+)td\b/gi, (_, prefix) => `${prefix}TB`);
  return anyDirectionFixed;
}

export async function attemptMermaidFix(
  llm: CoreLlmClient | null,
  failedDiagram: string,
  errorMessage: string,
  options?: { forceLlm?: boolean }
): Promise<MermaidFixResponse> {
  const baseDiagram = ensureGraphDirective(failedDiagram);
  if (!llm) {
    return {
      fixed: false,
      explanation: 'No AI client provided for mermaid fix'
    };
  }
  if (!options?.forceLlm) {
    if (errorMessage.includes('direction') || errorMessage.includes('TD')) {
      const fixedDiagram = fixSubgraphDirections(baseDiagram);
      if (fixedDiagram !== baseDiagram) {
        return {
          fixed: true,
          diagram: fixedDiagram,
          explanation: 'Fixed invalid TD direction in subgraph - converted to TB'
        };
      }
    }
    if (
      errorMessage.includes('backtick') ||
      errorMessage.includes('`') ||
      errorMessage.includes('Unrecognized text') ||
      baseDiagram.includes('`')
    ) {
      const backtickFixedDiagram = applyBacktickFix(baseDiagram);
      if (backtickFixedDiagram !== baseDiagram) {
        const fullyFixedDiagram = applyUniversalQuoteFix(backtickFixedDiagram);
        return {
          fixed: true,
          diagram: fullyFixedDiagram,
          explanation: 'Fixed backticks in node labels by converting to single quotes'
        };
      }
    }
    if (errorMessage.includes('quote') || errorMessage.includes('"') || errorMessage.includes("'")) {
      const fixedDiagram = applyUniversalQuoteFix(baseDiagram);
      if (fixedDiagram !== baseDiagram) {
        return {
          fixed: true,
          diagram: fixedDiagram,
          explanation: 'Fixed missing quotes in node labels'
        };
      }
    }
  }
  try {
    const prompt = MERMAID_FIX_PROMPT_TEMPLATE(baseDiagram, errorMessage);
    const result = await llm.callJson<MermaidFixResponse | string>(prompt, {
      task: 'mermaid_repair'
    });
    try {
      const maybeString = typeof result === 'string' ? result : JSON.stringify(result);
      let jsonText = maybeString.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonText.match(fenceRegex);
      if (match && match[2]) {
        jsonText = match[2].trim();
      }
      const fixResponse = JSON.parse(jsonText) as MermaidFixResponse;
      return fixResponse;
    } catch (parseError) {
      if (DEBUG_FLAGS.mermaid_debug) {
        logger.error('Failed to parse LLM response as JSON:', parseError);
        logger.error('Original text from LLM that failed parsing:', result);
      }
      return {
        fixed: false,
        explanation: 'Failed to parse fix response from AI'
      };
    }
  } catch (error: any) {
    if (DEBUG_FLAGS.mermaid_debug) {
      logger.error('Mermaid fix attempt failed:', error);
    }
    return {
      fixed: false,
      explanation: `Error during fix attempt: ${error.message}`
    };
  }
}

interface MermaidRecoveryOptions {
  llm: CoreLlmClient | null;
  initialDiagram: string;
  initialError: string;
  renderAttempt: (diagram: string) => Promise<{ svg: string }>;
  maxAttempts?: number;
}

export async function runMermaidRecovery(
  options: MermaidRecoveryOptions
): Promise<{ svg: string; diagram: string } | null> {
  const { llm, initialDiagram, initialError, renderAttempt, maxAttempts = 5 } = options;
  let currentDiagram = ensureGraphDirective(applyUniversalQuoteFix(applyBacktickFix(initialDiagram)));
  let currentError = initialError;
  const llmClient = llm;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await renderAttempt(currentDiagram);
      return { svg: result.svg, diagram: currentDiagram };
    } catch (err: any) {
      logger.error('[MERMAID_RECOVERY] Attempt', attempt, 'render failed:', err?.message || err);
      currentError = err?.message || 'Unknown render error';
      if (!llmClient) {
        break;
      }
      try {
        const fixResult = await attemptMermaidFix(llmClient, currentDiagram, currentError);
        if (fixResult.diagram) {
          currentDiagram = fixResult.diagram;
        }
      } catch (fixError: any) {
        logger.error('[MERMAID_RECOVERY] Attempt', attempt, 'fix invocation failed:', fixError?.message || fixError);
      }
    }
  }
  logger.error('[MERMAID_RECOVERY] Exhausted attempts without render');
  return null;
}

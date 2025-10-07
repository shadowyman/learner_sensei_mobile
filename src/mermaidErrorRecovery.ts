/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { logger, DEBUG_FLAGS } from './logger';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { MERMAID_ERROR_RECOVERY_CONFIG } from './model_usage';

interface MermaidFixRequest {
    failedDiagram: string;
    errorMessage: string;
}

interface MermaidFixResponse {
    fixed: boolean;
    diagram?: string;
    explanation?: string;
}

/**
 * Applies backtick fix by replacing all backticks with single quotes.
 * This handles Mermaid syntax errors caused by backticks in node labels.
 * @param diagram The mermaid diagram code
 * @returns The diagram with all backticks converted to single quotes
 */
export function applyBacktickFix(diagram: string): string {
    // Count backticks for processing
    const backtickCount = (diagram.match(/`/g) || []).length;
    
    if (backtickCount === 0) {
        return diagram;
    }
    
    // Replace all backticks with single quotes
    const fixedDiagram = diagram.replace(/`/g, "'");
    
    return fixedDiagram;
}

/**
 * Applies universal quote fix to all unquoted node text.
 * This handles the majority of syntax errors caused by missing quotes.
 * @param diagram The mermaid diagram code
 * @returns The diagram with all node text quoted
 */
export function applyUniversalQuoteFix(diagram: string): string {
    let fixedDiagram = diagram;
    
    // Helper function to find matching closing delimiter
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
    
    // Process line by line for better control
    const lines = fixedDiagram.split('\n');
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const originalLine = lines[lineIdx];
        if (originalLine === undefined) {
            continue;
        }
        let line = originalLine;
        
        // Match node definitions: Letter followed by delimiter
        // IMPORTANT: Longer patterns must come first in alternation
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
            
            // Determine closing delimiter
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
            
            // Find the matching closing delimiter
            let endPos = -1;
            
            if (openDelim === '((') {
                // For circle, we need to find matching ))
                let depth = 2; // We already consumed ((
                for (let i = startPos; i < line.length; i++) {
                    if (line[i] === '(') {
                        depth++;
                    } else if (line[i] === ')') {
                        depth--;
                        if (depth === 0) {
                            endPos = i - 1; // Point to content end, not the first )
                            break;
                        }
                    }
                }
            } else if (openDelim === '{{') {
                // For hexagon, we need to find matching }}
                let depth = 2; // We already consumed {{
                for (let i = startPos; i < line.length; i++) {
                    if (line[i] === '{') {
                        depth++;
                    } else if (line[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            endPos = i - 1; // Point to content end, not the first }
                            break;
                        }
                    }
                }
            } else {
                // For single delimiter shapes
                endPos = findMatchingDelimiter(line, startPos, searchOpenChar, searchCloseChar);
            }
            
            if (endPos !== -1 && endPos >= startPos) {
                // Extract content between delimiters
                const content = line.substring(startPos, endPos);
                const trimmedContent = content.trim();

                // Add everything before the node
                newLine += line.substring(lastIndex, match.index);

                const isDirectlyQuoted = trimmedContent.length > 1 && ((trimmedContent.startsWith('"') && trimmedContent.endsWith('"')) || (trimmedContent.startsWith("'") && trimmedContent.endsWith("'")));

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
                            if (inner.length > 1 && ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'")))) {
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
                
                // Update lastIndex to continue after the closing delimiter
                lastIndex = endPos + closeDelim.length;
                nodePattern.lastIndex = lastIndex;
            }
        }
        
        // Add any remaining part of the line
        newLine += line.substring(lastIndex);
        lines[lineIdx] = newLine || line;
    }
    
    return lines.join('\n');
}

/**
 * Fixes subgraph direction issues by converting TD to TB.
 * TD is not a valid direction inside subgraphs - must use TB instead.
 * @param diagram The mermaid diagram code
 * @returns The diagram with TD converted to TB in subgraphs
 */
export function fixSubgraphDirections(diagram: string): string {
    // Replace 'direction TD' with 'direction TB' only inside subgraphs
    return diagram.replace(/(\bsubgraph\b[\s\S]*?\bdirection\s+)TD\b/g, '$1TB');
}


const MERMAID_FIX_PROMPT_TEMPLATE = (failedDiagram: string, errorMessage: string) => `
Fix this Mermaid syntax error.

ERROR MESSAGE:
${errorMessage}

FAILED DIAGRAM:
${failedDiagram}

ANALYSIS PROCESS:
1. Read the error message carefully - note the line number and position
2. Look at what the parser expected vs what it found
3. Examine the specific line mentioned in the error
4. Identify the exact syntax issue causing the failure
5. COMPREHENSIVE FIX: If the issue is found in one location, scan the ENTIRE diagram for ALL instances of the same problem and fix them all
6. Check if error involves 'direction' inside a subgraph - valid options are ONLY: TB (Top to Bottom), BT (Bottom to Top), LR (Left to Right), RL (Right to Left). TD is invalid and must be converted to TB
7. If soup brackets used, convert it to either one of them: e.g. ([ … ]) can be changed to (()) OR [[]]

CRITICAL RULES (MUST BE APPLIED COMPREHENSIVELY):
- NO BACKTICKS ANYWHERE: Scan the ENTIRE diagram and replace ALL backticks (\`) with single quotes (') in every node label, edge label, and text content
- NO COMMENTS: Never use %%
- NO SEMICOLONS: Never end lines with ;
= NO SOUP BRACKETS: Combo rule: Only two hybrid combos—([ … ]) (pill) and [( … )] (cylinder)—are legal. Any other “bracket soup” will raise a parser error.
- SUBGRAPH DIRECTIONS: Inside subgraphs, valid directions are ONLY: TB (Top to Bottom), BT (Bottom to Top), LR (Left to Right), RL (Right to Left). Never use 'direction TD' - always convert to 'direction TB'
- Do not redesign or restructure
- Apply systematic fixes to resolve ALL instances of detected issues

Return the complete fixed diagram.

Provide your response as JSON with this structure:
{
    "fixed": true/false,
    "diagram": "the corrected Mermaid diagram code",
    "explanation": "brief explanation of what was fixed"
}
`;

export async function attemptMermaidFix(
    ai: GoogleGenAI,
    failedDiagram: string,
    errorMessage: string
): Promise<MermaidFixResponse> {
    const startTime = Date.now();
    
    // First try rule-based fixes
    if (errorMessage.includes('direction') || errorMessage.includes('TD')) {
        const fixedDiagram = fixSubgraphDirections(failedDiagram);
        if (fixedDiagram !== failedDiagram) {
            return {
                fixed: true,
                diagram: fixedDiagram,
                explanation: 'Fixed invalid TD direction in subgraph - converted to TB'
            };
        }
    }
    
    // If backtick-related error, try backtick fix first
    if (errorMessage.includes('backtick') || errorMessage.includes('`') || errorMessage.includes('Unrecognized text') || failedDiagram.includes('`')) {
        const backtickFixedDiagram = applyBacktickFix(failedDiagram);
        if (backtickFixedDiagram !== failedDiagram) {
            // Also apply quote fix after backtick fix
            const fullyFixedDiagram = applyUniversalQuoteFix(backtickFixedDiagram);
            return {
                fixed: true,
                diagram: fullyFixedDiagram,
                explanation: 'Fixed backticks in node labels by converting to single quotes'
            };
        }
    }

    // If quote-related error, try universal quote fix
    if (errorMessage.includes('quote') || errorMessage.includes('"') || errorMessage.includes("'")) {
        const fixedDiagram = applyUniversalQuoteFix(failedDiagram);
        if (fixedDiagram !== failedDiagram) {
            return {
                fixed: true,
                diagram: fixedDiagram,
                explanation: 'Fixed missing quotes in node labels'
            };
        }
    }

    // Fall back to LLM-based fix

    try {
        const prompt = MERMAID_FIX_PROMPT_TEMPLATE(failedDiagram, errorMessage);

        // Log the full prompt being sent

        const genAIResponse: GenerateContentResponse = await ai.models.generateContent({
            model: MERMAID_ERROR_RECOVERY_CONFIG.modelName,
            contents: prompt, // Pass the prompt string directly
            config: MERMAID_ERROR_RECOVERY_CONFIG.config 
        });

        const text = genAIResponse.text; // Access .text directly

        try {
            // The Gemini API for JSON output might wrap the JSON in ```json ... ```
            let jsonText = text.trim();
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
                logger.error('Original text from LLM that failed parsing:', text);
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
    ai: GoogleGenAI | null;
    initialDiagram: string;
    initialError: string;
    renderAttempt: (diagram: string) => Promise<{ svg: string }>;
    maxAttempts?: number;
}

export async function runMermaidRecovery(options: MermaidRecoveryOptions): Promise<{ svg: string; diagram: string } | null> {
    const { ai, initialDiagram, initialError, renderAttempt, maxAttempts = 5 } = options;
    let currentDiagram = applyUniversalQuoteFix(applyBacktickFix(initialDiagram));
    let currentError = initialError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await renderAttempt(currentDiagram);
            return { svg: result.svg, diagram: currentDiagram };
        } catch (err: any) {
            logger.error('[MERMAID_RECOVERY] Attempt', attempt, 'render failed:', err?.message || err);
            currentError = err?.message || 'Unknown render error';
            if (!ai) {
                break;
            }
            try {
                const fixResult = await attemptMermaidFix(ai, currentDiagram, currentError);
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

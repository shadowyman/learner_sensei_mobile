export const MERMAID_FIX_PROMPT_TEMPLATE = (failedDiagram: string, errorMessage: string) => `
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

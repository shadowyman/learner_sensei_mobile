export const SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION = `You are an expert tutor, Recursive Sensei.
The user has selected a specific piece of text FROM ONE OF YOUR PREVIOUS, LARGER EXPLANATIONS.
You will be given:
1.  Your full original explanation.
2.  The specific text snippet the user selected from it.
3.  An instruction for what to do with the selected text.
4.  A user-friendly label for the action performed (e.g., "Simpler", "Analogy").

Your task is to:
1.  Generate a concise, descriptive, and user-friendly title for a pop-up modal. This title should summarize the action being performed on the selected text. It should incorporate or be inspired by the provided user-friendly action label. The title should be engaging and clearly indicate the content of the pop-up.
2.  Provide a fully compliant execution of the given instruction for the SELECTED TEXT snippet, using the FULL ORIGINAL EXPLANATION for context.

### RESPONSE FORMAT:
- "suggestedTitle": A string for the modal title.
- "explanation": A string containing the full response in Markdown format. The explanation should be suitable for a pop-up window but can be detailed.
- Focus the explanation ONLY on the selected text AND the requested action.
- Do not add any commentary before or after the JSON.
- Ensure the JSON is valid and quotes are escaped.

### C++ CODE REQUIREMENTS:
If explicitly asked to generate C++ code, follow these rules:
1. Your primary goal is logical correctness. Do not oversimplify an explanation if doing so introduces any ambiguity or logical flaw. It is better to be slightly more verbose and complex than to be simple and wrong.
2. Ensure it is C++.
3. Your C++ code must be correct, runnable, and free of syntax errors. It must reflect industry best practices, interview completeness, and efficiency.
4. Double check your code for correctness and completeness before including it. Test your code with edge cases in mind. 


### ASCII ART VISUALIZATION CONSTRAINTS:
1.  CRITICAL VISUALIZATION CHECK: YOU MUST USE simple, pure text-based ASCII art (e.g., using slashes and dashes) in a markdown codeblock ONLY for explanations that involve tree and graph structures (for example display a sample tree or graph where code can be referred along with). 2.  Avoid structured visualization languages (like Mermaid). The visualization must be easily interpretable in plain text format.
3.  Do NOT include any other text within the visualization block. All accompanying text for the visualization must be outside the visualization markdown code block.
4.  Constraint: When generating ASCII art for tree or graph structures, only display the static structure of the input data; do not include recursion flow, call stack tracing, or computational paths. 
5.  Ensure the slash and dashes appear correctly aligned in the code block. For example, calculate the center of the nodes to horizontally and vertically align the slashes and dashes.
`;

export function SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
    originalSenseiMessageText: string,
    selectedText: string,
    instructionText: string,
    actionLabel: string
): string {
    return `
Here is your original full explanation (where the selected text came from):
--- ORIGINAL EXPLANATION START ---
${originalSenseiMessageText}
--- ORIGINAL EXPLANATION END ---

From that explanation, I selected the following text:
--- SELECTED TEXT START ---
${selectedText}
--- SELECTED TEXT END ---

Please perform the following instruction on the "SELECTED TEXT" only, using the "ORIGINAL EXPLANATION" for context while adhering to the requirements:
Instruction: ${instructionText}
User-friendly Action Label (use this to inspire the title): "${actionLabel}"

Generate a JSON response with "suggestedTitle" and "explanation".
The "suggestedTitle" should be descriptive, engaging, and incorporate the User-friendly Action Label.
The "explanation" should fulfill the instruction.
Return ONLY the JSON object.
`;
}

export function SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(
    originalSenseiMessageText: string,
    selectedText: string,
    userQuestion: string,
    actionLabel: string
): string {
    return `
Here is your original full explanation:
--- ORIGINAL EXPLANATION START ---
${originalSenseiMessageText}
--- ORIGINAL EXPLANATION END ---

From that explanation, I selected the following text:
--- SELECTED TEXT START ---
${selectedText}
--- SELECTED TEXT END ---

I have a specific question about this selected text:
--- MY QUESTION START ---
${userQuestion}
--- MY QUESTION END ---

Please answer my question.
User-friendly Action Label (use this to inspire the title): "${actionLabel}"

Generate a JSON response with "suggestedTitle" and "explanation".
The "suggestedTitle" should be a concise summary of my question (e.g., "Regarding the base case...").
The "explanation" should be a comprehensive answer to my question.
Return ONLY the JSON object.
`;
}

export type SelectionSenseiToolbarActionType =
    | 'explainSimpler'
    | 'explainWithAnalogy'
    | 'explainInMoreDepth'
    | 'showAnExample'
    | 'showExampleCodeSnippet'
    | 'askQuestion';

export const SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS: Record<Exclude<SelectionSenseiToolbarActionType, 'askQuestion'>, string> = {
    explainSimpler: "Explain the 'SELECTED TEXT' in a simpler way, suitable for a beginner who might be finding it complex.",
    explainWithAnalogy: "Provide a clear and concise analogy to help understand the 'SELECTED TEXT'.",
    explainInMoreDepth: "Explain the 'SELECTED TEXT' in more depth, providing more details and context. Try to understand why someone would require more depth for 'SELECTED TEXT' and tailor your response accordingly. The goal is proactively making sure you cover everything for it.",
    showAnExample: "Provide a new relevant and illustrative example for the concept in the 'SELECTED TEXT'. The example should be explained in detail.",
    showExampleCodeSnippet: "Provide a fully functional C++ code implementation that demonstrates the concept discussed in the 'SELECTED TEXT'. For code snippets, assume surrounding non-essential auxiliary infrastructure already exists—show only the lines necessary to illustrate the 'SELECTED TEXT'. After the code, provide a LINE-BY-LINE explanation of the code in a table. Then, anticipate and address common questions or pitfalls a novice or seasoned programmer might have about each part of the code. Make connections to the context throughout your explanation."
};

export function getSelectionSenseiToolbarActionInstruction(actionType: string): string | undefined {
    if (actionType === 'askQuestion') {
        return undefined;
    }
    return SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS[actionType as Exclude<SelectionSenseiToolbarActionType, 'askQuestion'>];
}

export function buildSelectionSenseiToolbarPrompt(request: {
    actionType: string;
    selectedText: string;
    originalSenseiMessageText: string;
    actionLabel: string;
    userQuestion?: string;
}): string {
    if (request.actionType === 'askQuestion') {
        return SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(
            request.originalSenseiMessageText,
            request.selectedText,
            request.userQuestion ?? '',
            request.actionLabel
        );
    }

    const instructionText = getSelectionSenseiToolbarActionInstruction(request.actionType);
    if (!instructionText) {
        throw new Error(`Unknown Selection Sensei toolbar action: ${request.actionType}`);
    }

    return SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
        request.originalSenseiMessageText,
        request.selectedText,
        instructionText,
        request.actionLabel
    );
}

export type SelectionSenseiModalTranscriptRole = 'user' | 'assistant';

export interface SelectionSenseiModalTranscriptEntry {
    role: SelectionSenseiModalTranscriptRole;
    content: string;
}

export interface SelectionSenseiInitialActionContext {
    actionType: SelectionSenseiToolbarActionType;
    actionLabel: string;
    userQuestion?: string;
}

export interface SelectionSenseiInitialResponseContext {
    suggestedTitle?: string;
    explanation?: string;
    rawText?: string;
}

export interface SelectionSenseiFollowUpPromptRequest {
    selectedText: string;
    originalSenseiMessageText: string;
    question: string;
    initialAction: SelectionSenseiInitialActionContext;
    initialResponse: SelectionSenseiInitialResponseContext;
    transcript?: SelectionSenseiModalTranscriptEntry[];
}

function formatInitialAction(action: SelectionSenseiInitialActionContext): string {
    const parts = [
        `Action Type: ${action.actionType}`,
        `Action Label: ${action.actionLabel}`
    ];
    if (action.userQuestion) {
        parts.push(`Original Ask Question: ${action.userQuestion}`);
    }
    return parts.join('\n');
}

function formatInitialResponse(response: SelectionSenseiInitialResponseContext): string {
    const parts: string[] = [];
    if (response.suggestedTitle) {
        parts.push(`Suggested Title: ${response.suggestedTitle}`);
    }
    if (response.explanation) {
        parts.push(response.explanation);
    } else if (response.rawText) {
        parts.push(response.rawText);
    }
    return parts.join('\n\n') || '[No initial response text supplied]';
}

function formatTranscript(transcript: SelectionSenseiModalTranscriptEntry[] | undefined): string {
    if (!transcript || transcript.length === 0) {
        return '[No previous follow-up turns supplied]';
    }
    return transcript
        .map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
        .join('\n');
}

export function buildSelectionSenseiFollowUpPrompt(request: SelectionSenseiFollowUpPromptRequest): string {
    return `
Here is your original full explanation:
--- ORIGINAL EXPLANATION START ---
${request.originalSenseiMessageText}
--- ORIGINAL EXPLANATION END ---

From that explanation, I selected the following text:
--- SELECTED TEXT START ---
${request.selectedText}
--- SELECTED TEXT END ---

The original Selection Sensei action was:
--- INITIAL ACTION START ---
${formatInitialAction(request.initialAction)}
--- INITIAL ACTION END ---

Your initial Selection Sensei response was:
--- INITIAL SELECTION SENSEI RESPONSE START ---
${formatInitialResponse(request.initialResponse)}
--- INITIAL SELECTION SENSEI RESPONSE END ---

The recent modal conversation after the initial answer is:
--- RECENT MODAL TRANSCRIPT START ---
${formatTranscript(request.transcript)}
--- RECENT MODAL TRANSCRIPT END ---

The learner now asks this follow-up question:
--- FOLLOW-UP QUESTION START ---
${request.question}
--- FOLLOW-UP QUESTION END ---

Answer the follow-up question using the selected text, original explanation, initial action, initial response, and recent modal transcript as context.
Generate a JSON response with "suggestedTitle" and "explanation".
The "suggestedTitle" should be a concise title for the follow-up answer.
The "explanation" should answer the follow-up question in Markdown format.
Return ONLY the JSON object.
`;
}

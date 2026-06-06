import { createHash } from 'crypto';
import {
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS
} from '../src/prompts';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const toolbarActionInstructions = {
    explainSimpler: "Explain the 'SELECTED TEXT' in a simpler way, suitable for a beginner who might be finding it complex.",
    explainWithAnalogy: "Provide a clear and concise analogy to help understand the 'SELECTED TEXT'.",
    explainInMoreDepth: "Explain the 'SELECTED TEXT' in more depth, providing more details and context. Try to understand why someone would require more depth for 'SELECTED TEXT' and tailor your response accordingly. The goal is proactively making sure you cover everything for it.",
    showAnExample: "Provide a new relevant and illustrative example for the concept in the 'SELECTED TEXT'. The example should be explained in detail.",
    showExampleCodeSnippet: "Provide a fully functional C++ code implementation that demonstrates the concept discussed in the 'SELECTED TEXT'. For code snippets, assume surrounding non-essential auxiliary infrastructure already exists—show only the lines necessary to illustrate the 'SELECTED TEXT'. After the code, provide a LINE-BY-LINE explanation of the code in a table. Then, anticipate and address common questions or pitfalls a novice or seasoned programmer might have about each part of the code. Make connections to the context throughout your explanation."
} as const;

describe('Selection Sensei prompts sans Mermaid', () => {
    it('system instruction explicitly discourages Mermaid diagrams', () => {
        expect(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION).toContain('Avoid structured visualization languages (like Mermaid)');
    });

    it('user prompt template omits Mermaid directives', () => {
        const prompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
            'Original explanation',
            'Selected text',
            'Explain the concept',
            'Simpler'
        );
        expect(prompt.toLowerCase()).not.toContain('```mermaid');
    });
});

describe('Selection Sensei prompt custody red/golden tests', () => {
    const original = 'Original explanation about recursion and base cases.';
    const selected = 'base case stops recursion';
    const simplerInstruction = "Explain the 'SELECTED TEXT' in a simpler way, suitable for a beginner who might be finding it complex.";
    const askQuestion = 'Why does the base case need to come before the recursive call?';

    it('keeps the old Selection Sensei system prompt runtime SHA and length before Core migration', () => {
        expect(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION).toHaveLength(2878);
        expect(sha256(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION)).toBe('56dc75df6fa8d62e55a3d7bb64908d8c343282918d58714cc508d97c7481ec12');
    });

    it('keeps the old standard toolbar prompt runtime SHA and length before Core migration', () => {
        const prompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            simplerInstruction,
            'Simpler'
        );

        expect(prompt).toHaveLength(919);
        expect(sha256(prompt)).toBe('213c6ccbb969b1c220c8f8818a4257e194486bf38d100513e1892556a4aa1698');
    });

    it('keeps the old ask-question prompt runtime SHA and length before Core migration', () => {
        const prompt = SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            askQuestion,
            'Ask'
        );

        expect(prompt).toHaveLength(823);
        expect(sha256(prompt)).toBe('688ab5ee7e3ba010e9a2738d4049859862784295c6b0f38174e23387ab9c8c7c');
    });

    it('keeps exact old toolbar action instruction strings through the src prompt facade', () => {
        expect(SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS).toEqual(toolbarActionInstructions);
    });

    it('exposes Selection Sensei prompt builders from the future Core prompt owner', () => {
        const corePrompts = require('@sensei/core/prompts/selectionSensei');
        expect(corePrompts.SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION).toBe(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION);
        expect(corePrompts.SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            simplerInstruction,
            'Simpler'
        )).toBe(SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            simplerInstruction,
            'Simpler'
        ));
        expect(corePrompts.SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            askQuestion,
            'Ask'
        )).toBe(SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION(
            original,
            selected,
            askQuestion,
            'Ask'
        ));
    });

    it('exposes exact toolbar action instructions from the future Core prompt owner', () => {
        const corePrompts = require('@sensei/core/prompts/selectionSensei');
        expect(corePrompts.SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS).toEqual(toolbarActionInstructions);
        if (typeof corePrompts.buildSelectionSenseiToolbarPrompt === 'function') {
            for (const actionType of Object.keys(toolbarActionInstructions)) {
                const prompt = corePrompts.buildSelectionSenseiToolbarPrompt({
                    actionType,
                    selectedText: selected,
                    originalSenseiMessageText: original,
                    actionLabel: actionType
                });
                expect(prompt).toContain(toolbarActionInstructions[actionType as keyof typeof toolbarActionInstructions]);
            }
        }
    });
});

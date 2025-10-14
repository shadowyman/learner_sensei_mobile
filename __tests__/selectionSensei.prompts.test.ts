import {
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION
} from '../src/prompts';

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

import {
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION
} from '../src/prompts';

describe('Selection Sensei prompts sans Mermaid', () => {
    it('system instruction omits Mermaid directives', () => {
        expect(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION.toLowerCase()).not.toContain('mermaid');
    });

    it('user prompt template omits Mermaid directives', () => {
        const prompt = SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION(
            'Original explanation',
            'Selected text',
            'Explain the concept',
            'Simpler'
        );
        expect(prompt.toLowerCase()).not.toContain('mermaid');
    });
});

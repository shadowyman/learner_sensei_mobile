import {
    buildSelectionSenseiFollowUpPrompt,
    createBrowserCoreLlmClient,
    runSelectionSenseiModalMessage,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SelectionSenseiModalMessageRequest
} from '@sensei/core';

describe('Selection Sensei Core modal capability', () => {
    const baseToolbarRequest: SelectionSenseiModalMessageRequest = {
        mode: 'toolbarAction',
        actionType: 'explainSimpler',
        selectedText: 'base case stops recursion',
        originalSenseiMessageText: 'Original explanation about recursion and base cases.',
        actionLabel: 'Simpler'
    };

    function createLlm(response: string) {
        const calls: Array<{ prompt: string; options?: { task?: string } }> = [];
        return {
            calls,
            llm: {
                async callText(prompt: string, options?: { task?: string }) {
                    calls.push({ prompt, options });
                    return response;
                },
                async callJson<T>() {
                    throw new Error('callJson should not be used by Selection Sensei modal capability');
                },
                async callWithTools() {
                    throw new Error('callWithTools should not be used by Selection Sensei modal capability');
                }
            }
        };
    }

    it('toolbar mode invokes injected LLM with selection task and parses JSON output', async () => {
        const { llm, calls } = createLlm('{"suggestedTitle":"Base Case","explanation":"A base case ends recursion."}');

        const result = await runSelectionSenseiModalMessage(llm, baseToolbarRequest);

        expect(result).toEqual({
            ok: true,
            suggestedTitle: 'Base Case',
            explanation: 'A base case ends recursion.',
            rawText: '{"suggestedTitle":"Base Case","explanation":"A base case ends recursion."}'
        });
        expect(calls).toHaveLength(1);
        expect(calls[0].options).toEqual({ task: 'selection_sensei_modal' });
        expect(calls[0].prompt).toContain(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION);
        expect(calls[0].prompt).toContain("Explain the 'SELECTED TEXT' in a simpler way");
        expect(calls[0].prompt).toContain('base case stops recursion');
    });

    it('ask-question toolbar mode includes the user question through Core prompt construction', async () => {
        const { llm, calls } = createLlm('{"suggestedTitle":"Base Case Order","explanation":"Put the base case first."}');

        const result = await runSelectionSenseiModalMessage(llm, {
            ...baseToolbarRequest,
            actionType: 'askQuestion',
            actionLabel: 'Ask',
            userQuestion: 'Why must the base case come before the recursive call?'
        });

        expect(result.ok).toBe(true);
        expect(calls[0].prompt).toContain(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION);
        expect(calls[0].prompt).toContain('--- MY QUESTION START ---');
        expect(calls[0].prompt).toContain('Why must the base case come before the recursive call?');
        expect(calls[0].options).toEqual({ task: 'selection_sensei_modal' });
    });

    it('follow-up mode builds prompt from explicit modal context without provider history', async () => {
        const { llm, calls } = createLlm('{"suggestedTitle":"Follow Up","explanation":"The initial answer already explained the stopping condition."}');
        const followUpRequest: SelectionSenseiModalMessageRequest = {
            mode: 'followUp',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            question: 'Can you connect that to stack unwinding?',
            initialAction: {
                actionType: 'explainSimpler',
                actionLabel: 'Simpler'
            },
            initialResponse: {
                suggestedTitle: 'Base Case',
                explanation: 'A base case stops recursion before another recursive call.'
            },
            transcript: [
                { role: 'user', content: 'Can you make it shorter?' },
                { role: 'assistant', content: 'It is the stopping rule.' }
            ]
        };

        const prompt = buildSelectionSenseiFollowUpPrompt(followUpRequest);
        const result = await runSelectionSenseiModalMessage(llm, followUpRequest);

        expect(result.ok).toBe(true);
        expect(prompt).toContain('--- INITIAL SELECTION SENSEI RESPONSE START ---');
        expect(prompt).toContain('A base case stops recursion before another recursive call.');
        expect(prompt).toContain('--- RECENT MODAL TRANSCRIPT START ---');
        expect(prompt).toContain('User: Can you make it shorter?');
        expect(prompt).toContain('Assistant: It is the stopping rule.');
        expect(prompt).toContain('Can you connect that to stack unwinding?');
        expect(calls[0].prompt).toContain(SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION);
        expect(calls[0].prompt).toContain(prompt);
        expect(calls[0].options).toEqual({ task: 'selection_sensei_modal' });
    });

    it('fails deterministically for null provider and non-LLM toolbar actions', async () => {
        await expect(runSelectionSenseiModalMessage(null, baseToolbarRequest)).resolves.toEqual({
            ok: false,
            errorCode: 'missing_llm',
            errorMessage: 'Selection Sensei modal capability requires an LLM client.'
        });

        for (const actionType of ['addToNotepad', 'copy', 'share']) {
            const { llm, calls } = createLlm('{"suggestedTitle":"No","explanation":"No"}');
            const result = await runSelectionSenseiModalMessage(llm, {
                ...baseToolbarRequest,
                actionType: actionType as any
            });

            expect(result).toEqual({
                ok: false,
                errorCode: 'invalid_request',
                errorMessage: 'Unsupported Selection Sensei toolbar action.'
            });
            expect(calls).toHaveLength(0);
        }
    });

    it('rejects final prompt-string and provider-control payloads before provider execution', async () => {
        const forbiddenValues: Record<string, unknown> = {
            prompt: 'Final prompt should not cross the mobile boundary',
            finalPrompt: 'Final prompt should not cross the mobile boundary',
            promptText: 'Final prompt should not cross the mobile boundary',
            message: 'Raw provider message should not cross the boundary',
            instruction: 'Instruction text should stay Core-owned',
            systemInstruction: 'System instruction should stay Core-owned',
            model: 'gemini-pro',
            temperature: 1,
            config: { responseMimeType: 'text/plain' },
            tools: [{ name: 'unsafe' }],
            providerOptions: { unsafe: true },
            safetySettings: [{ category: 'unsafe' }],
            history: [{ role: 'user', parts: [] }],
            requestId: 'transport-only-id',
            chat: { sendMessage: jest.fn() }
        };

        for (const [field, value] of Object.entries(forbiddenValues)) {
            const { llm, calls } = createLlm('{"suggestedTitle":"No","explanation":"No"}');
            const result = await runSelectionSenseiModalMessage(llm, {
                ...baseToolbarRequest,
                [field]: value
            } as any);

            expect(result).toEqual({
                ok: false,
                errorCode: 'invalid_request',
                errorMessage: 'Selection Sensei modal request contains forbidden prompt or provider-control fields.'
            });
            expect(calls).toHaveLength(0);
        }
    });

    it('requires explicit follow-up initial action and initial response context before provider execution', async () => {
        const validFollowUp: SelectionSenseiModalMessageRequest = {
            mode: 'followUp',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            question: 'Can you connect that to stack unwinding?',
            initialAction: {
                actionType: 'explainSimpler',
                actionLabel: 'Simpler'
            },
            initialResponse: {
                explanation: 'A base case stops recursion before another recursive call.'
            }
        };
        const invalidCases = [
            { ...validFollowUp, initialAction: { ...validFollowUp.initialAction, actionType: '' } },
            { ...validFollowUp, initialAction: { ...validFollowUp.initialAction, actionLabel: '' } },
            { ...validFollowUp, initialResponse: {} },
            { ...validFollowUp, initialResponse: { suggestedTitle: '   ', explanation: '', rawText: '' } }
        ];

        for (const request of invalidCases) {
            const { llm, calls } = createLlm('{"suggestedTitle":"No","explanation":"No"}');
            const result = await runSelectionSenseiModalMessage(llm, request as any);

            expect(result).toEqual({
                ok: false,
                errorCode: 'invalid_request',
                errorMessage: 'Selection Sensei follow-up request is missing required modal context.'
            });
            expect(calls).toHaveLength(0);
        }
    });

    it('normalizes malformed provider output through the tolerant parser', async () => {
        const { llm } = createLlm(`Here is the response: "suggestedTitle": "Loose", "explanation": "Recovered text"`);

        const result = await runSelectionSenseiModalMessage(llm, baseToolbarRequest);

        expect(result).toEqual({
            ok: true,
            suggestedTitle: 'Loose',
            explanation: 'Recovered text',
            rawText: `Here is the response: "suggestedTitle": "Loose", "explanation": "Recovered text"`
        });
    });
});

describe('Selection Sensei browser Core client task routing', () => {
    it('uses JSON response MIME type and temperature parity for selection_sensei_modal', async () => {
        const generateContent = jest.fn().mockResolvedValue({
            text: () => '{"suggestedTitle":"Configured","explanation":"Configured"}'
        });
        const client = createBrowserCoreLlmClient({ models: { generateContent } });

        await client?.callText('Prompt text', { task: 'selection_sensei_modal' });

        expect(generateContent).toHaveBeenCalledWith({
            model: 'gemini-flash-latest',
            contents: [{ parts: [{ text: 'Prompt text' }] }],
            config: {
                responseMimeType: 'application/json',
                temperature: 0.5
            }
        });
    });
});

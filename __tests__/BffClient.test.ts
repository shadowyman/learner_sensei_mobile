import { BffClient } from '../src/mobile/network/BffClient';
import type { BridgeManager } from '../src/mobile/bridge/BridgeManager';

const createFetchStub = () => {
    let callCount = 0;
    return (async (url: string, init?: RequestInit) => {
        callCount += 1;
        if (url.endsWith('/sessions') && init?.method === 'POST') {
            return {
                ok: true,
                json: async () => ({ sessionId: 'session-1' })
            } as Response;
        }
        if (/\/sessions\/session-1\/turns$/.test(url)) {
            return {
                ok: true,
                json: async () => ({ turnId: 'turn-1', streamUrl: 'wss://example.test/stream' })
            } as Response;
        }
        if (/\/sessions\/session-1\/llm-stream$/.test(url)) {
            return {
                ok: true,
                json: async () => ({ requestId: 'llmreq-1', streamUrl: 'wss://example.test/llm-stream' })
            } as Response;
        }
        if (url.endsWith('/mermaid/recover')) {
            return {
                ok: true,
                json: async () => ({ fixed: true, fixedCode: 'graph TD; A-->B;' })
            } as Response;
        }
        throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;
};

class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    public onopen: (() => void) | null = null;
    public onmessage: ((event: { data: string }) => void) | null = null;
    public onerror: ((event: { message?: string }) => void) | null = null;
    public onclose: (() => void) | null = null;
    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
        setTimeout(() => this.onopen?.(), 0);
    }
    emit(data: any) {
        this.onmessage?.({ data: JSON.stringify(data) });
    }
    close() {
        this.onclose?.();
    }
}

describe('BffClient', () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
    });

    it('connects, yields stream events, and forwards wrap-up data', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: createFetchStub(),
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        const handle = await client.submitTurn({ text: 'hello', clientTurnId: 'client-turn-1' });
        const iterator = handle.stream[Symbol.asyncIterator]();

        const socket = FakeWebSocket.instances.at(-1)!;
        socket.emit({ type: 'chunk', text: 'Hi there' });
        socket.emit({ type: 'wrapUp', payload: { moduleTitle: 'Test', questions: [] } });
        socket.close();

        const events: any[] = [];
        events.push(await iterator.next());
        events.push(await iterator.next());

        expect(events[0].value).toMatchObject({ type: 'chunk', text: 'Hi there' });
        expect(events[1].value).toMatchObject({ type: 'status', phase: 'completed' });
        expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'wrapup:show' }));

        const recovery = await client.recoverMermaid({ messageId: 'msg-1', code: 'graph TD; A-->B;' });
        expect(recovery.fixed).toBe(true);
    });

    it('submits capability LLM streams and preserves stream identity fields', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: createFetchStub(),
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        const handle = await client.submitLlmStream({
            capability: 'moduleIntroduction',
            messageId: 'msg-llm-1',
            payload: {
                selectedModuleTitle: 'Module',
                firstConceptTitle: 'Concept',
                phaseDisplayName: 'IntroIllustrate',
                userInputText: 'Phase: IntroIllustrate',
                curriculumFocus: { status: 'general' }
            }
        });
        expect(handle.requestId).toBe('llmreq-1');
        expect(handle.messageId).toBe('msg-llm-1');

        const iterator = handle.stream[Symbol.asyncIterator]();
        const socket = FakeWebSocket.instances.at(-1)!;
        socket.emit({ type: 'status', phase: 'started', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
        socket.emit({ type: 'chunk', text: 'Native chunk', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
        socket.emit({ type: 'status', phase: 'completed', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
        socket.close();

        const events: any[] = [];
        events.push(await iterator.next());
        events.push(await iterator.next());
        events.push(await iterator.next());

        expect(events[0].value).toMatchObject({ type: 'status', phase: 'started', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
        expect(events[1].value).toMatchObject({ type: 'chunk', text: 'Native chunk', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
        expect(events[2].value).toMatchObject({ type: 'status', phase: 'completed', requestId: 'llmreq-1', messageId: 'msg-llm-1', capability: 'moduleIntroduction' });
    });

    it('reports an error when an LLM stream socket closes before completion', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: createFetchStub(),
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        const handle = await client.submitLlmStream({
            capability: 'moduleIntroduction',
            messageId: 'msg-llm-premature-close',
            payload: {
                selectedModuleTitle: 'Module',
                firstConceptTitle: 'Concept',
                phaseDisplayName: 'IntroIllustrate',
                userInputText: 'Phase: IntroIllustrate',
                curriculumFocus: { status: 'general' }
            }
        });
        const iterator = handle.stream[Symbol.asyncIterator]();
        const socket = FakeWebSocket.instances.at(-1)!;
        socket.emit({ type: 'chunk', text: 'Partial chunk', requestId: 'llmreq-1', messageId: 'msg-llm-premature-close', capability: 'moduleIntroduction' });
        socket.close();

        expect((await iterator.next()).value).toMatchObject({
            type: 'chunk',
            text: 'Partial chunk',
            requestId: 'llmreq-1',
            messageId: 'msg-llm-premature-close',
            capability: 'moduleIntroduction'
        });
        expect((await iterator.next()).value).toMatchObject({
            type: 'error',
            code: 'DOWNSTREAM_UNAVAILABLE',
            message: 'LLM stream closed before completion',
            requestId: 'llmreq-1',
            messageId: 'msg-llm-premature-close',
            capability: 'moduleIntroduction'
        });
    });

    it('surfaces BFF rejection details for LLM stream submissions', async () => {
        const fetchStub = (async (url: string, init?: RequestInit) => {
            if (url.endsWith('/sessions') && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ sessionId: 'session-1' })
                } as Response;
            }
            if (/\/sessions\/session-1\/llm-stream$/.test(url)) {
                return {
                    ok: false,
                    status: 413,
                    json: async () => ({
                        code: 'PAYLOAD_TOO_LARGE',
                        message: 'Please shorten the prompt context.'
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch call: ${url}`);
        }) as typeof fetch;
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: fetchStub,
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        await expect(client.submitLlmStream({
            capability: 'mainSenseiResponse',
            messageId: 'msg-too-large',
            payload: {
                mode: 'standard',
                curriculumFocus: { status: 'general' },
                currentUserInput: 'Explain recursion.'
            }
        })).rejects.toThrow('LLM stream submission failed: 413 (PAYLOAD_TOO_LARGE: Please shorten the prompt context.)');
    });

    it('preserves unknown-session retry behavior for LLM stream submissions', async () => {
        const submittedUrls: string[] = [];
        const fetchStub = (async (url: string, init?: RequestInit) => {
            submittedUrls.push(url);
            if (url.endsWith('/sessions') && init?.method === 'POST') {
                const sessionId = submittedUrls.filter(value => value.endsWith('/sessions')).length === 1 ? 'stale-session' : 'session-2';
                return {
                    ok: true,
                    json: async () => ({ sessionId })
                } as Response;
            }
            if (/\/sessions\/stale-session\/llm-stream$/.test(url)) {
                return {
                    ok: false,
                    status: 400,
                    json: async () => ({
                        code: 'BAD_REQUEST',
                        message: 'Unknown session'
                    })
                } as Response;
            }
            if (/\/sessions\/session-2\/llm-stream$/.test(url)) {
                return {
                    ok: true,
                    json: async () => ({
                        requestId: 'llmreq-retry',
                        streamUrl: 'wss://example.test/llm-stream/retry'
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch call: ${url}`);
        }) as typeof fetch;
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: fetchStub,
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        const handle = await client.submitLlmStream({
            capability: 'mainSenseiResponse',
            messageId: 'msg-retry',
            payload: {
                mode: 'standard',
                curriculumFocus: { status: 'general' },
                currentUserInput: 'Explain recursion.'
            }
        });

        expect(handle.requestId).toBe('llmreq-retry');
        expect(submittedUrls).toEqual([
            'https://api.example.test/sessions',
            'https://api.example.test/sessions/stale-session/llm-stream',
            'https://api.example.test/sessions',
            'https://api.example.test/sessions/session-2/llm-stream'
        ]);
    });

    it('submits regular and Socratic main response streams with structured payloads', async () => {
        const submittedBodies: any[] = [];
        const fetchStub = (async (url: string, init?: RequestInit) => {
            if (url.endsWith('/sessions') && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ sessionId: 'session-1' })
                } as Response;
            }
            if (/\/sessions\/session-1\/llm-stream$/.test(url)) {
                const body = JSON.parse(String(init?.body));
                submittedBodies.push(body);
                return {
                    ok: true,
                    json: async () => ({
                        requestId: `llmreq-${submittedBodies.length}`,
                        streamUrl: `wss://example.test/llm-stream/${submittedBodies.length}`
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch call: ${url}`);
        }) as typeof fetch;
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: fetchStub,
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        const standard = await client.submitLlmStream({
            capability: 'mainSenseiResponse',
            messageId: 'msg-main-standard',
            payload: {
                mode: 'standard',
                curriculumFocus: { status: 'general' },
                currentUserInput: 'How do base cases stop recursion?'
            }
        });
        const socratic = await client.submitLlmStream({
            capability: 'mainSenseiResponse',
            messageId: 'msg-main-socratic',
            payload: {
                mode: 'socratic',
                teachingPlan: [[{
                    text: 'Ask why base cases stop recursion.',
                    interactionGuidance: {
                        expectedTurns: 2,
                        completionTriggers: ['base case explained'],
                        turnManagement: 'Ask one question at a time.'
                    },
                    socraticMetadata: {
                        detectedCategory: 'GENERAL_CONCEPT'
                    }
                }]],
                pedagogicalGuidance: {
                    directive: 'Use one concise question.'
                },
                isSystemInitialization: false,
                currentUserInput: 'I am stuck.'
            }
        });

        expect(submittedBodies).toHaveLength(2);
        expect(submittedBodies[0]).toMatchObject({
            capability: 'mainSenseiResponse',
            messageId: 'msg-main-standard',
            payload: {
                mode: 'standard',
                curriculumFocus: { status: 'general' },
                currentUserInput: 'How do base cases stop recursion?'
            }
        });
        expect(submittedBodies[0].payload).not.toHaveProperty('curriculumFocusInstruction');
        expect(submittedBodies[1]).toMatchObject({
            capability: 'mainSenseiResponse',
            messageId: 'msg-main-socratic',
            payload: {
                mode: 'socratic',
                currentUserInput: 'I am stuck.'
            }
        });
        expect(submittedBodies[1].payload).not.toHaveProperty('curriculumFocusInstruction');
        expect(standard).toMatchObject({
            requestId: 'llmreq-1',
            messageId: 'msg-main-standard',
            capability: 'mainSenseiResponse'
        });
        expect(socratic).toMatchObject({
            requestId: 'llmreq-2',
            messageId: 'msg-main-socratic',
            capability: 'mainSenseiResponse'
        });

        const iterator = socratic.stream[Symbol.asyncIterator]();
        const socket = FakeWebSocket.instances.at(-1)!;
        socket.emit({ type: 'chunk', text: 'Socratic chunk', requestId: 'llmreq-2', messageId: 'msg-main-socratic', capability: 'mainSenseiResponse' });
        socket.emit({ type: 'error', code: 'BAD_REQUEST', message: 'Rejected', requestId: 'llmreq-2', messageId: 'msg-main-socratic', capability: 'mainSenseiResponse' });
        socket.close();

        expect((await iterator.next()).value).toMatchObject({
            type: 'chunk',
            text: 'Socratic chunk',
            requestId: 'llmreq-2',
            messageId: 'msg-main-socratic',
            capability: 'mainSenseiResponse'
        });
        expect((await iterator.next()).value).toMatchObject({
            type: 'error',
            code: 'BAD_REQUEST',
            message: 'Rejected',
            requestId: 'llmreq-2',
            messageId: 'msg-main-socratic',
            capability: 'mainSenseiResponse'
        });
    });

    it('posts Selection Sensei toolbar and follow-up modal messages as structured route payloads', async () => {
        const submittedUrls: string[] = [];
        const submittedBodies: any[] = [];
        const fetchStub = (async (url: string, init?: RequestInit) => {
            submittedUrls.push(url);
            if (url.endsWith('/sessions') && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ sessionId: 'session-1' })
                } as Response;
            }
            if (/\/sessions\/session-1\/selection-sensei\/modal-message$/.test(url)) {
                submittedBodies.push(JSON.parse(String(init?.body)));
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        result: { suggestedTitle: 'Bridge', explanation: 'Bridge response' }
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch call: ${url}`);
        }) as typeof fetch;
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client: any = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: fetchStub,
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        await client.runSelectionSenseiModalMessage({
            mode: 'toolbarAction',
            actionType: 'explainSimpler',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            actionLabel: 'Simpler'
        });
        await client.runSelectionSenseiModalMessage({
            mode: 'followUp',
            modalConversationId: 'modal-1',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            initialActionType: 'askQuestion',
            initialActionLabel: 'Ask',
            initialActionUserQuestion: 'Why does this stop recursion?',
            initialResponse: { suggestedTitle: 'Base Case', explanation: 'A base case stops recursion.' },
            modalTranscript: [
                { role: 'user', text: 'Can you explain this simply?' },
                { role: 'sensei', text: 'A base case gives recursion a stopping point.' }
            ],
            question: 'How does that prevent an infinite loop?'
        });

        expect(submittedUrls).toEqual([
            'https://api.example.test/sessions',
            'https://api.example.test/sessions/session-1/selection-sensei/modal-message',
            'https://api.example.test/sessions/session-1/selection-sensei/modal-message'
        ]);
        expect(submittedBodies).toHaveLength(2);
        expect(submittedBodies[0]).toMatchObject({
            mode: 'toolbarAction',
            actionType: 'explainSimpler',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            actionLabel: 'Simpler'
        });
        expect(submittedBodies[1]).toMatchObject({
            mode: 'followUp',
            modalConversationId: 'modal-1',
            initialActionType: 'askQuestion',
            initialActionUserQuestion: 'Why does this stop recursion?',
            question: 'How does that prevent an infinite loop?'
        });
        for (const body of submittedBodies) {
            expect(body).not.toHaveProperty('prompt');
            expect(body).not.toHaveProperty('systemInstruction');
            expect(body).not.toHaveProperty('instruction');
            expect(body).not.toHaveProperty('model');
            expect(body).not.toHaveProperty('temperature');
            expect(body).not.toHaveProperty('providerOptions');
        }
    });

    it('surfaces BFF rejection details for Selection Sensei prompt-string modal payloads', async () => {
        const fetchStub = (async (url: string, init?: RequestInit) => {
            if (url.endsWith('/sessions') && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ sessionId: 'session-1' })
                } as Response;
            }
            if (/\/sessions\/session-1\/selection-sensei\/modal-message$/.test(url)) {
                return {
                    ok: false,
                    status: 400,
                    json: async () => ({
                        code: 'BAD_REQUEST',
                        message: 'Selection Sensei modal payload must be structured and cannot include prompt strings.'
                    })
                } as Response;
            }
            throw new Error(`Unexpected fetch call: ${url}`);
        }) as typeof fetch;
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const client: any = new BffClient({
            baseUrl: 'https://api.example.test',
            fetchImpl: fetchStub,
            webSocketImpl: FakeWebSocket as any,
            bridge
        });

        await expect(client.runSelectionSenseiModalMessage({
            mode: 'toolbarAction',
            actionType: 'explainSimpler',
            selectedText: 'base case stops recursion',
            originalSenseiMessageText: 'Original explanation about recursion and base cases.',
            actionLabel: 'Simpler',
            prompt: 'Explain this selected text.',
            systemInstruction: 'You are Selection Sensei.',
            model: 'gemini-test'
        })).rejects.toThrow('Selection Sensei modal submission failed: 400 (BAD_REQUEST: Selection Sensei modal payload must be structured and cannot include prompt strings.)');
    });
});

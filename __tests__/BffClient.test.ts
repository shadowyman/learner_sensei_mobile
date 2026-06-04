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
                curriculumFocusInstruction: 'Focus'
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
                curriculumFocusInstruction: 'Focus'
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
                curriculumFocusInstruction: '## Primary Action\nExplain base cases.\n__PEDAGOGICAL_GUIDANCE__',
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
                currentUserInput: 'How do base cases stop recursion?'
            }
        });
        expect(submittedBodies[1]).toMatchObject({
            capability: 'mainSenseiResponse',
            messageId: 'msg-main-socratic',
            payload: {
                mode: 'socratic',
                currentUserInput: 'I am stuck.'
            }
        });
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
});

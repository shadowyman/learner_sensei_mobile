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
});

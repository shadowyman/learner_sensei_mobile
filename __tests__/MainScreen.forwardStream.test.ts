import { runForwardStream } from '../src/mobile/MainScreen';
import type { BridgeManager } from '../src/mobile/bridge/BridgeManager';

describe('runForwardStream', () => {
    const telemetry = {
        record: jest.fn(),
        isEnabled: jest.fn(),
        toggle: jest.fn(),
        nextClientTurnId: jest.fn()
    } as any;

    const defer = async <T>(value: T): Promise<T> => value;

    const createHandle = (events: any[]) => defer({
        messageId: 'msg-1',
        stream: (async function* () {
            for (const event of events) {
                yield event;
            }
        })()
    });

    it('emits chat:completeMessage only when phase is completed', async () => {
        const enqueue = jest.fn();
        const setFooter = jest.fn();
        const setIsStreaming = jest.fn();
        const handle = createHandle([
            { type: 'status', phase: 'started' },
            { type: 'chunk', text: 'hello' },
            { type: 'status', phase: 'keepalive' },
            { type: 'status', phase: 'completed', footer: { confidence: 'high', confusion: 'low', intent: 'learn' } }
        ]);

        await runForwardStream(handle, {
            bridge: { enqueue } as unknown as BridgeManager,
            telemetryManager: telemetry,
            setFooter,
            setIsStreaming
        });

        const completionCalls = enqueue.mock.calls.filter(call => call[0]?.type === 'chat:completeMessage');
        expect(completionCalls).toHaveLength(1);
        expect(setFooter).toHaveBeenCalledWith(expect.objectContaining({ confidence: 'high' }));
        expect(setIsStreaming).toHaveBeenCalledWith(true);
        expect(setIsStreaming).toHaveBeenCalledWith(false);
    });

    it('always clears streaming flag when submitTurn rejects', async () => {
        const enqueue = jest.fn();
        const setFooter = jest.fn();
        const setIsStreaming = jest.fn();
        const handle = Promise.reject(new Error('network failure')) as any;

        await runForwardStream(handle, {
            bridge: { enqueue } as unknown as BridgeManager,
            telemetryManager: telemetry,
            setFooter,
            setIsStreaming
        });

        expect(setIsStreaming).toHaveBeenCalledWith(true);
        expect(setIsStreaming).toHaveBeenCalledWith(false);
        expect(enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'chat:completeMessage' }));
    });
});

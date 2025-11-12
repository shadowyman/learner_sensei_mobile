import { BridgeManager } from '../src/mobile/bridge/BridgeManager';
import type { RNToWebMessage } from '../src/mobile/bridge/contracts';

describe('BridgeManager', () => {
    const makeMessage = (type: RNToWebMessage['type'], extra: Partial<RNToWebMessage> = {}): RNToWebMessage => {
        switch (type) {
            case 'chat:startMessage':
                return { type, messageId: 'msg-1', sender: 'user', text: 'hello', ...extra } as RNToWebMessage;
            case 'chat:update':
                return { type, messageId: 'msg-1', text: 'chunk', ...extra } as RNToWebMessage;
            case 'chat:completeMessage':
                return { type, messageId: 'msg-1', ...extra } as RNToWebMessage;
            default:
                return { type, ...(extra as object) } as RNToWebMessage;
        }
    };

    it('throttles chat:update messages to the configured rate', () => {
        let now = 0;
        const dispatchOrder: RNToWebMessage[] = [];
        const scheduledCallbacks: Array<{ cb: () => void; delay: number }> = [];

        const manager = new BridgeManager({
            sender: message => {
                dispatchOrder.push(message);
            },
            maxChatUpdatesPerSecond: 10,
            now: () => now,
            schedule: (cb, delay) => {
                scheduledCallbacks.push({ cb, delay });
                return 0 as any;
            },
            clearTimeoutFn: () => undefined
        });

        manager.enqueue(makeMessage('chat:update', { text: 'chunk-1' }));
        manager.enqueue(makeMessage('chat:update', { text: 'chunk-2' }));
        manager.enqueue(makeMessage('chat:update', { text: 'chunk-3' }));

        expect(dispatchOrder).toHaveLength(1);
        expect(dispatchOrder[0]).toMatchObject({ text: 'chunk-1' });

        expect(scheduledCallbacks).toHaveLength(1);
        const firstCallback = scheduledCallbacks[0];
        now += firstCallback.delay;
        firstCallback.cb();

        expect(dispatchOrder).toHaveLength(2);
        expect(dispatchOrder[1]).toMatchObject({ text: 'chunk-2' });

        // Next callback scheduled
        expect(scheduledCallbacks).toHaveLength(2);
        const secondCallback = scheduledCallbacks[1];
        now += secondCallback.delay;
        secondCallback.cb();

        expect(dispatchOrder).toHaveLength(3);
        expect(dispatchOrder[2]).toMatchObject({ text: 'chunk-3' });
    });

    it('flushes non chat:update messages immediately', () => {
        const dispatchOrder: RNToWebMessage[] = [];
        const manager = new BridgeManager({
            sender: message => dispatchOrder.push(message)
        });

        manager.enqueue(makeMessage('chat:startMessage'));
        manager.enqueue(makeMessage('chat:completeMessage'));

        expect(dispatchOrder.map(message => message.type)).toEqual(['chat:startMessage', 'chat:completeMessage']);
    });
});

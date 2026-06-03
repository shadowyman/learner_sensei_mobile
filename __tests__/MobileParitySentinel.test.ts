import { BridgeManager } from '../src/mobile/bridge/BridgeManager';
import { SelectionOverlayController } from '../SenseiMobile/src/mobile/SelectionOverlay';
import { SaveLoadService } from '../src/mobile/saveLoad/SaveLoadService';
import { TelemetryManager } from '../src/mobile/telemetry/TelemetryManager';
import { BffClient } from '../src/mobile/network/BffClient';
import type { BridgeManager as BridgeType } from '../src/mobile/bridge/BridgeManager';
import { logger } from '../src/logger';

const recordSentinel = async (name: string, fn: () => Promise<void> | void) => {
    try {
        await fn();
        logger.info('[MOBILE_PORT] parity sentinel', { name, status: 'pass' });
    } catch (error) {
        logger.error('[MOBILE_PORT] parity sentinel', { name, status: 'fail', error: (error as Error).message });
        throw error;
    }
};

describe('Mobile parity sentinel suite', () => {
    test('streaming_diff sentinel', async () => {
        await recordSentinel('streaming_diff', () => {
            const dispatched: any[] = [];
            const manager = new BridgeManager({ sender: message => dispatched.push(message) });
            manager.enqueue({ type: 'chat:startMessage', messageId: 'msg-1', sender: 'user', text: 'hello' });
            manager.enqueue({ type: 'chat:update', messageId: 'msg-1', text: 'chunk-1' });
            manager.flushAll();
            expect(dispatched.map(msg => msg.type)).toEqual(['chat:startMessage', 'chat:update']);
        });
    });

    test('selection_alignment sentinel', async () => {
        await recordSentinel('selection_alignment', () => {
            const states: any[] = [];
            const controller = new SelectionOverlayController({
                bridge: { enqueue: jest.fn() } as unknown as BridgeType,
                onChange: state => states.push(state)
            });
            controller.handleWebMessage({
                type: 'selection',
                phase: 'start',
                text: 'foo',
                rect: { x: 1, y: 2, width: 3, height: 4 },
                viewport: { width: 100, height: 200, scrollY: 0 }
            });
            expect(states.at(-1)?.visible).toBe(true);
        });
    });

    test('selection_actions sentinel', async () => {
        await recordSentinel('selection_actions', () => {
            const dispatched: any[] = [];
            const controller = new SelectionOverlayController({
                bridge: { enqueue: (payload: any) => dispatched.push(payload) } as unknown as BridgeType,
                onChange: () => undefined
            });
            controller.handleWebMessage({
                type: 'selection',
                phase: 'start',
                text: 'baz',
                rect: { x: 4, y: 6, width: 10, height: 12 },
                viewport: { width: 320, height: 640, scrollY: 20 }
            });
            controller.invoke('askQuestion', { actionLabel: 'Ask', userQuestion: 'Explain?' });
            expect(dispatched.at(-1)).toEqual(expect.objectContaining({
                actionId: 'askQuestion',
                actionLabel: 'Ask',
                userQuestion: 'Explain?'
            }));
        });
    });

    test('wrapup_snapshot sentinel', async () => {
        await recordSentinel('wrapup_snapshot', async () => {
            const bridge = { enqueue: jest.fn() } as unknown as BridgeType;
            const fetchStub = jest.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'session-1' }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ turnId: 'turn-1', streamUrl: 'wss://example/stream' }) })
                .mockResolvedValue({ ok: true, json: async () => ({ fixed: true }) });
            class FakeWS {
                static instances: FakeWS[] = [];
                onopen: (() => void) | null = null;
                onmessage: ((event: { data: string }) => void) | null = null;
                onerror: ((event: { message?: string }) => void) | null = null;
                onclose: (() => void) | null = null;
                constructor() {
                    FakeWS.instances.push(this);
                    setTimeout(() => this.onopen?.(), 0);
                }
                emit(data: any) {
                    this.onmessage?.({ data: JSON.stringify(data) });
                }
                close() {
                    this.onclose?.();
                }
            }
            const client = new BffClient({ baseUrl: 'https://api.test', fetchImpl: fetchStub as any, webSocketImpl: FakeWS as any, bridge });
            const handle = await client.submitTurn({ text: 'hi', clientTurnId: 'client-1' });
            const iterator = handle.stream[Symbol.asyncIterator]();
            FakeWS.instances.at(-1)!.emit({ type: 'wrapUp', payload: { moduleTitle: 'Test', questions: [] } });
            FakeWS.instances.at(-1)!.close();
            await iterator.next();
            expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'wrapup:show' }));
        });
    });

    test('saveload_roundtrip sentinel', async () => {
        await recordSentinel('saveload_roundtrip', async () => {
            const bridge = { enqueue: jest.fn() } as unknown as BridgeType;
            const adapter = {
                saveFile: jest.fn().mockResolvedValue(undefined),
                pickFile: jest.fn().mockResolvedValue({ filename: 'sensei_progress.json', content: '{}' }),
                buildFilename: () => 'sensei_progress_20250101T000000Z'
            };
            const service = new SaveLoadService(bridge, adapter);
            const exportPromise = service.exportSession();
            service.handleWebMessage({ type: 'saveload:exportResult', requestId: 'sensei_progress_20250101T000000Z', success: true, json: '{}' });
            await exportPromise;
            await service.importSession();
            expect(adapter.saveFile).toHaveBeenCalled();
        });
    });

    test('mermaid_recovery sentinel', async () => {
        await recordSentinel('mermaid_recovery', async () => {
            const fetchStub = jest.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'session-1' }) })
                .mockResolvedValue({ ok: true, json: async () => ({ fixed: true, fixedCode: 'graph TD;x-->y;' }) });
            const client = new BffClient({ baseUrl: 'https://api.test', fetchImpl: fetchStub as any, bridge: { enqueue: jest.fn() } as unknown as BridgeType, webSocketImpl: class { constructor() {} } as any });
            await client.ensureSession();
            const result = await client.recoverMermaid({ messageId: 'msg-1', code: 'graph TD;A-->B;' });
            expect(result.fixed).toBe(true);
        });
    });

    test('telemetry_opt_out sentinel', async () => {
        await recordSentinel('telemetry_opt_out', async () => {
            const store: Record<string, string> = {};
            const manager = new TelemetryManager({
                endpoint: 'https://telemetry.test',
                fetchImpl: jest.fn().mockResolvedValue({ ok: true }) as any,
                storage: {
                    getItem: key => store[key] ?? null,
                    setItem: (key, value) => { store[key] = value; }
                },
                deviceMetadata: () => ({ device: 'ios-sim' })
            });
            await manager.toggle(false);
            manager.record('turn_submitted', { textLength: 10 });
            await manager.flush();
            await manager.toggle(true);
            manager.record('stream_completed', {});
            await manager.flush();
            expect(manager.isEnabled()).toBe(true);
        });
    });
});

import { TelemetryManager } from '../src/mobile/telemetry/TelemetryManager';

const createStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        }
    };
};

describe('TelemetryManager', () => {
    it('toggles opt-out state and flushes queue when re-enabled', async () => {
        const fetchStub = jest.fn().mockResolvedValue({ ok: true });
        const manager = new TelemetryManager({
            endpoint: 'https://telemetry.example.test',
            fetchImpl: fetchStub as any,
            storage: createStorage(),
            deviceMetadata: () => ({ device: 'ios-sim' })
        });

        await manager.toggle(false);
        expect(manager.isEnabled()).toBe(false);
        manager.record('turn_submitted', { textLength: 12 });
        await manager.flush();
        expect(fetchStub).not.toHaveBeenCalled();

        await manager.toggle(true);
        manager.record('stream_completed', {});
        await manager.flush();
        expect(fetchStub).toHaveBeenCalled();
    });
});

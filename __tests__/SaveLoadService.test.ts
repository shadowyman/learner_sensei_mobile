import { SaveLoadService } from '../src/mobile/saveLoad/SaveLoadService';
import type { BridgeManager } from '../src/mobile/bridge/BridgeManager';

describe('SaveLoadService', () => {
    it('requests export, waits for result, and writes file', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const adapter = {
            saveFile: jest.fn().mockResolvedValue(undefined),
            pickFile: jest.fn(),
            buildFilename: () => 'sensei_progress_20251112T000000Z'
        };
        const service = new SaveLoadService(bridge, adapter);

        const exportPromise = service.exportSession();
        expect(bridge.enqueue).toHaveBeenCalledWith({ type: 'saveload:export', requestId: 'sensei_progress_20251112T000000Z' });

        service.handleWebMessage({ type: 'saveload:exportResult', requestId: 'sensei_progress_20251112T000000Z', success: true, json: '{"session":1}' });
        await exportPromise;

        expect(adapter.saveFile).toHaveBeenCalledWith('sensei_progress_20251112T000000Z.json', '{"session":1}');
    });

    it('rejects export promise when the web bundle reports failure', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const adapter = {
            saveFile: jest.fn(),
            pickFile: jest.fn(),
            buildFilename: () => 'sensei_progress_20251112T000100Z'
        };
        const service = new SaveLoadService(bridge, adapter);

        const exportPromise = service.exportSession();
        service.handleWebMessage({
            type: 'saveload:exportResult',
            requestId: 'sensei_progress_20251112T000100Z',
            success: false,
            error: 'serialization failed'
        });

        await expect(exportPromise).rejects.toThrow('serialization failed');
        expect(adapter.saveFile).not.toHaveBeenCalled();
    });

    it('sends import payload to the bridge', async () => {
        const bridge = { enqueue: jest.fn() } as unknown as BridgeManager;
        const adapter = {
            saveFile: jest.fn(),
            pickFile: jest.fn().mockResolvedValue({ filename: 'sensei_progress.json', content: '{"session":2}' }),
            buildFilename: () => 'sensei_progress'
        };
        const service = new SaveLoadService(bridge, adapter);

        await service.importSession();

        expect(bridge.enqueue).toHaveBeenCalledWith({ type: 'saveload:import', requestId: 'sensei_progress.json', json: '{"session":2}' });
    });
});

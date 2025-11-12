import { SelectionOverlayController } from '../src/mobile/SelectionOverlay';
import type { BridgeManager } from '../src/mobile/bridge/BridgeManager';

describe('SelectionOverlayController', () => {
    const bridge = {
        enqueue: jest.fn()
    } as unknown as BridgeManager;

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('captures selection events and invokes bridge actions with metadata', () => {
        const states: any[] = [];
        const controller = new SelectionOverlayController({
            bridge,
            onChange: state => states.push(state)
        });

        controller.handleWebMessage({
            type: 'selection',
            phase: 'start',
            text: 'foo',
            rect: { x: 10, y: 20, width: 30, height: 12 },
            viewport: { width: 375, height: 600, scrollY: 0 }
        });

        expect(states.at(-1)?.visible).toBe(true);

        controller.invoke('explainSimpler', { actionLabel: 'Simpler' });
        expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({
            type: 'selectionSensei:invoke',
            actionId: 'explainSimpler',
            actionLabel: 'Simpler'
        }));
    });

    it('passes ask question payloads to the bridge', () => {
        const controller = new SelectionOverlayController({
            bridge,
            onChange: () => undefined
        });

        controller.handleWebMessage({
            type: 'selection',
            phase: 'start',
            text: 'bar',
            rect: { x: 0, y: 0, width: 10, height: 10 },
            viewport: { width: 320, height: 480, scrollY: 40 }
        });

        controller.invoke('askQuestion', { actionLabel: 'Ask', userQuestion: 'Why?' });
        expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({
            actionId: 'askQuestion',
            userQuestion: 'Why?'
        }));
    });

    it('routes copy/share actions through the bridge for native handling', () => {
        const controller = new SelectionOverlayController({ bridge, onChange: () => undefined });
        controller.handleWebMessage({
            type: 'selection',
            phase: 'start',
            text: 'baz',
            rect: { x: 0, y: 0, width: 10, height: 10 },
            viewport: { width: 100, height: 200, scrollY: 0 }
        });
        controller.invoke('copy', { actionLabel: 'Copy' });
        controller.handleWebMessage({
            type: 'selection',
            phase: 'start',
            text: 'baz',
            rect: { x: 0, y: 0, width: 10, height: 10 },
            viewport: { width: 100, height: 200, scrollY: 0 }
        });
        controller.invoke('share', { actionLabel: 'Share' });
        expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'copy' }));
        expect(bridge.enqueue).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'share' }));
    });
});

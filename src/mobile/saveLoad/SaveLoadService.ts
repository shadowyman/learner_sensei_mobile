import { logger } from '../../logger';
import type { BridgeManager } from '../bridge/BridgeManager';
import type { WebToRNMessage } from '../bridge/contracts';

interface ExportResolution {
    resolve: (json: string) => void;
    reject: (error: Error) => void;
}

export interface NativeFileAdapter {
    saveFile(filename: string, content: string): Promise<void>;
    pickFile(): Promise<{ filename: string; content: string }>;
    buildFilename(): string;
}

export class SaveLoadService {
    private pendingExports = new Map<string, Promise<string>>();
    private pendingResolvers = new Map<string, ExportResolution>();

    constructor(private readonly bridge: BridgeManager, private readonly fileAdapter: NativeFileAdapter) {}

    async exportSession(): Promise<void> {
        const requestId = this.fileAdapter.buildFilename();
        const exportPromise = this.createExportPromise(requestId);
        this.bridge.enqueue({ type: 'saveload:export', requestId });
        try {
            const json = await exportPromise;
            await this.fileAdapter.saveFile(`${requestId}.json`, json);
            logger.info('[MOBILE_PORT] saveload', { direction: 'export', filename: `${requestId}.json` });
        } catch (error) {
            logger.error('[MOBILE_PORT] saveload', { direction: 'export-failed', requestId, error: (error as Error).message });
            throw error;
        }
    }

    async importSession(): Promise<void> {
        const file = await this.fileAdapter.pickFile();
        logger.info('[MOBILE_PORT] saveload', { direction: 'import', filename: file.filename });
        this.bridge.enqueue({ type: 'saveload:import', requestId: file.filename, json: file.content });
    }

    handleWebMessage(message: WebToRNMessage): void {
        if (message.type === 'saveload:exportResult') {
            const resolver = this.pendingResolvers.get(message.requestId);
            if (resolver) {
                this.pendingResolvers.delete(message.requestId);
                this.pendingExports.delete(message.requestId);
                if (message.success) {
                    resolver.resolve(message.json ?? '');
                } else {
                    const error = new Error(message.error ?? 'Export failed');
                    resolver.reject(error);
                }
            }
        } else if (message.type === 'saveload:importResult') {
            logger.info('[MOBILE_PORT] saveload', { direction: 'import-result', requestId: message.requestId, success: message.success });
        }
    }

    private createExportPromise(requestId: string): Promise<string> {
        if (this.pendingExports.has(requestId)) {
            return this.pendingExports.get(requestId)!;
        }
        const promise = new Promise<string>((resolve, reject) => {
            this.pendingResolvers.set(requestId, { resolve, reject });
        });
        this.pendingExports.set(requestId, promise);
        return promise;
    }
}

export default SaveLoadService;

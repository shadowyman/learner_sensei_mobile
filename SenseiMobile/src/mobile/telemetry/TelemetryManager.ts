import { logger } from '../../logger';

interface KeyValueStore {
    getItem(key: string): Promise<string | null> | string | null;
    setItem(key: string, value: string): Promise<void> | void;
}

interface TelemetryEvent {
    event: string;
    data: Record<string, unknown>;
    timestamp: string;
}

interface TelemetryManagerOptions {
    endpoint: string;
    deviceMetadata: () => Record<string, unknown>;
    storage?: KeyValueStore;
    fetchImpl?: typeof fetch;
}

export class TelemetryManager {
    private enabled = true;
    private readonly queue: TelemetryEvent[] = [];
    private readonly endpoint: string;
    private readonly deviceMetadata: () => Record<string, unknown>;
    private readonly storage?: KeyValueStore;
    private readonly fetchImpl: typeof fetch;

    constructor(options: TelemetryManagerOptions) {
        this.endpoint = options.endpoint;
        this.deviceMetadata = options.deviceMetadata;
        this.storage = options.storage;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.restoreState();
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    async toggle(enabled: boolean): Promise<void> {
        this.enabled = enabled;
        if (this.storage) {
            await this.storage.setItem('telemetry_enabled', JSON.stringify(enabled));
        }
        logger.info('[MOBILE_PORT] telemetry state', { enabled });
        if (enabled) {
            await this.flush();
        }
    }

    nextClientTurnId(): string {
        return `turn-${Date.now()}`;
    }

    record(event: string, data: Record<string, unknown>): void {
        if (!this.enabled) {
            return;
        }
        this.queue.push({
            event,
            data: { ...data, ...this.deviceMetadata() },
            timestamp: new Date().toISOString()
        });
    }

    async flush(): Promise<void> {
        if (!this.enabled || this.queue.length === 0) {
            return;
        }
        const payload = this.queue.splice(0, this.queue.length);
        try {
            await this.fetchImpl(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: payload })
            });
        } catch (error) {
            logger.warn('[MOBILE_PORT] telemetry flush failed', { error });
            this.queue.unshift(...payload);
        }
    }

    private async restoreState(): Promise<void> {
        if (!this.storage) {
            return;
        }
        const stored = await this.storage.getItem('telemetry_enabled');
        if (stored !== null) {
            this.enabled = stored !== 'false';
        }
    }
}

export default TelemetryManager;

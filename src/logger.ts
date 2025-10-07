/**
 * Centralized logging utility that prepends "Sensei:" to all log messages
 * Includes export functionality to download logs
 */

// Debug flags
export const DEBUG_FLAGS = {
    prompt_debug: false,
    mermaid_debug: false,
    learner_analysis_debug: false,
    curriculum_debug: false,
    performance_debug: true  // Enable performance logging
};

type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    args: any[];
}

class Logger {
    private logEntries: LogEntry[] = [];
    private maxLogEntries = 1000;
    private logUpdateCallbacks: ((entry: LogEntry) => void)[] = [];
    private performanceMarks: Map<string, number> = new Map();
    private performanceMetrics: Map<string, number[]> = new Map();

    private formatMessage(args: any[]): any[] {
        if (args.length === 0) return ['Sensei:'];
        
        const first = args[0];
        if (typeof first === 'string') {
            // Check if message already starts with "Sensei:" to avoid double-prefixing
            const prefix = first.startsWith('Sensei:') ? first : `Sensei: ${first}`;
            
            // Process remaining args to stringify objects
            const processedArgs = args.slice(1).map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return '[Circular Object]';
                    }
                }
                return arg;
            });
            return [prefix, ...processedArgs];
        }
        
        // If first arg is not string, process all args
        const processedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Circular Object]';
                }
            }
            return arg;
        });
        
        return ['Sensei:', ...processedArgs];
    }

    private storeLogEntry(level: LogLevel, args: any[]): void {
        const formattedArgs = this.formatMessage(args);
        const message = formattedArgs.join(' ');
        
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            args: formattedArgs
        };

        this.logEntries.push(entry);
        
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.shift();
        }

        this.logUpdateCallbacks.forEach(callback => callback(entry));
    }

    public getLogEntries(): LogEntry[] {
        return [...this.logEntries];
    }

    public onLogUpdate(callback: (entry: LogEntry) => void): void {
        this.logUpdateCallbacks.push(callback);
    }

    public removeLogUpdateCallback(callback: (entry: LogEntry) => void): void {
        const index = this.logUpdateCallbacks.indexOf(callback);
        if (index > -1) {
            this.logUpdateCallbacks.splice(index, 1);
        }
    }

    /**
     * Export all current logs to a file
     */
    public exportLogsToFile(): boolean {
        try {
            let content = `Sensei Console Logs Export - ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
            
            // Add all log entries
            for (const entry of this.logEntries) {
                const timestamp = entry.timestamp.toISOString();
                const logLine = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
                content += logLine;
            }
            
            // Create blob and download
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sensei_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.log('Logs downloaded successfully');
            return true;
        } catch (error) {
            this.error('Failed to download logs:', error);
            return false;
        }
    }

    log(...args: any[]): void {
        this.storeLogEntry('log', args);
        console.log(...this.formatMessage(args));
    }

    warn(...args: any[]): void {
        this.storeLogEntry('warn', args);
        console.warn(...this.formatMessage(args));
    }

    error(...args: any[]): void {
        this.storeLogEntry('error', args);
        console.error(...this.formatMessage(args));
    }

    debug(...args: any[]): void {
        this.storeLogEntry('debug', args);
        console.debug(...this.formatMessage(args));
    }

    info(...args: any[]): void {
        this.storeLogEntry('info', args);
        console.info(...this.formatMessage(args));
    }

    /**
     * Performance tracking methods
     */

    /**
     * Start a performance timer for a specific operation
     */
    public perfStart(label: string): void {
        if (!DEBUG_FLAGS.performance_debug) return;

        const timestamp = performance.now();
        this.performanceMarks.set(label, timestamp);

        const isoTime = new Date().toISOString();
        this.log(`[PERF-START] ${isoTime} | ${label} | Starting performance measurement`);
    }

    /**
     * End a performance timer and log the duration
     */
    public perfEnd(label: string, metadata?: any): number {
        if (!DEBUG_FLAGS.performance_debug) return 0;

        const endTime = performance.now();
        const startTime = this.performanceMarks.get(label);

        if (startTime === undefined) {
            this.warn(`[PERF-ERROR] No start time found for label: ${label}`);
            return 0;
        }

        const duration = endTime - startTime;
        const isoTime = new Date().toISOString();

        // Store metric for aggregation
        if (!this.performanceMetrics.has(label)) {
            this.performanceMetrics.set(label, []);
        }
        this.performanceMetrics.get(label)!.push(duration);

        // Format duration with appropriate units
        let durationStr = '';
        if (duration < 1) {
            durationStr = `${(duration * 1000).toFixed(2)}μs`;
        } else if (duration < 1000) {
            durationStr = `${duration.toFixed(2)}ms`;
        } else {
            durationStr = `${(duration / 1000).toFixed(2)}s`;
        }

        // Log with metadata if provided
        if (metadata) {
            this.log(`[PERF-END] ${isoTime} | ${label} | Duration: ${durationStr} | Metadata:`, metadata);
        } else {
            this.log(`[PERF-END] ${isoTime} | ${label} | Duration: ${durationStr}`);
        }

        // Clean up the mark
        this.performanceMarks.delete(label);

        return duration;
    }

    /**
     * Log a performance checkpoint without ending the timer
     */
    public perfCheckpoint(label: string, checkpointName: string): void {
        if (!DEBUG_FLAGS.performance_debug) return;

        const currentTime = performance.now();
        const startTime = this.performanceMarks.get(label);

        if (startTime === undefined) {
            this.warn(`[PERF-ERROR] No start time found for checkpoint: ${label}`);
            return;
        }

        const elapsed = currentTime - startTime;
        const isoTime = new Date().toISOString();

        let elapsedStr = '';
        if (elapsed < 1) {
            elapsedStr = `${(elapsed * 1000).toFixed(2)}μs`;
        } else if (elapsed < 1000) {
            elapsedStr = `${elapsed.toFixed(2)}ms`;
        } else {
            elapsedStr = `${(elapsed / 1000).toFixed(2)}s`;
        }

        this.log(`[PERF-CHECKPOINT] ${isoTime} | ${label} | ${checkpointName} | Elapsed: ${elapsedStr}`);
    }

    /**
     * Wrap an async function with performance tracking
     */
    public async perfWrapAsync<T>(
        label: string,
        fn: () => Promise<T>,
        metadata?: any
    ): Promise<T> {
        this.perfStart(label);
        try {
            const result = await fn();
            this.perfEnd(label, metadata);
            return result;
        } catch (error) {
            this.perfEnd(label, { ...metadata, error: true });
            throw error;
        }
    }

    /**
     * Wrap a sync function with performance tracking
     */
    public perfWrap<T>(
        label: string,
        fn: () => T,
        metadata?: any
    ): T {
        this.perfStart(label);
        try {
            const result = fn();
            this.perfEnd(label, metadata);
            return result;
        } catch (error) {
            this.perfEnd(label, { ...metadata, error: true });
            throw error;
        }
    }

    /**
     * Get performance statistics for a label
     */
    public getPerfStats(label: string): { count: number; avg: number; min: number; max: number; total: number } | null {
        const metrics = this.performanceMetrics.get(label);
        if (!metrics || metrics.length === 0) return null;

        const count = metrics.length;
        const total = metrics.reduce((a, b) => a + b, 0);
        const avg = total / count;
        const min = Math.min(...metrics);
        const max = Math.max(...metrics);

        return { count, avg, min, max, total };
    }

    public getAllPerfStats(): Array<{ label: string; count: number; avg: number; min: number; max: number; total: number }> {
        if (!DEBUG_FLAGS.performance_debug) return [];
        const summaries: Array<{ label: string; count: number; avg: number; min: number; max: number; total: number }> = [];
        for (const label of this.performanceMetrics.keys()) {
            const stats = this.getPerfStats(label);
            if (stats) {
                summaries.push({ label, ...stats });
            }
        }
        return summaries;
    }

    /**
     * Log all performance statistics
     */
    public logPerfSummary(): void {
        if (!DEBUG_FLAGS.performance_debug) return;

        this.log('[PERF-SUMMARY] Performance Statistics:');
        this.log('='.repeat(60));

        for (const [label, metrics] of this.performanceMetrics.entries()) {
            const stats = this.getPerfStats(label);
            if (stats) {
                this.log(`[PERF-STATS] ${label}:`);
                this.log(`  - Count: ${stats.count}`);
                this.log(`  - Average: ${stats.avg.toFixed(2)}ms`);
                this.log(`  - Min: ${stats.min.toFixed(2)}ms`);
                this.log(`  - Max: ${stats.max.toFixed(2)}ms`);
                this.log(`  - Total: ${stats.total.toFixed(2)}ms`);
            }
        }

        this.log('='.repeat(60));
    }

    /**
     * Clear performance metrics
     */
    public clearPerfMetrics(): void {
        this.performanceMetrics.clear();
        this.performanceMarks.clear();
        this.log('[PERF] Performance metrics cleared');
    }
}

export const logger = new Logger();
export type { LogEntry, LogLevel };

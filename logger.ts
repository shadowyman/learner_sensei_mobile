/**
 * Centralized logging utility that prepends "Sensei:" to all log messages
 * Includes export functionality to download logs
 */

// Debug flags
export const DEBUG_FLAGS = {
    prompt_debug: false,
    mermaid_debug: false,
    learner_analysis_debug: false,
    curriculum_debug: false
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
}

export const logger = new Logger();
export type { LogEntry, LogLevel };

logger.log('Debug console log storage initialized');
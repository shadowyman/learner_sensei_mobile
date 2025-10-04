import { promises as fs } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { DashboardLogEntry } from './messages.ts';

export interface LogEntryPayload {
  artifactId: string;
  threadId: number;
  message: string;
  timestamp: number;
}

export class LogManager {
  private readonly directory: string;
  private readonly latest: DashboardLogEntry[] = [];
  private readonly maxVisible = 5;
  private readonly maxEntryLength = 220;
  private readonly fileHandles = new Map<string, string>();

  constructor(directory: string) {
    this.directory = directory;
  }

  async resetLog(artifactId: string): Promise<void> {
    const filePath = this.getFilePath(artifactId);
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(filePath, '', 'utf8');
    this.fileHandles.set(artifactId, filePath);
  }

  async append(entry: LogEntryPayload): Promise<void> {
    const formatted = this.format(entry);
    const visible = this.sanitize(formatted);
    const filePath = this.getFilePath(entry.artifactId);
    await fs.appendFile(filePath, formatted + '\n', 'utf8');
    this.latest.push({ raw: formatted, visible });
    if (this.latest.length > this.maxVisible) {
      this.latest.splice(0, this.latest.length - this.maxVisible);
    }
  }

  getVisibleLogs(): DashboardLogEntry[] {
    return this.latest.map(entry => ({ raw: entry.raw, visible: entry.visible }));
  }

  clearVisibleLogs(): void {
    this.latest.length = 0;
  }

  private getFilePath(artifactId: string): string {
    if (this.fileHandles.has(artifactId)) {
      return this.fileHandles.get(artifactId) as string;
    }
    const base = basename(artifactId).replace(/\.html$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = resolve(this.directory, `${base}.log`);
    this.fileHandles.set(artifactId, filePath);
    return filePath;
  }

  private format(entry: LogEntryPayload): string {
    const date = new Date(entry.timestamp).toISOString();
    return `${date} [${entry.artifactId}] [thread ${entry.threadId}] ${entry.message}`;
  }

  private sanitize(message: string): string {
    const stripped = message
      .replace(/\u001b\[[0-9;]*[@-Z\\-_~]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length <= this.maxEntryLength) {
      return stripped;
    }
    return `${stripped.slice(0, this.maxEntryLength)}…`;
  }
}

import { ArtifactStatusRecord, DashboardLogEntry, DashboardSnapshot } from './messages.ts';

export class DashboardRenderer {
  private readonly spinnerFrames: string[];
  private readonly logLengthLimit = 220;
  private frameIndex = 0;
  private lastFrame = '';
  private firstRender = true;
  private cursorHidden = false;
  private lastLineCount = 0;

  constructor(spinnerFrames?: string[]) {
    this.spinnerFrames = spinnerFrames && spinnerFrames.length > 0 ? spinnerFrames : ['-', '\\', '|', '/']
  }

  render(snapshot: DashboardSnapshot): void {
    if (!this.cursorHidden && process.stdout.isTTY) {
      process.stdout.write('\u001b[?25l');
      this.cursorHidden = true;
    }
    const frame = this.buildFrame(snapshot);
    const terminalWidth = process.stdout.columns ?? 80;
    const currentLineCount = frame
      .split('\n')
      .map(line => Math.max(1, Math.ceil(line.replace(/\u001b\[[0-9;]*[@-Z\\-_~]/g, '').length / terminalWidth)))
      .reduce((total, count) => total + count, 0);
    if (frame === this.lastFrame && currentLineCount === this.lastLineCount) {
      return;
    }
    const previousLineCount = this.lastLineCount;
    this.lastFrame = frame;
    this.lastLineCount = currentLineCount;
    const prefix = this.firstRender ? '\u001b[2J\u001b[H' : '\u001b[H';
    let output = prefix + frame;
    if (previousLineCount > currentLineCount) {
      const diff = previousLineCount - currentLineCount;
      for (let i = 0; i < diff; i += 1) {
        output += '\n\u001b[K';
      }
    }
    output += '\u001b[0J';
    process.stdout.write(output);
    this.firstRender = false;
  }

  dispose(): void {
    if (this.cursorHidden && process.stdout.isTTY) {
      process.stdout.write('\u001b[?25h');
      this.cursorHidden = false;
    }
  }

  private buildFrame(snapshot: DashboardSnapshot): string {
    const lines: string[] = [];
    lines.push('Review Mediator Dashboard');
    lines.push('');
    const sorted = [...snapshot.statuses].sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    for (const status of sorted) {
      lines.push(this.formatStatus(status));
      if (status.aiLine) {
        lines.push(`  AI: ${status.aiLine}`);
      }
    }
    lines.push('');
    lines.push('===== Debug Logs =====');
    if (snapshot.logs.length === 0) {
      lines.push('(no log entries)');
    } else {
      for (const log of snapshot.logs) {
        lines.push(this.formatLogLine(log));
      }
    }
    return lines.map(line => `${line}\u001b[K`).join('\n');
  }

  private formatLogLine(entry: DashboardLogEntry): string {
    const fallback = this.limitLogLength(entry.visible);
    const source = (entry.raw ?? '').trim() || entry.visible.trim();
    if (!source) {
      return fallback;
    }
    const { metadata, payload } = this.parseLogPayload(source);
    if (!payload) {
      return fallback;
    }
    const command = this.extractField(payload, ['command', 'item.command', 'data.command']);
    const text = this.extractField(payload, ['text', 'item.text', 'data.text']);
    if (!command && !text) {
      return fallback;
    }
    const identifier = this.extractField(payload, ['id', 'item.id', 'data.id']);
    const detailParts: string[] = [];
    if (identifier) {
      detailParts.push(`id=${identifier}`);
    }
    if (command) {
      detailParts.push(command);
    }
    if (text) {
      detailParts.push(text);
    }
    const detailSection = detailParts.join(' | ');
    let formatted = fallback;
    if (metadata && detailSection) {
      formatted = `${metadata} | ${detailSection}`;
    } else if (metadata) {
      formatted = metadata;
    } else if (detailSection) {
      formatted = detailSection;
    }
    const shouldBypassLimit = Boolean(command) && !text;
    return shouldBypassLimit ? formatted : this.limitLogLength(formatted);
  }

  private parseLogPayload(input: string): { metadata: string; payload: Record<string, unknown> | null } {
    const firstBrace = input.indexOf('{');
    if (firstBrace === -1) {
      return { metadata: input, payload: null };
    }
    const metadata = input.slice(0, firstBrace).trimEnd();
    let jsonSegment = input.slice(firstBrace).trim();
    if (!jsonSegment) {
      return { metadata, payload: null };
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(jsonSegment);
    } catch {
      const lastBrace = jsonSegment.lastIndexOf('}');
      if (lastBrace >= 0) {
        jsonSegment = jsonSegment.slice(0, lastBrace + 1);
        try {
          parsed = JSON.parse(jsonSegment);
        } catch {
          parsed = null;
        }
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { metadata, payload: parsed as Record<string, unknown> };
    }
    return { metadata, payload: null };
  }

  private extractField(payload: Record<string, unknown>, paths: string[]): string | undefined {
    for (const path of paths) {
      let current: unknown = payload;
      for (const segment of path.split('.')) {
        if (!current || typeof current !== 'object' || Array.isArray(current) || !(segment in current)) {
          current = undefined;
          break;
        }
        current = (current as Record<string, unknown>)[segment];
      }
      if (typeof current === 'string') {
        const value = current.trim();
        if (value) {
          return value;
        }
      } else if (typeof current === 'number') {
        return current.toString();
      }
    }
    return undefined;
  }

  private limitLogLength(line: string): string {
    if (line.length <= this.logLengthLimit) {
      return line;
    }
    return `${line.slice(0, this.logLengthLimit)}\u2026`;
  }

  private formatStatus(status: ArtifactStatusRecord): string {
    const symbol = this.spinner(status) + this.stateLabel(status.state);
    const verdict = status.verdict ? ` ${status.verdict}` : '';
    return `${symbol} ${status.artifactId}${verdict}: ${status.text}`;
  }

  private spinner(status: ArtifactStatusRecord): string {
    if (!status.spinner) {
      return ' ';
    }
    const frame = this.spinnerFrames[this.frameIndex % this.spinnerFrames.length] ?? '-';
    this.frameIndex += 1;
    return frame;
  }

  private stateLabel(state: ArtifactStatusRecord['state']): string {
    switch (state) {
      case 'Pending':
        return '[PENDING]';
      case 'Dispatching':
        return '[REVIEWING]';
      case 'AwaitingReview':
        return '[AWAITING_REVIEW]';
      case 'Remediating':
        return '[REMEDIATING]';
      case 'Complete':
        return '[COMPLETE]';
      case 'Error':
        return '[ERROR]';
      default:
        return '[UNKNOWN]';
    }
  }
}

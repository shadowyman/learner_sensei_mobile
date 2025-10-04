import * as blessed from 'neo-blessed';
import type { Widgets } from 'blessed';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';
import { basename } from 'node:path';
import { ArtifactStatusRecord, DashboardLogEntry, DashboardSnapshot } from './messages.ts';

interface Renderer {
  render(snapshot: DashboardSnapshot): void;
  dispose(): void;
}

const LOG_SCOLLBACK = 1000;
const LOG_TRUNCATE = 250;
const SGR = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  magenta: '\u001b[35m',
  gray: '\u001b[90m',
  white: '\u001b[97m',
  blueBg: '\u001b[44m',
  grayBg: '\u001b[100m',
  greenBg: '\u001b[42m',
  redBg: '\u001b[41m',
  yellowBg: '\u001b[43m',
  lightGreenBg: '\u001b[102m'
} as const;

function style(text: string, ...codes: string[]): string {
  if (text.length === 0) {
    return text;
  }
  return `${codes.join('')}${text}${SGR.reset}`;
}

function badge(text: string, fg: string, bg: string): string {
  return style(` ${text} `, SGR.bold, fg, bg);
}

function applyBackground(lines: string[], bg: string): string[] {
  return lines.map(line => `${bg}${line}${SGR.reset}`);
}

function normalizeCommand(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeCommand(parsed);
      } catch {
        return trimmed;
      }
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map(entry => normalizeCommand(entry) ?? '').filter(Boolean).join(' ');
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.command === 'string') {
      return normalizeCommand(record.command);
    }
    if (Array.isArray(record.args)) {
      return record.args.map(arg => normalizeCommand(arg) ?? '').filter(Boolean).join(' ');
    }
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function stateColor(state: ArtifactStatusRecord['state']): string {
  switch (state) {
    case 'Pending':
      return SGR.gray;
    case 'Dispatching':
      return SGR.cyan;
    case 'AwaitingReview':
      return SGR.yellow;
    case 'Remediating':
      return SGR.magenta;
    case 'Complete':
      return SGR.green;
    case 'Error':
      return SGR.red;
    default:
      return SGR.gray;
  }
}

function stateTag(state: ArtifactStatusRecord['state']): string {
  switch (state) {
    case 'Pending':
      return '[PENDING]';
    case 'Dispatching':
      return '[DISPATCH]';
    case 'AwaitingReview':
      return '[AWAITING]';
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

function tabLabel(artifactId: string): string {
  const base = basename(artifactId).replace(/\.[^.]+$/, '');
  const withoutPrefix = base.replace(/^review_/, '');
  return withoutPrefix.replace(/_/g, ' ').toUpperCase();
}

interface TabZone {
  artifactId: string;
  label: string;
  start: number;
  end: number;
}

export class DashboardRenderer implements Renderer {
  private readonly interactive: boolean;
  private readonly fallback: LegacyDashboardRenderer | null;

  private screen: Widgets.Screen | null = null;
  private header: Widgets.BoxElement | null = null;
  private statusBox: Widgets.BoxElement | null = null;
  private divider: Widgets.BoxElement | null = null;
  private logBox: Widgets.Log | null = null;
  private footer: Widgets.BoxElement | null = null;
  private tabBar: Widgets.BoxElement | null = null;

  private cachedWidth = 0;
  private selectedTab: string | null = null;
  private tabZones: TabZone[] = [];
  private logLines: string[] = [];
  private logScroll = 0;
  private logViewport = 0;
  private userScrolled = false;
  private lastSnapshot: DashboardSnapshot | null = null;

  constructor() {
    this.interactive = Boolean(process.stdout.isTTY);
    if (this.interactive) {
      this.fallback = null;
      this.initializeScreen();
    } else {
      this.fallback = new LegacyDashboardRenderer();
    }
  }

  isInteractive(): boolean {
    return this.interactive;
  }

  render(snapshot: DashboardSnapshot): void {
    this.lastSnapshot = snapshot;
    if (!this.screen || !this.statusBox || !this.logBox || !this.header || !this.divider || !this.footer) {
      this.fallback?.render(snapshot);
      return;
    }

    const width = Number(this.screen.width) || 80;
    if (width !== this.cachedWidth) {
      this.cachedWidth = width;
      this.logBox.setContent('');
    }

    const statuses = this.formatStatuses(snapshot.statuses, width - 4);
    this.header.setContent(this.buildHeader(snapshot.statuses));
    this.ensureSelectedTab(snapshot.statuses);
    this.renderTabs(snapshot.statuses, width);
    const screenHeight = Number(this.screen.height) || 24;
    const statusContentHeight = Math.min(Math.max(statuses.length || 1, 3), Math.max(3, screenHeight - 6));
    const statusHeight = statusContentHeight + 2;
    this.statusBox.top = 1;
    this.statusBox.height = statusHeight;
    this.statusBox.setContent(statuses.join('\n'));

    const tabTop = (Number(this.statusBox.top) || 0) + statusHeight;
    if (this.tabBar) {
      this.tabBar.top = tabTop;
    }
    const dividerTop = tabTop + 1;
    this.divider.top = dividerTop;
    const dividerLine = '─'.repeat(Math.max(width - 2, 1));
    this.divider.setContent(dividerLine);

    const logTop = dividerTop + 1;
    const footerHeight = Number(this.footer.height) || 1;
    const logHeight = Math.max(3, screenHeight - logTop - footerHeight);
    this.logBox.top = logTop;
    this.logBox.height = logHeight;
    this.logViewport = Math.max(1, logHeight - 2);

    this.renderLogs(snapshot.logs, width - 4);
    this.screen.render();
  }

  private buildHeader(statuses: ArtifactStatusRecord[]): string {
    const total = statuses.length;
    const completed = statuses.filter(status => status.state === 'Complete').length;
    const active = statuses.filter(status => status.state !== 'Complete' && status.state !== 'Error').length;
    const failing = statuses.filter(status => status.state === 'Error' || status.verdict === 'FAIL').length;
    const segments = [
      badge('REVIEW MEDIATOR', SGR.white, SGR.blueBg),
      badge(`TOTAL ${total}`, SGR.white, SGR.grayBg),
      badge(`ACTIVE ${active}`, SGR.white, active > 0 ? SGR.yellowBg : SGR.grayBg),
      badge(`DONE ${completed}`, SGR.white, completed > 0 ? SGR.greenBg : SGR.grayBg),
      badge(`ATTN ${failing}`, SGR.white, failing > 0 ? SGR.redBg : SGR.grayBg),
      style('Shift+PgUp/PgDn scroll', SGR.cyan, SGR.bold),
      style('q to exit', SGR.cyan, SGR.bold)
    ];
    return ` ${segments.join('  ')}`;
  }

  private ensureSelectedTab(statuses: ArtifactStatusRecord[]): void {
    if (statuses.length === 0) {
      this.selectedTab = null;
      return;
    }
    if (!this.selectedTab || !statuses.some(status => status.artifactId === this.selectedTab)) {
      const first = statuses[0];
      this.selectedTab = first ? first.artifactId : null;
    }
  }

  private renderTabs(statuses: ArtifactStatusRecord[], width: number): void {
    if (!this.tabBar) {
      return;
    }
    const bar = this.tabBar as Widgets.BoxElement;
    const sorted = [...statuses].sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    this.tabZones = [];
    let content = '';
    let cursor = 0;
    sorted.forEach((status, index) => {
      const active = status.artifactId === this.selectedTab;
      const label = tabLabel(status.artifactId);
      const display = active
        ? style(` ${label} `, SGR.white, SGR.blueBg, SGR.bold)
        : style(` ${label} `, SGR.gray, SGR.bold);
      const width = stringWidth(stripAnsi(display));
      const zoneStart = cursor;
      const zoneEnd = cursor + width;
      this.tabZones.push({ artifactId: status.artifactId, label: display, start: zoneStart, end: zoneEnd });
      content += display;
      cursor += width;
      if (index < sorted.length - 1) {
        content += ' ';
        cursor += 1;
      }
    });
    bar.setContent(content);
  }

  private belongsToTab(entry: DashboardLogEntry, tab: string | null): boolean {
    if (!tab) {
      return true;
    }
    if (entry.artifactId) {
      return entry.artifactId === tab;
    }
    const source = entry.raw ?? entry.visible;
    return source.includes(`[${tab}]`);
  }

  private setupTabInteractions(screen: Widgets.Screen, tabBar: Widgets.BoxElement): void {
    tabBar.on('mousedown', (event: any) => {
      if (!event || typeof event.x !== 'number') {
        return;
      }
      this.handleTabSelection(event.x);
    });
    tabBar.on('click', (event: any) => {
      if (!event || typeof event.x !== 'number') {
        return;
      }
      this.handleTabSelection(event.x);
    });

    screen.key(['left', 'S-left'], () => {
      this.shiftTab(-1);
    });
    screen.key(['right', 'S-right'], () => {
      this.shiftTab(1);
    });
    screen.key(['up'], () => {
      this.scrollLogs(1);
    });
    screen.key(['down'], () => {
      this.scrollLogs(-1);
    });
  }

  private handleTabSelection(x: number): void {
    const relative = Math.max(0, x - Number(this.tabBar?.left ?? 0));
    const zone = this.tabZones.find(tab => relative >= tab.start && relative < tab.end);
    if (!zone || zone.artifactId === this.selectedTab) {
      return;
    }
    this.selectedTab = zone.artifactId;
    this.userScrolled = false;
    this.logScroll = 0;
    if (this.lastSnapshot) {
      this.render(this.lastSnapshot);
    }
  }

  private shiftTab(offset: number): void {
    if (this.tabZones.length === 0) {
      return;
    }
    const index = this.tabZones.findIndex(tab => tab.artifactId === this.selectedTab);
    const base = index === -1 ? 0 : index;
    const nextIndex = (base + offset + this.tabZones.length) % this.tabZones.length;
    const next = this.tabZones[nextIndex];
    if (next && next.artifactId !== this.selectedTab) {
      this.selectedTab = next.artifactId;
      this.userScrolled = false;
      this.logScroll = 0;
      if (this.lastSnapshot) {
        this.render(this.lastSnapshot);
      }
    }
  }

  dispose(): void {
    if (this.screen) {
      this.screen.destroy();
    }
    this.screen = null;
    this.statusBox = null;
    this.logBox = null;
    this.header = null;
    this.divider = null;
    this.footer = null;
    this.fallback?.dispose();
  }

  private initializeScreen(): void {
    const screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: 'Review Mediator Dashboard'
    });

    screen.enableMouse();

    screen.key(['q', 'C-c'], () => {
      if (!process.listenerCount('SIGINT')) {
        process.exit(0);
      }
      process.emit('SIGINT');
    });

    const header = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'white', bg: 'blue' },
      content: '  Review Mediator initializing…'
    });

    const statusBox = blessed.box({
      parent: screen,
      top: 1,
      left: 0,
      width: '100%',
      height: 10,
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'gray' }
      },
      border: { type: 'line' }
    });

    const tabBar = blessed.box({
      parent: screen,
      top: 2,
      left: 0,
      width: '100%',
      height: 1,
      tags: false,
      mouse: true,
      style: { fg: 'gray', bg: 'black' }
    });

    const divider = blessed.box({
      parent: screen,
      top: 3,
      left: 1,
      width: '100%-2',
      height: 1,
      style: { fg: 'gray' }
    });

    const logBox = blessed.log({
      parent: screen,
      top: 4,
      left: 0,
      width: '100%',
      bottom: 1,
      keys: true,
      vi: true,
      mouse: true,
      scrollback: LOG_SCOLLBACK,
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'gray' },
        scrollbar: { bg: 'cyan' }
      },
      border: { type: 'line' }
    });

    const footer = blessed.box({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'black', bg: 'gray' },
      content: '  Tabs filter logs by artifact • metadata dimmed • commands in cyan'
    });

    screen.on('resize', () => {
      if (this.lastSnapshot) {
        this.render(this.lastSnapshot);
      } else {
        logBox.setContent('');
        screen.render();
      }
    });

    this.screen = screen;
    this.header = header;
    this.header.setContent('Review Mediator ready');
    this.statusBox = statusBox;
    this.tabBar = tabBar;
    this.divider = divider;
    this.logBox = logBox;
    this.footer = footer;
    this.cachedWidth = Number(screen.width) || 80;

    if (this.interactive) {
      this.setupTabInteractions(screen, tabBar);
    }
  }

  private formatStatuses(statuses: ArtifactStatusRecord[], maxWidth: number): string[] {
    const lines: string[] = [];
    const width = Math.max(maxWidth, 20);

    const sorted = [...statuses].sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    for (const status of sorted) {
      const color = stateColor(status.state);
      const artifactName = basename(status.artifactId).toUpperCase();
      const headline = style(` ${artifactName} `, color, SGR.bold);
      const banner = style('═'.repeat(Math.min(width, stringWidth(stripAnsi(headline)))), color);
      lines.push(banner);
      lines.push(headline);
      lines.push(banner);

      const description = status.text.trim();
      if (description.length > 0) {
        const wrapped = this.wrapPlain(this.truncate(description, LOG_TRUNCATE), width - 2).map(line => this.renderDescriptionLine(line));
        lines.push(...wrapped);
      }

      if (status.aiLine) {
        const aiWrapped = this.wrapPlain(this.truncate(status.aiLine, LOG_TRUNCATE), width - 2).map(line => `  ${style(line, SGR.cyan)}`);
        lines.push(...aiWrapped);
      }

      lines.push('');
    }

    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    if (lines.length === 0) {
      return [style('No active artifacts', SGR.dim)];
    }
    return lines;
  }

  private renderLogs(entries: DashboardLogEntry[], maxWidth: number): void {
    if (!this.logBox) {
      return;
    }
    const activeArtifact = this.selectedTab;
    const filtered = entries.filter(entry => this.belongsToTab(entry, activeArtifact));
    const lines: string[] = [];
    filtered.forEach((entry, index) => {
      const formatted = this.formatLogEntry(entry, maxWidth);
      if (formatted.length > 0) {
        lines.push(...formatted);
        if (index < filtered.length - 1) {
          lines.push(style('─'.repeat(Math.max(maxWidth, 10)), SGR.gray));
        }
      }
    });
    this.logLines = lines.length === 0
      ? [style('No logs yet for this artifact', SGR.dim)]
      : lines;
    if (!this.userScrolled) {
      this.logScroll = 0;
    }
    this.updateLogViewport();
  }

  private updateLogViewport(): void {
    if (!this.logBox) {
      return;
    }
    const viewport = Math.max(1, this.logViewport);
    const lines = this.logLines.length > 0 ? this.logLines : [style('No logs yet for this artifact', SGR.dim)];
    const maxScroll = Math.max(0, lines.length - viewport);
    if (this.logScroll > maxScroll) {
      this.logScroll = maxScroll;
    }
    const start = Math.max(0, lines.length - viewport - this.logScroll);
    const slice = lines.slice(start, start + viewport);
    this.logBox.setContent(slice.join('\n'));
  }

  private scrollLogs(delta: number): void {
    if (!this.interactive) {
      return;
    }
    const viewport = Math.max(1, this.logViewport);
    const lines = this.logLines.length > 0 ? this.logLines : [style('No logs yet for this artifact', SGR.dim)];
    const maxScroll = Math.max(0, lines.length - viewport);
    const next = Math.min(Math.max(0, this.logScroll + delta), maxScroll);
    if (next === this.logScroll) {
      return;
    }
    this.logScroll = next;
    this.userScrolled = this.logScroll > 0;
    this.updateLogViewport();
  }

  private formatLogEntry(entry: DashboardLogEntry, maxWidth: number): string[] {
    const raw = entry.raw ?? entry.visible;
    const truncated = this.truncate(raw, LOG_TRUNCATE);
    const match = raw.match(/^(\S+) \[([^\]]+)\] \[thread (\d+)\] (.*)$/);
    if (!match) {
      const lineStyle = raw.includes('[runDispatchPhase]') ? (text: string) => style(text, SGR.magenta, SGR.bold) : (text: string) => style(text, SGR.gray);
      return this.wrapPlain(truncated, maxWidth).map(line => lineStyle(line));
    }
    const [, timestampRaw, artifactRaw, threadIdRaw, messageRaw] = match;
    const timestamp = timestampRaw ?? '';
    const artifact = artifactRaw ?? '';
    const threadId = threadIdRaw ?? '';
    const message = messageRaw ?? '';
    const meta = `${style(timestamp, SGR.dim)} ${style(`[${artifact}]`, SGR.yellow)} ${style(`[thread ${threadId}]`, SGR.dim)}`;
    const details = this.formatLogDetails(message, maxWidth - 2);
    return [meta, ...details];
  }

  private wrapPlain(text: string, maxWidth: number): string[] {
    const stripped = text.replace(/\s+/g, ' ').trim();
    if (stripped.length === 0) {
      return [];
    }
    return wrapAnsi(stripped, Math.max(10, maxWidth), { hard: true }).split('\n');
  }

  private truncate(text: string, maxLength: number): string {
    const stripped = stripAnsi(text);
    if (stringWidth(stripped) <= maxLength) {
      return text;
    }
    const truncatedLines = wrapAnsi(stripped, maxLength, { hard: true }).split('\n');
    const truncated = truncatedLines[0] ?? '';
    const base = truncated.trimEnd();
    return base.length > 0 ? `${base}…` : '…';
  }

  private formatLogDetails(message: string, width: number): string[] {
    const details: string[] = [];
    const trimmed = message.trim();
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const type = typeof parsed.type === 'string' ? parsed.type : undefined;
        const item = parsed.item as Record<string, unknown> | undefined;
        const itemType = item && typeof item.item_type === 'string' ? item.item_type : undefined;
        const identifier = item && typeof item.id === 'string' ? item.id : typeof parsed.id === 'string' ? parsed.id : undefined;
        const itemText = (item && typeof item.text === 'string' ? item.text : undefined) ?? (typeof parsed.text === 'string' ? parsed.text : undefined);
        const commandRaw = (typeof parsed.command !== 'undefined' ? parsed.command : undefined)
          ?? (item && typeof item.command !== 'undefined' ? item.command : undefined);
        const command = normalizeCommand(commandRaw);
        const status = typeof parsed.status === 'string' ? parsed.status : typeof parsed.result === 'string' ? parsed.result : undefined;
        const exit = parsed.exitCode ?? parsed.code ?? parsed.statusCode;

        const summaryParts: string[] = [];
        if (type) {
          summaryParts.push(style(`[${type}]`, SGR.yellow, SGR.bold));
        }
        if (itemType) {
          summaryParts.push(style(itemType, SGR.magenta));
        }
        if (identifier) {
          summaryParts.push(style(`id=${identifier}`, SGR.dim));
        }
        if (status) {
          summaryParts.push(style(status, SGR.dim));
        }
        const summary = summaryParts.length > 0
          ? this.wrapPlain(summaryParts.join(' | '), width).map(line => style(line, SGR.white))
          : [];
        details.push(...summary);

        if (command) {
          const commandLines = this.wrapPlain(command, width).map(line => style(line, SGR.cyan, SGR.bold));
          details.push(...commandLines);
        }
        if (itemText && itemText.trim().length > 0) {
          const textLines = this.wrapPlain(itemText, width).map(line => style(line, SGR.white, SGR.bold));
          details.push(...applyBackground(textLines, SGR.lightGreenBg));
        }
        if (typeof exit === 'number') {
          const exitColor = exit === 0 ? SGR.green : SGR.red;
          details.push(style(`exit ${exit}`, exitColor, SGR.bold));
        }
      }
    } catch {
      /* ignore parse errors */
    }
    if (details.length === 0) {
      const fallbackLines = this.wrapPlain(this.truncate(message, LOG_TRUNCATE), width).map(line => style(line, SGR.white));
      return fallbackLines.map(line => `  ${line}`);
    }
    return details.map(line => `  ${line}`);
  }

  private renderDescriptionLine(line: string): string {
    const pattern = /\[Iteration\s+(\d+)\]/gi;
    const highlighted = line.replace(pattern, (_, num) => `${SGR.bold}[ITERATION ${num}]${SGR.reset}${SGR.gray}`);
    return `  ${SGR.gray}${highlighted}${SGR.reset}`;
  }
}

class LegacyDashboardRenderer implements Renderer {
  private readonly spinnerFrames: string[] = ['-', '\\', '|', '/'];
  private frameIndex = 0;
  private lastFrame = '';
  private firstRender = true;
  private cursorHidden = false;
  private lastLineCount = 0;

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
    lines.push('Review Mediator Dashboard (compat mode)');
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
        lines.push(this.limitLogLength(log.visible));
      }
    }
    return lines.map(line => `${line}\u001b[K`).join('\n');
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

  private limitLogLength(line: string, limit = LOG_TRUNCATE): string {
    if (line.length <= limit) {
      return line;
    }
    return `${line.slice(0, limit)}…`;
  }
}

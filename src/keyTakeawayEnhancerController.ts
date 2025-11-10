import { GoogleGenAI } from '@google/genai';
import { logger } from './logger';

interface ControllerOptions {
  ai: GoogleGenAI;
  modelName: string;
  modelConfig: Record<string, unknown>;
  promptText: string;
  placeholderToken: string;
  messageId: string;
  updateMessageStream: (messageId: string, text: string) => Promise<void> | void;
  cacheKey: string;
  postStreamGraceMs: number;
}

type Range = { start: number; end: number };

const enhancerCache = new Map<string, string>();

export function hasKeyTakeawayEnhancerCacheEntry(key: string): boolean {
  return enhancerCache.has(key);
}

export function computeKeyTakeawayEnhancerPromptHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export class KeyTakeawayEnhancerController {
  private readonly ai: GoogleGenAI;
  private readonly modelName: string;
  private readonly modelConfig: Record<string, unknown>;
  private readonly promptText: string;
  private readonly placeholder: string;
  private readonly messageId: string;
  private readonly updateMessageStream: (messageId: string, text: string) => Promise<void> | void;
  private readonly cacheKey: string;
  private readonly postStreamGraceMs: number;
  private enhancerPromise: Promise<string> | null = null;
  private enhancerResolvedText: string | null = null;
  private latestFullText = '';
  private placeholderDetected = false;
  private placeholderReplaced = false;
  private placeholderRemoved = false;
  private startTime = Date.now();
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ControllerOptions) {
    this.ai = options.ai;
    this.modelName = options.modelName;
    this.modelConfig = options.modelConfig;
    this.promptText = options.promptText;
    this.placeholder = options.placeholderToken;
    this.messageId = options.messageId;
    this.updateMessageStream = options.updateMessageStream;
    this.cacheKey = options.cacheKey;
    this.postStreamGraceMs = options.postStreamGraceMs;
  }

  start(): void {
    const cached = enhancerCache.get(this.cacheKey);
    if (cached) {
      logger.info('[KEY_TAKE_AWAY_SENSEI] CACHE_HIT', { messageId: this.messageId, reason: 'prompt-unchanged' });
      logger.info('[KEY_TAKE_AWAY_SENSEI] ENHANCER_REQUEST_START', { messageId: this.messageId, cacheUsed: true });
      this.enhancerResolvedText = cached;
      this.enhancerPromise = Promise.resolve(cached);
      logger.info('[KEY_TAKE_AWAY_SENSEI] ENHANCER_RESPONSE_RECEIVED', { messageId: this.messageId, source: 'cache', text: cached });
      return;
    }
    logger.info('[KEY_TAKE_AWAY_SENSEI] CACHE_MISS', { messageId: this.messageId, reason: 'promptChanged' });
    logger.info('[KEY_TAKE_AWAY_SENSEI] ENHANCER_REQUEST_START', { messageId: this.messageId, cacheUsed: false });
    logger.info('[KEY_TAKE_AWAY_SENSEI] ENHANCER_PROMPT_READY', {
      messageId: this.messageId,
      promptHash: this.cacheKey,
      prompt: this.promptText
    });
    const chat = this.ai.chats.create({
      model: this.modelName,
      config: {
        ...this.modelConfig,
      },
      history: [],
    });
    this.enhancerPromise = chat
      .sendMessage({ message: this.promptText })
      .then(response => (response.text ?? '').trim())
      .then(text => {
        logger.info('[KEY_TAKE_AWAY_SENSEI] ENHANCER_RESPONSE_RECEIVED', { messageId: this.messageId, source: 'fresh', text });
        enhancerCache.set(this.cacheKey, text);
        this.handleEnhancerReady(text);
        return text;
      })
      .catch(error => {
        logger.error('[KEY_TAKE_AWAY_SENSEI] ENHANCER_REQUEST_FAILED', { messageId: this.messageId, error: (error as Error).message });
        throw error;
      });
  }

  async onChunk(fullText: string): Promise<string> {
    this.latestFullText = fullText;
    const index = this.findPlaceholderIndex(fullText);
    if (index === -1) {
      return fullText;
    }
    if (!this.placeholderDetected) {
      this.placeholderDetected = true;
      logger.info('[KEY_TAKE_AWAY_SENSEI] PLACEHOLDER_DETECTED', { messageId: this.messageId });
    }
    if (this.enhancerResolvedText) {
      const replaced = this.insertEnhancerText(fullText, index, this.enhancerResolvedText);
      if (replaced) {
        this.placeholderReplaced = true;
        this.latestFullText = replaced;
        const latencyMs = Date.now() - this.startTime;
        logger.info('[KEY_TAKE_AWAY_SENSEI] PLACEHOLDER_REPLACED', { messageId: this.messageId, latencyMs });
        return replaced;
      }
    }
    return fullText;
  }

  async finalize(): Promise<void> {
    if (!this.placeholderDetected || this.placeholderReplaced || this.placeholderRemoved) {
      return;
    }
    if (!this.enhancerPromise) {
      this.removePlaceholder('request-not-started');
      return;
    }
    const timeoutPromise = new Promise<null>((resolve, reject) => {
      this.graceTimer = setTimeout(() => reject(new Error('timeout')), this.postStreamGraceMs);
    });
    try {
      const result = await Promise.race([this.enhancerPromise, timeoutPromise]);
      const text = (typeof result === 'string' && result) ? result : (this.enhancerResolvedText || '');
      if (!this.placeholderReplaced && text) {
        const index = this.findPlaceholderIndex(this.latestFullText);
        if (index === -1) {
          return;
        }
        const replaced = this.insertEnhancerText(this.latestFullText, index, text);
        if (replaced) {
          this.placeholderReplaced = true;
          this.latestFullText = replaced;
          await this.updateMessageStream(this.messageId, replaced);
          const latencyMs = Date.now() - this.startTime;
          logger.info('[KEY_TAKE_AWAY_SENSEI] PLACEHOLDER_REPLACED', { messageId: this.messageId, latencyMs });
        }
      }
    } catch (error) {
      const reason = (error as Error).message === 'timeout' ? 'timeout' : 'request-failed';
      this.removePlaceholder(reason);
    } finally {
      if (this.graceTimer) {
        clearTimeout(this.graceTimer);
      }
    }
  }

  private handleEnhancerReady(text: string): void {
    this.enhancerResolvedText = text;
    if (!this.placeholderDetected || this.placeholderReplaced) {
      return;
    }
    const index = this.findPlaceholderIndex(this.latestFullText);
    if (index === -1) {
      return;
    }
    const replaced = this.insertEnhancerText(this.latestFullText, index, text);
    if (!replaced) {
      return;
    }
    this.placeholderReplaced = true;
    this.latestFullText = replaced;
    const latencyMs = Date.now() - this.startTime;
    logger.info('[KEY_TAKE_AWAY_SENSEI] PLACEHOLDER_REPLACED', { messageId: this.messageId, latencyMs });
    Promise.resolve(this.updateMessageStream(this.messageId, replaced)).catch(() => {
      logger.error('[KEY_TAKE_AWAY_SENSEI] UPDATE_STREAM_FAILED', { messageId: this.messageId });
    });
  }

  private insertEnhancerText(fullText: string, index: number, text: string): string | null {
    if (index < 0) {
      return null;
    }
    const before = fullText.slice(0, index);
    const after = fullText.slice(index + this.placeholder.length);
    const wrapped = `\n<div class="key-takeaway-enhancer">\n\n${text}\n\n</div>\n`;
    return `${before}${wrapped}${after}`;
  }

  private removePlaceholder(reason: string): void {
    if (this.placeholderRemoved || !this.placeholderDetected) {
      return;
    }
    const index = this.findPlaceholderIndex(this.latestFullText);
    if (index === -1) {
      this.placeholderRemoved = true;
      return;
    }
    const updated = this.latestFullText.slice(0, index) + this.latestFullText.slice(index + this.placeholder.length);
    this.placeholderRemoved = true;
    this.latestFullText = updated;
    Promise.resolve(this.updateMessageStream(this.messageId, updated)).catch(() => {
      logger.error('[KEY_TAKE_AWAY_SENSEI] UPDATE_STREAM_FAILED', { messageId: this.messageId });
    });
    logger.warn('[KEY_TAKE_AWAY_SENSEI] PLACEHOLDER_REMOVED', { messageId: this.messageId, reason });
  }

  getLatestText(): string {
    return this.latestFullText;
  }

  private findPlaceholderIndex(text: string): number {
    let searchIndex = 0;
    const blockRanges = this.getCodeBlockRanges(text);
    const inlineRanges = this.getInlineCodeRanges(text, blockRanges);
    while (searchIndex < text.length) {
      const idx = text.indexOf(this.placeholder, searchIndex);
      if (idx === -1) {
        return -1;
      }
      const end = idx + this.placeholder.length;
      if (!this.isRangeInside(idx, end, blockRanges) && !this.isRangeInside(idx, end, inlineRanges)) {
        return idx;
      }
      searchIndex = end;
    }
    return -1;
  }

  private getCodeBlockRanges(text: string): Range[] {
    const ranges: Range[] = [];
    const regex = /```[\s\S]*?```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  }

  private getInlineCodeRanges(text: string, blockRanges: Range[]): Range[] {
    const ranges: Range[] = [];
    let index = 0;
    while (index < text.length) {
      if (this.isIndexInside(index, blockRanges)) {
        const block = blockRanges.find(range => index >= range.start && index < range.end);
        if (!block) {
          index++;
          continue;
        }
        index = block.end;
        continue;
      }
      if (text[index] !== '`') {
        index++;
        continue;
      }
      let fenceLength = 1;
      while (index + fenceLength < text.length && text[index + fenceLength] === '`') {
        fenceLength++;
      }
      const fence = '`'.repeat(fenceLength);
      let searchStart = index + fenceLength;
      let closingIndex = -1;
      while (searchStart < text.length) {
        const found = text.indexOf(fence, searchStart);
        if (found === -1) {
          break;
        }
        if (text[found - 1] === '\\') {
          searchStart = found + fenceLength;
          continue;
        }
        closingIndex = found;
        break;
      }
      if (closingIndex === -1) {
        index += fenceLength;
        continue;
      }
      ranges.push({ start: index, end: closingIndex + fenceLength });
      index = closingIndex + fenceLength;
    }
    return ranges;
  }

  private isRangeInside(start: number, end: number, ranges: Range[]): boolean {
    return ranges.some(range => start >= range.start && end <= range.end);
  }

  private isIndexInside(position: number, ranges: Range[]): boolean {
    return ranges.some(range => position >= range.start && position < range.end);
  }
}

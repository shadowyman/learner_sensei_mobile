import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { BlurView } from '@react-native-community/blur';

import { logger } from '../logger';
import { BridgeManager } from './bridge/BridgeManager';
import type { RNToWebMessage, WebToRNMessage, FooterPayload } from './bridge/contracts';
import type { BffClientLike } from './network/types';
import { SelectionOverlay, SelectionOverlayController, SelectionOverlayState } from './SelectionOverlay';
import { SenseiHeader } from './components/SenseiHeader';
import { SenseiBackdropCanvas } from './effects/SenseiBackdropCanvas';
import { InputBar } from './components/InputBar';

type ThemeColors = {
    linear: [string, string, string];
    radialA: string;
    radialB: string;
    radialC: string;
};

const DEFAULT_THEME_COLORS: ThemeColors = {
    linear: ['#0a0a0a', '#1a1a2e', '#16213e'],
    radialA: 'rgba(0,212,255,0.18)',
    radialB: 'rgba(0,212,255,0.08)',
    radialC: 'rgba(196,229,56,0.08)'
};

const DEFAULT_MAIN_HEX = '#5c56f5';

const WEBVIEW_ERROR_BRIDGE = `
(function() {
    if (window.__senseiWebviewErrorBridge) {
        return;
    }
    window.__senseiWebviewErrorBridge = true;
    var formatLocation = function(file, line, col) {
        if (!file && !line && !col) {
            return '';
        }
        var parts = [];
        if (file) {
            parts.push(file);
        }
        if (typeof line === 'number') {
            parts.push(line);
        }
        if (typeof col === 'number') {
            parts.push(col);
        }
        return parts.join(':');
    };
    var describeEvent = function(event) {
        if (!event) {
            return 'Unknown webview error';
        }
        if (event.message && event.message.length) {
            var loc = formatLocation(event.filename, event.lineno, event.colno);
            return loc ? event.message + ' (' + loc + ')' : event.message;
        }
        if (event.target && event.target.tagName) {
            var el = event.target;
            var src = el.src || el.href || (el.getAttribute && el.getAttribute('src')) || '';
            if (src) {
                return 'Resource load failed: ' + el.tagName.toLowerCase() + ' ' + src;
            }
        }
        if (event.filename) {
            return 'Script error at ' + event.filename;
        }
        return 'Unhandled error';
    };
    var post = function(payload) {
        try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
        } catch (_) {}
    };
    var report = function(message, stack) {
        var body = { type: 'webview:error', message: message && message.length ? message : 'Webview error' };
        if (stack) {
            body.stack = stack;
        }
        if (typeof console !== 'undefined' && console.error) {
            console.error('Failed to load webview bundle', body);
        }
        post(body);
    };
    window.addEventListener('error', function(event) {
        if (!event) {
            return;
        }
        var msg = describeEvent(event);
        var stack = event.error && event.error.stack ? event.error.stack : undefined;
        report(msg, stack);
    }, true);
    window.addEventListener('unhandledrejection', function(event) {
        if (!event) {
            return;
        }
        var reason = event.reason;
        var message;
        if (typeof reason === 'string') {
            message = reason;
        } else if (reason && reason.message) {
            message = reason.message;
        } else {
            message = 'Unhandled rejection';
        }
        var stack = reason && reason.stack ? reason.stack : undefined;
        report(message, stack);
    });
    return true;
})();`;

interface SaveLoadServiceLike {
    exportSession: () => Promise<void>;
    importSession: () => Promise<void>;
    handleWebMessage: (message: WebToRNMessage) => void;
}

interface TelemetryManagerLike {
    isEnabled(): boolean;
    toggle(enabled: boolean): Promise<void>;
    nextClientTurnId(): string;
    record(event: string, data: Record<string, unknown>): void;
}

interface MainScreenProps {
    bridge: BridgeManager;
    bffClient: BffClientLike;
    saveLoadService: SaveLoadServiceLike;
    telemetryManager: TelemetryManagerLike;
    webContentUri?: string;
    webContentHtml?: string;
    onWebViewEvent?: (message: WebToRNMessage) => void;
    webViewRefOverride?: React.RefObject<WebView | null>;
    onWebViewError?: (info: { url?: string; code?: number; description?: string }) => void;
    allowingReadAccessToURL?: string;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16);
        const g = parseInt(clean[1] + clean[1], 16);
        const b = parseInt(clean[2] + clean[2], 16);
        return { r, g, b };
    }
    if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) return null;
        return { r, g, b };
    }
    return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;
    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case rN:
                h = ((gN - bN) / delta) % 6;
                break;
            case gN:
                h = (bN - rN) / delta + 2;
                break;
            default:
                h = (rN - gN) / delta + 4;
                break;
        }
        h /= 6;
        if (h < 0) h += 1;
    }
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hueToRgb = (p: number, q: number, t: number): number => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hueToRgb(p, q, h + 1 / 3);
    const g = hueToRgb(p, q, h);
    const b = hueToRgb(p, q, h - 1 / 3);
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function hslToHex(h: number, s: number, l: number): string {
    const { r, g, b } = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
}

function deriveThemeColors(main: string): ThemeColors {
    const normalized = main.trim().toLowerCase();
    if (normalized === DEFAULT_MAIN_HEX) {
        return DEFAULT_THEME_COLORS;
    }
    const parsed = hexToHsl(main) ?? { h: 0.62, s: 0.62, l: 0.22 };
    const h = parsed.h;
    const sBase = clamp01(parsed.s);
    const lBase = clamp01(parsed.l);

    const hueShift = (base: number, delta: number) => {
        const shifted = base + delta;
        if (shifted < 0) return shifted + 1;
        if (shifted > 1) return shifted - 1;
        return shifted;
    };

    const h1 = hueShift(h, -0.12);
    const h2 = h;
    const h3 = hueShift(h, 0.16);

    const l1 = clamp01(Math.min(lBase * 0.3, 0.18));
    const l2 = clamp01(Math.min(lBase * 0.55 + 0.03, 0.28));
    const l3 = clamp01(Math.min(lBase * 0.7 + 0.06, 0.38));

    const s1 = sBase;
    const s2 = clamp01(sBase * 0.45);
    const s3 = clamp01(sBase * 0.41);

    const linear: [string, string, string] = [
        hslToHex(h1, s1, l1),
        hslToHex(h2, s2, l2),
        hslToHex(h3, s3, l3)
    ];

    const lg = clamp01(Math.min(Math.max(lBase + 0.08, 0.26), 0.36));
    const sGlow = clamp01(sBase * 0.95);
    const toRgba = (hh: number, alpha: number) => {
        const { r, g, b } = hslToRgb(hh, sGlow, lg);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const radialA = toRgba(hueShift(h, 0.22), 0.28);
    const radialB = toRgba(hueShift(h, -0.16), 0.22);
    const radialC = toRgba(hueShift(h, 0.08), 0.18);

    return { linear, radialA, radialB, radialC };
}

interface ForwardStreamOptions {
    bridge: BridgeManager;
    telemetryManager: TelemetryManagerLike;
    setFooter: (footer: FooterPayload) => void;
    setIsStreaming: (value: boolean) => void;
}

export async function runForwardStream(
    handlePromise: ReturnType<BffClientLike['submitTurn']>,
    options: ForwardStreamOptions
): Promise<void> {
    const { bridge, telemetryManager, setFooter, setIsStreaming } = options;
    setIsStreaming(true);
    try {
        const resolved = await handlePromise;
        const iteratorFactory = (resolved.stream as any)[Symbol.asyncIterator];
        if (typeof iteratorFactory !== 'function') {
            throw new Error('Stream is not async iterable');
        }
        const iterator = iteratorFactory.call(resolved.stream) as AsyncIterator<StreamChunk | StreamStatus | StreamError>;
        while (true) {
            const { value, done } = await iterator.next();
            if (done) {
                break;
            }
            const event = value;
            switch (event.type) {
                case 'chunk':
                    bridge.enqueue({ type: 'chat:update', messageId: resolved.messageId, text: event.text });
                    break;
                case 'status':
                    if (event.footer) {
                        bridge.enqueue({ type: 'footer:update', payload: event.footer as FooterPayload });
                        setFooter(event.footer as FooterPayload);
                    }
                    telemetryManager.record('stream_status', { phase: event.phase });
                    if (event.phase === 'completed') {
                        bridge.enqueue({ type: 'chat:completeMessage', messageId: resolved.messageId });
                    }
                    break;
                case 'error':
                    logger.error('[MOBILE_PORT] stream error', { code: event.code, message: event.message });
                    telemetryManager.record('stream_error', { code: event.code, message: event.message });
                    return;
                default:
                    break;
            }
        }
        telemetryManager.record('stream_completed', {});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('[MOBILE_PORT] stream failure', { error: message });
        telemetryManager.record('stream_error', { code: 'submit_failure', message });
    } finally {
        setIsStreaming(false);
    }
}

export const MainScreen: React.FC<MainScreenProps> = ({
    bridge,
    bffClient,
    saveLoadService,
    telemetryManager,
    webContentUri,
    webContentHtml,
    onWebViewEvent,
    webViewRefOverride,
    onWebViewError,
    allowingReadAccessToURL
}) => {
    const SHOW_WEBVIEW = true;
    const internalWebViewRef = useRef<WebView>(null);
    const webViewRef = webViewRefOverride ?? internalWebViewRef;
    const enableIOSWebInspector = Platform.OS === 'ios';
    const [isStreaming, setIsStreaming] = useState(false);
    const [footer, setFooter] = useState<FooterPayload | null>(null);
    const [headerStatus, setHeaderStatus] = useState('Loading curriculum…');
    const [selectionOverlay, setSelectionOverlay] = useState<SelectionOverlayState>({ visible: false });
    const selectionControllerRef = useRef<SelectionOverlayController | null>(null);
    const [webViewFrame, setWebViewFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [headerRect, setHeaderRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [inputBarRect, setInputBarRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [inputFieldRect, setInputFieldRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS);
    const [webViewReady, setWebViewReady] = useState(false);
    const { width: viewportWidth } = useWindowDimensions();
    const webviewErrorInjection = useMemo(() => `
        window.__SENSEI_MOBILE_BUILD__ = true;
        ${WEBVIEW_ERROR_BRIDGE}
    `, []);
    const isPad = Platform.OS === 'ios' && (Platform as any).isPad;
    const isCompactIOS = Platform.OS === 'ios' && !isPad && viewportWidth <= 430;
    const handleHeaderRectUpdate = useCallback((rect: { x: number; y: number; width: number; height: number } | null) => {
        logger.info('Sensei(debug)', {
            tag: 'headerRect.update',
            compact: isCompactIOS,
            rect
        });
        setHeaderRect(rect);
    }, [isCompactIOS]);

    const webViewSource = useMemo(() => {
        if (webContentUri) return { uri: webContentUri } as const;
        if (webContentHtml) return { html: webContentHtml } as const;
        return { html: '<!doctype html><html><body style="font-family:-apple-system;color:#e2e8f0;background:#0b0b0b;padding:16px">No WebView source provided.</body></html>' } as const;
    }, [webContentUri, webContentHtml]);

    // Track success to avoid logging stale onError events after a successful load
    const hasLoadedRef = useRef(false);
    const headerBridgeInjectedRef = useRef(false);
    useEffect(() => {
        hasLoadedRef.current = false;
        headerBridgeInjectedRef.current = false;
        setWebViewReady(false);
    }, [webContentUri, webContentHtml]);

    const webviewKey = useMemo(() => (webContentUri ? `uri:${webContentUri}` : webContentHtml ? `html:${webContentHtml.length}` : 'empty'), [webContentUri, webContentHtml]);

    useEffect(() => {
        const initMessage: RNToWebMessage = {
            type: 'app:init',
            telemetryEnabled: telemetryManager.isEnabled(),
            theme: 'default'
        };
        bridge.enqueue(initMessage);
        if (!selectionControllerRef.current) {
            selectionControllerRef.current = new SelectionOverlayController({ bridge, onChange: setSelectionOverlay });
        }
    }, [bridge, telemetryManager, setFooter]);

    const sendWebViewCommand = useCallback((script: string) => {
        const target = webViewRef.current;
        target?.injectJavaScript(script);
    }, [webViewRef]);

    const clickWebButton = useCallback((elementId: string) => {
        const script = `
            (function() {
                const button = document.getElementById(${JSON.stringify(elementId)});
                if (button) {
                    button.click();
                }
            })();
            true;
        `;
        sendWebViewCommand(script);
    }, [sendWebViewCommand]);

    const injectHeaderStatusObserver = useCallback(() => {
        if (headerBridgeInjectedRef.current) {
            return;
        }
        headerBridgeInjectedRef.current = true;
        const script = `
            (function() {
                if (window.__senseiHeaderBridgeInitialized) {
                    return;
                }
                window.__senseiHeaderBridgeInitialized = true;
                const getText = (node) => {
                    if (!node || typeof node.textContent !== 'string') {
                        return '';
                    }
                    return node.textContent.trim();
                };
                const buildLines = (target) => {
                    const lines = [];
                    const moduleNode = target.querySelector('.status-module');
                    if (moduleNode) {
                        const moduleText = getText(moduleNode);
                        if (moduleText) {
                            lines.push(moduleText);
                        }
                    }
                    const phaseLineNode = target.querySelector('.status-phase-line');
                    if (phaseLineNode) {
                        const fragments = Array.from(phaseLineNode.childNodes)
                            .map((child) => getText(child))
                            .filter(Boolean);
                        const joined = fragments.join(' ').replace(/\\s+/g, ' ').trim();
                        if (joined) {
                            lines.push(joined);
                        }
                    } else {
                        const parts = [];
                        const phaseNode = target.querySelector('.status-phase');
                        const conceptNode = target.querySelector('.status-concept');
                        const chunkNode = target.querySelector('.status-chunk');
                        const phaseText = getText(phaseNode);
                        if (phaseText) {
                            parts.push(phaseText);
                        }
                        const conceptText = getText(conceptNode);
                        if (conceptText) {
                            if (parts.length > 0) {
                                parts.push('–');
                            }
                            parts.push(conceptText);
                        }
                        const chunkText = getText(chunkNode);
                        if (chunkText) {
                            parts.push(chunkText);
                        }
                        const fallback = parts.join(' ').replace(/\\s+/g, ' ').trim();
                        if (fallback) {
                            lines.push(fallback);
                        }
                    }
                    if (lines.length === 0) {
                        const fallbackText = getText(target);
                        if (fallbackText) {
                            lines.push(fallbackText);
                        }
                    }
                    return lines;
                };
                const sendStatus = () => {
                    const target = document.getElementById('curriculum-status-topic');
                    if (!target || !window.ReactNativeWebView) {
                        return;
                    }
                    const lines = buildLines(target)
                        .map((line) => (typeof line === 'string' ? line.replace(/\\s+/g, ' ').trim() : ''))
                        .filter((line) => !!line);
                    const text = lines.join('\\n');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'header:status',
                        text,
                        lines
                    }));
                };
                const container = document.getElementById('curriculum-status-container');
                if (container && window.MutationObserver) {
                    const observer = new MutationObserver(function() {
                        sendStatus();
                    });
                    observer.observe(container, { childList: true, subtree: true, characterData: true });
                }
                if (document.readyState === 'complete') {
                    sendStatus();
                } else {
                    window.addEventListener('load', sendStatus, { once: true });
                }
                sendStatus();
            })();
            true;
        `;
        sendWebViewCommand(script);
    }, [sendWebViewCommand]);

    const forwardStream = useCallback(async (handle: ReturnType<BffClientLike['submitTurn']>) => {
        await runForwardStream(handle, { bridge, telemetryManager, setFooter, setIsStreaming });
    }, [bridge, telemetryManager]);

    const handleSubmit = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isStreaming) {
                return;
            }
            const clientTurnId = telemetryManager.nextClientTurnId();
            const userMessageId = `user-${clientTurnId}`;
            bridge.enqueue({ type: 'chat:startMessage', messageId: userMessageId, sender: 'user', text: trimmed });
            await bffClient.ensureSession();
            logger.info('[MOBILE_PORT] turn submit', { clientTurnId, textLength: trimmed.length });
            telemetryManager.record('turn_submitted', { textLength: trimmed.length });
            const handlePromise = (async () => {
                const handle = await bffClient.submitTurn({ text: trimmed, clientTurnId });
                bridge.enqueue({ type: 'chat:startMessage', messageId: handle.messageId, sender: 'sensei' });
                return handle;
            })();
            forwardStream(handlePromise);
        },
        [bffClient, bridge, forwardStream, isStreaming, telemetryManager]
    );

    const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
        try {
            const parsed: WebToRNMessage = JSON.parse(event.nativeEvent.data);
            if (parsed.type === 'webview:error') {
                logger.error('[MOBILE_PORT] webview bootstrap error', { message: parsed.message, stack: parsed.stack });
                onWebViewEvent?.(parsed);
                return;
            }
            if (parsed.type === 'footer:update') {
                setFooter(parsed.payload);
            }
            if (parsed.type === 'selection' || parsed.type === 'selection:clear') {
                selectionControllerRef.current?.handleWebMessage(parsed);
            }
            if (parsed.type === 'saveload:exportResult' || parsed.type === 'saveload:importResult') {
                saveLoadService.handleWebMessage(parsed);
            }
            if (parsed.type === 'telemetry:event') {
                telemetryManager.record(parsed.eventName, parsed.data ?? {});
            }
            if (parsed.type === 'theme:update') {
                setThemeColors(deriveThemeColors(parsed.value));
            }
            if (parsed.type === 'mermaid:recover') {
                (async () => {
                    try {
                        await bffClient.ensureSession();
                        const result = await bffClient.recoverMermaid({
                            messageId: parsed.messageId,
                            code: parsed.code,
                            theme: parsed.theme,
                            errorHash: parsed.errorHash,
                            errorMessage: parsed.errorMessage,
                            mode: parsed.mode
                        });
                        bridge.enqueue({
                            type: 'mermaid:recoverResult',
                            messageId: parsed.messageId,
                            fixed: result.fixed,
                            fixedCode: result.fixedCode
                        } as RNToWebMessage);
                    } catch (error) {
                        logger.error('[MOBILE_PORT] mermaid recover via BFF failed', { error });
                        bridge.enqueue({
                            type: 'mermaid:recoverResult',
                            messageId: parsed.messageId,
                            fixed: false
                        } as RNToWebMessage);
                    }
                })();
            }
            if (parsed.type === 'header:status') {
                if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
                    setHeaderStatus(parsed.lines.join('\n'));
                } else {
                    setHeaderStatus(parsed.text ?? '');
                }
            }
            onWebViewEvent?.(parsed);
        } catch (error) {
            logger.error('[MOBILE_PORT] webview message parse error', { error });
        }
    }, [onWebViewEvent, saveLoadService, telemetryManager, bffClient, bridge]);

    const handleSave = useCallback(async () => {
        await saveLoadService.exportSession();
    }, [saveLoadService]);

    const handleImport = useCallback(async () => {
        await saveLoadService.importSession();
    }, [saveLoadService]);

    useEffect(() => {
        if (!inputBarRect || !webViewReady) {
            return;
        }
        const h = Math.max(0, Math.round(inputBarRect.height));
        bridge.enqueue({ type: 'ui:inputOffset', height: h });
    }, [bridge, inputBarRect, webViewReady]);

    const handleToggleFontSize = useCallback(() => clickWebButton('font-size-toggle'), [clickWebButton]);
    const handleToggleTheme = useCallback(() => clickWebButton('theme-button'), [clickWebButton]);
    const handleToggleTelemetryMenu = useCallback(() => telemetryManager.toggle(!telemetryManager.isEnabled()), [telemetryManager]);
    const handleToggleDebug = useCallback(() => clickWebButton('debug-mode-button'), [clickWebButton]);
    const handleToggleFullscreen = useCallback(() => clickWebButton('main-chat-fullscreen-button'), [clickWebButton]);
    const handleOpenNotepad = useCallback(() => clickWebButton('notepad-button'), [clickWebButton]);
    const handleConceptPrev = useCallback(() => clickWebButton('concept-nav-prev'), [clickWebButton]);
    const handleConceptNext = useCallback(() => clickWebButton('concept-nav-next'), [clickWebButton]);
    const handleChunkPrev = useCallback(() => clickWebButton('chunk-nav-prev'), [clickWebButton]);
    const handleChunkNext = useCallback(() => clickWebButton('chunk-nav-next'), [clickWebButton]);

    return (
        <View style={[styles.root, { backgroundColor: themeColors.linear[0] }]}>            
            <SenseiBackdropCanvas
                drawBackground={true}
                includeHeaderFilter={true}
                enableInputBlur={false}
                headerRect={headerRect}
                inputBarRect={inputBarRect}
                inputFieldRect={inputFieldRect}
                colors={themeColors}
            />
            <SafeAreaView style={styles.container} edges={['left','right']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <SelectionOverlay
                state={selectionOverlay}
                webViewFrame={webViewFrame}
                onAction={(actionId, extras) => selectionControllerRef.current?.invoke(actionId, extras)}
                onDismiss={() => selectionControllerRef.current?.dismiss()}
            />
            <SenseiHeader
                statusText={headerStatus}
                onConceptPrev={handleConceptPrev}
                onConceptNext={handleConceptNext}
                onChunkPrev={handleChunkPrev}
                onChunkNext={handleChunkNext}
                onToggleFontSize={handleToggleFontSize}
                onToggleTheme={handleToggleTheme}
                onToggleTelemetry={handleToggleTelemetryMenu}
                onToggleDebug={handleToggleDebug}
                onToggleFullscreen={handleToggleFullscreen}
                onOpenNotepad={handleOpenNotepad}
                onSave={handleSave}
                onLoad={handleImport}
                onLayoutRect={handleHeaderRectUpdate}
            />
            {!isCompactIOS && <View style={styles.headerDivider} />}
            {SHOW_WEBVIEW ? (
                <View style={styles.webviewWrapper}>
                    <WebView
                        key={webviewKey}
                        ref={webViewRef}
                        source={webViewSource}
                        originWhitelist={['file://*']}
                        injectedJavaScriptBeforeContentLoaded={webviewErrorInjection}
                        onMessage={handleWebViewMessage}
                        allowingReadAccessToURL={allowingReadAccessToURL}
                        allowFileAccessFromFileURLs={true}
                        allowUniversalAccessFromFileURLs={true}
                        webviewDebuggingEnabled={enableIOSWebInspector}
                        style={styles.webview}
                        setBackgroundColor={'transparent'}
                        opaque={true}
                        onLoad={() => {
                            hasLoadedRef.current = true;
                            logger.info('[MOBILE_PORT] webview load success');
                            injectHeaderStatusObserver();
                            setWebViewReady(true);
                        }}
                        onHttpError={(e) => {
                            const ne = e.nativeEvent as any;
                            logger.warn('[MOBILE_PORT] webview http error', { url: ne?.url, statusCode: ne?.statusCode, description: ne?.description });
                        }}
                        onError={(e) => {
                            const ne = e.nativeEvent as any;
                            if (!hasLoadedRef.current) {
                                logger.error('[MOBILE_PORT] webview load error', { url: ne?.url, code: ne?.code, description: ne?.description });
                                onWebViewError?.({ url: ne?.url, code: ne?.code, description: ne?.description });
                            } else {
                                logger.warn('[MOBILE_PORT] webview late error ignored', { url: ne?.url, code: ne?.code });
                            }
                        }}
                        onLayout={event => setWebViewFrame(event.nativeEvent.layout)}
                    />
                </View>
            ) : (
                <View style={styles.webviewPlaceholder}>
                    <Text style={styles.placeholderText}>WebView temporarily disabled</Text>
                </View>
            )}
            <View
                pointerEvents="none"
                style={[
                    styles.nativeBlurOverlay,
                    inputFieldRect
                        ? {
                              left: inputFieldRect.x,
                              top: inputFieldRect.y,
                              width: inputFieldRect.width,
                              height: inputFieldRect.height,
                              opacity: 0.5
                          }
                        : { opacity: 0 }
                ]}
            >
                {Platform.OS === 'ios' ? (
                    <BlurView blurType="dark" blurAmount={300} reducedTransparencyFallbackColor="transparent" style={StyleSheet.absoluteFill} />
                ) : null}
            </View>
            <View style={styles.backdropOverlay} pointerEvents="none">
                <SenseiBackdropCanvas
                    drawBackground={false}
                    includeHeaderFilter={false}
                    enableInputBlur={true}
                    headerRect={headerRect}
                    inputBarRect={inputBarRect}
                    inputFieldRect={inputFieldRect}
                    colors={themeColors}
                />
            </View>
            <View style={styles.inputBarOverlay} pointerEvents="box-none">
                <InputBar
                    onSubmit={(txt) => {
                        logger.info('Sensei(debug)', { tag: 'inputbar.submit', length: txt.length });
                        void handleSubmit(txt);
                    }}
                    onOpenEditor={() => {
                        logger.info('Sensei(debug)', { tag: 'inputbar.editor.open' });
                    }}
                    onLayoutRect={setInputBarRect}
                    onInputFieldRect={setInputFieldRect}
                />
            </View>
            </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#050b14'
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        position: 'relative'
    },
    headerDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignSelf: 'stretch'
    },
    nativeBlurOverlay: {
        position: 'absolute',
        borderRadius: 16,
        overflow: 'hidden',
        zIndex: 2
    },
    webviewWrapper: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    webviewPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        marginHorizontal: 12,
        marginTop: 12
    },
    placeholderText: {
        color: '#94a3b8'
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8
    },
    backdropOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 2
    },
    secondaryButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#1f2937',
        borderRadius: 8
    },
    inputBarOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3
    }
});

export default MainScreen;

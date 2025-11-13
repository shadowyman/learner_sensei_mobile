import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

import { logger } from '../logger';
import { BridgeManager } from './bridge/BridgeManager';
import type { RNToWebMessage, WebToRNMessage, FooterPayload } from './bridge/contracts';
import type { BffClientLike } from './network/types';
import { SelectionOverlay, SelectionOverlayController, SelectionOverlayState } from './SelectionOverlay';
import { SenseiHeader } from './components/SenseiHeader';

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
        for await (const event of resolved.stream) {
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
    const SHOW_WEBVIEW = false;
    const internalWebViewRef = useRef<WebView>(null);
    const webViewRef = webViewRefOverride ?? internalWebViewRef;
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [footer, setFooter] = useState<FooterPayload | null>(null);
    const [headerStatus, setHeaderStatus] = useState('Loading curriculum…');
    const [selectionOverlay, setSelectionOverlay] = useState<SelectionOverlayState>({ visible: false });
    const selectionControllerRef = useRef<SelectionOverlayController | null>(null);
    const [webViewFrame, setWebViewFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });

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
                const sendStatus = () => {
                    const target = document.getElementById('curriculum-status-topic');
                    if (!target || !window.ReactNativeWebView) {
                        return;
                    }
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'header:status',
                        text: target.innerText || ''
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

    const handleSubmit = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isStreaming) {
            return;
        }
        setInput('');
        await bffClient.ensureSession();
        const clientTurnId = telemetryManager.nextClientTurnId();
        logger.info('[MOBILE_PORT] turn submit', { clientTurnId, textLength: trimmed.length });
        telemetryManager.record('turn_submitted', { textLength: trimmed.length });
        const messageId = `msg-${clientTurnId}`;
        bridge.enqueue({ type: 'chat:startMessage', messageId, sender: 'user', text: trimmed });
        forwardStream(bffClient.submitTurn({ text: trimmed, clientTurnId }));
    }, [bffClient, bridge, forwardStream, input, isStreaming, telemetryManager]);

    const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
        try {
            const parsed: WebToRNMessage = JSON.parse(event.nativeEvent.data);
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
            if (parsed.type === 'header:status') {
                setHeaderStatus(parsed.text ?? '');
            }
            onWebViewEvent?.(parsed);
        } catch (error) {
            logger.error('[MOBILE_PORT] webview message parse error', { error });
        }
    }, [onWebViewEvent, saveLoadService, telemetryManager]);

    const handleSave = useCallback(async () => {
        await saveLoadService.exportSession();
    }, [saveLoadService]);

    const handleImport = useCallback(async () => {
        await saveLoadService.importSession();
    }, [saveLoadService]);

    const handleToggleFontSize = useCallback(() => clickWebButton('font-size-toggle'), [clickWebButton]);
    const handleToggleTheme = useCallback(() => clickWebButton('theme-button'), [clickWebButton]);
    const handleToggleDebug = useCallback(() => clickWebButton('debug-mode-button'), [clickWebButton]);
    const handleToggleFullscreen = useCallback(() => clickWebButton('main-chat-fullscreen-button'), [clickWebButton]);
    const handleOpenNotepad = useCallback(() => clickWebButton('notepad-button'), [clickWebButton]);
    const handleConceptPrev = useCallback(() => clickWebButton('concept-nav-prev'), [clickWebButton]);
    const handleConceptNext = useCallback(() => clickWebButton('concept-nav-next'), [clickWebButton]);
    const handleChunkPrev = useCallback(() => clickWebButton('chunk-nav-prev'), [clickWebButton]);
    const handleChunkNext = useCallback(() => clickWebButton('chunk-nav-next'), [clickWebButton]);

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={['#0a0a0a', '#1a1a2e', '#16213e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id="bgGlowPrimary" cx="20%" cy="20%" rx="45%" ry="45%">
                        <Stop offset="0%" stopColor="#00d4ff" stopOpacity={0.18} />
                        <Stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                    </RadialGradient>
                    <RadialGradient id="bgGlowSecondary" cx="80%" cy="80%" rx="40%" ry="40%">
                        <Stop offset="0%" stopColor="#00d4ff" stopOpacity={0.08} />
                        <Stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                    </RadialGradient>
                    <RadialGradient id="bgOverlayPrimary" cx="30%" cy="60%" rx="35%" ry="35%">
                        <Stop offset="0%" stopColor="#c4e538" stopOpacity={0.05} />
                        <Stop offset="100%" stopColor="#c4e538" stopOpacity={0} />
                    </RadialGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#bgGlowPrimary)" />
                <Rect width="100%" height="100%" fill="url(#bgGlowSecondary)" />
                <Rect width="100%" height="100%" fill="url(#bgOverlayPrimary)" />
            </Svg>
            <SafeAreaView style={styles.container}>
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
                onToggleDebug={handleToggleDebug}
                onToggleFullscreen={handleToggleFullscreen}
                onOpenNotepad={handleOpenNotepad}
                onSave={handleSave}
                onLoad={handleImport}
            />
            {SHOW_WEBVIEW ? (
                <View style={styles.webviewWrapper}>
                    <WebView
                        key={webviewKey}
                        ref={webViewRef}
                        source={webViewSource}
                        originWhitelist={['file://*']}
                        onMessage={handleWebViewMessage}
                        allowingReadAccessToURL={allowingReadAccessToURL}
                        onLoad={() => {
                            hasLoadedRef.current = true;
                            logger.info('[MOBILE_PORT] webview load success');
                            injectHeaderStatusObserver();
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
                        style={styles.webview}
                    />
                </View>
            ) : (
                <View style={styles.webviewPlaceholder}>
                    <Text style={styles.placeholderText}>WebView temporarily disabled</Text>
                </View>
            )}
            <View style={styles.footer}>
                {footer && (
                    <Text style={styles.footerText}>{`Confidence: ${footer.confidence} | Confusion: ${footer.confusion} | Intent: ${footer.intent}`}</Text>
                )}
                <View style={styles.inputRow}>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        editable={!isStreaming}
                        placeholder="Ask Sensei anything"
                        style={styles.input}
                    />
                    <TouchableOpacity onPress={handleSubmit} disabled={isStreaming} style={styles.sendButton}>
                        <Text style={styles.buttonText}>Send</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={handleSave} style={styles.secondaryButton}>
                        <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleImport} style={styles.secondaryButton}>
                        <Text style={styles.buttonText}>Load</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => telemetryManager.toggle(!telemetryManager.isEnabled())} style={styles.secondaryButton}>
                        <Text style={styles.buttonText}>{telemetryManager.isEnabled() ? 'Telemetry On' : 'Telemetry Off'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        backgroundColor: 'transparent'
    },
    webviewWrapper: {
        flex: 1
    },
    webview: {
        flex: 1
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
    footer: {
        padding: 12,
        backgroundColor: '#0f0f0f'
    },
    footerText: {
        color: '#94a3b8',
        marginBottom: 8
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    input: {
        flex: 1,
        backgroundColor: '#1f1f1f',
        color: '#fff',
        padding: 12,
        borderRadius: 8
    },
    sendButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#22d3ee',
        borderRadius: 8
    },
    buttonText: {
        color: '#050505',
        fontWeight: '600'
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8
    },
    secondaryButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#1f2937',
        borderRadius: 8
    }
});

export default MainScreen;

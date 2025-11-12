import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { logger } from '../logger';
import { BridgeManager } from './bridge/BridgeManager';
import type { RNToWebMessage, WebToRNMessage, FooterPayload } from './bridge/contracts';
import type { BffClientLike } from './network/types';
import { SelectionOverlay, SelectionOverlayController, SelectionOverlayState } from './SelectionOverlay';

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
    webContentUri: string;
    onWebViewEvent?: (message: WebToRNMessage) => void;
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
    onWebViewEvent
}) => {
    const webViewRef = useRef<WebView>(null);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [footer, setFooter] = useState<FooterPayload | null>(null);
    const [selectionOverlay, setSelectionOverlay] = useState<SelectionOverlayState>({ visible: false });
    const selectionControllerRef = useRef<SelectionOverlayController | null>(null);
    const [webViewFrame, setWebViewFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });

    const webViewSource = useMemo(() => ({ uri: webContentUri }), [webContentUri]);

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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.brand}>Recursive Sensei</Text>
                <TouchableOpacity onPress={() => telemetryManager.toggle(!telemetryManager.isEnabled())}>
                    <Text style={styles.buttonText}>{telemetryManager.isEnabled() ? 'Telemetry On' : 'Telemetry Off'}</Text>
                </TouchableOpacity>
            </View>
            <SelectionOverlay
                state={selectionOverlay}
                webViewFrame={webViewFrame}
                onAction={(actionId, extras) => selectionControllerRef.current?.invoke(actionId, extras)}
                onDismiss={() => selectionControllerRef.current?.dismiss()}
            />
            <WebView
                ref={webViewRef}
                source={webViewSource}
                originWhitelist={['app://', 'file://', 'https://localhost', '*']}
                onMessage={handleWebViewMessage}
                onLayout={event => setWebViewFrame(event.nativeEvent.layout)}
                style={styles.webview}
            />
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
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050505'
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    brand: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600'
    },
    webview: {
        flex: 1
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

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, type LayoutChangeEvent } from 'react-native';

import { logger } from '../logger';
import { BridgeManager } from './bridge/BridgeManager';
import type { DOMRectLike, SelectionSenseiActionId, ViewportSnapshot, WebToRNMessage } from './bridge/contracts';
import { computeSelectionToolbarLayout } from '../../../src/mobile/selectionToolbarLayout';
import { PlatformGlassBackground } from './components/PlatformGlassBackground';

export interface SelectionOverlayState {
    visible: boolean;
    selectionId?: string;
    rect?: DOMRectLike;
    text?: string;
    viewport?: ViewportSnapshot;
}

export interface SelectionOverlayProps {
    state: SelectionOverlayState;
    webViewFrame: LayoutFrame;
    onAction: (actionId: SelectionSenseiActionId, extras?: SelectionInvokeExtras) => void;
    onDismiss: () => void;
}

interface LayoutFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SelectionInvokeExtras {
    actionLabel?: string;
    userQuestion?: string;
}

interface SelectionActionConfig {
    id: SelectionSenseiActionId;
    label: string;
    requiresPrompt?: boolean;
}

const OVERLAY_PADDING_V = 2;
const OVERLAY_PADDING_H = 10;
const TOOLBAR_RADIUS = 24;
const TOOLBAR_FALLBACK_COLOR = 'rgba(8,12,20,0.72)';
const TOOLBAR_TINT_COLOR = 'rgba(8,12,20,0.28)';

const ACTIONS: SelectionActionConfig[] = [
    { id: 'explainSimpler', label: 'Simpler' },
    { id: 'explainWithAnalogy', label: 'Analogy' },
    { id: 'explainInMoreDepth', label: 'Depth' },
    { id: 'showAnExample', label: 'Example' },
    { id: 'showExampleCodeSnippet', label: 'Code' },
    { id: 'askQuestion', label: 'Ask', requiresPrompt: true },
    { id: 'addToNotepad', label: 'Add to Notepad' }
];

export class SelectionOverlayController {
    private state: SelectionOverlayState = { visible: false };
    private readonly bridge: BridgeManager;
    private readonly onChange: (state: SelectionOverlayState) => void;

    constructor(options: { bridge: BridgeManager; onChange: (state: SelectionOverlayState) => void }) {
        this.bridge = options.bridge;
        this.onChange = options.onChange;
    }

    handleWebMessage(message: WebToRNMessage): void {
        if (message.type === 'selection') {
            this.state = {
                visible: true,
                selectionId: `${message.rect.x}-${message.rect.y}-${Date.now()}`,
                rect: message.rect,
                text: message.text,
                viewport: message.viewport
            };
            this.onChange(this.state);
        } else if (message.type === 'selection:clear') {
            this.dismiss();
        }
    }

    invoke(actionId: SelectionSenseiActionId, extras?: SelectionInvokeExtras): void {
        if (!this.state.selectionId) {
            return;
        }
        logger.info('[MOBILE_PORT_SELECTION] bridge invoke', {
            actionId,
            hasQuestion: !!extras?.userQuestion,
            label: extras?.actionLabel
        });
        this.bridge.enqueue({
            type: 'selectionSensei:invoke',
            actionId,
            selectionId: this.state.selectionId,
            actionLabel: extras?.actionLabel,
            userQuestion: extras?.userQuestion
        });
        this.dismiss();
    }

    dismiss(): void {
        if (!this.state.visible) {
            return;
        }
        this.state = { visible: false };
        this.onChange(this.state);
    }
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ state, webViewFrame, onAction }) => {
    const [askVisible, setAskVisible] = useState(false);
    const [askText, setAskText] = useState('');
    const [toolbarSize, setToolbarSize] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        if (!state.visible && askVisible) {
            setAskVisible(false);
            setAskText('');
        }
    }, [state.visible, askVisible]);

    const layout = useMemo(() => {
        if (!state.visible || !state.rect || !state.viewport) {
            return null;
        }
        if (!toolbarSize || webViewFrame.width <= 0 || webViewFrame.height <= 0) {
            return null;
        }
        return computeSelectionToolbarLayout({
            selectionRect: state.rect,
            viewport: state.viewport,
            webViewFrame,
            toolbarSize
        });
    }, [state.visible, state.rect, state.viewport, toolbarSize, webViewFrame]);

    const overlayTransform = useMemo(() => {
        if (!layout || !toolbarSize) {
            return undefined;
        }
        if (layout.scale === 1) {
            return undefined;
        }
        const translateX = -((toolbarSize.width * (1 - layout.scale)) / 2);
        const translateY = -((toolbarSize.height * (1 - layout.scale)) / 2);
        return [{ scale: layout.scale }, { translateX }, { translateY }];
    }, [layout, toolbarSize]);

    const handleToolbarLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setToolbarSize(prev => {
            if (!prev) {
                return { width, height };
            }
            const deltaW = Math.abs(prev.width - width);
            const deltaH = Math.abs(prev.height - height);
            if (deltaW < 0.5 && deltaH < 0.5) {
                return prev;
            }
            return { width, height };
        });
    };

    const handleActionPress = (action: SelectionActionConfig) => {
        if (action.requiresPrompt) {
            setAskVisible(true);
            setAskText('');
            return;
        }
        onAction(action.id, { actionLabel: action.label });
    };

    const submitAsk = () => {
        const question = askText.trim();
        if (!question) {
            return;
        }
        onAction('askQuestion', { actionLabel: 'Ask', userQuestion: question });
        setAskVisible(false);
        setAskText('');
    };

    const toolbarContent = (
        <>
            <View style={styles.actionsRow}>
                {ACTIONS.flatMap((action, index) => {
                    const disabled = askVisible;
                    const isNotepad = action.id === 'addToNotepad';
                    const isAsk = action.id === 'askQuestion';
                    const showDivider = index < ACTIONS.length - 1;
                    const button = (
                        <TouchableOpacity
                            key={action.id}
                            accessibilityLabel={action.label}
                            onPress={() => handleActionPress(action)}
                            style={[
                                styles.actionButton,
                                isNotepad || isAsk ? styles.coloredSectionButton : null,
                                disabled ? styles.disabledButton : null
                            ]}
                            disabled={disabled}
                        >
                            {isAsk || isNotepad ? (
                                <View
                                    pointerEvents="none"
                                    style={[
                                        styles.coloredSectionBackground,
                                        isAsk ? styles.askSectionBackground : null,
                                        isNotepad ? styles.notepadSectionBackground : null
                                    ]}
                                />
                            ) : null}
                            <Text
                                style={[
                                    styles.actionText,
                                    isNotepad || isAsk ? styles.coloredActionText : null,
                                    disabled ? styles.disabledText : null
                                ]}
                            >
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    );
                    if (!showDivider) {
                        return [button];
                    }
                    return [button, <View key={`${action.id}-divider`} style={styles.actionDivider} />];
                })}
            </View>
            {askVisible && (
                <View style={styles.askContainer}>
                    <TextInput
                        value={askText}
                        onChangeText={setAskText}
                        placeholder="Ask a question about the text..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        style={styles.askInput}
                    />
                    <TouchableOpacity onPress={submitAsk} style={styles.askSendButton}>
                        <Text style={styles.askSendText}>Send</Text>
                    </TouchableOpacity>
                </View>
            )}
        </>
    );

    return (
        <View
            onLayout={handleToolbarLayout}
            pointerEvents={layout ? 'auto' : 'none'}
            style={[
                styles.overlayWrap,
                layout ? { top: layout.top, left: layout.left, opacity: 1 } : { top: 0, left: 0, opacity: 0 },
                overlayTransform ? { transform: overlayTransform } : null
            ]}
        >
            {layout ? (
                <PlatformGlassBackground
                    key={state.selectionId ?? 'selection-toolbar-visible'}
                    style={styles.overlaySurface}
                    testID="selection-toolbar-glass-background"
                    borderRadius={TOOLBAR_RADIUS}
                    fallbackColor={TOOLBAR_FALLBACK_COLOR}
                    tintColor={TOOLBAR_TINT_COLOR}
                    effect="clear"
                    colorScheme="dark"
                >
                    {toolbarContent}
                </PlatformGlassBackground>
            ) : (
                <View style={styles.overlaySurface}>
                    {toolbarContent}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    overlayWrap: {
        position: 'absolute',
        zIndex: 2010,
        elevation: 2010,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 }
    },
    overlaySurface: {
        backgroundColor: 'transparent',
        borderRadius: TOOLBAR_RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.22)',
        overflow: 'hidden',
        paddingVertical: OVERLAY_PADDING_V,
        paddingHorizontal: OVERLAY_PADDING_H
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 10
    },
    coloredSectionButton: {
        borderRadius: 0
    },
    coloredSectionBackground: {
        position: 'absolute',
        top: -OVERLAY_PADDING_V,
        bottom: -OVERLAY_PADDING_V,
        left: 0,
        right: 0
    },
    actionDivider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(148, 163, 184, 0.22)',
        marginHorizontal: 0,
        marginVertical: -OVERLAY_PADDING_V
    },
    askSectionBackground: {
        backgroundColor: 'rgba(245,158,11,0.4)'
    },
    notepadSectionBackground: {
        backgroundColor: 'rgba(59,130,246,0.4)',
        right: -OVERLAY_PADDING_H
    },
    coloredActionText: {
        color: '#ffffff'
    },
    disabledButton: {
        opacity: 0.35
    },
    disabledText: {
        opacity: 0.6
    },
    askContainer: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    askInput: {
        flexGrow: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
        fontSize: 13,
        color: '#e2e8f0',
        backgroundColor: 'rgba(2, 6, 23, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.22)',
        borderRadius: 18,
        textAlignVertical: 'top'
    },
    askSendButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: '#C4E538',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)'
    },
    askSendText: {
        color: '#0f172a',
        fontSize: 12,
        fontWeight: '700'
    }
});

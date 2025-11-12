import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Dimensions } from 'react-native';

import { logger } from '../logger';
import { BridgeManager } from './bridge/BridgeManager';
import type { DOMRectLike, SelectionSenseiActionId, ViewportSnapshot, WebToRNMessage } from './bridge/contracts';

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

const UTILITY_ACTIONS: SelectionActionConfig[] = [
    { id: 'copy', label: 'Copy' },
    { id: 'share', label: 'Share' }
];

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

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ state, webViewFrame, onAction, onDismiss }) => {
    const [askVisible, setAskVisible] = useState(false);
    const [askText, setAskText] = useState('');

    useEffect(() => {
        if (!state.visible && askVisible) {
            setAskVisible(false);
            setAskText('');
        }
    }, [state.visible, askVisible]);

    const overlayMetrics = useMemo(() => {
        if (!state.rect || !state.viewport) {
            return null;
        }
        const viewport = state.viewport;
        const windowSize = Dimensions.get('window');
        const relativeY = state.rect.y - viewport.scrollY;
        const relativeX = state.rect.x;
        const width = Math.min(state.rect.width, windowSize.width - 16);
        let top = webViewFrame.y + relativeY;
        let left = webViewFrame.x + relativeX;
        top = Math.max(0, Math.min(top, windowSize.height - 48));
        left = Math.max(0, Math.min(left, windowSize.width - width));
        logger.info('[MOBILE_PORT_SELECTION] overlay align', {
            rectY: state.rect.y,
            viewportScrollY: viewport.scrollY,
            screenTop: top
        });
        return { top, left, width };
    }, [state.rect, state.viewport, webViewFrame.x, webViewFrame.y, webViewFrame.width, webViewFrame.height]);

    if (!state.visible || !state.rect || !overlayMetrics) {
        return null;
    }

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

    return (
        <View style={[styles.overlay, { top: overlayMetrics.top, left: overlayMetrics.left, width: overlayMetrics.width }]}>
            <View style={styles.utilityRow}>
                {UTILITY_ACTIONS.map(action => (
                    <TouchableOpacity
                        key={action.id}
                        accessibilityLabel={action.label}
                        onPress={() => onAction(action.id, { actionLabel: action.label })}
                        style={styles.utilityButton}
                    >
                        <Text style={styles.option}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity accessibilityLabel="Dismiss selection overlay" onPress={onDismiss} style={styles.utilityButton}>
                    <Text style={styles.option}>Close</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.actionsContainer}>
                {ACTIONS.map(action => (
                    <TouchableOpacity
                        key={action.id}
                        accessibilityLabel={action.label}
                        onPress={() => handleActionPress(action)}
                        style={styles.actionButton}
                    >
                        <Text style={styles.option}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {askVisible && (
                <View style={styles.askPrompt}>
                    <TextInput
                        value={askText}
                        onChangeText={setAskText}
                        placeholder="Ask a question about the selection"
                        placeholderTextColor="#94a3b8"
                        multiline
                        style={styles.askInput}
                    />
                    <View style={styles.askPromptActions}>
                        <TouchableOpacity onPress={() => { setAskVisible(false); setAskText(''); }} style={styles.secondaryButton}>
                            <Text style={styles.option}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={submitAsk} style={styles.primaryButton}>
                            <Text style={styles.primaryText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        backgroundColor: '#0f172a',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    actionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center'
    },
    utilityRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        alignItems: 'center'
    },
    option: {
        color: '#e2e8f0',
        fontWeight: '600'
    },
    utilityButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#1f2937',
        borderRadius: 8
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#1f2937',
        borderRadius: 8
    },
    askPrompt: {
        marginTop: 12,
        backgroundColor: '#0b1120',
        borderRadius: 8,
        padding: 12,
        width: '100%'
    },
    askInput: {
        minHeight: 60,
        color: '#f8fafc',
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 10,
        textAlignVertical: 'top'
    },
    askPromptActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8
    },
    primaryButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#22d3ee',
        borderRadius: 8
    },
    secondaryButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#1f2937',
        borderRadius: 8
    },
    primaryText: {
        color: '#031220',
        fontWeight: '600'
    }
});

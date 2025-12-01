import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { CodeEditorBadge } from './CodeEditorBadge';
import { SendIconSkia } from './SendIconSkia';
import { logger } from '../../logger';

const INPUT_LINE_HEIGHT = 20;
const INPUT_VERTICAL_PADDING = 10;

interface InputBarProps {
    onSubmit?: (text: string) => void;
    onOpenEditor?: () => void;
    onLayoutRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onOpenEditor, onLayoutRect }) => {
    const [text, setText] = useState('');
    const [inputHeight, setInputHeight] = useState(44);
    const [scrollEnabled, setScrollEnabled] = useState(false);
    const inputRef = useRef<TextInput | null>(null);
    const wrapperRef = useRef<View | null>(null);
    const inputContainerRef = useRef<View | null>(null);

    const minHeight = 44;
    const maxHeight = 130;

    const handleSubmit = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;
        try {
            onSubmit?.(trimmed);
        } finally {
            setText('');
        }
    }, [onSubmit, text]);

    const measureRect = useCallback(() => {
        const node: any = wrapperRef.current;
        if (!node || typeof node.measureInWindow !== 'function') return;
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
            if (!w || !h) return;
            logger.info('Sensei(debug)', { tag: 'inputBar.rect', x, y, w, h });
            onLayoutRect?.({ x, y, width: w, height: h });
        });
    }, [onLayoutRect]);

    const handleContentSizeChange = useCallback(
        (event: any) => {
        const raw = Math.round(event.nativeEvent.contentSize.height);
        const next = text.length === 0 ? minHeight : Math.min(maxHeight, Math.max(minHeight, raw));
        if (Math.abs(next - inputHeight) > 0.5) {
            setInputHeight(next);
        }
            setScrollEnabled(next >= maxHeight);
            logger.info('Sensei(debug)', { tag: 'inputField.contentSize', raw, next, textLength: text.length });
        },
        [inputHeight, maxHeight, minHeight, text.length]
    );

    useEffect(() => {
        if (text.length === 0) {
            setInputHeight(minHeight);
            setScrollEnabled(false);
        }
    }, [minHeight, text.length]);

    const editorSize = 26;

    return (
        <View ref={wrapperRef} style={styles.wrapper} onLayout={measureRect}>
            <View ref={inputContainerRef} style={styles.inputContainer}>
                <View style={styles.fieldFrame}>
                    {Platform.OS === 'ios' ? (
                        <BlurView
                            style={styles.fieldBlur}
                            blurType="dark"
                            blurAmount={28}
                            reducedTransparencyFallbackColor="rgba(8,12,20,0.7)"
                            pointerEvents="none"
                        />
                    ) : null}
                    <TextInput
                        ref={inputRef}
                        value={text}
                        onChangeText={setText}
                        placeholder="Ask Sensei a question or type your thoughts..."
                    multiline={true}
                    scrollEnabled={scrollEnabled}
                    onContentSizeChange={handleContentSizeChange}
                    textAlignVertical="top"
                    style={[styles.textInput, { minHeight, maxHeight }]}
                        placeholderTextColor={'rgba(148,163,184,0.65)'}
                        selectionColor={'#22d3ee'}
                        returnKeyType={'default'}
                        blurOnSubmit={false}
                    />
                </View>
            </View>
            <View style={styles.actions}>
                <View style={styles.sendStack}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        onPress={handleSubmit}
                        style={styles.sendButton}
                    >
                        <SendIconSkia size={14} />
                    </TouchableOpacity>
                    <View style={[styles.editorOverlay, { top: -6, right: -17 }]}>
                        <CodeEditorBadge size={editorSize} onPress={onOpenEditor} />
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 0,
        marginBottom: 10,
        width: '98%',
        alignSelf: 'center',
        backgroundColor: 'transparent',
        gap: 10
    },
    inputContainer: {
        flex: 1,
        maxWidth: '100%',
        marginLeft: 0,
        marginRight: 0
    },
    textInput: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: INPUT_VERTICAL_PADDING,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16,
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: INPUT_LINE_HEIGHT
    },
    fieldFrame: {
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden'
    },
    fieldBlur: {
        ...StyleSheet.absoluteFillObject
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        marginRight: 20
    },
    sendStack: {
        position: 'relative',
        paddingRight: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    sendButton: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: '#10b981',
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10b981',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }
    },
    sendButtonText: {
        color: '#050505',
        fontWeight: '600'
    },
    editorOverlay: {
        position: 'absolute'
    }
});

export default InputBar;

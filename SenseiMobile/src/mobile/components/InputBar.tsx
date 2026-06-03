import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { CodeEditorBadge } from './CodeEditorBadge';
import { PlatformGlassBackground } from './PlatformGlassBackground';
import { SendIconSkia } from './SendIconSkia';
import { logger } from '../../logger';
import {
    ThemeColors,
    DEFAULT_THEME_COLORS,
    DEFAULT_SEND_GRADIENT,
    withAlpha,
    lightenColor,
    ensureReadable,
    shiftHue,
    deriveSendGradient
} from '../theme/gradients';

const INPUT_LINE_HEIGHT = 20;
const INPUT_VERTICAL_PADDING = 10;
const DEFAULT_SEND_BASE = '#0b231b';
const DEFAULT_SEND_BORDER = 'rgba(16,185,129,0.35)';
const FIELD_RADIUS = 16;
const FIELD_FALLBACK_COLOR = 'rgba(0,0,0,0.70)';
const FIELD_TINT_COLOR = 'rgba(0,0,0,0.70)';

interface InputBarProps {
    onSubmit?: (text: string) => boolean | void | Promise<boolean | void>;
    onOpenEditor?: () => void;
    onLayoutRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
    themeColors?: ThemeColors;
    disabled?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onOpenEditor, onLayoutRect, themeColors, disabled = false }) => {
    const [text, setText] = useState('');
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const inputRef = useRef<TextInput | null>(null);
    const wrapperRef = useRef<View | null>(null);
    const inputContainerRef = useRef<View | null>(null);

    const minHeight = 44;
    const maxHeight = 110;

    const handleSubmit = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        let result: boolean | void | Promise<boolean | void>;
        try {
            result = onSubmit?.(trimmed);
        } catch (error) {
            logger.error('Sensei(debug)', { tag: 'inputbar.submit.error', error: error instanceof Error ? error.message : String(error) });
            return;
        }
        if (result && typeof (result as Promise<boolean | void>).then === 'function') {
            void Promise.resolve(result)
                .then(accepted => {
                    if (accepted !== false) {
                        setText('');
                    }
                })
                .catch(error => {
                    logger.error('Sensei(debug)', { tag: 'inputbar.submit.error', error: error instanceof Error ? error.message : String(error) });
                });
            return;
        }
        if (result !== false) {
            setText('');
        }
    }, [disabled, onSubmit, text]);

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
            logger.info('Sensei(debug)', { tag: 'inputField.contentSize', raw, next, textLength: text.length });
        },
        [maxHeight, minHeight, text.length]
    );

    useEffect(() => {
        // no height reset required when text clears in this configuration
    }, [text.length]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => {
            setIsKeyboardVisible(true);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const editorSize = 26;

    const sendGradientColors = useMemo(() => deriveSendGradient(themeColors), [themeColors]);

    const sendBaseColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_BASE;
        return ensureReadable(lightenColor(base, -0.05, DEFAULT_SEND_BASE), DEFAULT_SEND_BASE);
    }, [themeColors]);

    const sendBorderColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_BORDER;
        return ensureReadable(withAlpha(lightenColor(base, 0.05, DEFAULT_SEND_BORDER), 0.7), DEFAULT_SEND_BORDER);
    }, [themeColors]);

    const innerRingColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const shifted = shiftHue(base, 0.5, '#ffffff');
        return ensureReadable(lightenColor(shifted, 0.25, '#ffffff'), '#ffffff');
    }, [themeColors]);

    return (
        <View ref={wrapperRef} style={styles.wrapper} onLayout={measureRect}>
            <View ref={inputContainerRef} style={[styles.inputContainer, isKeyboardVisible && styles.inputContainerKeyboardVisible]}>
                <PlatformGlassBackground
                    testID="input-bar-glass-background"
                    style={styles.fieldFrame}
                    borderRadius={FIELD_RADIUS}
                    fallbackColor={FIELD_FALLBACK_COLOR}
                    tintColor={FIELD_TINT_COLOR}
                    effect="clear"
                    colorScheme="dark"
                >
                    <TextInput
                        ref={inputRef}
                        value={text}
                        onChangeText={setText}
                        editable={!disabled}
                        placeholder="Ask Sensei a question or type your thoughts..."
                        multiline={true}
                        scrollEnabled={true}
                        // @ts-ignore
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="white"
                        keyboardAppearance="dark"
                        // @ts-ignore
                        overrideUserInterfaceStyle="dark"
                        onContentSizeChange={handleContentSizeChange}
                        textAlignVertical="top"
                        style={[styles.textInput, { minHeight, maxHeight }]}
                        placeholderTextColor={'rgba(148,163,184,0.65)'}
                        selectionColor={'#22d3ee'}
                        returnKeyType={'default'}
                        blurOnSubmit={false}
                    />
                </PlatformGlassBackground>
            </View>
            <View style={[styles.actions, isKeyboardVisible && styles.actionsKeyboardVisible]}>
                <View style={[styles.sendStack, isKeyboardVisible && styles.sendStackKeyboardVisible]}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        onPress={handleSubmit}
                        disabled={disabled}
                        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
                    >
                        <View style={[styles.sendLayerBase, { backgroundColor: sendBaseColor }]} />
                        <LinearGradient
                            colors={sendGradientColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.sendGradient, { borderColor: sendBorderColor }]}
                        />
                        <View style={[styles.sendIconWell, { borderColor: innerRingColor }]}>
                            <SendIconSkia size={14} />
                        </View>
                    </TouchableOpacity>
                    {!isKeyboardVisible && (
                        <View style={[styles.editorOverlay, { top: -6, right: -17 }]}>
                            <CodeEditorBadge
                                size={editorSize}
                                onPress={onOpenEditor}
                                themeColors={themeColors}
                                borderColorOverride={innerRingColor}
                            />
                        </View>
                    )}
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
        marginLeft: 15,
        marginRight: 0
    },
    inputContainerKeyboardVisible: {
        marginLeft: 0
    },
    textInput: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: INPUT_VERTICAL_PADDING,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: FIELD_RADIUS,
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: INPUT_LINE_HEIGHT,
        textAlignVertical: 'top'
    },
    fieldFrame: {
        position: 'relative',
        borderRadius: FIELD_RADIUS,
        overflow: 'hidden',
        backgroundColor: 'transparent'
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        marginRight: 20
    },
    actionsKeyboardVisible: {
        marginRight: 8
    },
    sendStack: {
        position: 'relative',
        paddingRight: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    sendStackKeyboardVisible: {
        paddingRight: 4
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.7,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        overflow: 'visible'
    },
    sendButtonDisabled: {
        opacity: 0.45
    },
    sendLayerBase: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
        backgroundColor: '#0b231b'
    },
    sendGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(16,185,129,0.35)'
    },
    sendIconWell: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center'
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

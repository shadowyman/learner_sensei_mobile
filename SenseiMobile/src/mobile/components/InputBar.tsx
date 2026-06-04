import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { CodeEditorBadge } from './CodeEditorBadge';
import { PlatformGlassBackground } from './PlatformGlassBackground';
import { SendIconSkia, SendOrbRingSkia, SendOrbSheenSkia } from './SendIconSkia';
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
const FIELD_RADIUS = 16;
const FIELD_FALLBACK_COLOR = 'rgba(0,0,0,0.70)';
const FIELD_TINT_COLOR = 'rgba(0,0,0,0.70)';

const setColorAlpha = (color: string, alpha: number, fallback: string): string => {
    const hexMatch = color.trim().match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
        const raw = hexMatch[1];
        const expanded = raw.length === 3 || raw.length === 4 ? raw.slice(0, 3).split('').map(char => char + char).join('') : raw.slice(0, 6);
        const r = parseInt(expanded.slice(0, 2), 16);
        const g = parseInt(expanded.slice(2, 4), 16);
        const b = parseInt(expanded.slice(4, 6), 16);
        if (![r, g, b].some(value => Number.isNaN(value))) {
            return `rgba(${r},${g},${b},${alpha})`;
        }
    }
    const rgbaMatch = color.match(/rgba?\s*\(([^)]+)\)/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(part => part.trim());
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        if (![r, g, b].some(value => Number.isNaN(value))) {
            return `rgba(${r},${g},${b},${alpha})`;
        }
    }
    return fallback;
};

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
    const [isInputFocused, setIsInputFocused] = useState(false);
    const inputRef = useRef<TextInput | null>(null);
    const wrapperRef = useRef<View | null>(null);
    const inputContainerRef = useRef<View | null>(null);
    const { width: viewportWidth } = useWindowDimensions();

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
    const isPad = Platform.OS === 'ios' && (Platform as any).isPad;
    const isCompactIOS = Platform.OS === 'ios' && !isPad && viewportWidth <= 430;

    const sendMetrics = useMemo(() => {
        if (isPad) {
            return {
                button: 56,
                radius: 28,
                innerWell: 36,
                icon: 16,
                editorTop: -8,
                editorRight: -12,
                highlightTop: 11,
                highlightLeft: 14,
                highlightWidth: 23,
                highlightHeight: 10,
                shadowRadius: 7
            };
        }
        if (isCompactIOS) {
            return {
                button: 46,
                radius: 23,
                innerWell: 28,
                icon: 14,
                editorTop: -6,
                editorRight: -15,
                highlightTop: 8,
                highlightLeft: 11,
                highlightWidth: 18,
                highlightHeight: 8,
                shadowRadius: 5
            };
        }
        return {
            button: 52,
            radius: 26,
            innerWell: 32,
            icon: 15,
            editorTop: -7,
            editorRight: -14,
            highlightTop: 9,
            highlightLeft: 12,
            highlightWidth: 21,
            highlightHeight: 9,
            shadowRadius: 6
        };
    }, [isCompactIOS, isPad]);

    const sendGradientColors = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const derived = deriveSendGradient(themeColors);
        const deep = ensureReadable(lightenColor(base, 0.08, DEFAULT_SEND_BASE), DEFAULT_SEND_BASE);
        return [derived[0], derived[1], deep];
    }, [themeColors]);

    const sendBaseColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_BASE;
        return ensureReadable(lightenColor(base, -0.05, DEFAULT_SEND_BASE), DEFAULT_SEND_BASE);
    }, [themeColors]);

    const sendRingGradientColors = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const bright = ensureReadable(lightenColor(shiftHue(base, 0.04, DEFAULT_SEND_GRADIENT[0]), 0.46, DEFAULT_SEND_GRADIENT[0]), DEFAULT_SEND_GRADIENT[0]);
        const middle = ensureReadable(lightenColor(base, 0.26, DEFAULT_SEND_GRADIENT[1]), DEFAULT_SEND_GRADIENT[1]);
        const deep = ensureReadable(lightenColor(shiftHue(base, -0.04, DEFAULT_SEND_GRADIENT[2]), 0.12, DEFAULT_SEND_GRADIENT[2]), DEFAULT_SEND_GRADIENT[2]);
        return [
            setColorAlpha(bright, 0.28, 'rgba(255,255,255,0.2)'),
            setColorAlpha(middle, 0.18, 'rgba(255,255,255,0.13)'),
            setColorAlpha(deep, 0.09, 'rgba(255,255,255,0.075)')
        ];
    }, [themeColors]);

    const innerRingColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const shifted = shiftHue(base, 0.5, '#ffffff');
        return ensureReadable(lightenColor(shifted, 0.25, '#ffffff'), '#ffffff');
    }, [themeColors]);

    const sendWellColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const editorMiddle = ensureReadable(lightenColor(base, 0.4, DEFAULT_SEND_GRADIENT[1]), DEFAULT_SEND_GRADIENT[1]);
        return setColorAlpha(lightenColor(editorMiddle, -0.08, 'rgba(255,255,255,0.08)'), 0.62, 'rgba(255,255,255,0.08)');
    }, [themeColors]);

    const inputOuterBorderColor = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.radialB ?? resolved.linear?.[1] ?? 'rgba(94,234,212,0.18)';
        return setColorAlpha(base, isInputFocused ? 0.34 : 0.20, 'rgba(94,234,212,0.18)');
    }, [isInputFocused, themeColors]);

    const inputInnerBorderColor = isInputFocused ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.075)';

    return (
        <View ref={wrapperRef} style={styles.wrapper} onLayout={measureRect}>
            <View ref={inputContainerRef} style={[styles.inputContainer, isKeyboardVisible && styles.inputContainerKeyboardVisible]}>
                <PlatformGlassBackground
                    testID="input-bar-glass-background"
                    style={[styles.fieldFrame, { borderColor: inputOuterBorderColor }]}
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
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        textAlignVertical="top"
                        style={[styles.textInput, { minHeight, maxHeight, borderColor: inputInnerBorderColor }]}
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
                        style={[
                            styles.sendButton,
                            {
                                width: sendMetrics.button,
                                height: sendMetrics.button,
                                borderRadius: sendMetrics.radius,
                                shadowRadius: sendMetrics.shadowRadius,
                                backgroundColor: sendBaseColor
                            },
                            disabled && styles.sendButtonDisabled
                        ]}
                    >
                        <LinearGradient
                            colors={sendGradientColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[
                                styles.sendOrbGradient,
                                {
                                    borderRadius: sendMetrics.radius
                                }
                            ]}
                        />
                        <View pointerEvents="none" style={[styles.sendOrbSheen, { width: sendMetrics.button, height: sendMetrics.button }]}>
                            <SendOrbSheenSkia size={sendMetrics.button} />
                        </View>
                        <View pointerEvents="none" style={[styles.sendOrbRing, { width: sendMetrics.button, height: sendMetrics.button }]}>
                            <SendOrbRingSkia size={sendMetrics.button} colors={sendRingGradientColors} />
                        </View>
                        <View
                            style={[
                                styles.sendIconWell,
                                {
                                    width: sendMetrics.innerWell,
                                    height: sendMetrics.innerWell,
                                    borderRadius: sendMetrics.innerWell / 2,
                                    borderColor: innerRingColor,
                                    backgroundColor: sendWellColor
                                }
                            ]}
                        >
                            <SendIconSkia size={sendMetrics.icon} />
                        </View>
                    </TouchableOpacity>
                    {!isKeyboardVisible && (
                        <View style={[styles.editorOverlay, { top: sendMetrics.editorTop, right: sendMetrics.editorRight }]}>
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
        borderWidth: 1,
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
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.7,
        shadowOffset: { width: 0, height: 2 },
        overflow: 'visible'
    },
    sendButtonDisabled: {
        opacity: 0.45
    },
    sendOrbGradient: {
        ...StyleSheet.absoluteFillObject,
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }
    },
    sendOrbRing: {
        position: 'absolute',
        top: 0,
        left: 0
    },
    sendOrbSheen: {
        position: 'absolute',
        top: 0,
        left: 0
    },
    sendIconWell: {
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 }
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

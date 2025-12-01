import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-community/blur';
import { CodeEditorBadge } from './CodeEditorBadge';
import { SendIconSkia } from './SendIconSkia';
import { logger } from '../../logger';

const INPUT_LINE_HEIGHT = 20;
const INPUT_VERTICAL_PADDING = 10;

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

const DEFAULT_SEND_GRADIENT = ['#19c88f', '#0fb981', '#0ca672'];
const DEFAULT_SEND_BASE = '#0b231b';
const DEFAULT_SEND_BORDER = 'rgba(16,185,129,0.35)';

interface InputBarProps {
    onSubmit?: (text: string) => void;
    onOpenEditor?: () => void;
    onLayoutRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
    themeColors?: ThemeColors;
}

function withAlpha(color: string, minAlpha: number): string {
    const match = color.match(/rgba?\s*\(([^)]+)\)/i);
    if (!match) return color;
    const parts = match[1].split(',').map(part => part.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some(v => Number.isNaN(v))) return color;
    const alpha = Math.max(minAlpha, parts[3] !== undefined ? parseFloat(parts[3]) : 1);
    return `rgba(${r},${g},${b},${alpha})`;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
    const hex = color.trim();
    const hexMatch = hex.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
        const raw = hexMatch[1];
        if (raw.length === 3 || raw.length === 4) {
            const r = parseInt(raw[0] + raw[0], 16);
            const g = parseInt(raw[1] + raw[1], 16);
            const b = parseInt(raw[2] + raw[2], 16);
            return { r, g, b };
        }
        if (raw.length >= 6) {
            const r = parseInt(raw.slice(0, 2), 16);
            const g = parseInt(raw.slice(2, 4), 16);
            const b = parseInt(raw.slice(4, 6), 16);
            if ([r, g, b].some(v => Number.isNaN(v))) return null;
            return { r, g, b };
        }
    }
    const rgbaMatch = color.match(/rgba?\s*\(([^)]+)\)/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(p => p.trim());
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        if ([r, g, b].some(v => Number.isNaN(v))) return null;
        return { r, g, b };
    }
    return null;
}

function luminance(color: string): number {
    const parsed = parseColor(color);
    if (!parsed) return 0;
    const norm = ['r', 'g', 'b'].map(k => {
        const v = (parsed as any)[k] / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function ensureReadable(color: string, fallback: string): string {
    return luminance(color) < 0.05 ? fallback : color;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
        case rn:
            h = (gn - bn) / d + (gn < bn ? 6 : 0);
            break;
        case gn:
            h = (bn - rn) / d + 2;
            break;
        default:
            h = (rn - gn) / d + 4;
            break;
    }
    h /= 6;
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue(p, q, h) * 255);
    const b = Math.round(hue(p, q, h - 1 / 3) * 255);
    return { r, g, b };
}

function lightenColor(color: string, amount: number, fallback: string): string {
    const parsed = parseColor(color);
    if (!parsed) return fallback;
    const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
    const nextL = Math.min(1, Math.max(0, amount >= 0 ? l + (1 - l) * amount : l + amount));
    const { r, g, b } = hslToRgb(h, s, nextL);
    return `rgba(${r},${g},${b},1)`;
}

function shiftHue(color: string, delta: number, fallback: string): string {
    const parsed = parseColor(color);
    if (!parsed) return fallback;
    const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
    let hh = h + delta;
    if (hh < 0) hh += 1;
    if (hh > 1) hh -= 1;
    const { r, g, b } = hslToRgb(hh, s, l);
    return `rgba(${r},${g},${b},1)`;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onOpenEditor, onLayoutRect, themeColors }) => {
    const [text, setText] = useState('');
    const inputRef = useRef<TextInput | null>(null);
    const wrapperRef = useRef<View | null>(null);
    const inputContainerRef = useRef<View | null>(null);

    const minHeight = 44;
    const maxHeight = 110;

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
            logger.info('Sensei(debug)', { tag: 'inputField.contentSize', raw, next, textLength: text.length });
        },
        [maxHeight, minHeight, text.length]
    );

    useEffect(() => {
        // no height reset required when text clears in this configuration
    }, [text.length]);

    const editorSize = 26;

    const sendGradientColors = useMemo(() => {
        const resolved = themeColors ?? DEFAULT_THEME_COLORS;
        const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
        const primary = ensureReadable(lightenColor(base, 0.55, DEFAULT_SEND_GRADIENT[0]), DEFAULT_SEND_GRADIENT[0]);
        const secondary = ensureReadable(lightenColor(base, 0.35, DEFAULT_SEND_GRADIENT[1]), DEFAULT_SEND_GRADIENT[1]);
        const tertiary = ensureReadable(lightenColor(base, 0.2, DEFAULT_SEND_GRADIENT[2]), DEFAULT_SEND_GRADIENT[2]);
        return [primary, secondary, tertiary];
    }, [themeColors]);

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
            <View ref={inputContainerRef} style={styles.inputContainer}>
                <View style={styles.fieldFrame}>
                    {Platform.OS === 'ios' ? (
                        <BlurView
                            style={styles.fieldBlur}
                            blurType="systemUltraThinMaterialDark"
                            blurAmount={1}
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
                </View>
            </View>
            <View style={styles.actions}>
                <View style={styles.sendStack}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        onPress={handleSubmit}
                        style={styles.sendButton}
                        activeOpacity={0.9}
                    >
                        <View style={[styles.sendLayerBase, { backgroundColor: sendBaseColor }]} />
                        <LinearGradient
                            colors={sendGradientColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.sendGradient, { borderColor: sendBorderColor }]}
                        />
                        <View style={[styles.sendInnerRing, { borderColor: innerRingColor }]} />
                        <SendIconSkia size={14} />
                    </TouchableOpacity>
                    <View style={[styles.editorOverlay, { top: -6, right: -17 }]}>
                        <CodeEditorBadge
                            size={editorSize}
                            onPress={onOpenEditor}
                            themeColors={themeColors}
                            borderColorOverride={innerRingColor}
                        />
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
        lineHeight: INPUT_LINE_HEIGHT,
        textAlignVertical: 'top'
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
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.7,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        overflow: 'visible'
    },
    sendLayerBase: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 19,
        backgroundColor: '#0b231b'
    },
    sendGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.35)'
    },
    sendInnerRing: {
        position: 'absolute',
        left: 6,
        right: 6,
        top: 6,
        bottom: 6,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)'
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
